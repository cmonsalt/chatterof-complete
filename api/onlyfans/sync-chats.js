import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, limit = 100 } = req.query

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

    // Fetch chats from OnlyFans API
    const response = await fetch(`https://app.onlyfansapi.com/api/${accountId}/chats?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const chats = data.list || data.chats || []

    let synced = 0

    for (const chat of chats) {
      // Get messages for this chat
      const messagesResponse = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/chats/${chat.withUser.id}/messages?limit=50`,
        {
          headers: { 'Authorization': `Bearer ${API_KEY}` }
        }
      )

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        const messages = messagesData.list || messagesData.messages || []

        for (const msg of messages) {
          const chatData = {
            fan_id: chat.withUser.id.toString(),
            message: msg.text || '',
            model_id: modelId,
            timestamp: msg.createdAt || new Date().toISOString(),
            from: msg.fromUser?.id === accountId ? 'model' : 'fan',
            message_type: msg.media?.length > 0 ? 'media' : 'text',
            of_message_id: msg.id?.toString(),
            media_url: msg.media?.[0]?.src,
            amount: msg.price || 0,
            read: msg.isOpened || false
          }

          const { error } = await supabase
            .from('chat')
            .upsert(chatData, { onConflict: 'of_message_id' })

          if (!error) synced++
        }
      }

      // Ensure fan exists
      await supabase.from('fans').upsert({
        fan_id: chat.withUser.id.toString(),
        name: chat.withUser.name || 'Unknown',
        model_id: modelId,
        of_username: chat.withUser.username,
        of_avatar_url: chat.withUser.avatar,
        last_message_date: chat.lastMessage?.createdAt
      }, { onConflict: 'fan_id' })
    }

    return res.status(200).json({
      success: true,
      synced,
      chats: chats.length,
      message: `Synced ${synced} messages from ${chats.length} chats`
    })

  } catch (error) {
    console.error('Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
