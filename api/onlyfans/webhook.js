import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body

    console.log('Webhook received:', payload)

    // Get model_id from account_id
    const { data: model } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', payload.accountId)
      .single()

    if (!model) {
      console.log('Model not found for accountId:', payload.accountId)
      return res.status(200).json({ received: true })
    }

    const modelId = model.model_id

    // Handle different webhook events
    switch (payload.event) {
      case 'message:new':
        await handleNewMessage(payload.data, modelId)
        break

      case 'transaction:new':
        await handleNewTransaction(payload.data, modelId)
        break

      case 'subscriber:new':
        await handleNewSubscriber(payload.data, modelId)
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

async function handleNewMessage(data, modelId) {
  const chatData = {
    fan_id: data.fromUser?.id?.toString() || data.userId?.toString(),
    message: data.text || '',
    model_id: modelId,
    timestamp: data.createdAt || new Date().toISOString(),
    from: data.isFromFan ? 'fan' : 'model',
    message_type: data.media?.length > 0 ? 'media' : 'text',
    of_message_id: data.id?.toString(),
    media_url: data.media?.[0]?.src,
    amount: data.price || 0,
    source: 'webhook'
  }

  await supabase.from('chat').upsert(chatData, { onConflict: 'of_message_id' })
  
  // Ensure fan exists
  if (data.fromUser || data.user) {
    const user = data.fromUser || data.user
    await supabase.from('fans').upsert({
      fan_id: user.id?.toString(),
      name: user.name || user.username || 'Unknown',
      model_id: modelId,
      of_username: user.username,
      of_avatar_url: user.avatar,
      last_message_date: data.createdAt
    }, { onConflict: 'fan_id' })
  }
}

async function handleNewTransaction(data, modelId) {
  let type = 'compra'
  if (data.type === 'tip') type = 'tip'
  if (data.type === 'subscription') type = 'suscripcion'

  const txnData = {
    fan_id: data.user?.id?.toString() || 'unknown',
    type,
    amount: parseFloat(data.amount || 0),
    model_id: modelId,
    created_at: data.createdAt || new Date().toISOString(),
    description: data.description || data.text || '',
    of_transaction_id: data.id?.toString(),
    payment_method: data.paymentType || 'locked_content',
    detected_by: 'webhook'
  }

  await supabase.from('transactions').upsert(txnData, { onConflict: 'of_transaction_id' })

  // Update fan spent_total
  if (data.user?.id) {
    const { data: fan } = await supabase
      .from('fans')
      .select('spent_total')
      .eq('fan_id', data.user.id.toString())
      .single()

    if (fan) {
      await supabase
        .from('fans')
        .update({ 
          spent_total: (fan.spent_total || 0) + parseFloat(data.amount || 0)
        })
        .eq('fan_id', data.user.id.toString())
    }
  }
}

async function handleNewSubscriber(data, modelId) {
  const fanData = {
    fan_id: data.id?.toString() || data.userId?.toString(),
    name: data.name || data.username || 'Unknown',
    model_id: modelId,
    of_username: data.username,
    of_avatar_url: data.avatar,
    is_subscribed: true,
    subscription_date: data.subscribedOn || new Date().toISOString()
  }

  await supabase.from('fans').upsert(fanData, { onConflict: 'fan_id' })
}
