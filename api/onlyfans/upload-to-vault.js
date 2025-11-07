// ✅ UPLOAD TO VAULT - Con Cloudflare R2 (ahorra 80-95% créditos)
// Ubicación: api/onlyfans/upload-to-vault.js (NUEVO)

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
    // ✅ Vercel no soporta multipart nativo, necesitamos usar formidable
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

    // Leer archivo
    const fs = require('fs');
    const buffer = fs.readFileSync(file.filepath);
    const contentType = file.mimetype;
    const fileType = contentType.includes('video') ? 'video' : 'photo';
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

    const r2Url = `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
    console.log('✅ Uploaded to R2:', r2Url);

    // 2️⃣ OnlyFans scrape desde R2 (solo 1 crédito)
    console.log('🌐 Step 2: OnlyFans scraping from R2... (1 credit)');
    
    const scrapeResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/scrape`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: r2Url })
      }
    );

    if (!scrapeResponse.ok) {
      const error = await scrapeResponse.text();
      console.error('❌ Scrape failed:', error);
      throw new Error(`Scrape failed: ${error}`);
    }

    const scrapeData = await scrapeResponse.json();
    console.log('✅ Scrape response:', scrapeData);

    // Extraer vault_media_id
    const vaultMediaId = scrapeData.id || scrapeData.media_id || scrapeData.data?.id;
    const thumbUrl = scrapeData.files?.thumb?.url || scrapeData.thumb?.url;

    if (!vaultMediaId) {
      throw new Error('No vault media ID returned from scrape');
    }

    console.log('✅ Got vault ID:', vaultMediaId);

    // 3️⃣ Guardar en catalog
    console.log('💾 Step 3: Saving to catalog...');

    const catalogData = {
      of_media_id: vaultMediaId.toString(),
      of_media_ids: [vaultMediaId.toString()],
      r2_url: r2Url,  // ✅ URL permanente
      media_url: r2Url,  // Usar R2 como principal
      media_thumb: thumbUrl,
      media_thumbnails: thumbUrl ? { [vaultMediaId]: thumbUrl } : {},
      file_type: fileType,
      model_id: modelId,
      parent_type: 'single',
      title: title || `${fileType} ${vaultMediaId}`,
      base_price: basePrice,
      nivel: nivel,
      tags: tags || fileType,
      description: `Uploaded via R2 on ${new Date().toISOString().split('T')[0]}`,
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

    return res.status(200).json({
      success: true,
      vaultMediaId: vaultMediaId,
      r2Url: r2Url,
      fileType: fileType,
      creditsUsed: 1,
      message: '✅ File uploaded to vault successfully!',
      catalogSaved: true
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Upload failed'
    });
  }
}
