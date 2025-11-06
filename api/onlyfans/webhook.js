import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Helper to clean HTML
function cleanHTML(text) {
  if (!text) return ''
  return text
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

// Helper to create notification
async function createNotification(modelId, fanId, type, title, message, amount = null, metadata = {}) {
  console.log('🔔 Creating notification:', { modelId, fanId, type, title, message, amount })
  
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
    console.log('✅ Notification created successfully')
  }
  
  return { data, error }
}

export default async function handler(req, res) {
  console.log('🎯 Webhook received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body

    console.log('📦 Payload:', {
      event: payload.event,
      accountId: payload.account_id,
      payloadKeys: Object.keys(payload.payload || {})
    })

    // Get model_id from account_id
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', payload.account_id)
      .single()

    if (modelError) {
      console.error('❌ Error finding model:', modelError)
    }

    if (!model) {
      console.log('⚠️ Model not found for accountId:', payload.account_id)
      return res.status(200).json({ received: true, message: 'Model not found' })
    }

    const modelId = model.model_id
    console.log('✅ Model found:', modelId)

    // El data real está en payload.payload
    const data = payload.payload

    // Handle different webhook events
    switch (payload.event) {
      case 'messages.received':
      case 'messages.sent':
        console.log('💬 Handling message event')
        await handleMessage(data, modelId)
        break

      case 'subscriptions.new':
        console.log('⭐ Handling new subscriber event')
        await handleNewSubscriber(data, modelId)
        break

      case 'purchases.created':
      case 'tips.received':
        console.log('💰 Handling transaction event')
        await handleTransaction(data, modelId)
        break

      case 'posts.liked':
      case 'messages.liked':
        console.log('❤️ Handling like event')
        await handleLike(data, modelId)
        break

      default:
        console.log('❓ Unknown event type:', payload.event)
    }

    return res.status(200).json({ received: true })

  } catch (error) {
    console.error('💥 Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function handleMessage(data, modelId) {
  try {
    console.log('📨 Processing message:', { 
      messageId: data.id,
      fromUser: data.fromUser?.id,
      isSentByMe: data.isSentByMe 
    })

    const fanId = data.fromUser?.id?.toString() || data.user?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found in message')
      return
    }

    // Ensure fan exists
    console.log('👤 Upserting fan:', fanId)
    await supabase.from('fans').upsert({
      fan_id: fanId,
      name: data.fromUser?.name || data.user?.name || 'Unknown',
      model_id: modelId,
      of_username: data.fromUser?.username || data.user?.username,
      of_avatar_url: data.fromUser?.avatar || data.user?.avatar,
      last_message_date: data.createdAt || new Date().toISOString()
    }, { onConflict: 'fan_id' })

    // Save message
    console.log('💾 Saving message to chat table')
    const chatData = {
      fan_id: fanId,
      message: cleanHTML(data.text),
      model_id: modelId,
      timestamp: data.createdAt || new Date().toISOString(),
      from: data.isSentByMe ? 'model' : 'fan',
      message_type: data.mediaCount > 0 || data.media?.length > 0 ? 'media' : 'text',
      of_message_id: data.id?.toString(),
      media_url: data.media?.[0]?.files?.full?.url || data.media?.[0]?.files?.thumb?.url,
      media_urls: data.media?.map(m => m.files?.full?.url || m.files?.thumb?.url).filter(Boolean).join(','),
      amount: parseFloat(data.price || 0),
      read: data.isOpened || false,
      source: 'webhook',
      is_locked: !data.isFree,
      is_purchased: data.canPurchaseReason === 'purchased' || data.canPurchaseReason === 'opened' || data.isFree,
      locked_text: data.lockedText || false
    }

    const { error: chatError } = await supabase.from('chat').upsert(chatData, { onConflict: 'of_message_id' })
    
    if (chatError) {
      console.error('❌ Error saving message:', chatError)
    } else {
      console.log('✅ Message saved successfully')
    }

    // Create notification if message is from fan
    if (!data.isSentByMe) {
      console.log('🔔 Message is from fan, creating notification')
      const fanName = data.fromUser?.name || data.user?.name || 'Un fan'
      const messagePreview = cleanHTML(data.text).slice(0, 50) || (data.mediaCount > 0 ? 'Envió contenido multimedia' : 'Nuevo mensaje')
      
      await createNotification(
        modelId,
        fanId,
        'new_message',
        `${fanName} te escribió`,
        messagePreview,
        parseFloat(data.price || 0),
        { chat_id: data.id }
      )
    } else {
      console.log('📤 Message sent by model, no notification needed')
    }

    console.log(`✅ Message handled: ${data.id} from fan ${fanId}`)
  } catch (error) {
    console.error('💥 Error handling message:', error)
  }
}

async function handleNewSubscriber(data, modelId) {
  try {
    console.log('⭐ Processing new subscriber')
    const fanId = data.user?.id?.toString() || data.subscriber?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found in subscriber data')
      return
    }

    const subInfo = data.subscription || data

    const fanData = {
      fan_id: fanId,
      name: data.user?.name || data.subscriber?.name || 'Unknown',
      model_id: modelId,
      of_username: data.user?.username || data.subscriber?.username,
      of_avatar_url: data.user?.avatar || data.subscriber?.avatar,
      is_subscribed: true,
      subscription_date: subInfo.createdAt || subInfo.subscribeAt || new Date().toISOString(),
      subscription_type: subInfo.type || 'paid',
      subscription_price: parseFloat(subInfo.price || 0),
      is_renewal_enabled: subInfo.isAutoRenew || false,
      subscription_expires_at: subInfo.expireDate || subInfo.expiredAt
    }

    await supabase.from('fans').upsert(fanData, { onConflict: 'fan_id' })

    // Create notification
    const fanName = data.user?.name || data.subscriber?.name || 'Un nuevo fan'
    const amount = parseFloat(subInfo.price || 0)
    
    await createNotification(
      modelId,
      fanId,
      'new_subscriber',
      `${fanName} se suscribió! 🎉`,
      `Nueva suscripción ${amount > 0 ? `por $${amount.toFixed(2)}` : 'gratuita'}`,
      amount
    )

    console.log(`✅ New subscriber: ${fanId}`)
  } catch (error) {
    console.error('💥 Error handling subscriber:', error)
  }
}

