import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, data } = req.body;

  try {
    switch (event) {
      // Nuevo mensaje recibido
      case 'messages.received':
        await supabase.from('chat').insert({
          fan_id: data.fromUser.id,
          message: data.text,
          timestamp: new Date(data.createdAt),
          from: 'fan',
          model_id: data.toUser.id,
          media: data.media || []
        });
        break;

      // PPV desbloqueado (comprado)
      case 'messages.ppv.unlocked':
        // Actualizar total gastado del fan
        await supabase.rpc('increment_fan_spending', {
          p_fan_id: data.fromUser.id,
          p_amount: data.price
        });

        // Registrar transacción
        await supabase.from('transactions').insert({
          fan_id: data.fromUser.id,
          type: 'ppv',
          amount: data.price,
          created_at: new Date(data.unlockedAt),
          message_id: data.id
        });
        break;

      // Tip recibido
      case 'tip.received':
        await supabase.rpc('increment_fan_spending', {
          p_fan_id: data.fromUser.id,
          p_amount: data.amount
        });

        await supabase.from('transactions').insert({
          fan_id: data.fromUser.id,
          type: 'tip',
          amount: data.amount,
          created_at: new Date(data.createdAt)
        });
        break;

      // Nueva suscripción
      case 'subscription.new':
      case 'subscription.renewed':
        await supabase.from('fans').upsert({
          fan_id: data.user.id,
          of_username: data.user.username,
          of_avatar_url: data.user.avatar,
          subscription_active: true,
          subscription_price: data.price,
          last_subscription_date: new Date(data.subscribedAt),
          model_id: data.creator.id
        });

        await supabase.rpc('increment_fan_spending', {
          p_fan_id: data.user.id,
          p_amount: data.price
        });

        await supabase.from('transactions').insert({
          fan_id: data.user.id,
          type: 'subscription',
          amount: data.price,
          created_at: new Date(data.subscribedAt)
        });
        break;
    }

    // Log del webhook recibido
    await supabase.from('webhooks').insert({
      event_type: event,
      payload: data,
      created_at: new Date(),
      processed: true
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Log del error
    await supabase.from('webhooks').insert({
      event_type: event,
      payload: data,
      created_at: new Date(),
      processed: false,
      error: error.message
    });

    res.status(500).json({ error: error.message });
  }
}
