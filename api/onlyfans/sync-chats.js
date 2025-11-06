import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function cleanHTML(text) {
  if (!text) return ''
  return text
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, modelId, offset = 0 } = req.body
  const messagesLimit = 50 // Últimos 50 mensajes por chat
  const chatsLimit = 20 // 20 chats por request

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    let syncedMessages = 0
    let totalChats = 0
    let skippedInactive = 0
    let skippedNoConversation = 0
    let creditsUsed = 0

    // Fetch chats
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats?limit=${chatsLimit}&offset=${offset}`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      
      if (response.status === 401 || response.status === 403) {
        await supabase
          .from('models')
          .update({ connection_status: 'disconnected' })
          .eq('model_id', modelId)
        
        return res.status(401).json({
          error: 'Authentication failed',
          needsReauth: true
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    const chats = responseData.data || []
    const hasMore = responseData._pagination?.next_page ? true : false
    totalChats = chats.length
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log(`💬 Fetched ${chats.length} chats at offset ${offset}`)

    // Calculate 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    for (const chat of chats) {
      const fanData = chat.fan
      const fanId = fanData?.id?.toString()
      
      if (!fanId) continue

      // FILTER 1: Skip if inactive (>30 days)
      if (chat.lastMessage?.createdAt) {
        const lastMessageDate = new Date(chat.lastMessage.createdAt)
        if (lastMessageDate < thirtyDaysAgo) {
          console.log(`  ⏭️ Skip fan ${fanId}: inactive >30 days`)
          skippedInactive++
          continue
        }
      }

      // Fetch messages
      try {
        const messagesResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/chats/${fanId}/messages?limit=${messagesLimit}`,
          { headers: { 'Authorization': `Bearer ${API_KEY}` } }
        )

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          const messages = messagesData.data || []
          creditsUsed += messagesData._meta?._credits?.used || 1

          // FILTER 2: Skip if no fan messages (only model spam)
          const hasFanMessages = messages.some(msg => !msg.isSentByMe)

          if (!hasFanMessages) {
            console.log(`  ⏭️ Skip fan ${fanId}: no conversation (only model spam)`)
            skippedNoConversation++
            continue
          }

          console.log(`  ✅ Fan ${fanId}: ${messages.length} messages (real conversation)`)

          for (const msg of messages) {
            // Generate messageId if null
            const messageId = msg.id?.toString() || 
              `generated_${fanId}_${msg.createdAt}_${Math.random().toString(36).substr(2, 9)}`
            
            const chatData = {
              fan_id: fanId,
              message: cleanHTML(msg.text),
              model_id: modelId,
              timestamp: msg.createdAt || new Date().toISOString(),
              from: msg.isSentByMe ? 'model' : 'fan',
              message_type: msg.mediaCount > 0 ? 'media' : 'text',
              of_message_id: messageId,
              media_url: msg.media?.[0]?.files?.full?.url || msg.media?.[0]?.files?.thumb?.url,
              media_urls: msg.media?.map(m => m.files?.full?.url || m.files?.thumb?.url).filter(Boolean).join(','),
              amount: parseFloat(msg.price || 0),
              read: msg.isOpened || false,
              source: 'api_sync',
              is_locked: !msg.isFree,
              is_purchased: msg.canPurchaseReason === 'purchased' || msg.canPurchaseReason === 'opened' || msg.isFree,
              locked_text: msg.lockedText || false
            }

            const { error } = await supabase
              .from('chat')
              .upsert(chatData, { onConflict: 'of_message_id,model_id' })

            if (!error) syncedMessages++
            else console.error('❌ Error saving message:', msg.id, error)
          }
        }
      } catch (msgError) {
        console.error(`💥 Error for fan ${fanId}:`, msgError)
      }
    }

    console.log(`✅ Complete: ${syncedMessages} msgs, skipped ${skippedInactive} inactive + ${skippedNoConversation} no-conversation`)

    return res.status(200).json({
      success: true,
      syncedMessages,
      totalChats,
      skippedInactive,
      skippedNoConversation,
      hasMore,
      nextOffset: hasMore ? offset + chatsLimit : null,
      creditsUsed,
      message: `Synced ${syncedMessages} messages from ${totalChats - skippedInactive - skippedNoConversation} active chats`
    })

  } catch (error) {
    console.error('💥 Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
