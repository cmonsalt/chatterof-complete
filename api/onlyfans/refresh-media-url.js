export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, ofMediaId } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !ofMediaId) {
    return res.status(400).json({ 
      error: 'accountId and ofMediaId required' 
    });
  }

  try {
    console.log(`🔄 Refreshing URL for media ${ofMediaId}...`);

    // Obtener info del media desde OnlyFans (incluye URL fresca)
    const url = `https://app.onlyfansapi.com/api/${accountId}/media/vault?limit=100&sort=desc`;
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OnlyFans API Error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const medias = data.data?.list || [];
    
    console.log(`📦 Found ${medias.length} medias in vault`);
    
    // Buscar el media específico
    const media = medias.find(m => m.id.toString() === ofMediaId.toString());
    
    if (!media) {
      console.log(`❌ Media ${ofMediaId} not found in vault`);
      return res.status(404).json({ 
        success: false,
        error: 'Media not found in vault. It may not be in the first 100 items.'
      });
    }

    // Extraer URL fresca - Probar múltiples fuentes
    const freshUrl = media.files?.full?.url || 
                     media.files?.source?.url || 
                     media.files?.preview?.url;
    
    if (!freshUrl) {
      console.log(`❌ No URL available for media ${ofMediaId}`);
      console.log('Media structure:', JSON.stringify(media.files, null, 2));
      return res.status(404).json({ 
        success: false,
        error: 'No URL available for this media'
      });
    }

    console.log(`✅ Fresh URL obtained for media ${ofMediaId}`);

    res.status(200).json({
      success: true,
      freshUrl: freshUrl,
      mediaType: media.type,
      expiresIn: '~20 minutes',
      message: 'Fresh URL generated successfully'
    });

  } catch (error) {
    console.error('❌ Refresh URL error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}