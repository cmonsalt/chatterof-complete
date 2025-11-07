// 🔥 SEND-MESSAGE SIMPLE - Usa vault IDs directamente
// Ubicación: api/onlyfans/send-message.js (REEMPLAZAR)

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
    mediaFiles,
    hasMedia: !!(mediaFiles && mediaFiles.length > 0)
  });

  try {
    // 🔥 SIMPLE: Usar IDs de vault directamente (sin conversión)
    let finalMediaFiles = mediaFiles;
    
    console.log('✅ Using vault IDs directly:', finalMediaFiles);
    
    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    const payload = {
      text: formattedText,
      ...(finalMediaFiles && finalMediaFiles.length > 0 && { mediaFiles: finalMediaFiles }),
      ...(price && price > 0 && { price }),
      ...(replyToMessageId && { replyToMessageId }),
      ...(replyToText && { replyToText })
    };

    console.log('📦 Final payload:', JSON.stringify(payload, null, 2));

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OnlyFans error:', errorText);
      
      let errorMessage = `API error: ${response.status}`;
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.message || errorMessage;
        if (error.onlyfans_response?.body?.errors) {
          console.error('📋 Specific errors:', JSON.stringify(error.onlyfans_response.body.errors, null, 2));
        }
      } catch (parseError) {
        errorMessage = errorText.substring(0, 200);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Message sent to OnlyFans, ID:', data.id);

    // 🔥 Obtener media_url del catálogo para guardar en BD
    let mediaUrl = null;
    let mediaThumb = null;
    let mediaType = null;
    
    if (mediaFiles && mediaFiles.length > 0) {
      try {
        console.log('🔍 Getting media info from catalog...');
        const firstMediaId = mediaFiles[0];
        
        const { data: catalogItem, error: catalogError } = await supabase
          .from('catalog')
          .select('media_url, media_thumb, file_type, r2_url')
          .eq('of_media_id', firstMediaId)
          .single();
        
        if (catalogError) {
          console.warn('⚠️ Could not get media from catalog:', catalogError.message);
        } else if (catalogItem) {
          mediaUrl = catalogItem.r2_url || catalogItem.media_url;
          mediaThumb = catalogItem.media_thumb;
          mediaType = catalogItem.file_type;
          console.log('✅ Got media info:', { 
            has_url: !!mediaUrl, 
            type: mediaType,
            from: catalogItem.r2_url ? 'R2' : 'OnlyFans'
          });
        } else {
          console.warn('⚠️ Media not found in catalog');
        }
      } catch (catalogErr) {
        console.error('❌ Error getting media from catalog:', catalogErr);
      }
    }

    // 🔥 Guardar mensaje en BD con media_url
    const chatData = {
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text.replace(/<[^>]*>/g, ''),
      timestamp: new Date().toISOString(),
      from: 'model',
      read: true,
      source: 'api',
      // Campos de media
      media_url: mediaUrl,
      media_thumb: mediaThumb,
      media_type: mediaType,
      // Campos de PPV
      is_ppv: price > 0,
      ppv_price: price || 0,
      amount: price || 0,
      is_locked: price > 0,
      is_purchased: false,
      ppv_unlocked: false
    };

    console.log('💾 Saving to database:', {
      of_message_id: chatData.of_message_id,
      is_ppv: chatData.is_ppv,
      ppv_price: chatData.ppv_price,
      has_media_url: !!chatData.media_url,
      media_type: chatData.media_type
    });

    const { error: dbError } = await supabase
      .from('chat')
      .insert(chatData);

    if (dbError) {
      console.error('⚠️ DB save error:', dbError);
    } else {
      console.log('✅ Message saved to database');
    }

    console.log('✅ Send message complete');
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
