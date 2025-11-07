// Endpoint para convertir Vault Media IDs a Prefixed IDs
// Descarga del vault y re-sube para obtener ID válido para mensajes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, mediaIds } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !mediaIds || !Array.isArray(mediaIds)) {
    return res.status(400).json({ 
      error: 'accountId and mediaIds array required' 
    });
  }

  try {
    console.log(`🔄 Converting ${mediaIds.length} vault IDs to prefixed IDs`);
    
    const results = [];
    
    for (const mediaId of mediaIds) {
      try {
        console.log(`📥 Processing media ${mediaId}`);
        
        // 1. Obtener info del media del vault
        const mediaInfoResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/media/vault/${mediaId}`,
          {
            headers: { 
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!mediaInfoResponse.ok) {
          console.error(`❌ Failed to get media info for ${mediaId}`);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'Media not found in vault' 
          });
          continue;
        }

        const mediaInfo = await mediaInfoResponse.json();
        const media = mediaInfo.data;

        if (!media) {
          console.error(`❌ No media data for ${mediaId}`);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'No media data' 
          });
          continue;
        }

        // 2. Obtener URL de descarga
        const downloadUrl = media.files?.full?.url || media.files?.source?.url;
        
        if (!downloadUrl) {
          console.error(`❌ No download URL for media ${mediaId}`);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'No download URL available' 
          });
          continue;
        }

        console.log(`⬇️ Downloading media ${mediaId}`);

        // 3. Descargar el archivo
        const downloadResponse = await fetch(downloadUrl);
        
        if (!downloadResponse.ok) {
          console.error(`❌ Failed to download media ${mediaId}`);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'Download failed' 
          });
          continue;
        }

        const arrayBuffer = await downloadResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`📦 Downloaded ${buffer.length} bytes`);

        // 4. Determinar tipo de contenido
        const contentType = media.type === 'video' 
          ? 'video/mp4' 
          : 'image/jpeg';

        // 5. Re-subir a OnlyFans para obtener prefixed_id
        console.log(`⬆️ Uploading media ${mediaId} to OnlyFans`);

        const uploadResponse = await fetch(
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

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`❌ Upload failed for ${mediaId}:`, errorText);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'Upload failed' 
          });
          continue;
        }

        const uploadData = await uploadResponse.json();
        const prefixedId = uploadData.data?.prefixed_id || uploadData.prefixed_id;

        if (!prefixedId) {
          console.error(`❌ No prefixed_id returned for ${mediaId}`);
          results.push({ 
            originalId: mediaId, 
            success: false, 
            error: 'No prefixed_id in response' 
          });
          continue;
        }

        console.log(`✅ Converted ${mediaId} → ${prefixedId}`);

        results.push({
          originalId: mediaId,
          prefixedId: prefixedId,
          type: media.type,
          success: true
        });

      } catch (error) {
        console.error(`❌ Error processing media ${mediaId}:`, error);
        results.push({ 
          originalId: mediaId, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Converted ${successCount}/${mediaIds.length} medias`);

    return res.status(200).json({
      success: true,
      converted: successCount,
      total: mediaIds.length,
      results
    });

  } catch (error) {
    console.error('❌ Convert media error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
