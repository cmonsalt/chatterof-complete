import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Verificar que es llamado por Vercel Cron
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('⏰ Cron job: Checking notifications for all models')

    // Get all active models
    const { data: models, error } = await supabase
      .from('models')
      .select('model_id, of_account_id, name')
      .not('of_account_id', 'is', null)

    if (error) throw error

    console.log(`📋 Found ${models?.length || 0} models to check`)

    let totalLikes = 0

    // Check notifications for each model
    for (const model of models || []) {
      if (!model.of_account_id) continue

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/onlyfans/check-notifications`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: model.of_account_id,
              modelId: model.model_id
            })
          }
        )

        const result = await response.json()
        totalLikes += result.likesProcessed || 0
        
        console.log(`✅ ${model.name}: ${result.likesProcessed || 0} likes`)
      } catch (err) {
        console.error(`❌ Error checking ${model.name}:`, err.message)
      }
    }

    return res.status(200).json({
      success: true,
      modelsChecked: models?.length || 0,
      totalLikesProcessed: totalLikes
    })

  } catch (error) {
    console.error('💥 Cron error:', error)
    return res.status(500).json({ error: error.message })
  }
}
