import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fan_id, model_id } = req.body

  if (!fan_id || !model_id) {
    return res.status(400).json({ error: 'fan_id and model_id required' })
  }

  try {
    // 1. Verificar límite
    const limitCheck = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/check-ai-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id })
    })

    if (!limitCheck.ok) {
      const limitError = await limitCheck.json()
      return res.status(429).json(limitError)
    }

    // 2. Inicializar Supabase y Anthropic
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // 3. Obtener datos del fan
    const { data: fan, error: fanError } = await supabase
      .from('fans')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .single()

    if (fanError) throw new Error('Fan not found')

    // 4. Obtener últimos mensajes del chat
    const { data: messages, error: messagesError } = await supabase
      .from('chat')
      .select('message, from, ts, is_ppv, ppv_price')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .order('ts', { ascending: false })
      .limit(10)

    if (messagesError) throw messagesError

    // 5. Obtener sessions disponibles
    const { data: catalog, error: catalogError } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', model_id)
      .eq('parent_type', 'session')
      .order('session_name, step_number')

    if (catalogError) throw catalogError

    // 6. Buscar qué PPVs ya compró el fan
    const { data: purchased } = await supabase
      .from('chat')
      .select('ppv_catalog_id')
      .eq('fan_id', fan_id)
      .eq('is_ppv', true)
      .eq('is_purchased', true)

    const purchasedIds = purchased?.map(p => p.ppv_catalog_id) || []

    // 7. Organizar sessions
    const sessionsMap = new Map()
    catalog.forEach(item => {
      if (!sessionsMap.has(item.session_id)) {
        sessionsMap.set(item.session_id, {
          session_name: item.session_name,
          parts: []
        })
      }
      sessionsMap.get(item.session_id).parts.push(item)
    })

    const sessions = Array.from(sessionsMap.values())

    // 8. Determinar tier del fan
    const tierNames = { 0: 'FREE', 1: 'VIP', 2: 'WHALE' }
    const tierName = tierNames[fan.tier] || 'FREE'

    // 9. Construir historial de chat para el prompt
    const chatHistory = messages
      .reverse()
      .map(m => `${m.from === 'fan' ? 'Fan' : 'Model'}: ${m.message}`)
      .join('\n')

    // 10. Crear prompt para Claude
    const prompt = `You are an AI assistant helping an OnlyFans chatter respond to a fan. 

FAN INFO:
- Username: ${fan.of_username || 'Anonymous'}
- Tier: ${tierName}
- Total Spent: $${fan.spent_total || 0}
- Notes: ${fan.notes || 'None'}

RECENT CHAT HISTORY:
${chatHistory || 'No previous messages'}

AVAILABLE CONTENT (Sessions):
${sessions.map(s => 
  `Session "${s.session_name}":\n${s.parts.map(p => 
    `  - Part ${p.step_number}: ${p.title} ($${p.base_price}, Level ${p.nivel}/10)${purchasedIds.includes(p.id) ? ' [ALREADY PURCHASED]' : ''}`
  ).join('\n')}`
).join('\n\n')}

INSTRUCTIONS:
1. Analyze the conversation context
2. Determine if this is a good moment to offer content (don't always push sales)
3. If offering content, follow the DRIP STRATEGY:
   - If fan hasn't bought anything → Offer Part 0 (FREE teaser)
   - If fan bought Part 0 → Offer Part 1
   - If fan bought Part 1 → Offer Part 2, etc.
4. Write a flirty, natural message as the model
5. If conversation is casual/emotional → DON'T push PPV, just connect
6. If fan mentions "custom" → Ask what they want, don't push catalog

Respond with JSON only:
{
  "message": "The flirty message to send",
  "tease_text": "Short unlock tease (if offering PPV)",
  "recommended_ppv": {
    "session_name": "Session name",
    "part_number": 0,
    "title": "Part title",
    "price": 15,
    "level": 5
  },
  "reasoning": "Why this approach"
}

If NOT recommending PPV, set recommended_ppv to null.`

    // 11. Llamar a Claude
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const responseText = completion.content[0].text
    
    // 12. Parsear respuesta JSON
    let suggestion
    try {
      // Limpiar markdown si existe
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      suggestion = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Error parsing AI response:', responseText)
      throw new Error('Invalid AI response format')
    }

    // 13. Retornar sugerencia
    return res.json({
      success: true,
      suggestion: {
        message: suggestion.message,
        teaseText: suggestion.tease_text || '',
        recommendedPPV: suggestion.recommended_ppv,
        reasoning: suggestion.reasoning
      }
    })

  } catch (error) {
    console.error('Error generating AI suggestion:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to generate suggestion' 
    })
  }
}
