import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, modelId } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !modelId) {
    return res.status(400).json({ 
      error: 'accountId and modelId required' 
    });
  }

  try {
    console.log('🔄 Starting vault → catalog sync...');

    // 1. Obtener todos los medias del vault de OnlyFans
    let allMedias = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore && allMedias.length < 1000) {
      const url = `https://app.onlyfansapi.com/api/${accountId}/media/vault?limit=${limit}&offset=${offset}&sort=desc`;
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const medias = data.data?.list || [];
      const hasMoreFlag = data.data?.hasMore || false;
      
      if (medias.length === 0) break;

      allMedias = allMedias.concat(medias);
      
      if (!hasMoreFlag || medias.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      console.log(`📦 Loaded ${allMedias.length} medias so far...`);
    }

    console.log(`✅ Total medias from vault: ${allMedias.length}`);

    // 2. Procesar y sincronizar cada media al catalog
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const media of allMedias) {
      try {
        // Validar que el media esté listo y tenga URLs
        if (!media.isReady || !media.canView) {
          console.log(`⏭️ Skipping media ${media.id} - not ready or not viewable`);
          skippedCount++;
          continue;
        }

        // Extraer URLs
        const mediaUrl = media.files?.full?.url || media.files?.preview?.url;
        const thumbUrl = media.files?.thumb?.url || media.files?.preview?.url;

        if (!mediaUrl) {
          console.log(`⏭️ Skipping media ${media.id} - no URL available`);
          skippedCount++;
          continue;
        }

        // Preparar datos para catalog
        const catalogData = {
          of_media_id: media.id.toString(),
          of_media_ids: [media.id.toString()], // Array de un solo ID
          media_url: mediaUrl,
          media_thumb: thumbUrl,
          media_thumbnails: {
            [media.id]: thumbUrl
          },
          file_type: media.type, // 'video' o 'photo'
          duration_seconds: media.duration || null,
          model_id: modelId,
          parent_type: 'single', // Por defecto como single
          
          // Campos por defecto que el usuario puede editar después
          title: `${media.type === 'video' ? '🎥' : '📸'} ${media.type} ${media.id}`,
          base_price: 10, // Precio base por defecto
          nivel: 5, // Nivel medio por defecto
          tags: media.type,
          description: `Synced from vault on ${new Date().toISOString().split('T')[0]}`,
          
          // Metadata
          created_at: media.createdAt || new Date().toISOString(),
        };

        // UPSERT en catalog (actualizar si existe, insertar si no)
        const { error } = await supabase
          .from('catalog')
          .upsert(catalogData, { 
            onConflict: 'of_media_id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Error syncing media ${media.id}:`, error.message);
          errorCount++;
        } else {
          syncedCount++;
          if (syncedCount % 50 === 0) {
            console.log(`✅ Synced ${syncedCount}/${allMedias.length} medias...`);
          }
        }

      } catch (mediaError) {
        console.error(`❌ Error processing media ${media.id}:`, mediaError.message);
        errorCount++;
      }
    }

    // 3. Actualizar modelo con fecha de sincronización
    await supabase
      .from('models')
      .update({ 
        vault_synced_at: new Date().toISOString(),
        vault_media_count: syncedCount
      })
      .eq('model_id', modelId);

    console.log('✅ Vault sync completed!');
    console.log(`📊 Synced: ${syncedCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`);

    res.status(200).json({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: allMedias.length,
      message: `Successfully synced ${syncedCount} medias to catalog`
    });

  } catch (error) {
    console.error('❌ Sync vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
