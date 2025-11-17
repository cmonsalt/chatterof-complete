export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, direction } = req.body;

    console.log('🌐 DeepL translation request:', { 
      text: text?.substring(0, 50), 
      direction,
      length: text?.length 
    });

    // Validación
    if (!text || !direction) {
      return res.status(400).json({ error: 'Missing text or direction' });
    }

    if (!['to_spanish', 'to_english'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    // Verificar API key
    if (!process.env.DEEPL_API_KEY) {
      console.error('❌ Missing DEEPL_API_KEY');
      return res.status(500).json({ error: 'DeepL API key not configured' });
    }

    // DeepL target language
    const targetLang = direction === 'to_spanish' ? 'ES' : 'EN-US';
    
    console.log('🤖 Calling DeepL API...');

    // Llamar a DeepL API
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        auth_key: process.env.DEEPL_API_KEY,
        text: text,
        target_lang: targetLang,
        //formality: 'less' // Traducción casual/informal (mejor para OF)
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ DeepL API error:', errorData);
      throw new Error(`DeepL API error: ${response.status}`);
    }

    const data = await response.json();
    const translated = data.translations[0].text;

    console.log('✅ DeepL translation success:', translated.substring(0, 50));

    return res.status(200).json({
      success: true,
      translated,
      original: text,
      direction,
      service: 'deepl',
      detectedSourceLang: data.translations[0].detected_source_language
    });

  } catch (error) {
    console.error('❌ Translation error:', error);
    
    return res.status(500).json({ 
      error: 'Translation failed',
      details: error.message
    });
  }
}