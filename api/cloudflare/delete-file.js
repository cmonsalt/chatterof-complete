import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
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

    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey
    }))

    console.log(`✅ Successfully deleted from R2: ${fileKey}`)

    return res.status(200).json({ 
      success: true,
      deleted: fileKey,
      message: 'File deleted from Cloudflare R2'
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
