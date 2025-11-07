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
    // 🔥 Si NO es PPV, enviar directo sin conversión
    let finalMediaFiles = mediaFiles;
    
    if (mediaFiles && mediaFiles.length > 0 && price > 0) {
      console.log('🔄 Attempting to convert media for PPV...');
      
      // INTENTAR conversión, pero NO fallar si no funciona
      try {
        const { data: catalogItems, error: catalogError } = await supabase
          .from('catalog')
          .select('of_media_id, r2_url, media_url, file_type')
          .in('of_media_id', mediaFiles);

        if (catalogError) {
          console.warn('⚠️ Could not fetch catalog items:', catalogError.message);
        } else if (catalogItems && catalogItems.length > 0) {
          console.log(`📦 Found ${catalogItems.length} items in catalog`);

          const conversions = [];
          
          for (const item of catalogItems) {
            try {
              const downloadUrl = item.r2_url || item.media_url;
              
              if (!downloadUrl) {
                console.warn(`⚠️ No download URL for ${item.of_media_id}`);
                continue;
              }

              console.log(`⬇️ Trying to download ${item.of_media_id}...`);
              const downloadResp = await fetch(downloadUrl);
              
              if (!downloadResp.ok) {
                console.warn(`⚠️ Download failed for ${item.of_media_id} - continuing anyway`);
                continue;
              }

              const buffer = Buffer.from(await downloadResp.arrayBuffer());
              const contentType = item.file_type === 'video' ? 'video/mp4' : 'image/jpeg';

              console.log(`⬆️ Re-uploading ${item.of_media_id}...`);
              
              const uploadResp = await fetch(
                `https://app.onlyfansapi.com/api/${accountId}/upload`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': contentType
                  },
                  body: buffer
                }
              );

              if (!uploadResp.ok) {
                console.warn(`⚠️ Upload failed for ${item.of_media_id}`);
                continue;
              }

              const uploadData = await uploadResp.json();
              const prefixedId = uploadData.data?.prefixed_id || uploadData.prefixed_id;

              if (prefixedId) {
                conversions.push(prefixedId);
                console.log(`✅ Converted ${item.of_media_id} → ${prefixedId}`);
              }

            } catch (mediaError) {
              console.warn(`⚠️ Error converting ${item.of_media_id}:`, mediaError.message);
            }
          }

          if (conversions.length > 0) {
            finalMediaFiles = conversions;
            console.log(`✅ Successfully converted ${conversions.length}/${mediaFiles.length} medias`);
          } else {
            console.warn('⚠️ No conversions succeeded, using original media IDs');
            // NO fallar - usar los IDs originales
          }
        }

      } catch (conversionError) {
        console.warn('⚠️ Conversion process failed, using original media IDs:', conversionError.message);
        // NO fallar - continuar con los media IDs originales
      }
    }
    
    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    // Construir el payload para OnlyFans API
    const payload = {
      text: formattedText,
      isCouplePeopleMedia: false
    };

    // Agregar media si existe
    if (finalMediaFiles && finalMediaFiles.length > 0) {
      payload.media = finalMediaFiles;
    }

    // Agregar precio si es PPV
    if (price && price > 0) {
      payload.price = parseFloat(price);
      payload.isMediaReady = false;
    }

    // Agregar reply si existe
    if (replyToMessageId && replyToText) {
      payload.repliedMessage = {
        id: replyToMessageId,
        text: replyToText
      };
    }

    console.log('📤 Sending to OnlyFans:', {
      endpoint: `https://app.onlyfansapi.com/api/${accountId}/chat/${chatId}/message`,
      payload: {
        ...payload,
        media: payload.media ? `[${payload.media.length} items]` : undefined
      }
    });

    // Enviar mensaje a OnlyFans
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chat/${chatId}/message`,
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
    console.log('✅ Message sent successfully');

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

    if (finalMediaFiles && finalMediaFiles.length > 0) {
      messageData.media = JSON.stringify(finalMediaFiles);
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
