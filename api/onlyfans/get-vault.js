export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    let allMedias = [];
    let offset = 0;
    const limit = 50; // Max por request
    let hasMore = true;

    console.log('📂 Fetching all vault media...');

    // Fetch all pages
    while (hasMore && allMedias.length < 1000) {
      const url = `https://app.onlyfansapi.com/api/${accountId}/media/vault?limit=${limit}&offset=${offset}&sort=desc`;
      
      console.log(`  ├─ Fetching offset ${offset}...`);
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OnlyFans API error:', response.status, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // La estructura correcta es: data.data.list
      const medias = data.data?.list || [];
      const hasMoreFlag = data.data?.hasMore || false;
      
      console.log(`  ├─ Got ${medias.length} medias, hasMore: ${hasMoreFlag}`);
      
      if (medias.length === 0) {
        hasMore = false;
        break;
      }

      // Transform to simpler structure
      const transformedMedias = medias.map(media => ({
        id: media.id,
        type: media.type,
        thumb: media.files?.thumb?.url || media.files?.preview?.url,
        preview: media.files?.preview?.url,
        full: media.files?.full?.url,
        width: media.files?.full?.width,
        height: media.files?.full?.height,
        duration: media.duration,
        createdAt: media.createdAt,
        likesCount: media.counters?.likesCount || 0,
        tipsSumm: media.counters?.tipsSumm || 0,
        canView: media.canView,
        isReady: media.isReady
      }));

      allMedias = allMedias.concat(transformedMedias);
      
      // Check if there's more
      if (!hasMoreFlag || medias.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log('✅ Total vault medias loaded:', allMedias.length);

    res.status(200).json({ 
      success: true,
      medias: allMedias,
      total: allMedias.length
    });
    
  } catch (error) {
    console.error('❌ Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
