import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const API_KEY = process.env.ONLYFANS_API_KEY

  try {
    const { modelId, offset = 0 } = req.body

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' })
    }

    // Get OF account ID
    const { data: model } = await supabase
      .from('models')
      .select('of_account_id, vault_media_count, vault_scraped_at')
      .eq('model_id', modelId)
      .single()

    if (!model?.of_account_id) {
      return res.status(400).json({ error: 'No OF account found' })
    }

    console.log(`📥 Vault scrape for ${modelId} at offset ${offset}`)

    // CRITICAL: Only scrape 20 medias per request to avoid timeout
    const BATCH_SIZE = 20
    const limit = 50 // Fetch 50 but only process 20

    const vaultResponse = await fetch(
      `https://app.onlyfansapi.com/api/${model.of_account_id}/media/vault?limit=${limit}&offset=${offset}`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!vaultResponse.ok) {
      throw new Error(`Vault API error: ${vaultResponse.status}`)
    }

    const vaultData = await vaultResponse.json()
    const allMedias = vaultData.data?.list || []
    const hasMoreFromAPI = vaultData.data?.hasMore || false
    
    console.log(`📦 Fetched ${allMedias.length} medias from API`)

    // Only process BATCH_SIZE to stay under 5min limit
    const mediasToProcess = allMedias.slice(0, BATCH_SIZE)
    
    console.log(`🔄 Processing ${mediasToProcess.length} medias (batch size: ${BATCH_SIZE})`)

    let scrapedCount = 0
    let errorCount = 0

    for (const media of mediasToProcess) {
      try {
        const fileType = media.type || 'photo'
        const extension = fileType === 'video' ? 'mp4' : 'jpg'
        const mediaUrl = media.files?.full?.url || media.files?.source?.url
        
        if (!mediaUrl) {
          console.log(`⚠️ No URL for media ${media.id}`)
          errorCount++
          continue
        }

        // Download from OnlyFans
        const fileResponse = await fetch(mediaUrl)
        if (!fileResponse.ok) {
          throw new Error(`Download failed: ${fileResponse.status}`)
        }

        const fileBuffer = await fileResponse.arrayBuffer()
        const fileName = `${modelId}/${media.id}.${extension}`

        // Upload to R2
        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: Buffer.from(fileBuffer),
          ContentType: fileType === 'video' ? 'video/mp4' : 'image/jpeg'
        })

        await s3Client.send(command)

        console.log(`✅ Scraped: ${fileName}`)
        scrapedCount++

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ Error scraping media ${media.id}:`, error.message)
        errorCount++
      }
    }

    // Calculate progress
    const currentTotal = (model.vault_media_count || 0) + scrapedCount
    const hasMore = hasMoreFromAPI && (allMedias.length >= BATCH_SIZE)
    const nextOffset = hasMore ? offset + BATCH_SIZE : null

    // Update model with progress
    await supabase
      .from('models')
      .update({ 
        vault_media_count: currentTotal,
        vault_scraped_at: hasMore ? null : new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId)

    console.log(`🎉 Batch complete: ${scrapedCount} success, ${errorCount} errors`)
    console.log(`📊 Progress: ${currentTotal} total, hasMore: ${hasMore}`)

    res.status(200).json({
      success: true,
      scraped: scrapedCount,
      errors: errorCount,
      totalScraped: currentTotal,
      hasMore,
      nextOffset,
      batchSize: BATCH_SIZE,
      message: `Scraped ${scrapedCount}/${mediasToProcess.length} medias. Total: ${currentTotal}`
    })

  } catch (error) {
    console.error('❌ Vault scrape error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
