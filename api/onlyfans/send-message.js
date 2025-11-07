// ✅ SEND-MESSAGE - 100% según OnlyFans API documentation
// Ubicación: api/onlyfans/send-message.js

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
    mediaFiles: mediaFiles,
    mediaFilesType: Array.isArray(mediaFiles) ? mediaFiles.map(m => typeof m) : 'not-array'
  });

  try {
    // 🔥 CRÍTICO: Vault IDs deben ser NÚMEROS, no strings
    // Según docs: [3866342509, 1234567890] NO ["3866342509", "1234567890"]
    const finalMediaFiles = mediaFiles.map(id => {
      // Si viene como string, convertir a número
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      console.log(`Converting media ID: ${id} (${typeof id}) → ${numId} (${typeof numId})`);
      return numId;
    });
    
    console.log('✅ Final media IDs (as numbers):', finalMediaFiles);
    
    // Formatear texto
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    // Payload según documentación oficial
    const payload = {
      text: formattedText,
      mediaFiles: finalMediaFiles,
      ...(price && price > 0 && { price }),
      ...(replyToMessageId && { replyToMessageId }),
      ...(replyToText && { replyToText })
    };

    console.log('📦 Payload to OnlyFans:', JSON.stringify(payload, null, 2));

    // Enviar a OnlyFans API
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

    const responseText = await response.text();
    console.log('📥 OnlyFans response:', responseText);

    if (!response.ok) {
      console.error('❌ OnlyFans API error:', responseText);
      
      let errorMessage = `API error: ${response.status}`;
      try {
        const error = JSON.parse(responseText);
        errorMessage = error.message || errorMessage;
        if (error.onlyfans_response?.body?.errors) {
          console.error('📋 Specific errors:', JSON.stringify(error.onlyfans_response.body.errors, null, 2));
          errorMessage = JSON.stringify(error.onlyfans_response.body.errors);
        }
      } catch (parseError) {
        errorMessage = responseText.substring(0, 200);
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = JSON.parse(responseText);
    console.log('✅ Message sent successfully! ID:', data.id);

    // Obtener media info del catálogo
    let mediaUrl = null;
    let mediaThumb = null;
    let mediaType = null;
    
    if (mediaFiles && mediaFiles.length > 0) {
      try {
        const firstMediaId = mediaFiles[0].toString();
        
        const { data: catalogItem, error: catalogError } = await supabase
          .from('catalog')
          .select('media_url, media_thumb, file_type, r2_url')
          .eq('of_media_id', firstMediaId)
          .single();
        
        if (!catalogError && catalogItem) {
          mediaUrl = catalogItem.r2_url || catalogItem.media_url;
          mediaThumb = catalogItem.media_thumb;
          mediaType = catalogItem.file_type;
          console.log('✅ Got media info from catalog');
        }
      } catch (catalogErr) {
        console.warn('⚠️ Could not get media from catalog');
      }
    }

    // Guardar en BD
    const chatData = {
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text.replace(/<[^>]*>/g, ''),
      timestamp: new Date().toISOString(),
      from: 'model',
      read: true,
      source: 'api',
      media_url: mediaUrl,
      media_thumb: mediaThumb,
      media_type: mediaType,
      is_ppv: price > 0,
      ppv_price: price || 0,
      amount: price || 0,
      is_locked: price > 0,
      is_purchased: false,
      ppv_unlocked: false
    };

    console.log('💾 Saving to database');

    const { error: dbError } = await supabase
      .from('chat')
      .insert(chatData);

    if (dbError) {
      console.error('⚠️ DB save error:', dbError);
    } else {
      console.log('✅ Message saved to database');
    }

    return res.status(200).json({ 
      success: true, 
      data,
      saved_to_db: !dbError,
      has_media_url: !!mediaUrl
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    return res.status(500).json({ 
      error: error.message || 'Server Error'
    });
  }
}
