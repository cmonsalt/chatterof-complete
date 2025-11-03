export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // Crear FormData con el archivo
    const formData = new FormData();
    
    // El archivo viene en req.body como base64 o buffer
    // Ajustar según tu implementación de upload
    if (req.body.file) {
      formData.append('file', req.body.file);
    }

    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/upload`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`
          // No incluir Content-Type, FormData lo maneja
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({ 
      success: true,
      prefixed_id: data.prefixed_id, // Para usar en mensajes (1 sola vez)
      vault_id: data.id // Para reutilizar
    });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: error.message });
  }
}
