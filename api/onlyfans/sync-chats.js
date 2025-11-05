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
  const messagesLimit = 20

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    let syncedMessages = 0
    const chatsLimit = 10

    console.log(`[Sync Chats] Fetching chats from offset ${offset}, limit ${chatsLimit}`)

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
      
      console.error(`[Sync Chats] API Error ${response.status}:`, errorText)
      
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
      
      // If 404, assume no more chats
      if (response.status === 404) {
        console.log(`[Sync Chats] 404 at offset ${offset} - end of data`)
        return res.status(200).json({
          success: true,
          syncedMessages: 0,
          hasMore: false,
          nextOffset: null,
          message: 'No more chats to sync'
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    
    const chats = responseData.data || []
    const hasMore = responseData._pagination?.next_page ? true : false
    
    console.log(`[Sync Chats] Fetched ${chats.length} chats, hasMore: ${hasMore}`)

    for (const chat of chats) {
      const fanId = chat.with_user?.id?.toString()
      if (!fanId) continue

      // Get last 20 messages from this chat
      const messagesResponse = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/chats/${fanId}/messages?limit=${messagesLimit}&offset=0`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        }
      )

      if (!messagesResponse.ok) continue

      const messagesData = await messagesResponse.json()
      const messages = messagesData.data?.list || []

      for (const msg of messages) {
        const messageData = {
          fan_id: fanId,
          model_id: modelId,
          message: cleanHTML(msg.text) || '',
          from: msg.from_user?.id?.toString() === fanId ? 'fan' : 'model',
          message_type: msg.media?.length > 0 ? 'media' : 'text',
          timestamp: new Date(msg.created_at).toISOString(),
          created_at: new Date(msg.created_at).toISOString(),
          of_message_id: msg.id?.toString(),
          is_ppv: msg.price > 0,
          ppv_price: parseFloat(msg.price || 0),
          is_opened: msg.is_opened || false,
          media: msg.media || null,
          source: 'onlyfans_api'
        }

        // If no of_message_id, generate unique one
        if (!messageData.of_message_id) {
          messageData.of_message_id = `msg_${fanId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }

        const { error } = await supabase
          .from('chat')
          .upsert(messageData, { 
            onConflict: 'of_message_id',
            ignoreDuplicates: true 
          })

        if (!error) syncedMessages++
        else if (error.code !== '23505') {
          console.error('Error upserting message:', msg.id, error)
        }
      }
    }

    console.log(`[Sync Chats] Synced ${syncedMessages} messages from ${chats.length} chats`)

    return res.status(200).json({
      success: true,
      syncedMessages,
      chatsProcessed: chats.length,
      hasMore,
      nextOffset: hasMore ? offset + chatsLimit : null,
      message: `Synced ${syncedMessages} messages from ${chats.length} chats`
    })

  } catch (error) {
    console.error('Sync chats error:', error)
    return res.status(500).json({ 
      error: 'Sync failed',
      message: error.message 
    })
  }
}
