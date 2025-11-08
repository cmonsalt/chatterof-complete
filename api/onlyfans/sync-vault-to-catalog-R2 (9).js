import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Helper para subir a R2
async function uploadToR2(buffer, mediaId, mediaType, modelId) {
  try {
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const key = `model_${modelId}/vault/${mediaId}_${Date.now()}.${ext}`;
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    
    return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
  } catch (error) {
    console.error('❌ R2 upload error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // 🚨 EMERGENCY STOP - SYNC DISABLED
  return res.status(503).json({ error: 'Sync temporarily disabled to save credits' });
  
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
    console.log('🔄 Starting vault → catalog sync with R2 backup...');

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
    let r2UploadedCount = 0;

    for (const media of allMedias) {
      try {
        // Validar que el media esté listo y tenga URLs
        if (!media.isReady || !media.canView) {
          console.log(`⏭️ Skipping media ${media.id} - not ready or not viewable`);
          skippedCount++;
          continue;
        }

        // Verificar si ya existe en catalog con R2 URL
        const { data: existingMedia } = await supabase
          .from('catalog')
          .select('of_media_id, r2_url')
          .eq('of_media_id', media.id.toString())
          .single();

        let r2Url = existingMedia?.r2_url || null;

        // Si no tiene R2 URL, descargar y subir
        if (!r2Url) {
          const mediaUrl = media.files?.full?.url || media.files?.preview?.url;
          
          if (mediaUrl) {
            try {
              console.log(`📥 Downloading media ${media.id} from OnlyFans API...`);
              
              // cdnUrl va en el path, URL encoded
              const encodedUrl = encodeURIComponent(mediaUrl);
              const downloadUrl = `https://app.onlyfansapi.com/api/${accountId}/media/download/${encodedUrl}`;
              
              const downloadResp = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_KEY}`
                }
              });
              
              console.log(`   Download status: ${downloadResp.status}`);
              
              const buffer = Buffer.from(await downloadResp.arrayBuffer());
              
              // Si tiene contenido binario válido, procesarlo
              if (buffer.length > 1000) {  // Archivos reales son > 1KB
                console.log(`   Downloaded ${buffer.length} bytes`);
                
                console.log(`☁️ Uploading media ${media.id} to R2...`);
                r2Url = await uploadToR2(buffer, media.id, media.type, modelId);
                
                if (r2Url) {
                  console.log(`✅ Uploaded to R2: ${r2Url}`);
                  r2UploadedCount++;
                } else {
                  console.warn(`⚠️ R2 upload failed for ${media.id}`);
                }
              } else {
                const errorText = await downloadResp.text();
                console.error(`❌ Download failed: HTTP ${downloadResp.status} - ${errorText.substring(0, 200)}`);
              }
            } catch (downloadError) {
              console.error(`❌ Error for ${media.id}:`, downloadError.message);
            }
          }
        } else {
          console.log(`✅ Media ${media.id} already has R2 URL`);
        }

        // Extraer thumbnail URL
        const thumbUrl = media.files?.thumb?.url || media.files?.preview?.url;

        // Preparar datos para catalog
        const catalogData = {
          of_media_id: media.id.toString(),
          of_media_ids: [media.id.toString()],
          media_url: r2Url || (media.files?.full?.url || media.files?.preview?.url),
          r2_url: r2Url, // URL permanente de R2
          media_thumb: thumbUrl,
          media_thumbnails: {
            [media.id]: thumbUrl
          },
          file_type: media.type,
          duration_seconds: media.duration || null,
          model_id: modelId,
          parent_type: 'single',
          
          title: `${media.type === 'video' ? '🎥' : '📸'} ${media.type} ${media.id}`,
          base_price: 10,
          nivel: 5,
          tags: media.type,
          description: `Synced from vault on ${new Date().toISOString().split('T')[0]}`,
          
          created_at: media.createdAt || new Date().toISOString(),
        };

        // UPSERT en catalog
        const { error } = await supabase
          .from('catalog')
          .upsert(catalogData, { 
            onConflict: 'of_media_id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Error saving media ${media.id}:`, error.message);
          errorCount++;
        } else {
          syncedCount++;
        }

      } catch (mediaError) {
        console.error(`❌ Error processing media ${media.id}:`, mediaError.message);
        errorCount++;
      }
    }

    const summary = {
      total: allMedias.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      r2_uploaded: r2UploadedCount
    };

    console.log('✅ Sync complete:', summary);

    return res.status(200).json({
      success: true,
      message: 'Vault synced successfully',
      summary
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return res.status(500).json({ 
      error: error.message || 'Sync failed' 
    });
  }
}