async function handleTransaction(data, modelId) {
  try {
    console.log('💰 Processing transaction')
    const fanId = data.user?.id?.toString() || data.fromUser?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found in transaction')
      return
    }

    // Determine transaction type
    let type = 'compra'
    if (data.type === 'tip' || data.isTip) type = 'tip'
    if (data.type === 'subscription') type = 'suscripcion'

    const amount = parseFloat(data.amount || data.price || 0)

    // Save transaction
    const txnData = {
      fan_id: fanId,
      type,
      amount,
      model_id: modelId,
      created_at: data.createdAt || new Date().toISOString(),
      description: data.description || data.text || cleanHTML(data.message) || '',
      of_transaction_id: data.id?.toString(),
      payment_method: data.paymentType || 'locked_content',
      detected_by: 'webhook'
    }

    await supabase.from('transactions').upsert(txnData, { onConflict: 'of_transaction_id' })

    // Update fan spent_total
    const { data: fan } = await supabase
      .from('fans')
      .select('spent_total')
      .eq('fan_id', fanId)
      .single()

    if (fan) {
      await supabase
        .from('fans')
        .update({ 
          spent_total: (fan.spent_total || 0) + amount,
          last_update: new Date().toISOString()
        })
        .eq('fan_id', fanId)
    }

    console.log(`✅ Transaction saved: $${amount} from fan ${fanId}`)

    // Create notification
    const fanName = data.user?.name || data.fromUser?.name || 'Un fan'
    const notifType = type === 'tip' ? 'new_tip' : 'new_purchase'
    const title = type === 'tip' 
      ? `${fanName} te envió un tip de $${amount.toFixed(2)}! 💸`
      : `${fanName} compró contenido por $${amount.toFixed(2)} 💰`
    const message = data.description || data.text || cleanHTML(data.message) || 'Nueva transacción'
    
    await createNotification(
      modelId,
      fanId,
      notifType,
      title,
      message.slice(0, 50),
      amount,
      { transaction_id: data.id }
    )

  } catch (error) {
    console.error('💥 Error handling transaction:', error)
  }
}

async function handleLike(data, modelId) {
  try {
    console.log('❤️ Processing like event')
    
    const fanId = data.user?.id?.toString() || data.fromUser?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found in like event')
      return
    }

    const fanName = data.user?.name || data.fromUser?.name || 'Un fan'
    const contentType = data.post ? 'post' : 'mensaje'
    const contentPreview = data.post?.text || data.message?.text || 'tu contenido'

    console.log(`❤️ Like from ${fanName} on ${contentType}`)

    // Create notification
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

    console.log(`✅ Like notification created for fan ${fanId}`)
  } catch (error) {
    console.error('💥 Error handling like:', error)
  }
}
