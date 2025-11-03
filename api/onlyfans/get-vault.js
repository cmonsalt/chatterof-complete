export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media-vault`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: error.message });
  }
}
