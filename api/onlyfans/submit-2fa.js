// api/onlyfans/submit-2fa.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { attemptId, code } = req.body

  if (!attemptId || !code) {
    return res.status(400).json({ error: 'attemptId and code required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    const response = await fetch(
      `https://app.onlyfansapi.com/api/authenticate/${attemptId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ code })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || 'Invalid 2FA code',
        details: data
      })
    }

    return res.status(200).json(data)

  } catch (error) {
    console.error('Submit 2FA error:', error)
    return res.status(500).json({ 
      error: 'Failed to submit 2FA code',
      message: error.message 
    })
  }
}
