import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // Obtener todos los fans con spending
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/fans/list-all-fans`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const fans = data.data || [];

    // Guardar/actualizar fans con su spending total
    for (const fan of fans) {
      await supabase.from('fans').upsert({
        fan_id: fan.id,
        of_username: fan.username,
        of_avatar_url: fan.avatar,
        spent_total: fan.spentTotal || 0,
        subscription_active: fan.subscribedBy,
        subscription_price: fan.subscribePrice || 0,
        last_seen: fan.lastSeen ? new Date(fan.lastSeen) : null,
        model_id: accountId
      }, {
        onConflict: 'fan_id'
      });
    }

    res.status(200).json({ 
      success: true, 
      fansCount: fans.length 
    });
  } catch (error) {
    console.error('Sync fans error:', error);
    res.status(500).json({ error: error.message });
  }
}
