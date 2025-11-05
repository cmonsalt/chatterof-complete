// api/onlyfans/check-auth-status.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { attemptId } = req.query

  if (!attemptId) {
    return res.status(400).json({ error: 'attemptId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    const response = await fetch(
      `https://app.onlyfansapi.com/api/authenticate/${attemptId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || 'Failed to check auth status',
        details: data
      })
    }

    return res.status(200).json(data)

  } catch (error) {
    console.error('Check auth status error:', error)
    return res.status(500).json({ 
      error: 'Failed to check auth status',
      message: error.message 
    })
  }
}
