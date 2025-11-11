import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

    console.log(`[Setup] Starting setup for ${accountId}`)

    // Check if model already exists
    const { data: existingModel } = await supabase
      .from('models')
      .select('model_id, name, of_account_id')
      .eq('model_id', modelId)
      .single()

    // If model exists, just update account_id (reconnect)
    if (existingModel) {
      console.log(`[Setup] Model ${modelId} already exists, reconnecting...`)
      
      await supabase
        .from('models')
        .update({ 
          of_account_id: accountId,
          updated_at: new Date().toISOString()
        })
        .eq('model_id', modelId)

      return res.status(200).json({
        success: true,
        reconnected: true,
        message: `Account reconnected for ${existingModel.name}`,
        modelId,
        accountId
      })
    }

    // New model - do full setup
    console.log(`[Setup] New model detected, starting initial sync...`)

    let creditsUsed = 0
    let totalFans = 0
    let messagesSynced = 0

    // STEP 1: Sync first 20 fans only
    console.log(`[Setup] Step 1: Syncing first 20 fans...`)
    
    const fansResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/fans/all?limit=20&offset=0`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    )

    if (!fansResponse.ok) {
      throw new Error(`Fans API error: ${fansResponse.status}`)
    }

    const fansData = await fansResponse.json()
    const subscribers = fansData.data?.list || []
    const hasMoreFans = fansData.data?.hasMore || false
    creditsUsed += fansData._meta?._credits?.used || 1
    totalFans = subscribers.length

    const fansWithMoney = []

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

      // ✅ Usar onConflict correcto para permitir fans compartidos entre modelos
      await supabase.from('fans').upsert(fanData, { onConflict: 'fan_id,model_id' })

      if (netRevenue > 0) {
        fansWithMoney.push(sub.id?.toString())
      }
    }

    console.log(`[Setup] Step 1: ${totalFans} fans synced (${fansWithMoney.length} with spending)`)

    // STEP 2: Sync last 10 messages from paying fans (max 10 fans)
    console.log(`[Setup] Step 2: Syncing messages...`)

    const fansToSync = fansWithMoney.slice(0, 10) // Max 10 fans

    for (const fanId of fansToSync) {
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
              media_url: msg.media?.[0]?.files?.full?.url,
              amount: parseFloat(msg.price || 0),
              read: msg.isOpened || false,
              source: 'api_sync',
              is_locked: !msg.isFree,
              is_purchased: msg.canPurchaseReason === 'purchased' || msg.isFree
            }

            const { error } = await supabase
              .from('chat')
              .upsert(chatData, { onConflict: 'of_message_id' })

            if (!error) messagesSynced++
          }
        }
      } catch (msgError) {
        console.error(`[Setup] Error for fan ${fanId}:`, msgError.message)
      }
    }

    console.log(`[Setup] Step 2: ${messagesSynced} messages synced`)

    // STEP 3: Mark vault as NOT scraped yet (will be done separately)
    await supabase
      .from('models')
      .update({ 
        updated_at: new Date().toISOString(),
        vault_scraped_at: null
      })
      .eq('model_id', modelId)

    console.log(`[Setup] Initial setup complete!`)

    // STEP 4: Auto-crear tiers default
    const { data: existingTiers } = await supabase
      .from('tiers')
      .select('id')
      .eq('model_id', modelId)
      .limit(1)

    if (!existingTiers || existingTiers.length === 0) {
      console.log('[Setup] Creating default tiers...')
      
      await supabase
        .from('tiers')
        .insert([
          {
            model_id: modelId,
            name: 'FREE',
            min_spent: 0,
            max_spent: 19,
            price_multiplier: 1.0
          },
          {
            model_id: modelId,
            name: 'VIP',
            min_spent: 20,
            max_spent: 499,
            price_multiplier: 1.5
          },
          {
            model_id: modelId,
            name: 'WHALE',
            min_spent: 500,
            max_spent: 999999,
            price_multiplier: 2.0
          }
        ])
      
      console.log('[Setup] ✅ Default tiers created')
    }

    return res.status(200).json({
      success: true,
      totalFans,
      messagesSynced,
      hasMoreFans,
      hasMoreChats: fansWithMoney.length > 10,
      needsVaultScrape: true,
      creditsUsed,
      message: `Initial sync: ${totalFans} fans, ${messagesSynced} messages (${creditsUsed} credits)`
    })

  } catch (error) {
    console.error('[Setup] Error:', error)
    return res.status(500).json({
      error: 'Failed to setup account',
      details: error.message
    })
  }
}
