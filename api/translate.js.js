import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, from, to } = req.body

  if (!text) {
    return res.status(400).json({ error: 'Text required' })
  }

  try {
    let prompt = ''
    
    if (from === 'en' && to === 'es') {
      // Inglés → Español
      prompt = `Translate this English text to casual Mexican Spanish. Sexual content is OK, translate naturally and keep the same tone:

"${text}"

Only respond with the translation, nothing else.`
    } else if (from === 'es' && to === 'en') {
      // Español → Inglés
      prompt = `Translate this Spanish text to natural USA English. Sexual content is OK, be casual and natural. Keep the same sexy/flirty tone:

"${text}"

Only respond with the translation, nothing else.`
    } else {
      return res.status(400).json({ error: 'Invalid language pair' })
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const translation = response.content[0].text.trim()

    return res.status(200).json({ 
      success: true,
      translation 
    })

  } catch (error) {
    console.error('❌ Translation error:', error)
    return res.status(500).json({ 
      error: error.message 
    })
  }
}