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
    // 🔥 AUTO-CONVERT VAULT IDs TO PREFIXED IDs FOR PPV
    let finalMediaFiles = mediaFiles;
    
    if (mediaFiles && mediaFiles.length > 0 && price > 0) {
      console.log('🔄 Auto-converting vault IDs to prefixed IDs for PPV...');
      
      try {
        // Download and re-upload each media to get prefixed_id
        const conversions = [];
        
        for (const vaultId of mediaFiles) {
          try {
            // 1. Get media info from vault
            const infoResp = await fetch(
              `https://app.onlyfansapi.com/api/${accountId}/media/vault/${vaultId}`,
              {
                headers: { 
                  'Authorization': `Bearer ${API_KEY}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!infoResp.ok) {
              console.error(`❌ Failed to get info for vault ID ${vaultId}`);
              continue;
            }

            const infoData = await infoResp.json();
            const media = infoData.data;
            const downloadUrl = media.files?.full?.url || media.files?.source?.url;

            if (!downloadUrl) {
              console.error(`❌ No download URL for vault ID ${vaultId}`);
              continue;
            }

            // 2. Download media
            console.log(`⬇️ Downloading vault media ${vaultId}...`);
            const downloadResp = await fetch(downloadUrl);
            if (!downloadResp.ok) {
              console.error(`❌ Download failed for ${vaultId}`);
              continue;
            }

            const buffer = Buffer.from(await downloadResp.arrayBuffer());
            const contentType = media.type === 'video' ? 'video/mp4' : 'image/jpeg';

            // 3. Re-upload to get prefixed_id
            console.log(`⬆️ Re-uploading ${vaultId} (${buffer.length} bytes)...`);
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
              console.error(`❌ Upload failed for ${vaultId}`);
              continue;
            }

            const uploadData = await uploadResp.json();
            const prefixedId = uploadData.data?.prefixed_id || uploadData.prefixed_id;

            if (prefixedId) {
              conversions.push(prefixedId);
              console.log(`✅ Converted ${vaultId} → ${prefixedId}`);
            }

          } catch (mediaError) {
            console.error(`❌ Error converting ${vaultId}:`, mediaError.message);
          }
        }

        if (conversions.length > 0) {
          finalMediaFiles = conversions;
          console.log(`✅ Successfully converted ${conversions.length}/${mediaFiles.length} medias`);
        } else {
          console.warn('⚠️ No successful conversions, cannot send PPV without valid media');
          return res.status(400).json({
            error: 'Failed to convert vault media IDs. Please try uploading fresh content.'
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

    console.log('📨 OnlyFans response:', {
      status: response.status,
      body: (await response.text()).substring(0, 200)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ OnlyFans error:', JSON.stringify(error, null, 2));
      
      if (error.onlyfans_response?.body?.errors) {
        console.error('📋 Specific errors:', JSON.stringify(error.onlyfans_response.body.errors, null, 2));
      }
      
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Detectar tipo de media si se envió
    let mediaType = null;
    if (finalMediaFiles && finalMediaFiles.length > 0) {
      const firstMedia = finalMediaFiles[0];
      if (typeof firstMedia === 'string') {
        if (firstMedia.includes('.mp4') || firstMedia.includes('video')) {
          mediaType = 'video';
        } else if (firstMedia.includes('.gif')) {
          mediaType = 'gif';
        } else {
          mediaType = 'photo';
        }
      }
    }

    // Guardar mensaje en BD
    const { error: dbError } = await supabase.from('chat').insert({
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text.replace(/<[^>]*>/g, ''),
      ts: new Date().toISOString(),
      from: 'model',
      amount: price || 0,
      read: true,
      media_type: mediaType,
      media_url: null
    });

    if (dbError) {
      console.error('⚠️ DB save error:', dbError);
    } else {
      console.log('✅ Message saved to DB');
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
