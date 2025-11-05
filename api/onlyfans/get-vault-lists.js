export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
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
      const errorText = await response.text();
      console.error('Vault lists error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ Vault lists loaded:', data.data?.length || 0);

    res.status(200).json({ 
      success: true,
      lists: data.data || []
    });
    
  } catch (error) {
    console.error('❌ Get vault lists error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
