import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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

async function createNotification(modelId, fanId, type, title, message, amount = null, metadata = {}) {
  console.log('🔔 Creating notification:', { modelId, fanId, type, title })
  
  const { data, error } = await supabase.from('notifications').insert({
    model_id: modelId,
    fan_id: fanId,
    type,
    title,
    message,
    amount,
    metadata
  })
  
  if (error) {
    console.error('❌ Error creating notification:', error)
  } else {
    console.log('✅ Notification created')
  }
  
  return { data, error }
}

export default async function handler(req, res) {
  console.log('🎯 Webhook received')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body
    console.log('📦 Event:', payload.event)

    // Get model_id from account_id
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', payload.account_id)
      .single()

    if (modelError || !model) {
      console.log('⚠️ Model not found')
      return res.status(200).json({ received: true })
    }

    const modelId = model.model_id
    const data = payload.payload

    // Handle events
    switch (payload.event) {
      case 'messages.received':
      case 'messages.sent':
        await handleMessage(data, modelId)
        break

      case 'subscriptions.new':
        await handleNewSubscriber(data, modelId)
        break

      case 'purchases.created':
      case 'tips.received':
        await handleTransaction(data, modelId)
        break

      case 'posts.liked':
      case 'messages.liked':
        await handleLike(data, modelId)
        break

      default:
        console.log('❓ Unknown event:', payload.event)
    }

    return res.status(200).json({ received: true })

  } catch (error) {
    console.error('💥 Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function handleMessage(data, modelId) {
  try {
    const fanId = data.fromUser?.id?.toString() || data.user?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found')
      return
    }

    // 🔥 VERIFICAR SI ES VAULT FAN
    const { data: modelData } = await supabase
      .from('models')
      .select('vault_fan_id')
      .eq('model_id', modelId)
      .single()

    const isVaultFan = modelData?.vault_fan_id === fanId
    
    // ✅ GUARDAR CUALQUIER MENSAJE DEL VAULT FAN (enviado o recibido)
    if (isVaultFan) {
      console.log('📸 Vault content detected! Saving to catalog AND chat...')
      
      // Detectar tipo de media
      let mediaUrl = null
      let mediaThumb = null
      let mediaType = null
      
      if (data.media && data.media.length > 0) {
        const media = data.media[0]
        mediaType = media.type
        
        if (mediaType === 'video') {
          mediaUrl = media.files?.full?.url || media.url
          mediaThumb = media.files?.thumb?.url
        } else {
          mediaUrl = media.files?.full?.url || media.files?.thumb?.url || media.url
        }
      }
      
      // 1. Guardar en CATALOG
      if (mediaUrl) {
        const { error: catalogError } = await supabase
          .from('catalog')
          .insert({
            model_id: modelId,
            offer_id: `vault_${Date.now()}`,
            title: data.text?.replace(/<[^>]*>/g, '').replace('📸 ', '').trim() || 'Untitled',
            base_price: 0,
            nivel: 0,
            of_media_id: data.media[0].id?.toString(),
            file_type: mediaType,
            parent_type: 'single',
            created_at: new Date().toISOString()
          })
        
        if (catalogError) {
          console.error('❌ Error saving to catalog:', catalogError)
        } else {
          console.log('✅ Saved to catalog!')
        }
      }
      
      // 2. Guardar en CHAT (para poder ver el video)
      const chatData = {
        fan_id: fanId,
        message: cleanHTML(data.text),
        model_id: modelId,
        ts: new Date(data.createdAt || Date.now()).toISOString(),
        from: data.isSentByMe ? 'model' : 'fan',
        of_message_id: data.id?.toString(),
        media_url: mediaUrl,
        media_thumb: mediaThumb,
        media_type: mediaType,
        amount: parseFloat(data.price || 0),
        read: data.isOpened || false
      }

      const { error: chatError } = await supabase
        .from('chat')
        .upsert(chatData, { onConflict: 'of_message_id' })
      
      if (chatError) {
        console.error('❌ Error saving to chat:', chatError)
      } else {
        console.log('✅ Saved to chat!')
      }
      
      // 3. Crear notificación del vault fan (para pruebas)
      if (!data.isSentByMe) {
        const fanName = data.fromUser?.name || data.user?.name || 'Vault Fan'
        const messagePreview = mediaType === 'video' ? '📹 Video guardado en vault' :
                              mediaType === 'photo' ? '📸 Foto guardada en vault' :
                              '📎 Contenido guardado en vault'
        
        await createNotification(
          modelId,
          fanId,
          'vault_upload',
          `${fanName} - Vault`,
          messagePreview
        )
      }
      
      // ✅ Continuar para que también actualice el fan (NO return aquí)
    }

    // Upsert fan (código existente)
    await supabase.from('fans').upsert({
      fan_id: fanId,
      name: data.fromUser?.name || data.user?.name || 'Unknown',
      model_id: modelId,
      of_username: data.fromUser?.username || data.user?.username,
      of_avatar_url: data.fromUser?.avatar || data.user?.avatar,
      last_message_date: data.createdAt || new Date().toISOString()
    }, { onConflict: 'fan_id,model_id' })

    // Detectar tipo de media
    let mediaUrl = null
    let mediaThumb = null
    let mediaType = null
    
    if (data.media && data.media.length > 0) {
      const media = data.media[0]
      mediaType = media.type
      
      if (mediaType === 'video') {
        mediaUrl = media.files?.full?.url || media.url
        mediaThumb = media.files?.thumb?.url
        console.log('🎬 Video detected:', { url: mediaUrl, thumb: mediaThumb })
      } else {
        mediaUrl = media.files?.full?.url || media.files?.thumb?.url || media.url
        console.log('🖼️ Media detected:', { type: mediaType, url: mediaUrl })
      }
    }

    // Guardar mensaje (código existente...)
    const chatData = {
      fan_id: fanId,
      message: cleanHTML(data.text),
      model_id: modelId,
      ts: new Date(data.createdAt || Date.now()).toISOString(),
      from: data.isSentByMe ? 'model' : 'fan',
      of_message_id: data.id?.toString(),
      media_url: mediaUrl,
      media_thumb: mediaThumb,
      media_type: mediaType,
      amount: parseFloat(data.price || 0),
      read: data.isOpened || false
    }

    const { error: chatError } = await supabase
      .from('chat')
      .upsert(chatData, { onConflict: 'of_message_id' })
    
    if (chatError) {
      console.error('❌ Error saving message:', chatError)
    } else {
      console.log('✅ Message saved')
    }

    // Crear notificación si es del fan (código existente...)
    if (!data.isSentByMe) {
      const fanName = data.fromUser?.name || data.user?.name || 'Un fan'
      const tipAmount = parseFloat(data.price || 0)
      
      const isTip = tipAmount > 0
      const notifType = isTip ? 'new_tip' : 'new_message'
      
      let messagePreview = cleanHTML(data.text).slice(0, 50)
      if (!messagePreview && mediaUrl) {
        messagePreview = mediaType === 'video' ? '📹 Envió un video' :
                        mediaType === 'photo' ? '🖼️ Envió una foto' :
                        mediaType === 'gif' ? 'GIF animado' :
                        '📎 Envió contenido'
      }
      
      const notifTitle = isTip 
        ? `${fanName} te envió un tip de $${tipAmount}` 
        : `${fanName} te envió un mensaje`
      
      await createNotification(
        modelId,
        fanId,
        notifType,
        notifTitle,
        messagePreview || 'Nuevo mensaje',
        isTip ? tipAmount : null
      )

      if (isTip) {
        await supabase.rpc('increment_fan_spent', {
          p_fan_id: fanId,
          p_model_id: modelId,
          p_amount: tipAmount
        })
      }
    }

  } catch (error) {
    console.error('💥 Error handling message:', error)
  }
}

