// /api/of/send-message.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

// Función para desencriptar
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { modelId, fanId, message } = req.body;

    if (!modelId || !fanId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    console.log(`💬 Sending message to fan ${fanId}`);

    // 1. Obtener sesión
    const { data: session, error: sessionError } = await supabase
      .from('of_sessions')
      .select('*')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ 
        error: 'Not connected to OnlyFans. Please reconnect.' 
      });
    }

    // 2. Desencriptar cookies
    const sessCookie = decrypt(session.sess_encrypted);
    const authId = decrypt(session.auth_id_encrypted);

    // 3. Enviar mensaje a OnlyFans
    const response = await fetch(`https://onlyfans.com/api2/v2/chats/${fanId}/messages`, {
      method: 'POST',
      headers: {
        'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
        'User-Agent': session.user_agent,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text: message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OnlyFans error:', errorText);
      throw new Error('Failed to send message to OnlyFans');
    }

    const data = await response.json();
    console.log('✅ Message sent to OF');

    // 4. Guardar en BD
    await supabase.from('chat').insert({
      fan_id: fanId,
      model_id: modelId,
      from: 'model',
      message: message,
      message_type: 'text',
      timestamp: new Date().toISOString(),
      source: 'app'
    });

    console.log('✅ Message saved to DB');

    // 5. Actualizar stats
    const today = new Date().toISOString().split('T')[0];
    await supabase.rpc('increment_daily_messages', {
      p_model_id: modelId,
      p_date: today
    }).catch(() => {
      // Si la función no existe, ignorar
    });

    res.json({ 
      success: true,
      messageId: data.id
    });

  } catch (error) {
    console.error('💥 Error in send-message:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}
