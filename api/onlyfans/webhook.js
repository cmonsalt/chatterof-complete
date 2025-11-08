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

async function handleMessage(data, modelId) {
  try {
    // Determinar si es mensaje del FAN o de la MODELO
    const isFromFan = !!data.fromUser
    const fanId = data.fromUser?.id?.toString()
    
    if (!fanId && isFromFan) {
      console.log('⚠️ No fanId found')
      return
    }

    // Si es mensaje de la modelo, no procesar (no tiene fanId)
    if (!isFromFan) {
      console.log('📤 Message from model, skipping')
      return
    }

    const cleanText = cleanHTML(data.text || '')
    
    let mediaUrl = null
    let mediaThumb = null
    let mediaType = null
    
    if (data.media && data.media.length > 0) {
      const firstMedia = data.media[0]
      mediaUrl = firstMedia.files?.full?.url || firstMedia.url
      mediaThumb = firstMedia.files?.thumb?.url || firstMedia.thumb
      mediaType = firstMedia.type
    }
    
    // Determinar si es tip
    const isTip = data.price > 0 && !data.isOpened
    const isMessage = data.text || data.media?.length > 0
    
    if (isMessage) {
      const messageData = {
        of_message_id: data.id?.toString(),
        fan_id: fanId,
        model_id: modelId,
        message: cleanText,
        timestamp: data.createdAt || new Date().toISOString(),
        from: 'fan',
        read: false,
        source: 'webhook',
        media_url: mediaUrl,
        media_thumb: mediaThumb,
        media_type: mediaType,
        amount: isTip ? data.price : 0,
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
    }
    
    // Si es tip, crear notificación
    if (isTip) {
      await createNotification(
        modelId,
        fanId,
        'new_tip',
        'New Tip Received! 💰',
        `You received a $${data.price} tip!`,
        data.price,
        { message_id: data.id }
      )
      
      // Actualizar spent_total
      await supabase.rpc('increment_fan_spent', {
        p_fan_id: fanId,
        p_model_id: modelId,
        p_amount: data.price
      })
    }
    
    // Crear notificación de mensaje nuevo
    if (isFromFan && isMessage) {
      await createNotification(
        modelId,
        fanId,
        'new_message',
        'New Message 💬',
        cleanText.substring(0, 100) || 'New media message',
        null,
        { message_id: data.id }
      )
    }
    
  } catch (error) {
    console.error('❌ Error in handleMessage:', error)
  }
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
    const { event, data } = req.body

    if (!event || !data) {
      console.log('❌ Invalid payload:', JSON.stringify(req.body))
      return res.status(400).json({ error: 'Invalid webhook payload' })
    }

    console.log(`🔔 Webhook event: ${event}`)

    // Obtener modelId desde account_id en query o en data
    const accountId = req.query.account || data.account?.id

    if (!accountId) {
      console.log('❌ Missing account ID')
      return res.status(400).json({ error: 'Missing account ID' })
    }

    const { data: model } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', accountId)
      .single()

    if (!model) {
      console.log(`❌ Model not found for account: ${accountId}`)
      return res.status(404).json({ error: 'Model not found' })
    }

    const modelId = model.model_id

    // Procesar mensaje
    if (event === 'messages.received') {
      await handleMessage(data, modelId)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}