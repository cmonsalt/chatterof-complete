import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
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
  const { accountId, modelId } = req.query
  const API_KEY = process.env.ONLYFANS_API_KEY

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' })
  }

  try {
    // Check if vault was already scraped
    const { data: model } = await supabase
      .from('models')
      .select('vault_scraped_at')
      .eq('model_id', modelId)
      .single()

    const isScraped = !!model?.vault_scraped_at

    console.log(`📂 Vault scraped: ${isScraped}`)

    if (isScraped) {
      // Lista desde R2
      console.log('📦 Listing from R2...')
      
      const prefix = `model_${modelId}/scraped/`
      
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix
      })

      const response = await s3Client.send(command)
      const r2Files = response.Contents || []

      // Transform to same format as OF vault
      const medias = r2Files.map(file => {
        const fileName = file.Key.split('/').pop()
        const mediaId = fileName.split('.')[0]
        const extension = fileName.split('.').pop()
        const type = extension === 'mp4' ? 'video' : 'photo'

        return {
          id: mediaId,
          type,
          thumb: `https://${process.env.R2_BUCKET_NAME}.r2.dev/${file.Key}`,
          preview: `https://${process.env.R2_BUCKET_NAME}.r2.dev/${file.Key}`,
          full: `https://${process.env.R2_BUCKET_NAME}.r2.dev/${file.Key}`,
          createdAt: file.LastModified,
          canView: true,
          isReady: true,
          source: 'r2'
        }
      })

      console.log(`✅ Loaded ${medias.length} medias from R2`)

      return res.status(200).json({
        success: true,
        medias,
        total: medias.length,
        source: 'r2'
      })

    } else {
      // Fallback: Lista desde OnlyFans (método original)
      console.log('📡 Listing from OnlyFans (not scraped yet)...')
      
      let allMedias = []
      let offset = 0
      const limit = 50
      let hasMore = true

      while (hasMore && allMedias.length < 1000) {
        const url = `https://app.onlyfansapi.com/api/${accountId}/media/vault?limit=${limit}&offset=${offset}&sort=desc`
        
        const response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const medias = data.data?.list || []
        const hasMoreFlag = data.data?.hasMore || false
        
        if (medias.length === 0) break

        const transformedMedias = medias.map(media => ({
          id: media.id,
          type: media.type,
          thumb: media.files?.thumb?.url || media.files?.preview?.url,
          preview: media.files?.preview?.url,
          full: media.files?.full?.url,
          width: media.files?.full?.width,
          height: media.files?.full?.height,
          duration: media.duration,
          createdAt: media.createdAt,
          likesCount: media.counters?.likesCount || 0,
          canView: media.canView,
          isReady: media.isReady,
          source: 'onlyfans'
        }))

        allMedias = allMedias.concat(transformedMedias)
        
        if (!hasMoreFlag || medias.length < limit) {
          hasMore = false
        } else {
          offset += limit
        }
      }

      console.log(`✅ Loaded ${allMedias.length} medias from OnlyFans`)

      return res.status(200).json({
        success: true,
        medias: allMedias,
        total: allMedias.length,
        source: 'onlyfans',
        needsScrape: true // Indica que debe hacer scrape inicial
      })
    }
    
  } catch (error) {
    console.error('❌ Get vault error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
}
