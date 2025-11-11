import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, modelId, startDate, marker } = req.body

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    // If modelId not provided, get it from accountId
    let finalModelId = modelId
    if (!finalModelId) {
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select('model_id')
        .eq('of_account_id', accountId)
        .single()

      if (modelError || !model) {
        throw new Error('Model not found for this account')
      }

      finalModelId = model.model_id
    }

    let synced = 0
    let skipped = 0
    const limit = 50
    let creditsUsed = 0

    // Build URL with optional parameters
    let url = `https://app.onlyfansapi.com/api/${accountId}/transactions?limit=${limit}`
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`
    if (marker) url += `&marker=${marker}`

    console.log(`🔄 Syncing transactions from OnlyFans...`)

    // Fetch transactions from OnlyFans
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    })

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
    
    const transactions = responseData.data?.list || []
    const hasMore = responseData.data?.hasMore || false
    const nextMarker = responseData.data?.nextMarker
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log(`📊 Fetched ${transactions.length} transactions, hasMore: ${hasMore}`)

    for (const tx of transactions) {
      const ofTxId = tx.id
      const fanId = tx.user?.id?.toString()
      
      if (!fanId || !ofTxId) {
        console.warn('⚠️ Missing fanId or transaction ID:', tx)
        continue
      }

      // Check if transaction already exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('of_transaction_id', ofTxId)
        .single()

      if (existing) {
        skipped++
        continue // Already exists, skip
      }

      // Determine transaction type from description
      const description = tx.description || ''
      let type = 'compra' // default
      
      if (description.includes('Subscription') || description.includes('Recurring subscription')) {
        type = 'suscripcion'
      } else if (description.includes('Tip')) {
        type = 'tip'
      } else if (description.includes('Payment for message')) {
        type = 'compra' // PPV
      }

      // Calculate gross revenue (API returns gross as "amount")
      const grossAmount = parseFloat(tx.amount || 0)
      const netAmount = parseFloat(tx.net || 0)

      // Insert transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          of_transaction_id: ofTxId,
          fan_id: fanId,
          model_id: modelId,
          amount: grossAmount,
          type: type,
          description: description.replace(/<[^>]*>/g, ''), // Strip HTML tags
          created_at: tx.createdAt,
          detected_by: 'sync',
          purchase_metadata: {
            net_amount: netAmount,
            fee: parseFloat(tx.fee || 0),
            status: tx.status,
            currency: tx.currency
          }
        })

      if (txError) {
        console.error('❌ Error inserting transaction:', ofTxId, txError)
        continue
      }

      synced++

      // Note: spent_total is auto-updated by trigger "trigger_recalculate_spent_total"
      // No need to manually call increment_fan_spent
    }

    console.log(`✅ Sync complete: ${synced} new, ${skipped} skipped`)

    return res.status(200).json({
      success: true,
      synced,
      skipped,
      total: transactions.length,
      hasMore,
      nextMarker,
      creditsUsed,
      message: `Synced ${synced} new transactions (${skipped} already existed)`
    })

  } catch (error) {
    console.error('❌ Sync transactions error:', error)
    return res.status(500).json({
      error: 'Failed to sync transactions',
      details: error.message
    })
  }
}