// ✅ REGISTER BLOB MEDIA - Recibe Blob URL y registra en OnlyFans
// Ubicación: api/onlyfans/register-blob-media.js

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
    blobUrl,
    filename,
    contentType,
    title,
    basePrice = 10,
    nivel = 5,
    tags = ''
  } = req.body;

  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !modelId || !blobUrl) {
    return res.status(400).json({
      error: 'accountId, modelId, and blobUrl required'
    });
  }

  console.log('📥 Registering media from Blob:', blobUrl);

  try {
    // 1️⃣ Descargar desde Blob
    const fetchResponse = await fetch(blobUrl);
    if (!fetchResponse.ok) {
      throw new Error('Failed to fetch from Blob');
    }

    const buffer = Buffer.from(await fetchResponse.arrayBuffer());
    const fileType = contentType.includes('video') ? 'video' : 'photo';

    // 2️⃣ Subir a OnlyFans
    console.log('📤 Uploading to OnlyFans...');

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: filename,
      contentType: contentType
    });

    const uploadResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('❌ OnlyFans upload failed:', error);
      throw new Error('OnlyFans upload failed');
    }

    const uploadData = await uploadResponse.json();
    const vaultMediaId = uploadData.id || uploadData.media_id || uploadData.data?.id;
    const thumbUrl = uploadData.files?.thumb?.url || uploadData.thumb?.url;

    if (!vaultMediaId) {
      throw new Error('No vault media ID returned');
    }

    console.log('✅ Got vault ID:', vaultMediaId);

    // 3️⃣ Guardar en catalog
    const catalogData = {
      of_media_id: vaultMediaId.toString(),
      of_media_ids: [vaultMediaId.toString()],
      media_url: blobUrl, // URL permanente de Blob
      media_thumb: thumbUrl,
      media_thumbnails: thumbUrl ? { [vaultMediaId]: thumbUrl } : {},
      file_type: fileType,
      model_id: modelId,
      parent_type: 'single',
      title: title || `${fileType} ${vaultMediaId}`,
      base_price: basePrice,
      nivel: nivel,
      tags: tags || fileType,
      description: `Uploaded on ${new Date().toISOString().split('T')[0]}`,
      created_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase
      .from('catalog')
      .upsert(catalogData, {
        onConflict: 'of_media_id',
        ignoreDuplicates: false
      });

    if (dbError) {
      throw dbError;
    }

    console.log('✅ Saved to catalog');

    const fileSizeMB = buffer.length / (1024 * 1024);
    const creditsUsed = Math.ceil(fileSizeMB / 6);

    return res.status(200).json({
      success: true,
      vaultMediaId: vaultMediaId,
      blobUrl: blobUrl,
      fileType: fileType,
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      creditsUsed: creditsUsed,
      message: '✅ Successfully registered!',
      catalogSaved: true
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: error.message || 'Registration failed'
    });
  }
}
