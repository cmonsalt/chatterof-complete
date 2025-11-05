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

  const { accountId, modelId } = req.body
  const messagesLimit = 20 // Últimos 20 mensajes por chat

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
    let offset = 0
    const chatsLimit = 10 // Solo 10 chats por llamada para evitar timeout
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
      
      // If auth error, mark as disconnected
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

    console.log(`Fetched ${chats.length} chats`)

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
      }, { onConflict: 'fan_id' })

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

          console.log(`  Fan ${fanId}: ${messages.length} messages`)

          for (const msg of messages) {
            const chatData = {
              fan_id: fanId,
              message: cleanHTML(msg.text),
              model_id: modelId,
              timestamp: msg.createdAt || new Date().toISOString(),
              from: msg.isSentByMe ? 'model' : 'fan',
              message_type: msg.mediaCount > 0 ? 'media' : 'text',
              of_message_id: msg.id?.toString(),
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
              .upsert(chatData, { onConflict: 'of_message_id' })

            if (!error) syncedMessages++
            else console.error('Error upserting message:', msg.id, error)
          }
        }
      } catch (msgError) {
        console.error(`Error fetching messages for fan ${fanId}:`, msgError)
      }
    }

    return res.status(200).json({
      success: true,
      syncedMessages,
      totalChats,
      hasMore,
      nextOffset: hasMore ? offset + chatsLimit : null,
      creditsUsed,
      message: `Synced ${syncedMessages} messages from ${totalChats} chats (${creditsUsed} credits)`
    })

  } catch (error) {
    console.error('Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
