// api/onlyfans/authenticate.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    console.log(`[Authenticate] Starting authentication for: ${email}`)

    // Step 1: Start authentication
    const response = await fetch('https://app.onlyfansapi.com/api/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    console.log(`[Authenticate] Response:`, {
      status: response.status,
      hasAttemptId: !!data.attempt_id,
      hasAccountId: !!data.account_id,
      dataKeys: Object.keys(data)
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || 'Authentication failed',
        details: data
      })
    }

    // Return attempt_id or account_id
    return res.status(200).json(data)

  } catch (error) {
    console.error('[Authenticate] Error:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}
