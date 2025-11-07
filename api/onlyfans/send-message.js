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
    
    // 🔥 CONVERTIR MEDIA USANDO SCRAPE (solo si es PPV)
    if (mediaFiles && mediaFiles.length > 0 && price > 0) {
      console.log('🔄 Converting media using R2 scrape method...');
      
      try {
        // Obtener URLs de R2 desde catalog
        const { data: catalogItems, error: catalogError } = await supabase
          .from('catalog')
          .select('of_media_id, r2_url, file_type')
          .in('of_media_id', mediaFiles);

        if (catalogError) {
          throw new Error('Failed to fetch catalog items: ' + catalogError.message);
        }

        if (!catalogItems || catalogItems.length === 0) {
          throw new Error('No media found in catalog');
        }

        console.log(`📦 Found ${catalogItems.length} items in catalog`);

        const conversions = [];
        
        for (const item of catalogItems) {
          try {
            if (!item.r2_url) {
              console.warn(`⚠️ No R2 URL for ${item.of_media_id}, skipping`);
              continue;
            }

            console.log(`🌐 Scraping ${item.of_media_id} from R2...`);
            console.log(`   URL: ${item.r2_url}`);
            
            // 🔥 USAR SCRAPE en lugar de UPLOAD (1 crédito sin importar tamaño)
            const scrapeResp = await fetch(
              `https://app.onlyfansapi.com/api/${accountId}/media/scrape`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  url: item.r2_url
                })
              }
            );

            if (!scrapeResp.ok) {
              const scrapeError = await scrapeResp.text();
              console.error(`❌ Scrape failed for ${item.of_media_id}:`, scrapeError);
              continue;
            }

            const scrapeData = await scrapeResp.json();
            
            // El scrape devuelve un prefixed_id que podemos usar
            const prefixedId = scrapeData.data?.prefixed_id || scrapeData.prefixed_id;

            if (prefixedId) {
              conversions.push(prefixedId);
              console.log(`✅ Scraped ${item.of_media_id} → ${prefixedId} (1 crédito)`);
            } else {
              console.error(`❌ No prefixed_id returned for ${item.of_media_id}`);
            }

          } catch (mediaError) {
            console.error(`❌ Error scraping ${item.of_media_id}:`, mediaError.message);
          }
        }

        if (conversions.length > 0) {
          finalMediaFiles = conversions;
          console.log(`✅ Successfully scraped ${conversions.length}/${mediaFiles.length} medias`);
        } else {
          console.error('❌ No successful conversions');
          return res.status(400).json({
            error: 'Failed to convert media. Please check R2 URLs are accessible.'
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

    // Construir el payload para OnlyFans API
    const payload = {
      text: formattedText,
      isCouplePeopleMedia: false
    };

    // Agregar media si existe
    if (finalMediaFiles && finalMediaFiles.length > 0) {
      payload.mediaFiles = finalMediaFiles;  // 🔥 OnlyFans API espera "mediaFiles" no "media"
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
        ...payload,
        mediaFiles: payload.mediaFiles ? `[${payload.mediaFiles.length} items]` : undefined
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
