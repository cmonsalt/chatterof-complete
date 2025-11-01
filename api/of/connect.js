// /api/of/connect.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key para bypassear RLS
);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!'; // 32 caracteres

// Función para encriptar
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
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model_id, sess_cookie, auth_id, user_agent } = req.body;

    // Validar datos
    if (!model_id || !sess_cookie || !auth_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: model_id, sess_cookie, auth_id' 
      });
    }

    console.log('🔐 Connecting model:', model_id);

    // Encriptar cookies
    const sessEncrypted = encrypt(sess_cookie);
    const authIdEncrypted = encrypt(auth_id);

    // Guardar en BD
    const { data, error } = await supabase
      .from('of_sessions')
      .upsert({
        model_id: model_id,
        sess_encrypted: sessEncrypted,
        auth_id_encrypted: authIdEncrypted,
        user_agent: user_agent || 'Unknown',
        last_sync: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
        is_active: true
      }, {
        onConflict: 'model_id'
      });

    if (error) {
      console.error('❌ Supabase error:', error);
      throw error;
    }

    console.log('✅ Session saved for:', model_id);

    // 🔥 IMPORTANTE: Iniciar sincronización inicial
    await syncInitialData(model_id, sess_cookie, auth_id, user_agent);

    res.json({ 
      success: true,
      message: 'Connected successfully. Syncing data...'
    });

  } catch (error) {
    console.error('💥 Error in /api/of/connect:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to connect' 
    });
  }
}

// 🔥 Sincronización inicial
async function syncInitialData(modelId, sessCookie, authId, userAgent) {
  console.log('🔄 Starting initial sync for:', modelId);

  try {
    // Headers para requests a OF
    const headers = {
      'Cookie': `sess=${sessCookie}; auth_id=${authId}`,
      'User-Agent': userAgent,
      'Accept': 'application/json'
    };

    // 1. Sincronizar fans (suscriptores)
    console.log('👥 Syncing fans...');
    const fansResponse = await fetch('https://onlyfans.com/api2/v2/subscriptions/subscribers?limit=100', {
      headers
    });

    if (fansResponse.ok) {
      const fansData = await fansResponse.json();
      const fans = fansData.list || [];

      console.log(`✅ Found ${fans.length} fans`);

      // Insertar fans en BD
      for (const fan of fans) {
        await supabase.from('fans').upsert({
          fan_id: fan.id?.toString(),
          model_id: modelId,
          name: fan.name || `Fan ${fan.id}`,
          of_username: fan.username || `u${fan.id}`,
          of_avatar_url: fan.avatar || null,
          tier: 0, // Se calculará automáticamente
          spent_total: 0,
          last_message_date: new Date().toISOString()
        }, {
          onConflict: 'fan_id,model_id'
        });
      }

      console.log('✅ Fans synced');
    }

    // 2. Sincronizar vault (catálogo)
    console.log('📦 Syncing vault...');
    const vaultResponse = await fetch('https://onlyfans.com/api2/v2/vault/lists?limit=100', {
      headers
    });

    if (vaultResponse.ok) {
      const vaultData = await vaultResponse.json();
      const media = vaultData.list || [];

      console.log(`✅ Found ${media.length} vault items`);

      // Insertar en catálogo
      for (const item of media.slice(0, 20)) { // Limitar a 20 primeros
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

  } catch (error) {
    console.error('❌ Error in initial sync:', error);
    // No hacer throw para no fallar el connect
  }
}
