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
        is_read: false
      })

    if (error) {
      console.error('❌ Notification insert error:', error)
      throw error
    }
    
    console.log(`✅ Notification created: ${type} for fan ${fanId}`)
  } catch (error) {
    console.error('❌ Notification error:', error)
  }
}

// 📨 MESSAGES.RECEIVED - Mensaje recibido de un fan
async function handleMessageReceived(payload, modelId) {
  const fanId = payload.fromUser?.id?.toString()
  
  if (!fanId) {
    console.log('⚠️ No fanId in message')
    return
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
    return
  }
  
  console.log('✅ Message saved to chat')
  
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
  } else {
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
}

// 📦 HANDLE VAULT CONTENT - Descargar y subir a R2
async function handleVaultContent(payload, modelId) {
  try {
    // Solo procesar si tiene media
    if (!payload.media || payload.media.length === 0) {
      console.log('⚠️ No media in vault message')
      return
    }

    console.log(`🎯 Vault content detected, processing ${payload.media.length} files...`)

    // Procesar cada media
    for (const media of payload.media) {
      const mediaId = media.id?.toString()
      const mediaType = media.type // 'photo' o 'video'
      const cdnUrl = media.files?.full?.url || media.files?.source?.url
      const thumbUrl = media.files?.thumb?.url

      if (!mediaId || !cdnUrl) {
        console.log('⚠️ Missing mediaId or cdnUrl')
        continue
      }

      console.log(`📥 Downloading media ${mediaId} from CDN...`)

      // Descargar desde OnlyFans CDN
      const response = await fetch(cdnUrl)
      
      if (!response.ok) {
        console.error(`❌ Failed to download: ${response.status}`)
        continue
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      console.log(`✅ Downloaded ${buffer.length} bytes`)

      // Determinar extensión y content type
      const ext = mediaType === 'video' ? 'mp4' : 'jpg'
      const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
      
      // Generar key único para R2
      const timestamp = Date.now()
      const r2Key = `vault/${mediaId}_${timestamp}.${ext}`
      
      // Subir a R2
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      
      const r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: contentType,
      })

      await r2Client.send(command)

      // URL pública de R2 (permanente)
      const r2Url = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${r2Key}`
      
      console.log(`✅ Uploaded to R2: ${r2Url}`)

      // También subir thumbnail si existe
      let r2ThumbUrl = null
      if (thumbUrl) {
        try {
          const thumbResponse = await fetch(thumbUrl)
          if (thumbResponse.ok) {
            const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
            const thumbKey = `vault/${mediaId}_${timestamp}_thumb.jpg`
            
            await r2Client.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/jpeg',
            }))
            
            r2ThumbUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${thumbKey}`
            console.log(`✅ Thumbnail uploaded to R2`)
          }
        } catch (thumbError) {
          console.error('⚠️ Thumbnail upload failed:', thumbError)
        }
      }

      // Guardar en catalog
      const catalogData = {
        model_id: modelId,
        of_media_id: mediaId,
        title: `Vault ${mediaType} - ${mediaId}`, // Título temporal
        base_price: 0, // Se asignará después al organizar
        nivel: 1, // Nivel por defecto
        file_type: mediaType,
        r2_url: r2Url,
        media_thumb: r2ThumbUrl || thumbUrl,
        status: 'inbox', // Pendiente de organizar
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('catalog')
        .upsert(catalogData, { onConflict: 'of_media_id' })

      if (error) {
        console.error('❌ Error saving to catalog:', error)
      } else {
        console.log(`✅ Media ${mediaId} saved to catalog (inbox)`)
      }
    }

  } catch (error) {
    console.error('❌ Error in handleVaultContent:', error)
  }
}

