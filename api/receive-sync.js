// /api/receive-sync.js - Recibe datos desde extension
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
    const { modelId, type, data } = req.body;

    if (!modelId || !type || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📥 Receiving ${type} data for ${modelId}`);

    // Procesar según tipo de datos
    switch (type) {
      case 'fans':
        await syncFans(modelId, data);
        break;
      
      case 'chats':
        await syncChats(modelId, data);
        break;
      
      case 'messages':
        await syncMessages(modelId, data);
        break;
      
      case 'transactions':
        await syncTransactions(modelId, data);
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }

    res.json({ 
      success: true,
      synced: data.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Sync error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Sincronizar fans
async function syncFans(modelId, fans) {
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
  console.log(`✅ Synced ${fans.length} fans`);
}

// Sincronizar chats
async function syncChats(modelId, chats) {
  for (const chat of chats) {
    // Actualizar fan con último mensaje
    await supabase.from('fans').upsert({
      fan_id: chat.withUser?.id?.toString(),
      model_id: modelId,
      name: chat.withUser?.name || 'Unknown',
      of_username: chat.withUser?.username || 'unknown',
      last_message_date: chat.lastMessage?.createdAt || new Date().toISOString()
    }, {
      onConflict: 'fan_id,model_id'
    });
  }
  console.log(`✅ Synced ${chats.length} chats`);
}

// Sincronizar mensajes
async function syncMessages(modelId, messages) {
  for (const msg of messages) {
    await supabase.from('chat').upsert({
      message_id: msg.id?.toString(),
      fan_id: msg.fromUser?.id?.toString(),
      model_id: modelId,
      message_text: msg.text || '',
      sender_type: msg.fromUser?.id === modelId ? 'model' : 'fan',
      price: parseFloat(msg.price || 0),
      is_paid: msg.isOpened || false,
      media_url: msg.media?.[0]?.full || null,
      created_at: msg.createdAt || new Date().toISOString()
    }, {
      onConflict: 'message_id'
    });
  }
  console.log(`✅ Synced ${messages.length} messages`);
}

// Sincronizar transacciones
async function syncTransactions(modelId, transactions) {
  for (const tx of transactions) {
    await supabase.from('transactions').insert({
      transaction_id: tx.id?.toString(),
      fan_id: tx.user?.id?.toString(),
      model_id: modelId,
      amount: parseFloat(tx.amount || 0),
      type: tx.type || 'purchase',
      description: tx.description || '',
      created_at: tx.createdAt || new Date().toISOString()
    }).onConflict('transaction_id').ignore();
  }
  console.log(`✅ Synced ${transactions.length} transactions`);
}
