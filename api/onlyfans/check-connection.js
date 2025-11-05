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

    // Try a simple API call to check connection
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/fans/all?limit=1&offset=0`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    )

    const isConnected = response.ok

    // Update connection status in DB
    await supabase
      .from('models')
      .update({ 
        connection_status: isConnected ? 'connected' : 'disconnected',
        last_connection_check: new Date().toISOString()
      })
      .eq('model_id', modelId)

    if (!isConnected) {
      return res.status(200).json({
        success: true,
        connected: false,
        needsReauth: true,
        message: 'Account needs re-authorization'
      })
    }

    return res.status(200).json({
      success: true,
      connected: true,
      message: 'Connection is healthy'
    })

  } catch (error) {
    console.error('Connection check error:', error)
    
    // Mark as disconnected on error
    await supabase
      .from('models')
      .update({ 
        connection_status: 'disconnected',
        last_connection_check: new Date().toISOString()
      })
      .eq('model_id', modelId)

    return res.status(200).json({
      success: true,
      connected: false,
      needsReauth: true,
      message: 'Connection check failed'
    })
  }
}
