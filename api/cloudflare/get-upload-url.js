// ✅ GET UPLOAD URL - Genera presigned URL para subir directo a R2
// Ubicación: api/cloudflare/get-upload-url.js (NUEVO)

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

  const { key, contentType } = req.body;

  if (!key || !contentType) {
    return res.status(400).json({ 
      error: 'key and contentType required' 
    });
  }

  try {
    console.log('🔑 Generating presigned URL for:', key);

    // Crear comando PUT
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // Generar URL firmada (válida por 1 hora)
    const uploadUrl = await getSignedUrl(r2Client, command, { 
      expiresIn: 3600 
    });

    console.log('✅ Presigned URL generated');

    return res.status(200).json({
      uploadUrl: uploadUrl,
      key: key,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('❌ Error generating URL:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate upload URL'
    });
  }
}