// 📤 MESSAGES.SENT - Mensaje enviado por la modelo
async function handleMessageSent(payload, modelId) {
  console.log('📤 Message sent by model')
  
  // Verificar si es al vault fan
  const recipientId = payload.toUser?.id?.toString()
  
  if (!recipientId) {
    console.log('⚠️ No recipient in sent message')
    return
  }

  // Buscar vault_fan_id del modelo
  const { data: model } = await supabase
    .from('models')
    .select('vault_fan_id')
    .eq('model_id', modelId)
    .single()

  if (!model?.vault_fan_id) {
    console.log('⚠️ No vault_fan_id configured')
    return
  }

  // Si el destinatario es el vault fan, procesar contenido
  if (recipientId === model.vault_fan_id) {
    console.log('🎯 Message to vault fan detected!')
    await handleVaultContent(payload, modelId)
  } else {
    console.log('📤 Regular message sent (not to vault fan)')
  }
}

// 💰 MESSAGES.PPV.UNLOCKED - PPV desbloqueado
async function handlePPVUnlocked(payload, modelId) {
  const fanId = payload.fromUser?.id?.toString()
  
  if (!fanId) return

  console.log(`💰 PPV unlocked by fan ${fanId}`)
  
  await createNotification(
    modelId,
    fanId,
    'ppv_unlocked',
    'PPV Unlocked! 💸',
    `Fan unlocked your PPV for $${payload.price}`,
    payload.price,
    { message_id: payload.id }
  )
  
  // Actualizar spent_total
  await supabase.rpc('increment_fan_spent', {
    p_fan_id: fanId,
    p_model_id: modelId,
    p_amount: payload.price
  })
}

// 🆕 SUBSCRIPTIONS.NEW - Nueva suscripción
async function handleNewSubscription(payload, modelId) {
  const fanId = payload.user?.id?.toString()
  
  if (!fanId) return

  console.log(`🆕 New subscription from fan ${fanId}`)
  
  await createNotification(
    modelId,
    fanId,
    'new_subscription',
    'New Subscriber! 🎉',
    `${payload.user?.name || 'Someone'} just subscribed!`,
    payload.price || 0,
    { subscription_id: payload.id }
  )
}

// ❤️ POSTS.LIKED - Post liked
async function handlePostLiked(payload, modelId) {
  console.log('❤️ Post liked')
  // Opcional: crear notificación si quieres
}

// ⌨️ USERS.TYPING - Usuario escribiendo
async function handleUserTyping(payload, modelId) {
  console.log('⌨️ User typing')
  // No crear notificación, solo log
}

// 🔌 ACCOUNTS.* - Eventos de cuenta
async function handleAccountEvent(event, payload, modelId) {
  console.log(`🔌 Account event: ${event}`)
  
  // Actualizar connection_status en models
  let status = 'connected'
  
  if (event === 'accounts.session_expired') {
    status = 'session_expired'
  } else if (event === 'accounts.authentication_failed') {
    status = 'auth_failed'
  } else if (event === 'accounts.otp_code_required') {
    status = 'otp_required'
  } else if (event === 'accounts.face_otp_required') {
    status = 'face_otp_required'
  }
  
  await supabase
    .from('models')
    .update({ 
      connection_status: status,
      last_connection_check: new Date().toISOString()
    })
    .eq('model_id', modelId)
  
  console.log(`✅ Connection status updated: ${status}`)
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

    // Rutear eventos
    switch(event) {
      case 'messages.received':
        await handleMessageReceived(payload, modelId)
        break
        
      case 'messages.sent':
        await handleMessageSent(payload, modelId)
        break
        
      case 'messages.ppv.unlocked':
        await handlePPVUnlocked(payload, modelId)
        break
        
      case 'subscriptions.new':
        await handleNewSubscription(payload, modelId)
        break
        
      case 'posts.liked':
        await handlePostLiked(payload, modelId)
        break
        
      case 'users.typing':
        await handleUserTyping(payload, modelId)
        break
        
      case 'accounts.connected':
      case 'accounts.reconnected':
      case 'accounts.session_expired':
      case 'accounts.authentication_failed':
      case 'accounts.otp_code_required':
      case 'accounts.face_otp_required':
        await handleAccountEvent(event, payload, modelId)
        break
        
      default:
        console.log(`⚠️ Unhandled event: ${event}`)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}
