import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, chatId, text, mediaFiles, price } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !chatId || !text) {
    return res.status(400).json({ error: 'accountId, chatId, and text required' });
  }

  try {
    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    const payload = {
      text: formattedText,
      ...(mediaFiles && mediaFiles.length > 0 && { mediaFiles }),
      ...(price && price > 0 && { price })
    };

    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Guardar mensaje enviado en BD
    await supabase.from('chat').insert({
      message_id: data.id,
      fan_id: chatId,
      message: text,
      timestamp: new Date(),
      from: 'model',
      media: mediaFiles || [],
      is_ppv: price > 0,
      ppv_price: price || 0,
      model_id: accountId
    });

    res.status(200).json({ 
      success: true, 
      message: data 
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
}
