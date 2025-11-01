// /api/check-connection.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key bypasses RLS
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { modelId } = req.query;

  if (!modelId) {
    return res.status(400).json({ error: 'modelId required' });
  }

  try {
    const { data } = await supabase
      .from('of_sessions')
      .select('last_sync, is_active')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .maybeSingle();

    res.json({ 
      connected: !!data, 
      lastSync: data?.last_sync || null 
    });

  } catch (error) {
    console.error('Error checking connection:', error);
    res.status(500).json({ error: error.message });
  }
}
