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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body

    console.log('Webhook received:', {
      event: payload.event,
      accountId: payload.account?.id
    })

    // Get model_id from account_id
    const { data: model } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', payload.account?.id)
      .single()

    if (!model) {
      console.log('Model not found for accountId:', payload.account?.id)
      return res.status(200).json({ received: true })
    }

    const modelId = model.model_id

    // Handle different webhook events
    switch (payload.event) {
      case 'message.received':
      case 'message.sent':
        await handleMessage(payload.data, modelId)
        break

      case 'subscription.created':
      case 'subscription.renewed':
        await handleNewSubscriber(payload.data, modelId)
        break

      case 'purchase.created':
      case 'tip.received':
        await handleTransaction(payload.data, modelId)
        break

      default:
        console.log('Unknown event type:', payload.event)
    }

    return res.status(200).json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function handleMessage(data, modelId) {
  try {
    const fanId = data.fromUser?.id?.toString() || data.user?.id?.toString()
    
    if (!fanId) return

    // Ensure fan exists
    await supabase.from('fans').upsert({
      fan_id: fanId,
      name: data.fromUser?.name || data.user?.name || 'Unknown',
      model_id: modelId,
      of_username: data.fromUser?.username || data.user?.username,
      of_avatar_url: data.fromUser?.avatar || data.user?.avatar,
      last_message_date: data.createdAt || new Date().toISOString()
    }, { onConflict: 'fan_id' })

    // Save message
    const chatData = {
      fan_id: fanId,
      message: cleanHTML(data.text),
      model_id: modelId,
      timestamp: data.createdAt || new Date().toISOString(),
      from: data.isSentByMe ? 'model' : 'fan',
      message_type: data.mediaCount > 0 || data.media?.length > 0 ? 'media' : 'text',
      of_message_id: data.id?.toString(),
      media_url: data.media?.[0]?.src || data.media?.[0]?.thumb,
      media_urls: data.media?.map(m => m.src || m.thumb).filter(Boolean).join(','),
      amount: parseFloat(data.price || 0),
      read: data.isOpened || false,
      source: 'webhook',
      is_locked: !data.isFree,
      is_purchased: data.canPurchaseReason === 'purchased' || data.isFree,
      locked_text: data.lockedText || false
    }

    await supabase.from('chat').upsert(chatData, { onConflict: 'of_message_id' })

    console.log(`Message saved: ${data.id} from fan ${fanId}`)
  } catch (error) {
    console.error('Error handling message:', error)
  }
}

async function handleNewSubscriber(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.subscriber?.id?.toString()
    
    if (!fanId) return

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

    console.log(`New subscriber: ${fanId}`)
  } catch (error) {
    console.error('Error handling subscriber:', error)
  }
}

async function handleTransaction(data, modelId) {
  try {
    const fanId = data.user?.id?.toString() || data.fromUser?.id?.toString()
    
    if (!fanId) return

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

    console.log(`Transaction saved: $${amount} from fan ${fanId}`)
  } catch (error) {
    console.error('Error handling transaction:', error)
  }
}
