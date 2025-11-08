export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, cdnUrl } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !cdnUrl) {
    return res.status(400).json({ 
      error: 'accountId and cdnUrl required' 
    });
  }

  try {
    console.log(`🎥 Downloading video via OnlyFans API...`);

    // Usar el endpoint de download de OnlyFans API
    const downloadUrl = `https://app.onlyfansapi.com/api/${accountId}/media/download?cdnUrl=${encodeURIComponent(cdnUrl)}`;
    
    const response = await fetch(downloadUrl, {
      headers: { 
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OnlyFans API Error:', response.status, errorText);
      throw new Error(`Failed to download video: ${response.status}`);
    }

    // Obtener el video como stream
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');

    // Configurar headers de respuesta
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    // Stream el video al navegador
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ Video downloaded successfully (${buffer.length} bytes)`);
    
    res.send(buffer);

  } catch (error) {
    console.error('❌ Watch video error:', error);
    res.status(500).json({ 
      error: 'Failed to load video',
      details: error.message 
    });
  }
}