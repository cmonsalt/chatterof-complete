import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

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

    // Fetch subscribers from OnlyFans API
    const response = await fetch(`https://app.onlyfansapi.com/api/${accountId}/subscribers`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const subscribers = data.list || data.subscribers || []

    let synced = 0

    for (const sub of subscribers) {
      const fanData = {
        fan_id: sub.id.toString(),
        name: sub.name || sub.username || 'Unknown',
        model_id: modelId,
        of_username: sub.username,
        of_avatar_url: sub.avatar,
        is_subscribed: true,
        subscription_date: sub.subscribedOn || sub.subscribed_on,
        spent_total: parseFloat(sub.spentTotal || 0),
        last_update: new Date().toISOString()
      }

      const { error } = await supabase
        .from('fans')
        .upsert(fanData, { onConflict: 'fan_id' })

      if (!error) synced++
    }

    return res.status(200).json({
      success: true,
      synced,
      total: subscribers.length,
      message: `Synced ${synced} fans successfully`
    })

  } catch (error) {
    console.error('Sync fans error:', error)
    return res.status(500).json({
      error: 'Failed to sync fans',
      details: error.message
    })
  }
}
