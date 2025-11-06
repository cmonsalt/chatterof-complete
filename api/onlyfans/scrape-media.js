const API_KEY = process.env.ONLYFANS_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, mediaUrl } = req.body;

    if (!accountId || !mediaUrl) {
      return res.status(400).json({ 
        error: 'accountId and mediaUrl required' 
      });
    }

    console.log('🔄 Scraping media from R2:', mediaUrl);

    // Llamar al endpoint de OnlyFans API para hacer scrape
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/scrape`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: mediaUrl
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('✅ Media scraped to vault:', data);

    // Retornar el vault_media_id que OnlyFans generó
    res.status(200).json({
      success: true,
      vaultMediaId: data.data?.id,
      creditsUsed: data._meta?._credits?.used || 1,
      data: data.data
    });

  } catch (error) {
    console.error('❌ Scrape error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
