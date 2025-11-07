// 🔥 WEBHOOK UPDATED - Con handlePurchase separado para desbloquear PPVs
// Ubicación: api/onlyfans/webhook.js (REEMPLAZAR ARCHIVO COMPLETO)

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// R2 Client for permanent storage
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

// Helper function to upload to R2 (ORGANIZAD O POR MODELO)
async function uploadToR2(buffer, mediaId, mediaType, modelId) {
  try {
    const ext = mediaType === 'video' ? 'mp4' : 'jpg'
    // 🔥 NUEVO: Organizar por modelo
    const key = `model_${modelId}/media/${mediaId}_${Date.now()}.${ext}`
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
    
    await r2Client.send(command)
    
    return `https://pub-c91f7a72074547ffad99c7d07cf8c8cd.r2.dev/${key}`
  } catch (error) {
    console.error('❌ R2 upload error:', error)
    return null
  }
}

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

      // 🔥 SEPARADO: purchases.created ahora tiene su propio handler
      case 'purchases.created':
        await handlePurchase(data, modelId)
        break

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
      
      let savedCount = 0
      
      // 1. GUARDAR EN CATALOG
      if (data.media && data.media.length > 0) {
        for (const mediaItem of data.media) {
          const mediaId = mediaItem.id?.toString()
          const mediaType = mediaItem.type
          const thumbUrl = mediaItem.files?.thumb?.url || mediaItem.thumb?.url
          let fullUrl = mediaItem.files?.full?.url || mediaItem.full?.url || mediaItem.url
          
          if (!mediaId || !fullUrl) continue
          
          // Download and upload to R2
          let r2Url = null
          try {
            console.log(`📥 Downloading ${mediaType} ${mediaId}...`)
            const downloadResp = await fetch(fullUrl)
            if (downloadResp.ok) {
              const buffer = Buffer.from(await downloadResp.arrayBuffer())
              // 🔥 PASAR modelId para organizar en R2
              r2Url = await uploadToR2(buffer, mediaId, mediaType, modelId)
              console.log(`✅ Uploaded to R2: ${r2Url}`)
            }
          } catch (err) {
            console.error(`❌ R2 upload failed for ${mediaId}:`, err)
          }
          
          const catalogEntry = {
            of_media_id: mediaId,
            title: `Vault ${mediaType} ${mediaId}`,
            description: `Uploaded via vault fan ${fanId}`,
            base_price: 10,
            nivel: 5,
            model_id: modelId,
            file_type: mediaType,
            media_url: fullUrl,
            media_thumb: thumbUrl,
            r2_url: r2Url,
            status: 'inbox'
          }
          
          const { error: catalogError } = await supabase
            .from('catalog')
            .upsert(catalogEntry, { onConflict: 'of_media_id' })
          
          if (!catalogError) {
            savedCount++
            console.log(`✅ Saved to catalog: ${mediaId}`)
          } else {
            console.error(`❌ Catalog error for ${mediaId}:`, catalogError)
          }
        }
      }
      
      // 2. GUARDAR EN CHAT (para timeline)
      const messageId = data.id?.toString() || `vault_${Date.now()}`
      const from = data.fromUser?.id?.toString() === fanId ? 'fan' : 'model'
      const mediaUrl = data.media?.[0]?.files?.full?.url || data.media?.[0]?.files?.thumb?.url
      const mediaType = data.media?.[0]?.type || 'photo'
      const tipAmount = parseFloat(data.price || 0)
      
      await supabase.from('chat').upsert({
        fan_id: fanId,
        model_id: modelId,
        message: cleanHTML(data.text) || `[${savedCount} ${savedCount === 1 ? 'file' : 'files'} uploaded to vault]`,
        from: from,
        timestamp: new Date(data.createdAt || Date.now()).toISOString(),
        of_message_id: messageId,
        media_url: mediaUrl,
        media_type: mediaType,
        amount: tipAmount,
        read: data.isOpened || false,
        source: 'webhook'
      }, { onConflict: 'of_message_id' })
      
      console.log(`✅ Vault: ${savedCount} items saved to catalog`)
      return
    }

    // MENSAJE NORMAL (no es vault fan)
    await supabase.from('fans').upsert({
      fan_id: fanId,
      model_id: modelId,
      name: data.fromUser?.name || data.user?.name || 'Unknown',
      of_username: data.fromUser?.username || data.user?.username,
      of_avatar_url: data.fromUser?.avatar || data.user?.avatar
    }, { onConflict: 'fan_id,model_id' })

    const messageId = data.id?.toString()
    if (!messageId) return

    const from = data.fromUser?.id?.toString() === fanId ? 'fan' : 'model'
    const mediaUrl = data.media?.[0]?.files?.full?.url || data.media?.[0]?.files?.thumb?.url
    const mediaType = data.media?.[0]?.type || 'photo'
    const tipAmount = parseFloat(data.price || 0)
    const isTip = tipAmount > 0

    await supabase.from('chat').upsert({
      fan_id: fanId,
      model_id: modelId,
      message: cleanHTML(data.text) || (mediaUrl ? `[${mediaType}]` : ''),
      from: from,
      timestamp: new Date(data.createdAt || Date.now()).toISOString(),
      of_message_id: messageId,
      media_url: mediaUrl,
      media_type: mediaType,
      amount: tipAmount,
      read: data.isOpened || false,
      source: 'webhook'
    }, { onConflict: 'of_message_id' })

    // Notification
    if (from === 'fan') {
      const fanName = data.fromUser?.name || 'A fan'
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

// 🔥 NUEVA FUNCIÓN: handlePurchase (separada de tips)
async function handlePurchase(data, modelId) {
  try {
    console.log('💰 Purchase detected:', data)
    
    const fanId = data.user?.id?.toString() || data.from_user?.id?.toString()
    const fanName = data.user?.name || data.from_user?.name || 'Un fan'
    const amount = parseFloat(data.amount || data.price || 0)
    const messageId = data.message?.id?.toString() || data.message_id?.toString()
    
    if (!fanId || amount === 0) {
      console.log('⚠️ Invalid purchase data:', { fanId, amount })
      return
    }

    console.log('🔍 Looking for PPV message:', messageId)

    // 1. BUSCAR MENSAJE PPV POR of_message_id
    if (messageId) {
      const { data: ppvMessage, error: findError } = await supabase
        .from('chat')
        .select('*')
        .eq('of_message_id', messageId)
        .eq('model_id', modelId)
        .single()

      if (findError) {
        console.log('⚠️ PPV message not found:', messageId, findError)
      } else if (ppvMessage) {
        console.log('✅ PPV message found! Unlocking...')
        
        // 2. ACTUALIZAR MENSAJE: Desbloquear PPV
        const { error: updateError } = await supabase
          .from('chat')
          .update({
            is_purchased: true,
            is_locked: false,
            ppv_unlocked: true,
            is_opened: true
          })
          .eq('of_message_id', messageId)
          .eq('model_id', modelId)

        if (updateError) {
          console.error('❌ Error unlocking PPV:', updateError)
        } else {
          console.log('🔓 PPV unlocked successfully!')
        }
      }
    }

    // 3. SUMAR A SPENT_TOTAL
    await supabase.rpc('increment_fan_spent', {
      p_fan_id: fanId,
      p_model_id: modelId,
      p_amount: amount
    })

    // 4. CREAR NOTIFICACIÓN
    await createNotification(
      modelId,
      fanId,
      'new_purchase',
      `${fanName} desbloqueó contenido por $${amount}`,
      'PPV desbloqueado',
      amount,
      { message_id: messageId }
    )

    console.log('✅ Purchase handled successfully')

  } catch (error) {
    console.error('💥 Error handling purchase:', error)
  }
}

// 🔥 FUNCIÓN ORIGINAL: handleTransaction (solo para tips ahora)
async function handleTransaction(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.from_user?.id?.toString()
    const fanName = data.user?.name || data.from_user?.name || 'Un fan'
    const amount = parseFloat(data.amount || data.price || 0)
    
    if (!fanId || amount === 0) return

    // Solo tips (purchases.created ahora usa handlePurchase)
    await createNotification(
      modelId,
      fanId,
      'new_tip',
      `${fanName} te envió un tip de $${amount}`,
      'Nuevo tip',
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

    const contentType = data.post ? 'post' : 'message'
    
    await createNotification(
      modelId,
      fanId,
      'new_like',
      `${fanName} le dio like a tu ${contentType}`,
      `Like en ${contentType}`
    )

  } catch (error) {
    console.error('💥 Error handling like:', error)
  }
}
