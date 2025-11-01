// /api/sync-data.js - Recibe datos desde la extensión
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { modelId, fans, timestamp } = req.body;

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' });
    }

    console.log(`📥 Receiving sync for ${modelId}: ${fans?.length || 0} fans`);

    // Guardar/actualizar fans
    if (fans && fans.length > 0) {
      for (const fan of fans) {
        await supabase.from('fans').upsert({
          fan_id: fan.id?.toString(),
          model_id: modelId,
          name: fan.name || `Fan ${fan.id}`,
          of_username: fan.username || `u${fan.id}`,
          of_avatar_url: fan.avatar || fan.avatarUrl || null,
          tier: 0,
          spent_total: parseFloat(fan.spentTotal || 0),
          last_message_date: fan.subscribedOn || new Date().toISOString()
        }, {
          onConflict: 'fan_id,model_id'
        });
      }
    }

    // Actualizar last_sync en of_sessions
    await supabase
      .from('of_sessions')
      .update({ last_sync: timestamp || new Date().toISOString() })
      .eq('model_id', modelId);

    res.json({ 
      success: true, 
      synced: {
        fans: fans?.length || 0
      }
    });

  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).json({ error: error.message });
  }
}
