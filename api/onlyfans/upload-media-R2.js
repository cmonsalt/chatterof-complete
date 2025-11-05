import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import formidable from 'formidable'
import fs from 'fs'

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
    bodyParser: false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const API_KEY = process.env.ONLYFANS_API_KEY

  try {
    const { accountId, modelId, sendToVault } = req.query

    if (!accountId || !modelId) {
      return res.status(400).json({ error: 'accountId and modelId required' })
    }

    // Parse form data
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024
    })

    const [fields, files] = await form.parse(req)
    const file = files.file?.[0]

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const fileBuffer = fs.readFileSync(file.filepath)
    const fileName = file.originalFilename || file.newFilename
    const fileType = file.mimetype

    console.log(`📤 Uploading ${fileName} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // PASO 1: Subir a R2 primero
    const timestamp = Date.now()
    const r2Path = `model_${modelId}/uploaded/${timestamp}_${fileName}`

    const r2Command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Path,
      Body: fileBuffer,
      ContentType: fileType
    })

    await s3Client.send(r2Command)
    console.log(`✅ Uploaded to R2: ${r2Path}`)

    // PASO 2: Si sendToVault=true, también sube a OnlyFans
    let ofMediaId = null

    if (sendToVault === 'true') {
      console.log(`📡 Sending to OnlyFans vault...`)

      // Upload to OnlyFans
      const FormData = require('form-data')
      const formData = new FormData()
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: fileType
      })

      const ofResponse = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/media/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        }
      )

      if (!ofResponse.ok) {
        console.error(`⚠️ OnlyFans upload failed: ${ofResponse.status}`)
        // Continue anyway, we have it in R2
      } else {
        const ofData = await ofResponse.json()
        ofMediaId = ofData.prefixed_id
        console.log(`✅ Uploaded to OnlyFans: ${ofMediaId}`)
      }
    }

    // Cleanup temp file
    fs.unlinkSync(file.filepath)

    res.status(200).json({
      success: true,
      r2Path,
      r2Url: `https://${process.env.R2_BUCKET_NAME}.r2.dev/${r2Path}`,
      ofMediaId,
      fileName,
      fileSize: file.size,
      fileType
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
}
