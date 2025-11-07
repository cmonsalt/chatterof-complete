import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    accountId, 
    modelId, 
    chatId, 
    text, 
    mediaFiles, 
    price,
    replyToMessageId,  // ðŸ”¥ REPLY
    replyToText        // ðŸ”¥ REPLY
  } = req.body;
  
  const API_KEY = process.env.ONLYFANS_API_KEY;

  // âœ… Validar que tenemos AMBOS IDs
  if (!accountId || !modelId || !chatId || !text) {
    return res.status(400).json({ 
      error: 'accountId, modelId, chatId, and text required' 
    });
  }

  // ðŸ”¥ Validar PPV (precio requiere media)
  if (price && price > 0 && (!mediaFiles || mediaFiles.length === 0)) {
    return res.status(400).json({
      error: 'PPV messages must include media files'
    });
  }

  try {
    // Formatear texto con HTML bÃ¡sico
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
      console.error('❌ OnlyFans error:', JSON.stringify(error, null, 2));
      
      // Si hay errores específicos, mostrarlos
      if (error.onlyfans_response?.body?.errors) {
        console.error('📋 Specific errors:', JSON.stringify(error.onlyfans_response.body.errors, null, 2));
      }
      
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // ðŸ”¥ Detectar tipo de media si se enviÃ³
    let mediaType = null
    if (mediaFiles && mediaFiles.length > 0) {
      const firstMedia = mediaFiles[0]
      // Si viene del catÃ¡logo, puede tener el tipo
      if (typeof firstMedia === 'string') {
        if (firstMedia.includes('.mp4') || firstMedia.includes('video')) {
          mediaType = 'video'
        } else if (firstMedia.includes('.gif')) {
          mediaType = 'gif'
        } else {
          mediaType = 'photo'
        }
      }
    }

    // 2. Guardar mensaje en BD con nombres de columnas CORRECTOS
    const { error: dbError } = await supabase.from('chat').insert({
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text,
      ts: new Date().toISOString(),
      from: 'model',
      read: false,
      amount: price || null,
      media_url: mediaFiles?.[0] || null,
      media_type: mediaType,
      // ðŸ”¥ REPLY
      reply_to_message_id: replyToMessageId || null,
      reply_to_text: replyToText || null
    });

    if (dbError) {
      console.error('âŒ Database error:', dbError);
      throw new Error('Failed to save message to database');
    }

    console.log('âœ… Message sent and saved:', {
      of_message_id: data.id,
      fan_id: chatId,
      model_id: modelId,
      read: false,
      ppv_price: price || 0,
      has_reply: !!replyToMessageId
    });

    res.status(200).json({ 
      success: true, 
      message: data 
    });
  } catch (error) {
    console.error('âŒ Send message error:', error);
    res.status(500).json({ error: error.message });
  }
}
