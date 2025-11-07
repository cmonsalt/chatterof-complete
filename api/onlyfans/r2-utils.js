// Utility para subir archivos a Cloudflare R2
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Sube un archivo a R2
 * @param {Buffer} buffer - Archivo en buffer
 * @param {string} key - Nombre/path del archivo en R2
 * @param {string} contentType - MIME type del archivo
 * @returns {Promise<string>} URL pública del archivo
 */
export async function uploadToR2(buffer, key, contentType) {
  const bucketName = process.env.R2_BUCKET_NAME;
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // URL pública
  const publicUrl = `https://pub-c91f7a72074547ffad99c7d07cf8c8cd.r2.dev/${key}`;
  
  return publicUrl;
}

/**
 * Genera key único para R2
 * @param {string} mediaId - ID del media
 * @param {string} type - Tipo (photo/video)
 * @returns {string} Key único
 */
export function generateR2Key(mediaId, type) {
  const ext = type === 'video' ? 'mp4' : 'jpg';
  const timestamp = Date.now();
  return `media/${mediaId}_${timestamp}.${ext}`;
}
