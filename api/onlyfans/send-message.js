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
    let finalMediaFiles = mediaFiles;
    
    // 🔥 CONVERTIR MEDIA SI ES PPV
    if (mediaFiles && mediaFiles.length > 0 && price > 0) {
      console.log('🔄 Converting media for PPV...');
      
      const { data: catalogItems, error: catalogError } = await supabase
        .from('catalog')
        .select('of_media_id, r2_url, media_url, file_type')
        .in('of_media_id', mediaFiles);

      if (catalogError || !catalogItems || catalogItems.length === 0) {
        return res.status(400).json({
          error: 'Media not found in catalog'
        });
      }

      console.log(`📦 Found ${catalogItems.length} items`);

      const conversions = [];
      
      for (const item of catalogItems) {
        const downloadUrl = item.r2_url || item.media_url;
        
        if (!downloadUrl) {
          console.warn(`⚠️ No URL for ${item.of_media_id}`);
          continue;
        }

        console.log(`⬇️ Downloading ${item.of_media_id}...`);
        const downloadResp = await fetch(downloadUrl);
        
        if (!downloadResp.ok) {
          console.error(`❌ Download failed for ${item.of_media_id}`);
          continue;
        }

        const buffer = Buffer.from(await downloadResp.arrayBuffer());
        const contentType = item.file_type === 'video' ? 'video/mp4' : 'image/jpeg';

        console.log(`⬆️ Uploading ${item.of_media_id} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
        
        const uploadResp = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/media/upload`,
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
          console.error(`❌ Upload failed for ${item.of_media_id}`);
          continue;
        }

        const uploadData = await uploadResp.json();
        const prefixedId = uploadData.data?.prefixed_id || uploadData.prefixed_id;

        if (prefixedId) {
          conversions.push(prefixedId);
          console.log(`✅ Converted ${item.of_media_id} → ${prefixedId}`);
        }
      }

      if (conversions.length === 0) {
        return res.status(400).json({
          error: 'Failed to convert media'
        });
      }

      finalMediaFiles = conversions;
      console.log(`✅ Converted ${conversions.length}/${mediaFiles.length} files`);
    }
    
    // Formatear texto
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    // Construir payload
    const payload = {
      text: formattedText,
      isCouplePeopleMedia: false
    };

    if (finalMediaFiles && finalMediaFiles.length > 0) {
      payload.mediaFiles = finalMediaFiles;
    }

    if (price && price > 0) {
      payload.price = parseFloat(price);
    }

    if (replyToMessageId && replyToText) {
      payload.repliedMessage = {
        id: replyToMessageId,
        text: replyToText
      };
    }

    console.log('📤 Sending to OnlyFans...');

    // Enviar mensaje
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
        error: 'Failed to send message',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('✅ Message sent!');

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

    await supabase.from('chat').insert(messageData);

    return res.status(200).json({
      success: true,
      message: 'Message sent',
      data: data.data || data
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
