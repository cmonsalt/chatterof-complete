import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Helper to clean HTML
function cleanHTML(text) {
  if (!text) return ''
  return text
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId } = req.query

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    console.log(`[Setup] Starting account setup for ${accountId}`)

    // Get model_id from account_id
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('model_id')
      .eq('of_account_id', accountId)
      .single()

    if (modelError || !model) {
      throw new Error('Model not found for this account')
    }

    const modelId = model.model_id

    let creditsUsed = 0
    let totalFans = 0
    let fansWithSpending = 0
    let messagesSynced = 0

    // STEP 1: Sync ALL fans (to have complete list with spending data)
    console.log(`[Setup] Step 1: Syncing all fans...`)
    
    let offset = 0
    let hasMore = true
    const limit = 20
    const fansWithMoney = []

    while (hasMore) {
      const response = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/fans/all?limit=${limit}&offset=${offset}`,
        {
          headers: { 'Authorization': `Bearer ${API_KEY}` }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
      }

      const responseData = await response.json()
      const subscribers = responseData.data?.list || []
      hasMore = responseData.data?.hasMore || false
      creditsUsed += responseData._meta?._credits?.used || 1
      totalFans += subscribers.length

      for (const sub of subscribers) {
        const subData = sub.subscribedOnData
        const lastSubscribe = subData?.subscribes?.[0]

        // Calculate revenues
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

        await supabase.from('fans').upsert(fanData, { onConflict: 'fan_id' })

        // Track fans with spending for step 2
        if (netRevenue > 0) {
          fansWithSpending++
          fansWithMoney.push(sub.id?.toString())
        }
      }

      offset += limit
      
      if (offset > 1000) {
        console.log('[Setup] Reached safety limit of 1000 fans')
        break
      }
    }

    console.log(`[Setup] Step 1 complete: ${totalFans} fans synced (${fansWithSpending} with spending > $0)`)

    // STEP 2: Fetch last 10 messages ONLY from fans with spending
    console.log(`[Setup] Step 2: Syncing messages from paying fans...`)

    for (const fanId of fansWithMoney) {
      try {
        const messagesResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/chats/${fanId}/messages?limit=10`,
          {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
          }
        )

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          const messages = messagesData.data || []
          creditsUsed += messagesData._meta?._credits?.used || 1

          for (const msg of messages) {
            const chatData = {
              fan_id: fanId,
              message: cleanHTML(msg.text),
              model_id: modelId,
              timestamp: msg.createdAt || new Date().toISOString(),
              from: msg.isSentByMe ? 'model' : 'fan',
              message_type: msg.mediaCount > 0 ? 'media' : 'text',
              of_message_id: msg.id?.toString(),
              media_url: msg.media?.[0]?.files?.full?.url || msg.media?.[0]?.files?.thumb?.url,
              media_urls: msg.media?.map(m => m.files?.full?.url || m.files?.thumb?.url).filter(Boolean).join(','),
              amount: parseFloat(msg.price || 0),
              read: msg.isOpened || false,
              source: 'api_sync',
              is_locked: !msg.isFree,
              is_purchased: msg.canPurchaseReason === 'purchased' || msg.canPurchaseReason === 'opened' || msg.isFree,
              locked_text: msg.lockedText || false
            }

            const { error } = await supabase
              .from('chat')
              .upsert(chatData, { onConflict: 'of_message_id' })

            if (!error) messagesSynced++
          }
        }
      } catch (msgError) {
        console.error(`[Setup] Error fetching messages for fan ${fanId}:`, msgError)
      }
    }

    console.log(`[Setup] Step 2 complete: ${messagesSynced} messages synced`)

    // Update model sync timestamp
    await supabase
      .from('models')
      .update({ updated_at: new Date().toISOString() })
      .eq('model_id', modelId)

    console.log(`[Setup] Account setup complete!`)

    return res.status(200).json({
      success: true,
      totalFans,
      fansWithSpending,
      messagesSynced,
      creditsUsed,
      message: `Setup complete: ${totalFans} fans synced, ${messagesSynced} messages from ${fansWithSpending} paying fans (${creditsUsed} credits used)`
    })

  } catch (error) {
    console.error('[Setup] Error:', error)
    return res.status(500).json({
      error: 'Failed to setup account',
      details: error.message
    })
  }
}
