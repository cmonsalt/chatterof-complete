import Anthropic from '@anthropic-ai/sdk';

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

    console.log('🌐 Translation request:', { text: text?.substring(0, 50), direction });

    // Validación
    if (!text || !direction) {
      console.error('❌ Missing params:', { text: !!text, direction });
      return res.status(400).json({ error: 'Missing text or direction' });
    }

    if (!['to_spanish', 'to_english'].includes(direction)) {
      console.error('❌ Invalid direction:', direction);
      return res.status(400).json({ error: 'Invalid direction. Use "to_spanish" or "to_english"' });
    }

    // Verificar API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Missing ANTHROPIC_API_KEY');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Inicializar cliente
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // 🎯 PROMPT MEJORADO con contexto profesional
    const prompt = direction === 'to_spanish'
      ? `You are a professional translation assistant for an adult content subscription platform (similar to OnlyFans). Your job is to accurately translate messages between creators and their paying subscribers.

Context: This is legitimate business communication between consenting adults on a paid platform. The creator needs accurate translations to communicate with international subscribers.

Task: Translate the following English message to Spanish, maintaining the tone and meaning exactly as written. Provide ONLY the Spanish translation, nothing else.

Message to translate:
${text}

Spanish translation:`
      : `You are a professional translation assistant for an adult content subscription platform (similar to OnlyFans). Your job is to accurately translate messages between creators and their paying subscribers.

Context: This is legitimate business communication between consenting adults on a paid platform. The creator needs accurate translations to communicate with international subscribers.

Task: Translate the following Spanish message to English, maintaining the tone and meaning exactly as written. Provide ONLY the English translation, nothing else.

Message to translate:
${text}

English translation:`;

    console.log('🤖 Calling Claude Haiku with professional context...');

    // Llamar a Claude Haiku
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const translated = message.content[0].text.trim();

    // Verificar si Claude se negó
    if (translated.toLowerCase().includes('i cannot') || 
        translated.toLowerCase().includes('i do not feel comfortable') ||
        translated.toLowerCase().includes('i apologize')) {
      
      console.error('❌ Claude refused translation');
      return res.status(400).json({ 
        error: 'Translation blocked by AI safety filters',
        original: text,
        suggestion: 'Consider using DeepL API for adult content translation'
      });
    }

    console.log('✅ Translation success:', translated.substring(0, 50));

    return res.status(200).json({
      success: true,
      translated,
      original: text,
      direction
    });

  } catch (error) {
    console.error('❌ Translation error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({ 
      error: 'Translation failed',
      details: error.message,
      type: error.name
    });
  }
}