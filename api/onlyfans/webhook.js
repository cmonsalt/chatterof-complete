import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Cliente R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

function cleanHTML(text) {
  if (!text) return ''
  return text
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

// 🆕 Función para descargar desde OnlyFans CDN y subir a R2
async function downloadAndUploadToR2(cdnUrl, mediaId, mediaType) {
  try {
    console.log(`📥 Downloading from CDN: ${mediaId}`)

    // Descargar desde OnlyFans CDN
    const response = await fetch(cdnUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    console.log(`✅ Downloaded ${buffer.length} bytes`)

    // Determinar extensión y content type
    const ext = mediaType === 'video' ? 'mp4' : 'jpg'
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
    
    // Generar key único para R2
    const timestamp = Date.now()
    const key = `vault/${mediaId}_${timestamp}.${ext}`
    
    // Subir a R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })

    await r2Client.send(command)

    // URL pública de R2
    const r2Url = `https://${process.env.R2_BUCKET_NAME}.r2.dev/${key}`
    
    console.log(`✅ Uploaded to R2: ${r2Url}`)

    return r2Url

  } catch (error) {
    console.error('❌ Error downloading/uploading:', error)
    return null
  }
}

// 🆕 Función para capturar contenido al fan de prueba
async function handleVaultContent(data, modelId) {
  try {
    // Solo procesar si tiene media
    if (!data.media || data.media.length === 0) {
      return
    }

    // Verificar si es mensaje DE la modelo (no del fan)
    if (data.fromUser) {
      // Es del fan, no procesar
      return
    }

    // Obtener vault_fan_id del modelo
    const { data: modelData } = await supabase
      .from('models')
      .select('vault_fan_id')
      .eq('model_id', modelId)
      .single()

    if (!modelData?.vault_fan_id) {
      console.log('⚠️ No vault_fan_id configured')
      return
    }

    // Verificar si el mensaje es PARA el vault fan
    const recipientId = data.toUser?.id?.toString() || data.user?.id?.toString()
    
    if (recipientId !== modelData.vault_fan_id) {
      // No es para el vault fan, no procesar
      return
    }

    console.log('🎯 Message to vault fan detected, processing media...')

    // Procesar cada media
    for (const media of data.media) {
      const mediaId = media.id?.toString()
      const mediaType = media.type // 'photo' o 'video'
      const cdnUrl = media.files?.full?.url || media.files?.source?.url
      const thumbUrl = media.files?.thumb?.url

      if (!mediaId || !cdnUrl) {
        console.log('⚠️ Missing mediaId or cdnUrl')
        continue
      }

      // Descargar y subir a R2
      const r2Url = await downloadAndUploadToR2(cdnUrl, mediaId, mediaType)

      if (!r2Url) {
        console.log('❌ Failed to upload to R2')
        continue
      }

      // También subir thumbnail
      let r2ThumbUrl = null
      if (thumbUrl) {
        r2ThumbUrl = await downloadAndUploadToR2(thumbUrl, `${mediaId}_thumb`, 'photo')
      }

      // Guardar en catalog
      const catalogData = {
        model_id: modelId,
        of_media_id: mediaId,
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

async function handleMessage(data, modelId) {
  try {
    const fanId = data.fromUser?.id?.toString() || data.user?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found')
      return
    }

    // Solo guardar mensaje normal en chat
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
        from: data.fromUser ? 'fan' : 'model',
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
    
    // Si es mensaje del fan, crear notificación
    if (data.fromUser && isMessage) {
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
      return res.status(400).json({ error: 'Invalid webhook payload' })
    }

    console.log(`🔔 Webhook event: ${event}`)

    // Obtener modelId desde account_id
    const accountId = req.query.account || data.account?.id

    if (!accountId) {
      return res.status(400).json({ error: 'Missing account ID' })
    }

    const { data: model } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', accountId)
      .single()

    if (!model) {
      return res.status(404).json({ error: 'Model not found' })
    }

    const modelId = model.model_id

    // 🆕 PRIMERO: Intentar capturar contenido al vault fan
    if (event === 'message:new' || event === 'message:sent') {
      await handleVaultContent(data, modelId)
    }

    // DESPUÉS: Procesar mensaje normal
    if (event === 'message:new') {
      await handleMessage(data, modelId)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}