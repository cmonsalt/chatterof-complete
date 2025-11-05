import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

// Configurar cliente R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { modelId } = req.query

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' })
    }

    // Listar archivos del modelo
    const prefix = `model_${modelId}/`

    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: prefix
    })

    const response = await s3Client.send(command)

    const files = (response.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `https://${process.env.R2_BUCKET_NAME}.r2.dev/${item.Key}`,
      type: item.Key.includes('/scraped/') ? 'scraped' : 'uploaded',
      fileName: item.Key.split('/').pop()
    }))

    console.log(`✅ Listed ${files.length} files for model ${modelId}`)

    res.status(200).json({
      success: true,
      files,
      total: files.length
    })

  } catch (error) {
    console.error('❌ R2 list error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
