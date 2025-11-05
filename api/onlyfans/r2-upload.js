import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'

// Configurar cliente R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

export const config = {
  api: {
    bodyParser: false // Necesario para formidable
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { modelId } = req.query

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' })
    }

    // Parsear form data
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024 // 500MB max
    })

    const [fields, files] = await form.parse(req)
    const file = files.file?.[0]

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Leer archivo
    const fileBuffer = fs.readFileSync(file.filepath)
    const fileName = file.originalFilename || file.newFilename
    const fileType = file.mimetype

    // Path en R2: model_{id}/uploaded/{timestamp}_{filename}
    const timestamp = Date.now()
    const r2Path = `model_${modelId}/uploaded/${timestamp}_${fileName}`

    // Subir a R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Path,
      Body: fileBuffer,
      ContentType: fileType
    })

    await s3Client.send(command)

    console.log('✅ File uploaded to R2:', r2Path)

    // Limpiar archivo temporal
    fs.unlinkSync(file.filepath)

    res.status(200).json({
      success: true,
      r2Path,
      fileName,
      fileSize: file.size,
      fileType
    })

  } catch (error) {
    console.error('❌ R2 upload error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
