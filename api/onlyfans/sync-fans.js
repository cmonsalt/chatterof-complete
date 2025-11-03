import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, force = false } = req.query

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    // Get model_id from account_id
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('model_id, updated_at')
      .eq('of_account_id', accountId)
      .single()

    if (modelError || !model) {
      throw new Error('Model not found for this account')
    }

    const modelId = model.model_id

    // Check if we synced recently (less than 1 hour ago)
    if (!force) {
      const lastSync = model.updated_at
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      if (lastSync && new Date(lastSync) > oneHourAgo) {
        return res.status(200).json({
          success: true,
          cached: true,
          message: 'Using recent sync (less than 1 hour old). Use ?force=true to force refresh',
          lastSync: lastSync
        })
      }
    }

    let synced = 0
    let totalFetched = 0
    let offset = 0
    let hasMore = true
    const limit = 20 // Máximo permitido por la API
    let creditsUsed = 0

    // Fetch all pages
    while (hasMore) {
      const response = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/fans/all?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
      }

      const responseData = await response.json()
      
      const subscribers = responseData.data?.list || []
      hasMore = responseData.data?.hasMore || false
      totalFetched += subscribers.length
      creditsUsed += responseData._meta?._credits?.used || 1

      console.log(`Page ${offset/limit + 1}: Fetched ${subscribers.length} fans, hasMore: ${hasMore}`)

      for (const sub of subscribers) {
        // Get subscription details
        const subData = sub.subscribedOnData
        const lastSubscribe = subData?.subscribes?.[0]

        // Calculate revenues
        const netRevenue = parseFloat(subData?.totalSumm || 0)  // Lo que ganaste (API da esto)
        const grossRevenue = netRevenue > 0 ? netRevenue / 0.8 : 0  // Lo que gastó el fan

        const fanData = {
          fan_id: sub.id?.toString(),
          name: sub.name || sub.username || 'Unknown',
          model_id: modelId,
          of_username: sub.username,
          of_avatar_url: sub.avatar,
          is_subscribed: sub.subscribedBy || false,
          subscription_date: sub.subscribedByData?.subscribeAt,
          spent_total: grossRevenue,  // GROSS para compatibilidad
          gross_revenue: grossRevenue,  // Lo que gastó el fan
          net_revenue: netRevenue,  // Lo que ganaste
          last_update: new Date().toISOString(),
          // Subscription fields
          subscription_type: lastSubscribe?.type || null,
          subscription_price: parseFloat(lastSubscribe?.price || 0),
          is_renewal_enabled: sub.subscribedByAutoprolong || false,
          subscription_expires_at: lastSubscribe?.expireDate || null
        }

        const { error } = await supabase
          .from('fans')
          .upsert(fanData, { onConflict: 'fan_id' })

        if (!error) synced++
        else console.error('Error upserting fan:', sub.id, error)
      }

      offset += limit
      
      // Safety limit: stop after 50 pages (1000 fans)
      if (offset > 1000) {
        console.log('Reached safety limit of 1000 fans')
        break
      }
    }

    // Update model sync timestamp
    await supabase
      .from('models')
      .update({ updated_at: new Date().toISOString() })
      .eq('model_id', modelId)

    return res.status(200).json({
      success: true,
      synced,
      total: totalFetched,
      pages: Math.ceil(offset / limit),
      creditsUsed,
      message: `Synced ${synced} fans successfully from ${totalFetched} total fans (${creditsUsed} credits used)`
    })

  } catch (error) {
    console.error('Sync fans error:', error)
    return res.status(500).json({
      error: 'Failed to sync fans',
      details: error.message
    })
  }
}
