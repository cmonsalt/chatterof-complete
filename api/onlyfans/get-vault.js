export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    let allMedias = [];
    let url = `https://app.onlyfansapi.com/api/${accountId}/media/vault`;
    let hasMore = true;

    // Fetch all pages
    while (hasMore && allMedias.length < 500) { // Límite de seguridad
      console.log('Fetching:', url);
      
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
      
      console.log('Page result:', {
        count: data.data?.length || 0,
        hasNextPage: !!data._meta?._pagination?.next_page,
        totalSoFar: allMedias.length
      });

      // Add current page medias
      if (data.data && Array.isArray(data.data)) {
        allMedias = allMedias.concat(data.data);
      }

      // Check if there's a next page
      if (data._meta?._pagination?.next_page) {
        url = data._meta._pagination.next_page;
      } else {
        hasMore = false;
      }
    }

    console.log('✅ Total vault medias loaded:', allMedias.length);

    res.status(200).json({ 
      success: true,
      medias: allMedias,
      total: allMedias.length
    });
    
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
