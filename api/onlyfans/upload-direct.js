// ✅ UPLOAD DIRECTO A ONLYFANS CDN + BACKUP R2
// Ubicación: api/onlyfans/upload-direct.js (NUEVO)

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formidable = require('formidable');
    
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024, // 500MB
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Extraer datos
    const accountId = fields.accountId?.[0] || fields.accountId;
    const modelId = fields.modelId?.[0] || fields.modelId;
    const title = fields.title?.[0] || fields.title;
    const basePrice = parseInt(fields.basePrice?.[0] || fields.basePrice || '10');
    const nivel = parseInt(fields.nivel?.[0] || fields.nivel || '5');
    const tags = fields.tags?.[0] || fields.tags || '';
    
    const file = files.file?.[0] || files.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const API_KEY = process.env.ONLYFANS_API_KEY;

    if (!accountId || !modelId) {
      return res.status(400).json({ 
        error: 'accountId and modelId required' 
      });
    }

    console.log('📤 Starting upload:', file.originalFilename);

    const fs = require('fs');
    const buffer = fs.readFileSync(file.filepath);
    const contentType = file.mimetype;
    const fileType = contentType.includes('video') ? 'video' : 'photo';

    // 1️⃣ Subir a OnlyFans CDN (para obtener vault ID válido)
    console.log('☁️ Step 1: Uploading to OnlyFans CDN...');
    
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: file.originalFilename,
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
      throw new Error(`OnlyFans upload failed: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ OnlyFans upload response:', uploadData);

    // Extraer prefixed_id y vault ID
    const prefixedId = uploadData.prefixed_id || uploadData.data?.prefixed_id;
    const vaultMediaId = uploadData.id || uploadData.media_id || uploadData.data?.id;
    const thumbUrl = uploadData.files?.thumb?.url || uploadData.thumb?.url;
    const mediaUrl = uploadData.files?.full?.url || uploadData.url;

    if (!vaultMediaId) {
      throw new Error('No vault media ID returned from OnlyFans');
    }

    console.log('✅ Got vault ID:', vaultMediaId);

    // 2️⃣ Backup a R2 (opcional pero recomendado)
    let r2Url = null;
    try {
      console.log('💾 Step 2: Backing up to R2...');
      
      const ext = fileType === 'video' ? 'mp4' : 'jpg';
      const timestamp = Date.now();
      const sanitizedName = file.originalFilename.replace(/[^a-zA-Z0-9]/g, '_');
      const key = `model_${modelId}/vault/${timestamp}_${sanitizedName}.${ext}`;

      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));

      r2Url = `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
      console.log('✅ Backed up to R2:', r2Url);
    } catch (r2Error) {
      console.warn('⚠️ R2 backup failed (continuing anyway):', r2Error.message);
    }

    // 3️⃣ Guardar en catalog
    console.log('💾 Step 3: Saving to catalog...');

    const catalogData = {
      of_media_id: vaultMediaId.toString(),
      of_media_ids: [vaultMediaId.toString()],
      r2_url: r2Url,  // URL de backup
      media_url: mediaUrl,  // URL de OnlyFans (temporal)
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
      console.error('⚠️ DB error:', dbError);
      throw dbError;
    }

    console.log('✅ Saved to catalog');

    // Calcular créditos usados
    const fileSizeMB = buffer.length / (1024 * 1024);
    const creditsUsed = Math.ceil(fileSizeMB / 6); // 1 crédito por cada 6MB

    return res.status(200).json({
      success: true,
      vaultMediaId: vaultMediaId,
      prefixedId: prefixedId,
      r2Url: r2Url,
      mediaUrl: mediaUrl,
      fileType: fileType,
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      creditsUsed: creditsUsed,
      message: '✅ File uploaded successfully!',
      catalogSaved: true
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Upload failed'
    });
  }
}
