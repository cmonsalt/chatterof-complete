// /api/of-sync.js - Sincroniza datos usando API oficial de OnlyFans
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const OF_API_KEY = process.env.ONLYFANS_API_KEY;
const OF_API_URL = process.env.ONLYFANS_API_URL || 'https://api.onlyfansapi.com/v1';

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
    const { modelId } = req.body;

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' });
    }

    console.log(`🔄 Starting sync for model: ${modelId}`);

    // Obtener account_id de la BD
    const { data: modelData } = await supabase
      .from('models')
      .select('of_account_id')
      .eq('model_id', modelId)
      .single();

    if (!modelData?.of_account_id) {
      return res.status(404).json({ 
        error: 'OnlyFans account not connected. Please connect account first.' 
      });
    }

    const accountId = modelData.of_account_id;
    console.log(`📋 Using account ID: ${accountId}`);

    // Headers para OF API oficial
    const headers = {
      'Authorization': `Bearer ${OF_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Account-Id': accountId // Usar el account_id correcto
    };

    // 1. Sincronizar fans/subscribers usando endpoint correcto
    console.log('👥 Fetching subscribers...');
    const fansResponse = await fetch(`${OF_API_URL}/fans/active`, {
      method: 'GET',
      headers
    });

    let syncedFans = 0;
    if (fansResponse.ok) {
      const fansData = await fansResponse.json();
      const fans = fansData.subscribers || fansData.data || [];

      for (const fan of fans) {
        await supabase.from('fans').upsert({
          fan_id: fan.id?.toString() || fan.user_id?.toString(),
          model_id: modelId,
          name: fan.name || fan.display_name || `Fan ${fan.id}`,
          of_username: fan.username || `u${fan.id}`,
          of_avatar_url: fan.avatar || fan.avatar_url || null,
          tier: 0,
          spent_total: parseFloat(fan.spent_total || fan.total_spent || 0),
          last_message_date: fan.subscribed_on || fan.created_at || new Date().toISOString()
        }, {
          onConflict: 'fan_id,model_id'
        });
      }

      syncedFans = fans.length;
      console.log(`✅ Synced ${syncedFans} fans`);
    } else {
      console.log('⚠️ Failed to fetch fans:', fansResponse.status);
    }

    // 2. Sincronizar chats/mensajes recientes usando endpoint correcto
    console.log('💬 Fetching recent chats...');
    const chatsResponse = await fetch(`${OF_API_URL}/chats`, {
      method: 'GET',
      headers
    });

    let syncedChats = 0;
    if (chatsResponse.ok) {
      const chatsData = await chatsResponse.json();
      const chats = chatsData.chats || chatsData.data || [];

      for (const chat of chats) {
        // Guardar mensaje en BD
        await supabase.from('chat').upsert({
          message_id: chat.id?.toString() || chat.message_id?.toString(),
          fan_id: chat.from_user_id?.toString() || chat.fan_id?.toString(),
          model_id: modelId,
          message_text: chat.text || chat.message || '',
          sender_type: chat.from_user?.id === modelId ? 'model' : 'fan',
          created_at: chat.created_at || new Date().toISOString()
        }, {
          onConflict: 'message_id'
        });
      }

      syncedChats = chats.length;
      console.log(`✅ Synced ${syncedChats} messages`);
    } else {
      console.log('⚠️ Failed to fetch chats:', chatsResponse.status);
    }

    // 3. Actualizar timestamp de sincronización
    await supabase
      .from('models')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId);

    res.json({
      success: true,
      synced: {
        fans: syncedFans,
        messages: syncedChats
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Sync error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.toString()
    });
  }
}
