import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Helper function to clean HTML from messages
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId } = req.query
  const messagesLimit = 50 // Últimos 50 mensajes por chat

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    // Get model_id from account_id
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', accountId)
      .single()

    if (modelError || !model) {
      throw new Error('Model not found for this account')
    }

    const modelId = model.model_id

    let syncedMessages = 0
    let totalChats = 0
    let offset = 0
    let hasMore = true
    const chatsLimit = 20 // Límite por página
    let creditsUsed = 0

    // Fetch all chats
    while (hasMore && offset < 200) { // Max 200 chats (10 páginas)
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
        throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
      }

      const responseData = await response.json()
      
      const chats = responseData.data || []
      hasMore = responseData._pagination?.next_page ? true : false
      totalChats += chats.length
      creditsUsed += responseData._meta?._credits?.used || 1

      console.log(`Chats page ${offset/chatsLimit + 1}: Fetched ${chats.length} chats`)

      // For each chat, fetch recent messages
      for (const chat of chats) {
        const fanData = chat.fan
        const fanId = fanData?.id?.toString()
        
        if (!fanId) continue

        // Get subscription details
        const subData = fanData.subscribedOnData
        const lastSubscribe = subData?.subscribes?.[0]

        // Ensure fan exists with all data
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

            console.log(`  Fan ${fanId}: Fetched ${messages.length} messages`)

            for (const msg of messages) {
              const chatData = {
                fan_id: fanId,
                message: cleanHTML(msg.text),  // Clean HTML tags
                model_id: modelId,
                timestamp: msg.createdAt || new Date().toISOString(),
                from: msg.isSentByMe ? 'model' : 'fan',
                message_type: msg.mediaCount > 0 ? 'media' : 'text',
                of_message_id: msg.id?.toString(),
                media_url: msg.media?.[0]?.src || msg.media?.[0]?.thumb,
                media_urls: msg.media?.map(m => m.src || m.thumb).filter(Boolean).join(','),
                amount: parseFloat(msg.price || 0),
                read: msg.isOpened || false,
                source: 'api_sync',
                // PPV fields
                is_locked: !msg.isFree,
                is_purchased: msg.canPurchaseReason === 'purchased' || msg.isFree,
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

      offset += chatsLimit
    }

    return res.status(200).json({
      success: true,
      syncedMessages,
      totalChats,
      creditsUsed,
      message: `Synced ${syncedMessages} messages from ${totalChats} chats (${creditsUsed} credits used)`
    })

  } catch (error) {
    console.error('Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
