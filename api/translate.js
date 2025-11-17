import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, direction } = req.body;

    // Validación
    if (!text || !direction) {
      return res.status(400).json({ error: 'Missing text or direction' });
    }

    if (!['to_spanish', 'to_english'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid direction. Use "to_spanish" or "to_english"' });
    }

    // Prompt según dirección
    const prompt = direction === 'to_spanish'
      ? `Translate this English text to Spanish. Only return the translation, nothing else:\n\n${text}`
      : `Translate this Spanish text to English. Only return the translation, nothing else:\n\n${text}`;

    // Llamar a Claude Haiku (barato: $0.25 por millón de tokens)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const translated = message.content[0].text.trim();

    return res.status(200).json({
      success: true,
      translated,
      original: text,
      direction
    });

  } catch (error) {
    console.error('❌ Translation error:', error);
    return res.status(500).json({ 
      error: 'Translation failed',
      details: error.message 
    });
  }
}