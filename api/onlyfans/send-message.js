import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
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
    replyToMessageId,
    replyToText
  } = req.body;
  
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !modelId || !chatId || !text) {
    return res.status(400).json({ 
      error: 'accountId, modelId, chatId, and text required' 
    });
  }

  if (price && price > 0 && (!mediaFiles || mediaFiles.length === 0)) {
    return res.status(400).json({
      error: 'PPV messages must include media files'
    });
  }

  console.log('📥 Send message request:', { 
    accountId, 
    chatId, 
    text: text.substring(0, 50),
    price,
    mediaFiles,
    hasMedia: !!(mediaFiles && mediaFiles.length > 0)
  });

  try {
    // 🔥 USAR VAULT IDs DIRECTAMENTE (sin conversión)
    console.log('✅ Using Vault Media IDs directly:', mediaFiles);
    
    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    // Construir el payload para OnlyFans API
    const payload = {
      text: formattedText,
      isCouplePeopleMedia: false
    };

    // 🔥 Agregar mediaFiles directamente (Vault IDs)
    if (mediaFiles && mediaFiles.length > 0) {
      payload.mediaFiles = mediaFiles.map(id => parseInt(id));  // Convertir a números
      console.log('📦 MediaFiles as integers:', payload.mediaFiles);
    }

    // Agregar precio si es PPV
    if (price && price > 0) {
      payload.price = parseFloat(price);
    }

    // Agregar reply si existe
    if (replyToMessageId && replyToText) {
      payload.repliedMessage = {
        id: replyToMessageId,
        text: replyToText
      };
    }

    console.log('📤 Sending to OnlyFans:', {
      endpoint: `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/messages`,
      payload: {
        text: payload.text.substring(0, 50),
        mediaFiles: payload.mediaFiles,
        price: payload.price
      }
    });

    // Enviar mensaje a OnlyFans
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
      const errorText = await response.text();
      console.error('❌ OnlyFans API error:', errorText);
      return res.status(response.status).json({
        error: 'Failed to send message to OnlyFans',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('✅ Message sent successfully!');
    console.log('📨 Response:', JSON.stringify(data, null, 2));

    // Guardar en BD
    const messageData = {
      fan_id: chatId,
      model_id: modelId,
      message: text,
      from: 'model',
      source: 'manual',
      of_message_id: data.data?.id || data.id,
      ts: new Date().toISOString()
    };

    if (price && price > 0) {
      messageData.is_ppv = true;
      messageData.ppv_price = parseFloat(price);
      messageData.is_locked = true;
      messageData.is_purchased = false;
    }

    if (mediaFiles && mediaFiles.length > 0) {
      messageData.media = JSON.stringify(mediaFiles);
    }

    if (replyToMessageId) {
      messageData.reply_to_message_id = replyToMessageId;
      messageData.reply_to_text = replyToText;
    }

    const { error: dbError } = await supabase
      .from('chat')
      .insert(messageData);

    if (dbError) {
      console.error('❌ Error saving to database:', dbError);
    }

    return res.status(200).json({
      success: true,
      message: 'Message sent',
      data: data.data || data
    });

  } catch (error) {
    console.error('❌ Error in send-message:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
