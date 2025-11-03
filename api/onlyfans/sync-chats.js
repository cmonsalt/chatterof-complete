import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // Obtener todos los chats de la cuenta
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats`,
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

    // Guardar chats en BD (solo info básica, mensajes se cargan después)
    for (const chat of data.data || []) {
      await supabase.from('fans').upsert({
        fan_id: chat.withUser.id,
        of_username: chat.withUser.username,
        of_avatar_url: chat.withUser.avatar,
        last_message: chat.lastMessage?.text || '',
        last_message_at: chat.lastMessage?.createdAt || null,
        unread_count: chat.hasNotViewedMessages ? 1 : 0,
        model_id: accountId
      });
    }

    res.status(200).json({ 
      success: true, 
      chatsCount: data.data?.length || 0 
    });
  } catch (error) {
    console.error('Sync chats error:', error);
    res.status(500).json({ error: error.message });
  }
}
