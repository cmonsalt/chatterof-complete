import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
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

async function createNotification(modelId, fanId, type, title, message, amount, metadata) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        model_id: modelId,
        fan_id: fanId,
        type,
        title,
        message,
        amount,
        metadata,
        read: false
      })

    if (error) throw error
    console.log(`✅ Notification created: ${type}`)
  } catch (error) {
    console.error('❌ Notification error:', error)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { event, account_id, payload } = req.body

    if (!event || !payload) {
      console.log('❌ Invalid payload:', JSON.stringify(req.body))
      return res.status(400).json({ error: 'Invalid webhook payload' })
    }

    // Ignorar eventos de test
    if (event === 'test-event') {
      console.log('✅ Test event received')
      return res.status(200).json({ success: true })
    }

    console.log(`🔔 Webhook event: ${event}`)

    if (!account_id) {
      console.log('❌ Missing account_id')
      return res.status(400).json({ error: 'Missing account_id' })
    }

    // Buscar modelo por account_id
    const { data: model } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', account_id)
      .single()

    if (!model) {
      console.log(`❌ Model not found for account: ${account_id}`)
      return res.status(404).json({ error: 'Model not found' })
    }

    const modelId = model.model_id

    // Procesar mensaje recibido
    if (event === 'messages.received') {
      const fanId = payload.fromUser?.id?.toString()
      
      if (!fanId) {
        console.log('⚠️ No fanId in message')
        return res.status(200).json({ success: true })
      }

      const cleanText = cleanHTML(payload.text || '')
      
      let mediaUrl = null
      let mediaThumb = null
      let mediaType = null
      
      if (payload.media && payload.media.length > 0) {
        const firstMedia = payload.media[0]
        mediaUrl = firstMedia.files?.full?.url || firstMedia.url
        mediaThumb = firstMedia.files?.thumb?.url || firstMedia.thumb
        mediaType = firstMedia.type
      }
      
      const isTip = payload.price > 0 && !payload.isOpened
      
      // Guardar mensaje
      const messageData = {
        of_message_id: payload.id?.toString(),
        fan_id: fanId,
        model_id: modelId,
        message: cleanText,
        timestamp: payload.createdAt || new Date().toISOString(),
        from: 'fan',
        read: false,
        source: 'webhook',
        media_url: mediaUrl,
        media_thumb: mediaThumb,
        media_type: mediaType,
        amount: isTip ? payload.price : 0,
        is_ppv: false,
        ppv_price: 0
      }
      
      const { error: chatError } = await supabase
        .from('chat')
        .upsert(messageData, { onConflict: 'of_message_id' })
      
      if (chatError) {
        console.error('❌ Chat save error:', chatError)
      } else {
        console.log('✅ Message saved to chat')
      }
      
      // Si es tip
      if (isTip) {
        await createNotification(
          modelId,
          fanId,
          'new_tip',
          'New Tip Received! 💰',
          `You received a $${payload.price} tip!`,
          payload.price,
          { message_id: payload.id }
        )
        
        await supabase.rpc('increment_fan_spent', {
          p_fan_id: fanId,
          p_model_id: modelId,
          p_amount: payload.price
        })
      }
      
      // Notificación de mensaje nuevo
      await createNotification(
        modelId,
        fanId,
        'new_message',
        'New Message 💬',
        cleanText.substring(0, 100) || 'New media message',
        null,
        { message_id: payload.id }
      )
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}