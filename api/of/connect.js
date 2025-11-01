// /api/of/connect.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export default async function handler(req, res) {
  // ✨ CORS headers
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
    // ✨ Aceptar ambos formatos de campos
    const { 
      model_id, modelId,
      sess_cookie, sess,
      auth_id, authId,
      user_agent, userAgent
    } = req.body;

    const finalModelId = model_id || modelId;
    const finalSess = sess_cookie || sess;
    const finalAuthId = auth_id || authId;
    const finalUserAgent = user_agent || userAgent;

    if (!finalModelId || !finalSess || !finalAuthId) {
      return res.status(400).json({ 
        error: 'Missing required fields: modelId, sess, authId' 
      });
    }

    console.log('🔐 Connecting model:', finalModelId);

    const sessEncrypted = encrypt(finalSess);
    const authIdEncrypted = encrypt(finalAuthId);

    const { error } = await supabase
      .from('of_sessions')
      .upsert({
        model_id: finalModelId,
        sess_encrypted: sessEncrypted,
        auth_id_encrypted: authIdEncrypted,
        user_agent: finalUserAgent || 'Unknown',
        last_sync: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true
      }, {
        onConflict: 'model_id'
      });

    if (error) {
      console.error('❌ Supabase error:', error);
      throw error;
    }

    console.log('✅ Session saved for:', finalModelId);

    const syncResult = await syncInitialData(finalModelId, finalSess, finalAuthId, finalUserAgent);

    res.json({ 
      success: true,
      message: 'Connected successfully',
      syncedFans: syncResult.fansCount || 0
    });

  } catch (error) {
    console.error('💥 Error in /api/of/connect:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to connect' 
    });
  }
}

async function syncInitialData(modelId, sessCookie, authId, userAgent) {
  console.log('🔄 Starting initial sync for:', modelId);

  let fansCount = 0;

  try {
    const headers = {
      'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
      'User-Agent': userAgent,
      'Accept': 'application/json'
    };

    // 1. Sync fans
    console.log('👥 Syncing fans...');
    const fansResponse = await fetch('https://onlyfans.com/api2/v2/subscriptions/subscribers?limit=100', {
      headers
    });

    if (fansResponse.ok) {
      const fansData = await fansResponse.json();
      const fans = fansData.list || [];
      fansCount = fans.length;

      console.log(`✅ Found ${fans.length} fans`);

      for (const fan of fans) {
        await supabase.from('fans').upsert({
          fan_id: fan.id?.toString(),
          model_id: modelId,
          name: fan.name || `Fan ${fan.id}`,
          of_username: fan.username || `u${fan.id}`,
          of_avatar_url: fan.avatar || null,
          tier: 0,
          spent_total: 0,
          last_message_date: new Date().toISOString()
        }, {
          onConflict: 'fan_id,model_id'
        });
      }

      console.log('✅ Fans synced');
    }

    // 2. Sync vault
    console.log('📦 Syncing vault...');
    const vaultResponse = await fetch('https://onlyfans.com/api2/v2/vault/lists?limit=100', {
      headers
    });

    if (vaultResponse.ok) {
      const vaultData = await vaultResponse.json();
      const media = vaultData.list || [];

      console.log(`✅ Found ${media.length} vault items`);

      for (const item of media.slice(0, 20)) {
        await supabase.from('catalog').upsert({
          offer_id: item.id?.toString(),
          model_id: modelId,
          title: item.title || `Content ${item.id}`,
          base_price: item.price || 0,
          nivel: 1,
          tags: item.type || '',
          description: item.text || ''
        }, {
          onConflict: 'offer_id,model_id'
        });
      }

      console.log('✅ Vault synced');
    }

    console.log('🎉 Initial sync completed for:', modelId);
    return { fansCount };

  } catch (error) {
    console.error('❌ Error in initial sync:', error);
    return { fansCount };
  }
}
