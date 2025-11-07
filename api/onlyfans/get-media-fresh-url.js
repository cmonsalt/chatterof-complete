// Endpoint para obtener URL fresca de un media específico
// Se llama solo cuando usuario hace click en Preview

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mediaId, accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!mediaId || !accountId) {
    return res.status(400).json({ 
      error: 'mediaId and accountId required' 
    });
  }

  try {
    console.log(`🔍 Getting fresh URL for media ${mediaId}`);

    // Llamar a OnlyFans API para obtener info del media
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/vault/${mediaId}`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`OnlyFans API error: ${response.status}`);
    }

    const data = await response.json();
    const media = data.data;

    if (!media) {
      throw new Error('Media not found');
    }

    // Extraer URLs
    const fullUrl = media.files?.full?.url;
    const previewUrl = media.files?.preview?.url;
    const thumbUrl = media.files?.thumb?.url;

    if (!fullUrl && !previewUrl) {
      throw new Error('No valid URL found for this media');
    }

    console.log(`✅ Fresh URL obtained for media ${mediaId}`);

    // Devolver URLs frescass
    res.status(200).json({
      success: true,
      mediaId: media.id,
      type: media.type,
      url: fullUrl || previewUrl,
      thumb: thumbUrl,
      preview: previewUrl,
      duration: media.duration,
      isReady: media.isReady,
      canView: media.canView
    });

  } catch (error) {
    console.error('❌ Get fresh URL error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
