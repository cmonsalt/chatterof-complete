// 🔥 SEND-MESSAGE MINIMAL FIX - Solo arregla media_url
// Ubicación: api/onlyfans/send-message.js (REEMPLAZAR)
// Este archivo mantiene TODO tu código original y solo cambia la sección final

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
    // 🔥 AUTO-CONVERT: Download from R2 (permanent) or media_url (temp)
    let finalMediaFiles = mediaFiles;
    
    if (mediaFiles && mediaFiles.length > 0 && price > 0) {
      console.log('🔄 Converting media for PPV (trying R2 first)...');
      
      try {
        // Get media from catalog
        const { data: catalogItems, error: catalogError } = await supabase
          .from('catalog')
          .select('of_media_id, r2_url, media_url, file_type')
          .in('of_media_id', mediaFiles);

        if (catalogError) {
          throw new Error('Failed to get media from catalog: ' + catalogError.message);
        }

        if (!catalogItems || catalogItems.length === 0) {
          throw new Error('No media found in catalog');
        }

        console.log(`📦 Found ${catalogItems.length} items in catalog`);

        const conversions = [];
        
        for (const item of catalogItems) {
          try {
            // Try R2 first (permanent URL), fallback to media_url
            const downloadUrl = item.r2_url || item.media_url;
            
            if (!downloadUrl) {
              console.error(`❌ No download URL for ${item.of_media_id}`);
              continue;
            }

            console.log(`⬇️ Downloading ${item.of_media_id} from ${item.r2_url ? 'R2' : 'OnlyFans'}...`);
            const downloadResp = await fetch(downloadUrl);
            
            if (!downloadResp.ok) {
              console.error(`❌ Download failed for ${item.of_media_id} - URL may have expired`);
              continue;
            }

            const buffer = Buffer.from(await downloadResp.arrayBuffer());
            const contentType = item.file_type === 'video' ? 'video/mp4' : 'image/jpeg';

            console.log(`⬆️ Re-uploading ${item.of_media_id} (${buffer.length} bytes)...`);
            
            // Re-upload to get prefixed_id
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
              const uploadError = await uploadResp.text();
              console.error(`❌ Upload failed for ${item.of_media_id}:`, uploadError);
              continue;
            }

            const uploadData = await uploadResp.json();
            const prefixedId = uploadData.data?.prefixed_id || uploadData.prefixed_id;

            if (prefixedId) {
              conversions.push(prefixedId);
              console.log(`✅ Converted ${item.of_media_id} → ${prefixedId}`);
            } else {
              console.error(`❌ No prefixed_id returned for ${item.of_media_id}`);
            }

          } catch (mediaError) {
            console.error(`❌ Error converting ${item.of_media_id}:`, mediaError.message);
          }
        }

        if (conversions.length > 0) {
          finalMediaFiles = conversions;
          console.log(`✅ Successfully converted ${conversions.length}/${mediaFiles.length} medias`);
        } else {
          console.warn('⚠️ No successful conversions');
          return res.status(400).json({
            error: 'Failed to convert media. Please upload fresh content to vault.'
          });
        }

      } catch (conversionError) {
        console.error('❌ Conversion process failed:', conversionError);
        return res.status(500).json({
          error: 'Media conversion failed: ' + conversionError.message
        });
      }
    }
    
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
      
      try {
        const error = JSON.parse(errorText);
        if (error.onlyfans_response?.body?.errors) {
          console.error('📋 Specific errors:', JSON.stringify(error.onlyfans_response.body.errors, null, 2));
        }
        throw new Error(error.message || `API error: ${response.status}`);
      } catch (parseError) {
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();

    // 🔥 NUEVO: Obtener media_url del catálogo ANTES de guardar
    let mediaUrl = null;
    let mediaThumb = null;
    let mediaType = null;
    
    if (mediaFiles && mediaFiles.length > 0) {
      try {
        const firstMediaId = mediaFiles[0]; // ID original del catálogo
        
        const { data: catalogItem } = await supabase
          .from('catalog')
          .select('media_url, media_thumb, file_type, r2_url')
          .eq('of_media_id', firstMediaId)
          .single();
        
        if (catalogItem) {
          mediaUrl = catalogItem.r2_url || catalogItem.media_url;
          mediaThumb = catalogItem.media_thumb;
          mediaType = catalogItem.file_type;
        }
      } catch (catalogErr) {
        console.warn('⚠️ Could not get media from catalog:', catalogErr);
      }
    }

    // 🔥 ACTUALIZADO: Guardar con media_url y campos PPV
    const { error: dbError } = await supabase.from('chat').insert({
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text.replace(/<[^>]*>/g, ''),
      timestamp: new Date().toISOString(),
      from: 'model',
      read: true,
      source: 'api',
      // 🔥 CAMPOS DE MEDIA (AHORA CON URL REAL)
      media_url: mediaUrl,
      media_thumb: mediaThumb,
      media_type: mediaType,
      // 🔥 CAMPOS DE PPV
      is_ppv: price > 0,
      ppv_price: price || 0,
      amount: price || 0,
      is_locked: price > 0,
      is_purchased: false
    });

    if (dbError) {
      console.error('⚠️ DB save error:', dbError);
    } else {
      console.log('✅ Message saved to DB with media_url:', mediaUrl ? 'Yes' : 'No');
    }

    console.log('✅ Message sent successfully');
    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('❌ Send message error:', error);
    return res.status(500).json({ 
      error: error.message || 'Server Error'
    });
  }
}
