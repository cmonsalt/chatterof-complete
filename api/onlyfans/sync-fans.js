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
    const limit = 20

    console.log(`[Sync Fans] Fetching fans from offset ${offset}, limit ${limit}`)

    // Fetch fans with pagination
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
      
      console.error(`[Sync Fans] API Error ${response.status}:`, errorText)
      
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
      
      // If 404, assume no more fans (end of pagination)
      if (response.status === 404) {
        console.log(`[Sync Fans] 404 at offset ${offset} - end of data`)
        return res.status(200).json({
          success: true,
          synced: 0,
          hasMore: false,
          nextOffset: null,
          message: 'No more fans to sync'
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    
    const subscribers = responseData.data?.list || []
    const hasMore = responseData._pagination?.next_page ? true : false
    
    console.log(`[Sync Fans] Fetched ${subscribers.length} fans, hasMore: ${hasMore}`)
    
    // Log first fan structure to debug
    if (subscribers.length > 0 && offset === 0) {
      console.log('[Sync Fans] Sample fan data:', JSON.stringify(subscribers[0], null, 2))
    }

    // Process each fan
    for (const sub of subscribers) {
      const grossRevenue = parseFloat(sub.spentTotal || 0)
      const netRevenue = grossRevenue * 0.8
      const lastSubscribe = sub.subscribedByData?.subscribeAt 
        ? { ...sub.subscribedByData, expireDate: sub.subscribedByExpireDate }
        : null

      const fanData = {
        fan_id: sub.id.toString(),
        name: sub.name || `u${sub.id}`,
        model_id: modelId,
        of_username: sub.username || null,
        of_avatar_url: sub.avatar || null,
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
        .upsert(fanData, { 
          onConflict: 'fan_id,model_id',
          ignoreDuplicates: false 
        })

      if (!error) synced++
      else console.error('Error upserting fan:', sub.id, error)
    }

    console.log(`[Sync Fans] Synced ${synced} fans`)

    return res.status(200).json({
      success: true,
      synced,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      message: `Synced ${synced} fans`
    })

  } catch (error) {
    console.error('Sync fans error:', error)
    return res.status(500).json({ 
      error: 'Sync failed',
      message: error.message 
    })
  }
}