async function handleNewSubscriber(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.subscriber?.id?.toString()
    const fanName = data.user?.name || data.subscriber?.name || 'Un fan'
    
    if (!fanId) return

    await supabase.from('fans').upsert({
      fan_id: fanId,
      name: fanName,
      model_id: modelId,
      of_username: data.user?.username || data.subscriber?.username,
      of_avatar_url: data.user?.avatar || data.subscriber?.avatar,
      tier: 0
    }, { onConflict: 'fan_id,model_id' })

    await createNotification(
      modelId,
      fanId,
      'new_subscriber',
      `${fanName} se suscribió a tu perfil`,
      'Nuevo suscriptor'
    )

  } catch (error) {
    console.error('💥 Error handling subscriber:', error)
  }
}

async function handleTransaction(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.from_user?.id?.toString()
    const fanName = data.user?.name || data.from_user?.name || 'Un fan'
    const amount = parseFloat(data.amount || data.price || 0)
    
    if (!fanId || amount === 0) return

    const isPPV = data.type === 'purchase' || data.action === 'unlock'
    const type = isPPV ? 'new_purchase' : 'new_tip'
    const title = isPPV 
      ? `${fanName} desbloqueó contenido por $${amount}`
      : `${fanName} te envió un tip de $${amount}`

    await createNotification(
      modelId,
      fanId,
      type,
      title,
      isPPV ? 'Contenido desbloqueado' : 'Nuevo tip',
      amount
    )

    await supabase.rpc('increment_fan_spent', {
      p_fan_id: fanId,
      p_model_id: modelId,
      p_amount: amount
    })

  } catch (error) {
    console.error('💥 Error handling transaction:', error)
  }
}

async function handleLike(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.from_user?.id?.toString()
    const fanName = data.user?.name || data.from_user?.name || 'Un fan'
    
    if (!fanId) return

    const contentType = data.post ? 'post' : 'mensaje'
    const contentPreview = data.post?.text || data.message?.text || 'tu contenido'

    await createNotification(
      modelId,
      fanId,
      'new_like',
      `${fanName} le dio ❤️ a tu ${contentType}`,
      contentPreview.slice(0, 50),
      null,
      { 
        like_id: data.id,
        post_id: data.post?.id || data.message?.id
      }
    )

  } catch (error) {
    console.error('💥 Error handling like:', error)
  }
}
