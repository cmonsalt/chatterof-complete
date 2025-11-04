export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // ✅ Endpoint correcto: List Vault Media (no lists)
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/vault`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OnlyFans API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Vault API response:', {
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      structure: Object.keys(data)
    });

    // La respuesta viene en data.data (array de medias)
    res.status(200).json({ 
      success: true,
      medias: data.data || [],
      _meta: data._meta
    });
    
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
