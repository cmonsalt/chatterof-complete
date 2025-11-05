import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, modelId } = req.body

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    let synced = 0
    let totalFetched = 0
    let offset = 0
    let hasMore = true
    const limit = 20
    let creditsUsed = 0

    // Fetch max 20 fans per call (avoid timeout)
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
    totalFetched = subscribers.length
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log(`Fetched ${subscribers.length} fans, hasMore: ${hasMore}`)

    for (const sub of subscribers) {
      const subData = sub.subscribedOnData
      const lastSubscribe = subData?.subscribes?.[0]

      const netRevenue = parseFloat(subData?.totalSumm || 0)
      const grossRevenue = netRevenue > 0 ? netRevenue / 0.8 : 0

      const fanData = {
        fan_id: sub.id?.toString(),
        name: sub.name || sub.username || 'Unknown',
        model_id: modelId,
        of_username: sub.username,
        of_avatar_url: sub.avatar,
        is_subscribed: sub.subscribedBy || false,
        subscription_date: sub.subscribedByData?.subscribeAt,
        spent_total: grossRevenue,
        gross_revenue: grossRevenue,
        net_revenue: netRevenue,
        last_update: new Date().toISOString(),
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

    return res.status(200).json({
      success: true,
      synced,
      total: totalFetched,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      creditsUsed,
      message: `Synced ${synced} fans (${creditsUsed} credits)`
    })

  } catch (error) {
    console.error('Sync fans error:', error)
    return res.status(500).json({
      error: 'Failed to sync fans',
      details: error.message
    })
  }
}
