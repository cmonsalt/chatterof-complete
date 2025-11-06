import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, modelId, chatId, text, mediaFiles, price } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  // ✅ Validar que tenemos AMBOS IDs
  if (!accountId || !modelId || !chatId || !text) {
    return res.status(400).json({ 
      error: 'accountId, modelId, chatId, and text required' 
    });
  }

  try {
    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    const payload = {
      text: formattedText,
      ...(mediaFiles && mediaFiles.length > 0 && { mediaFiles }),
      ...(price && price > 0 && { price })
    };

    // 1. Enviar a OnlyFans API
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

    // 2. Guardar mensaje en BD con nombres de columnas CORRECTOS
    const { error: dbError } = await supabase.from('chat').insert({
      of_message_id: data.id?.toString(),  // ✅ ID de OnlyFans
      fan_id: chatId,                       // ✅ ID del fan
      model_id: modelId,                    // ✅ ID del modelo en Supabase
      message: text,                        // ✅ Texto del mensaje
      ts: new Date().toISOString(),         // ✅ Usar 'ts' no 'timestamp'
      from: 'model',                        // ✅ Enviado por el modelo
      read: false,                          // ✅ Iniciar como no leído
      amount: price || null,                // ✅ Precio si es PPV
      media_url: mediaFiles?.[0] || null    // ✅ Primera media si existe
    });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw new Error('Failed to save message to database');
    }

    console.log('✅ Message sent and saved:', {
      of_message_id: data.id,
      fan_id: chatId,
      model_id: modelId,
      read: false
    });

    res.status(200).json({ 
      success: true, 
      message: data 
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ error: error.message });
  }
}
