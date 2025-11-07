// ✅ UPLOAD CON VERCEL BLOB - Para archivos grandes en Vercel PRO
// Ubicación: api/onlyfans/upload-with-blob.js (NUEVO)

import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export const config = {
  api: {
    bodyParser: false, // Necesario para archivos grandes
  },
};

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

    // 1️⃣ Subir a Vercel Blob (permanente, sin límite)
    console.log('☁️ Step 1: Uploading to Vercel Blob...');
    
    const blob = await put(
      `model_${modelId}/${Date.now()}_${file.originalFilename}`,
      buffer,
      {
        access: 'public',
        contentType: contentType,
      }
    );

    console.log('✅ Uploaded to Blob:', blob.url);

    // 2️⃣ Subir a OnlyFans para obtener vault ID
    console.log('📥 Step 2: Uploading to OnlyFans...');
    
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
      throw new Error(`OnlyFans upload failed`);
    }

    const uploadData = await uploadResponse.json();
    const vaultMediaId = uploadData.id || uploadData.media_id || uploadData.data?.id;
    const thumbUrl = uploadData.files?.thumb?.url || uploadData.thumb?.url;

    if (!vaultMediaId) {
      throw new Error('No vault media ID returned');
    }

    console.log('✅ Got vault ID:', vaultMediaId);

    // 3️⃣ Guardar en catalog con Blob URL (permanente)
    console.log('💾 Step 3: Saving to catalog...');

    const catalogData = {
      of_media_id: vaultMediaId.toString(),
      of_media_ids: [vaultMediaId.toString()],
      media_url: blob.url,  // ✅ URL permanente de Vercel Blob
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
      blobUrl: blob.url,
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
