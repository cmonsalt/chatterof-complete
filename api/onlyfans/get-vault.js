export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // ✅ Endpoint correcto según documentación OnlyFans API
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/vault/lists`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Retornar solo el data, no el _meta
    res.status(200).json({ 
      success: true,
      medias: data.data || data,
      _meta: data._meta // Info de créditos y rate limits
    });
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
