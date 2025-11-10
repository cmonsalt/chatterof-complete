// ✅ SEND-MESSAGE FINAL - Usa vault IDs directamente
// Ubicación: api/onlyfans/send-message.js (REEMPLAZAR COMPLETO)

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
  lockedText,          
  previewMediaIds,     
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

  console.log('📥 Send message:', { accountId, chatId, price, mediaCount: mediaFiles?.length });

  try {
    // ✅ Convertir vault IDs a números (OnlyFans requiere números, no strings)
    const finalMediaFiles = (mediaFiles || []).map(id => {
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      return numId;
    });

    const finalPreviewIds = (previewMediaIds || []).map(id => {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  return numId;
});
    
    console.log('✅ Media IDs as numbers:', finalMediaFiles);
    
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

  const payload = {
  text: formattedText,
  mediaFiles: finalMediaFiles,
  ...(price && price > 0 && { price }),
  ...(lockedText && { lockedText }),                                  
  ...(finalPreviewIds.length > 0 && { previews: finalPreviewIds }),
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

    if (!response.ok) {
      console.error('❌ OnlyFans error:', responseText);
      
      let errorMessage = `API error: ${response.status}`;
      try {
        const error = JSON.parse(responseText);
        errorMessage = error.message || errorMessage;
        if (error.onlyfans_response?.body?.errors) {
          errorMessage = JSON.stringify(error.onlyfans_response.body.errors);
        }
      } catch (e) {
        errorMessage = responseText.substring(0, 200);
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = JSON.parse(responseText);
    console.log('✅ Message sent! ID:', data.id);

    // Obtener media info del catálogo para guardar en BD
    let mediaUrl = null;
    let mediaThumb = null;
    let mediaType = null;
    
    if (mediaFiles && mediaFiles.length > 0) {
      try {
        const { data: catalogItem } = await supabase
          .from('catalog')
          .select('media_url, media_thumb, file_type, r2_url')
          .eq('of_media_id', mediaFiles[0].toString())
          .single();
        
        if (catalogItem) {
          // Priorizar R2 URL (permanente) sobre media_url (temporal)
          mediaUrl = catalogItem.r2_url || catalogItem.media_url;
          mediaThumb = catalogItem.media_thumb;
          mediaType = catalogItem.file_type;
          console.log('✅ Got media from catalog');
        }
      } catch (err) {
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

    const { error: dbError } = await supabase
      .from('chat')
      .insert(chatData);

    if (dbError) {
      console.error('⚠️ DB error:', dbError);
    }

    return res.status(200).json({ 
      success: true, 
      data,
      saved_to_db: !dbError
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Server Error'
    });
  }
}
