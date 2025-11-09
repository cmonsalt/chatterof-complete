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
    // 1. Inicializar Supabase y Anthropic
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    // 2. Verificar límite directamente en DB
    let { data: limit } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('model_id', model_id)
      .single()

    // Si no existe límite, crear uno
    if (!limit) {
      const { data: newLimit, error: insertError } = await supabase
        .from('usage_limits')
        .insert({ model_id, messages_limit: 500, messages_today: 0 })
        .select()
        .single()
      
      if (insertError) throw insertError
      limit = newLimit
    }

    // Verificar si pasaron 24h y resetear
    const now = new Date()
    const lastReset = new Date(limit.last_reset)
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60)

    if (hoursSinceReset >= 24) {
      const { error: resetError } = await supabase
        .from('usage_limits')
        .update({ messages_today: 0, last_reset: now.toISOString() })
        .eq('model_id', model_id)
      
      if (resetError) throw resetError
      limit.messages_today = 0
    }

    // Verificar si alcanzó el límite
    if (limit.messages_today >= limit.messages_limit) {
      return res.status(429).json({ 
        error: 'Daily AI limit reached',
        limit: limit.messages_limit,
        used: limit.messages_today,
        reset_in_hours: Math.ceil(24 - hoursSinceReset)
      })
    }

    // Incrementar contador
    const { error: updateError } = await supabase
      .from('usage_limits')
      .update({ messages_today: limit.messages_today + 1 })
      .eq('model_id', model_id)

    if (updateError) throw updateError

    // 3. Inicializar Anthropic
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // 4. Obtener datos del fan
    const { data: fan, error: fanError } = await supabase
      .from('fans')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .single()

    if (fanError) throw new Error('Fan not found')

    // 5. Obtener últimos mensajes del chat
    const { data: messages, error: messagesError } = await supabase
      .from('chat')
      .select('message, from, ts, is_ppv, ppv_price')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .order('ts', { ascending: false })
      .limit(10)

    if (messagesError) throw messagesError

    // 6. Obtener sessions disponibles
    const { data: catalog, error: catalogError } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', model_id)
      .eq('parent_type', 'session')
      .order('session_name, step_number')

    if (catalogError) throw catalogError

    // 7. Buscar qué PPVs ya compró el fan
    const { data: purchased } = await supabase
      .from('chat')
      .select('ppv_catalog_id')
      .eq('fan_id', fan_id)
      .eq('is_ppv', true)
      .eq('is_purchased', true)

    const purchasedIds = purchased?.map(p => p.ppv_catalog_id) || []

    // 8. Organizar sessions
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

    // 9. Determinar tier del fan
    const tierNames = { 0: 'FREE', 1: 'VIP', 2: 'WHALE' }
    const tierName = tierNames[fan.tier] || 'FREE'

    // 10. Construir historial de chat para el prompt
    const chatHistory = messages
      .reverse()
      .map(m => `${m.from === 'fan' ? 'Fan' : 'Model'}: ${m.message}`)
      .join('\n')

    // 11. Crear prompt para Claude
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

    // 12. Llamar a Claude
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const responseText = completion.content[0].text
    
    // 13. Parsear respuesta JSON
    let suggestion
    try {
      // Limpiar markdown si existe
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      suggestion = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Error parsing AI response:', responseText)
      throw new Error('Invalid AI response format')
    }

    // 14. Si hay PPV recomendado, buscar info completa del catalog
    if (suggestion.recommended_ppv && suggestion.recommended_ppv.session_name) {
      try {
        const { data: fullPPV, error: ppvError } = await supabase
          .from('catalog')
          .select('*')
          .eq('model_id', model_id)
          .eq('session_name', suggestion.recommended_ppv.session_name)
          .eq('step_number', suggestion.recommended_ppv.part_number)
          .single()
        
        if (!ppvError && fullPPV) {
          // Reemplazar con info completa del catalog
          suggestion.recommended_ppv = fullPPV
        }
      } catch (ppvLookupError) {
        console.warn('Could not find full PPV details, using basic info:', ppvLookupError)
        // Continuar con la info básica que ya tiene
      }
    }

    // 15. Retornar sugerencia
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
