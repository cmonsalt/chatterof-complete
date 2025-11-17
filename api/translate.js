export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, direction } = req.body;

    if (!text || !direction) {
      return res.status(400).json({ error: 'Missing text or direction' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const targetLang = direction === 'to_spanish' ? 'Spanish' : 'English';
    
    console.log('🤖 Calling GPT-4o-mini...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Translate this to ${targetLang}. Only output the translation, nothing else:\n\n${text}`
        }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const translated = data.choices[0].message.content.trim();

    console.log('✅ Translation success');

    return res.status(200).json({
      success: true,
      translated,
      original: text,
      direction,
      service: 'gpt-4o-mini'
    });

  } catch (error) {
    console.error('❌ Translation error:', error);
    return res.status(500).json({ 
      error: 'Translation failed',
      details: error.message
    });
  }
}