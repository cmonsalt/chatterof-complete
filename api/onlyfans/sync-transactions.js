import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, limit = 100 } = req.query

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

    // Fetch transactions from OnlyFans API
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/transactions?limit=${limit}`,
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

    const data = await response.json()
    const transactions = data.list || data.transactions || []

    let synced = 0

    for (const txn of transactions) {
      // Determine transaction type
      let type = 'compra'
      if (txn.type === 'tip') type = 'tip'
      if (txn.type === 'subscription') type = 'suscripcion'

      const txnData = {
        fan_id: txn.user?.id?.toString() || 'unknown',
        type,
        amount: parseFloat(txn.amount || 0),
        model_id: modelId,
        created_at: txn.createdAt || new Date().toISOString(),
        description: txn.description || txn.text || '',
        of_transaction_id: txn.id?.toString(),
        payment_method: txn.paymentType || 'locked_content',
        detected_by: 'api_sync'
      }

      const { error } = await supabase
        .from('transactions')
        .upsert(txnData, { onConflict: 'of_transaction_id' })

      if (!error) synced++

      // Update fan spent_total
      if (txn.user?.id) {
        await supabase.rpc('increment_fan_spent', {
          p_fan_id: txn.user.id.toString(),
          p_amount: parseFloat(txn.amount || 0)
        }).catch(() => {
          // If RPC doesn't exist, do manual update
          supabase
            .from('fans')
            .select('spent_total')
            .eq('fan_id', txn.user.id.toString())
            .single()
            .then(({ data: fan }) => {
              if (fan) {
                supabase
                  .from('fans')
                  .update({ spent_total: (fan.spent_total || 0) + parseFloat(txn.amount || 0) })
                  .eq('fan_id', txn.user.id.toString())
              }
            })
        })
      }
    }

    return res.status(200).json({
      success: true,
      synced,
      total: transactions.length,
      message: `Synced ${synced} transactions successfully`
    })

  } catch (error) {
    console.error('Sync transactions error:', error)
    return res.status(500).json({
      error: 'Failed to sync transactions',
      details: error.message
    })
  }
}
