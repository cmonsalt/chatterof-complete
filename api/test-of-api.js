// /api/test-of-api.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

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
  const { modelId } = req.query;

  if (!modelId) {
    return res.status(400).json({ error: 'modelId required' });
  }

  try {
    // Get session
    const { data: session } = await supabase
      .from('of_sessions')
      .select('*')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'No active session' });
    }

    // Decrypt cookies
    const sessCookie = decrypt(session.sess_encrypted);
    const authId = decrypt(session.auth_id_encrypted);

    const headers = {
      'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
      'User-Agent': session.user_agent,
      'Accept': 'application/json'
    };

    // Test API call
    console.log('🔍 Testing OF API...');
    const response = await fetch('https://onlyfans.com/api2/v2/subscriptions/subscribers?limit=10', {
      headers
    });

    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Data received:', JSON.stringify(data, null, 2));
      
      res.json({
        success: true,
        status: response.status,
        fansCount: data.list?.length || 0,
        fans: data.list || [],
        rawResponse: data
      });
    } else {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
      
      res.json({
        success: false,
        status: response.status,
        error: errorText
      });
    }

  } catch (error) {
    console.error('💥 Error:', error);
    res.status(500).json({ error: error.message });
  }
}
