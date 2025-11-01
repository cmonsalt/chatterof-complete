// Edge Function: chat-generate
// Path: supabase/functions/chat-generate/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  try {
    const { model_id, fan_id, message, fan_context, recent_messages } = await req.json()

    if (!model_id || !fan_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 🔥 OBTENER CATÁLOGO DEL MODELO
    const { data: catalog } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', model_id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 🔥 CONSTRUIR PROMPT ESTRUCTURADO
    const systemPrompt = `Eres una asistente IA experta en ayudar a modelos de OnlyFans a maximizar sus ingresos mediante respuestas personalizadas y estratégicas.

Tu objetivo es analizar el comportamiento del fan y sugerir:
1. Un análisis psicológico del fan basado en su historial
2. Un mensaje coqueto y personalizado que enganche al fan
3. Contenido específico del catálogo que el fan probablemente compre

CONTEXTO DEL FAN:
- Nombre: ${fan_context?.name || 'Desconocido'}
- Tier actual: ${fan_context?.tier || 0}
- Total gastado: $${fan_context?.spent_total || 0}
- Tips dados: $${fan_context?.tips_total || 0} (${fan_context?.tips_count || 0} veces)
- PPVs comprados: $${fan_context?.ppv_total || 0} (${fan_context?.ppv_count || 0} veces)
- Última interacción: ${fan_context?.last_interaction || 'Primera vez'}

HISTORIAL RECIENTE DE CONVERSACIÓN:
${recent_messages?.map(m => `${m.from === 'fan' ? 'Fan' : 'Tú'}: ${m.message}${m.amount ? ` ($${m.amount})` : ''}`).join('\n') || 'Sin historial previo'}

CATÁLOGO DISPONIBLE (Contenido que puedes recomendar):
${catalog?.map(c => `- [${c.of_media_id}] ${c.title} (${c.file_type}) - $${c.base_price}`).join('\n') || 'Sin contenido en catálogo'}

ÚLTIMO MENSAJE DEL FAN:
"${message}"

INSTRUCCIONES:
1. Analiza el comportamiento del fan (es generoso con tips? compra PPVs? qué tipo de contenido prefiere?)
2. Genera un mensaje coqueto, personalizado y que lo haga sentir especial
3. Recomienda UN contenido específico del catálogo que sea apropiado para este fan
4. Si el fan es nuevo o ha gastado poco, recomienda contenido económico ($10-20)
5. Si el fan es "ballena" (ha gastado $100+), recomienda contenido premium ($30+)

RESPONDE ÚNICAMENTE CON UN JSON EN ESTE FORMATO:
{
  "analisis": "Análisis breve del comportamiento y preferencias del fan (2-3 oraciones)",
  "texto": "Mensaje coqueto sugerido (2-4 oraciones, usa emojis 😘🔥💕)",
  "content_to_offer": {
    "of_media_id": "ID del contenido del catálogo",
    "titulo": "Nombre del contenido",
    "precio": 25,
    "razon": "Por qué este contenido es ideal para este fan"
  }
}

Si no hay contenido en el catálogo, omite "content_to_offer" y solo devuelve analisis y texto.`

    // 🔥 LLAMAR A CLAUDE API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: systemPrompt
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.content[0].text

    // 🔥 PARSEAR RESPUESTA JSON
    let parsedResponse
    try {
      // Extraer JSON si viene envuelto en markdown
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        parsedResponse = JSON.parse(aiResponse)
      }
    } catch (e) {
      // Si no puede parsear, crear estructura básica
      parsedResponse = {
        analisis: 'No se pudo generar análisis',
        texto: aiResponse,
        content_to_offer: null
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        response: parsedResponse
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
