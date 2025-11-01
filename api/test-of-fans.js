// /api/test-of-fans.js - Prueba con headers reales de BD
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { HttpsProxyAgent } from 'https-proxy-agent';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';
const PROXY_URL = 'http://stonysolitude151430:KhLvKb761WX0@3hsu5e5kjf.cn.fxdx.in:16508';

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { modelId } = req.query;
  if (!modelId) return res.status(400).json({ error: 'modelId required' });

  try {
    // Obtener sesión de BD
    const { data: session } = await supabase
      .from('of_sessions')
      .select('*')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'No active session' });
    }

    // Desencriptar cookies
    const sessCookie = decrypt(session.sess_encrypted);
    const authId = decrypt(session.auth_id_encrypted);

    // Headers base
    const headers = {
      'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
      'Accept': 'application/json',
    };

    // Agregar headers dinámicos de BD
    if (session.of_headers) {
      Object.keys(session.of_headers).forEach(key => {
        headers[key] = session.of_headers[key];
      });
    }

    console.log('📋 Using headers:', Object.keys(headers));

    // Configurar proxy
    const agent = new HttpsProxyAgent(PROXY_URL);

    // Test: Obtener suscriptores
    console.log('🔍 Fetching subscribers...');
    const response = await fetch('https://onlyfans.com/api2/v2/subscriptions/subscribers?limit=10', {
      headers,
      agent
    });

    console.log('📊 Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      const fans = data.list || [];
      
      res.json({
        success: true,
        status: response.status,
        fansCount: fans.length,
        fans: fans.map(f => ({
          id: f.id,
          username: f.username,
          name: f.name
        }))
      });
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
      res.json({
        success: false,
        status: response.status,
        error: error
      });
    }

  } catch (error) {
    console.error('💥 Error:', error);
    res.status(500).json({ error: error.message });
  }
}
