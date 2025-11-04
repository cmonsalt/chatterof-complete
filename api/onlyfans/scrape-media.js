export default async function handler(req, res) {
  const { accountId, mediaId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !mediaId) {
    return res.status(400).json({ error: 'accountId and mediaId required' });
  }

  try {
    // Scrape media from OnlyFans
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/scrape`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: mediaId  // Puede ser media_id o URL
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scrape error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ Media scraped:', mediaId);

    res.status(200).json({ 
      success: true,
      temporary_url: data.temporary_url || data.data?.temporary_url,
      expiration_date: data.expiration_date || data.data?.expiration_date
    });
    
  } catch (error) {
    console.error('❌ Scrape error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
