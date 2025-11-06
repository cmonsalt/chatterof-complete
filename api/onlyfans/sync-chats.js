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
  const messagesLimit = 50 // Increased from 20
  const chatsLimit = 20 // Increased from 10

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
    let skippedNoConversation = 0
    let creditsUsed = 0

    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats?limit=${chatsLimit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
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
          needsReauth: true,
          message: 'Account needs re-authorization'
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    
    const chats = responseData.data || []
    const hasMore = responseData._pagination?.next_page ? true : false
    totalChats = chats.length
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log(`📨 Fetched ${chats.length} chats at offset ${offset}`)

    for (const chat of chats) {
      const fanData = chat.fan
      const fanId = fanData?.id?.toString()
      
      if (!fanId) continue

      const subData = fanData.subscribedOnData
      const lastSubscribe = subData?.subscribes?.[0]

      // Ensure fan exists
      await supabase.from('fans').upsert({
        fan_id: fanId,
        name: fanData.name || fanData.username || 'Unknown',
        model_id: modelId,
        of_username: fanData.username,
        of_avatar_url: fanData.avatar,
        last_message_date: chat.lastMessage?.createdAt,
        spent_total: parseFloat(subData?.totalSumm || 0),
        subscription_type: lastSubscribe?.type || null,
        subscription_price: parseFloat(lastSubscribe?.price || 0),
        is_renewal_enabled: fanData.subscribedByAutoprolong || false,
        subscription_expires_at: lastSubscribe?.expireDate || null
      }, { onConflict: 'fan_id,model_id' })

      // Fetch messages for this chat
      try {
        const messagesResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/chats/${fanId}/messages?limit=${messagesLimit}`,
          {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
          }
        )

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          const messages = messagesData.data || []
          creditsUsed += messagesData._meta?._credits?.used || 1

          // CRITICAL FILTER: Only sync if fan has replied
          const hasFanMessages = messages.some(msg => !msg.isSentByMe)

          if (!hasFanMessages) {
            console.log(`  ⏭️ Skip fan ${fanId}: no conversation (only model spam)`)
            skippedNoConversation++
            continue
          }

          console.log(`  ✅ Fan ${fanId}: ${messages.length} messages (has real conversation)`)

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
          }
        }
      } catch (msgError) {
        console.error(`Error fetching messages for fan ${fanId}:`, msgError)
      }
    }

    console.log(`✅ Sync complete: ${syncedMessages} messages, skipped ${skippedNoConversation} spam-only chats`)

    return res.status(200).json({
      success: true,
      syncedMessages,
      totalChats,
      skippedNoConversation,
      hasMore,
      nextOffset: hasMore ? offset + chatsLimit : null,
      creditsUsed,
      message: `Synced ${syncedMessages} messages from ${totalChats} chats (skipped ${skippedNoConversation} spam-only)`
    })

  } catch (error) {
    console.error('Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
