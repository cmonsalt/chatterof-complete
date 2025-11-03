import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { accountId, chatId, limit = 20 } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !chatId) {
    return res.status(400).json({ error: 'accountId and chatId required' });
  }

  try {
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/messages?skip_users=all&order=desc`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.data || [];

    // Guardar mensajes en BD
    const messagesToInsert = messages.slice(0, limit).map(msg => ({
      message_id: msg.id,
      fan_id: chatId,
      message: msg.text,
      timestamp: new Date(msg.createdAt),
      from: msg.isSentByMe ? 'model' : 'fan',
      media: msg.media || [],
      is_ppv: msg.price > 0,
      ppv_price: msg.price || 0,
      is_opened: msg.isOpened,
      model_id: accountId
    }));

    if (messagesToInsert.length > 0) {
      await supabase.from('chat').upsert(messagesToInsert, {
        onConflict: 'message_id'
      });
    }

    res.status(200).json({ 
      success: true, 
      messagesCount: messagesToInsert.length,
      messages: messagesToInsert
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
}
