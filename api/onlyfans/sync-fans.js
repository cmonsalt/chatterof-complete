import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, modelId, offset = 0 } = req.body

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
    const limit = 20
    let creditsUsed = 0

    // Fetch fans from OnlyFansAPI
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
      
      // If auth error, mark as disconnected
      if (response.status === 401 || response.status === 403) {
        await supabase
          .from('models')
          .update({ connection_status: 'disconnected' })
          .eq('model_id', modelId)
        
        return res.status(401).json({
          error: 'Authentication failed',
          needsReauth: true,
          message: 'Account needs re-authorization'
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    
    const subscribers = responseData.data?.list || []
    const hasMore = responseData.data?.hasMore || false
    totalFetched = subscribers.length
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log('='.repeat(80))
    console.log('[DEBUG] SYNC FANS - API RESPONSE')
    console.log('='.repeat(80))
    console.log(`Fetched: ${subscribers.length} fans`)
    console.log(`HasMore: ${hasMore}`)
    console.log(`Offset: ${offset}`)
    console.log(`Credits: ${creditsUsed}`)
    console.log('-'.repeat(80))

    // Log SAMPLE FAN (primer fan con datos completos)
    if (subscribers.length > 0) {
      const sampleFan = subscribers[0]
      console.log('📋 SAMPLE FAN DATA (COMPLETE JSON):')
      console.log(JSON.stringify(sampleFan, null, 2))
      console.log('-'.repeat(80))
      
      // Analizar estructura de revenue
      console.log('💰 REVENUE ANALYSIS:')
      console.log('  sub.subscribedOnData:', sampleFan.subscribedOnData ? 'EXISTS' : 'NULL')
      if (sampleFan.subscribedOnData) {
        console.log('  - totalSumm:', sampleFan.subscribedOnData.totalSumm)
        console.log('  - subscribes:', sampleFan.subscribedOnData.subscribes ? 'EXISTS' : 'NULL')
        if (sampleFan.subscribedOnData.subscribes && sampleFan.subscribedOnData.subscribes.length > 0) {
          console.log('  - subscribes[0]:', JSON.stringify(sampleFan.subscribedOnData.subscribes[0], null, 2))
        }
      }
      console.log('  sub.subscribedByData:', sampleFan.subscribedByData ? 'EXISTS' : 'NULL')
      if (sampleFan.subscribedByData) {
        console.log('  - subscribeAt:', sampleFan.subscribedByData.subscribeAt)
        console.log('  - expireAt:', sampleFan.subscribedByData.expireAt)
        console.log('  - price:', sampleFan.subscribedByData.price)
      }
      console.log('  sub.subscribedBy:', sampleFan.subscribedBy)
      console.log('  sub.subscribedByAutoprolong:', sampleFan.subscribedByAutoprolong)
      console.log('-'.repeat(80))
    }

    // Process fans
    for (const sub of subscribers) {
      const subData = sub.subscribedOnData
      const lastSubscribe = subData?.subscribes?.[0]

      const netRevenue = parseFloat(subData?.totalSumm || 0)
      const grossRevenue = netRevenue > 0 ? netRevenue / 0.8 : 0

      console.log(`  Fan ID ${sub.id}: netRevenue=${netRevenue}, grossRevenue=${grossRevenue}`)

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
        .upsert(fanData, { onConflict: 'fan_id,model_id' })

      if (!error) synced++
      else console.error('❌ Error upserting fan:', sub.id, error)
    }

    console.log('='.repeat(80))
    console.log(`✅ SYNC COMPLETE: ${synced}/${totalFetched} fans synced`)
    console.log('='.repeat(80))

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
    console.error('💥 Sync fans error:', error)
    return res.status(500).json({
      error: 'Failed to sync fans',
      details: error.message
    })
  }
}
