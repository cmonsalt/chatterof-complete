import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Construir endpoint desde ACCOUNT_ID si R2_ENDPOINT no está definido
const r2Endpoint = process.env.R2_ENDPOINT || 
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

const r2 = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fileKey } = req.body

  if (!fileKey) {
    return res.status(400).json({ error: 'fileKey required' })
  }

  try {
    console.log(`🗑️ Deleting from R2: ${fileKey}`)
    console.log(`Using bucket: ${process.env.R2_BUCKET_NAME}`)
    console.log(`Using endpoint: ${r2Endpoint}`)

    // Eliminar archivo principal
    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey
    }))

    console.log(`✅ Successfully deleted from R2: ${fileKey}`)

    // También eliminar thumbnail si existe
    const thumbKey = fileKey.replace(/\.(mp4|jpg|png|gif)$/, '_thumb.jpg')
    if (thumbKey !== fileKey) {
      try {
        await r2.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbKey
        }))
        console.log(`✅ Also deleted thumbnail: ${thumbKey}`)
      } catch (thumbError) {
        // Si no existe el thumbnail, no importa
        if (thumbError.name !== 'NoSuchKey' && thumbError.Code !== 'NoSuchKey') {
          console.log(`⚠️ Could not delete thumbnail: ${thumbError.message}`)
        }
      }
    }

    return res.status(200).json({ 
      success: true,
      deleted: fileKey,
      deletedThumb: thumbKey !== fileKey ? thumbKey : null,
      message: 'File and thumbnail deleted from Cloudflare R2'
    })

  } catch (error) {
    console.error('❌ R2 delete error:', error)
    
    // If file doesn't exist, still return success
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      console.log(`⚠️ File not found in R2 (already deleted?): ${fileKey}`)
      return res.status(200).json({ 
        success: true,
        deleted: fileKey,
        message: 'File not found (may have been deleted already)'
      })
    }
    
    return res.status(500).json({ 
      error: 'Failed to delete from R2',
      details: error.message 
    })
  }
}
