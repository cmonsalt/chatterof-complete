// /api/of/send-ppv.js
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { modelId, fanId, contentId, price, title } = req.body;

    if (!modelId || !fanId || !contentId || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    console.log(`📦 Sending PPV to fan ${fanId}: ${title} ($${price})`);

    // 1. Obtener sesión
    const { data: session } = await supabase
      .from('of_sessions')
      .select('*')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .single();

    if (!session) {
      return res.status(401).json({ error: 'Not connected' });
    }

    const sessCookie = decrypt(session.sess_encrypted);
    const authId = decrypt(session.auth_id_encrypted);

    // 2. Enviar PPV a OnlyFans
    const response = await fetch(`https://onlyfans.com/api2/v2/chats/${fanId}/messages`, {
      method: 'POST',
      headers: {
        'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
        'User-Agent': session.user_agent,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text: title || 'Check this out 🔥',
        price: parseFloat(price),
        lockedText: true,
        mediaIds: [contentId] // ID del media en OF vault
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send PPV');
    }

    const data = await response.json();
    console.log('✅ PPV sent to OF');

    // 3. Registrar en content_sends
    await supabase.from('content_sends').insert({
      fan_id: fanId,
      catalog_offer_id: contentId,
      model_id: modelId,
      status: 'sent',
      price_charged: parseFloat(price),
      sent_at: new Date().toISOString()
    });

    // 4. Guardar mensaje en chat
    await supabase.from('chat').insert({
      fan_id: fanId,
      model_id: modelId,
      from: 'model',
      message: `Sent PPV: ${title || 'Content'}`,
      message_type: 'ppv_locked',
      amount: parseFloat(price),
      timestamp: new Date().toISOString(),
      source: 'app'
    });

    console.log('✅ PPV tracked in DB');

    res.json({ 
      success: true,
      messageId: data.id
    });

  } catch (error) {
    console.error('💥 Error in send-ppv:', error);
    res.status(500).json({ error: error.message });
  }
}
