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
    const { modelId } = req.body

    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' })
    }

    // Get OF account ID
    const { data: model } = await supabase
      .from('models')
      .select('of_account_id')
      .eq('model_id', modelId)
      .single()

    if (!model?.of_account_id) {
      return res.status(400).json({ error: 'No OF account found' })
    }

    console.log(`📥 Starting vault scrape for model ${modelId}...`)

    // Get vault media from OnlyFans
    const vaultResponse = await fetch(
      `https://app.onlyfansapi.com/api/${model.of_account_id}/media/vault`,
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
    const medias = vaultData.data?.list || []

    console.log(`📦 Found ${medias.length} media items in vault`)

    let scrapedCount = 0
    let errorCount = 0

    // Scrape cada media
    for (const media of medias) {
      try {
        // Scrape media URL
        const scrapeResponse = await fetch(
          `https://app.onlyfansapi.com/api/${model.of_account_id}/media/scrape`,
          {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: media.files?.source?.url || media.full
            })
          }
        )

        if (!scrapeResponse.ok) {
          console.error(`⚠️ Failed to scrape media ${media.id}`)
          errorCount++
          continue
        }

        const scrapeData = await scrapeResponse.json()
        const temporaryUrl = scrapeData.temporary_url

        if (!temporaryUrl) {
          console.error(`⚠️ No temporary URL for media ${media.id}`)
          errorCount++
          continue
        }

        // Download media
        const mediaResponse = await fetch(temporaryUrl)
        const mediaBuffer = await mediaResponse.arrayBuffer()

        // Get file extension
        const fileType = media.type || 'photo'
        const extension = fileType === 'video' ? 'mp4' : 'jpg'
        const fileName = `${media.id}.${extension}`

        // Upload to R2
        const r2Path = `model_${modelId}/scraped/${fileName}`

        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Path,
          Body: Buffer.from(mediaBuffer),
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

    // Mark model as scraped
    await supabase
      .from('models')
      .update({ 
        vault_scraped_at: new Date().toISOString(),
        vault_media_count: scrapedCount
      })
      .eq('model_id', modelId)

    console.log(`🎉 Scrape complete: ${scrapedCount} success, ${errorCount} errors`)

    res.status(200).json({
      success: true,
      scraped: scrapedCount,
      errors: errorCount,
      total: medias.length
    })

  } catch (error) {
    console.error('❌ Vault scrape error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
