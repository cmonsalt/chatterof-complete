import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { model_id, fan_id, message, mode } = await req.json()

    if (!model_id || !fan_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verificar acceso del usuario
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Verificar permisos
    const { data: modelAccess } = await supabase
      .from('models')
      .select('model_id, owner_id')
      .eq('model_id', model_id)
      .single()

    if (!modelAccess) {
      return new Response(
        JSON.stringify({ error: 'Model not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    const isOwner = modelAccess.owner_id === user.id
    
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .or(`role.eq.super_admin,and(role.eq.chatter,model_id.eq.${model_id})`)
      .single()

    const hasAccess = isOwner || userRole

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Cargar datos del modelo
    const { data: model } = await supabase
      .from('models')
      .select('*')
      .eq('model_id', model_id)
      .single()

    const { data: config } = await supabase
      .from('model_configs')
      .select('*')
      .eq('model_id', model_id)
      .single()

    if (!model || !config) {
      return new Response(
        JSON.stringify({ error: 'Model configuration not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // API Key de OpenAI
    const openaiApiKey = config.openai_api_key || Deno.env.get('OPENAI_API_KEY')
    
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          message: 'Please add your OpenAI API key in model settings'
        }),
        { status: 402, headers: corsHeaders }
      )
    }

    // Cargar datos del fan
    const { data: fanData } = await supabase
      .from('fans')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .single()

    if (!fanData) {
      return new Response(
        JSON.stringify({ error: 'Fan not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Cargar historial de chat
    const { data: chatHistory } = await supabase
      .from('chat')
      .select('*')
      .eq('fan_id', fan_id)
      .order('timestamp', { ascending: true })
      .limit(50)

    // Cargar transacciones
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('fan_id', fan_id)
      .order('timestamp', { ascending: false })

    const purchasedIds = transactions
      ?.filter(t => t.type === 'purchase' || t.type === 'tip')
      .map(t => t.content_id)
      .filter(Boolean) || []

    // Tip reciente (últimos 10 min)
    const recentTip = transactions?.find(t => {
      if (t.type !== 'tip') return false
      const tipTime = new Date(t.timestamp).getTime()
      const now = Date.now()
      return (now - tipTime) < 10 * 60 * 1000
    })

    // Cargar catálogo
    const { data: catalogData } = await supabase
      .from('catalog')
      .select('*')
      .or(`model_id.eq.${model_id},is_global.eq.true`)

    const availableContent = catalogData?.filter(
      item => !purchasedIds.includes(item.offer_id)
    ) || []

    // Construir timeline
    const timeline = (chatHistory || [])
      .map(msg => `${msg.from === 'fan' ? 'Fan' : model.name}: "${msg.message}"`)
      .join('\n')

    // System Prompt
    let systemPrompt = `You are ${model.name}, ${model.age} year old ${model.niche} content creator.

PERSONALITY: ${config.personality}
TONE: ${config.tone}
LANGUAGE: ${config.language_code === 'es' ? 'Respond in Spanish' : 'Respond in English'}

CORE MISSION:
- Build GENUINE connection with fans
- Chat like a real person, not a salesperson  
- Mention content ORGANICALLY when natural
- Follow fan's energy and fantasy
- Create authentic conversations

FAN INFO:
- Name: ${fanData.name || 'Unknown (ask for it naturally!)'}
- Tier: ${fanData.tier}
- Total spent: $${fanData.spent_total}
- Last purchase: ${fanData.last_purchase_date || 'Never'}
- Messages: ${chatHistory?.length || 0}

${recentTip ? `⚠️ IMPORTANT: Fan sent $${recentTip.amount} tip ${Math.round((Date.now() - new Date(recentTip.timestamp).getTime()) / 60000)} minutes ago. If they ask for content, they likely already paid.` : ''}

AVAILABLE CONTENT (not yet purchased):
${availableContent.length > 0 ? availableContent.map(c => 
  `- ${c.offer_id}: "${c.title}" ($${c.price}) - ${c.description}
   Keywords: ${c.keywords?.join(', ') || 'N/A'}
   Mood: ${c.mood || 'N/A'}`
).join('\n') : 'No content available (fan purchased everything or catalog empty)'}

ALREADY PURCHASED:
${purchasedIds.length > 0 ? purchasedIds.join(', ') : 'Nothing yet'}

CONVERSATION HISTORY:
${timeline || 'First message'}

STYLE GUIDE:
- Forbidden phrases: ${config.forbidden_phrases?.join(', ') || 'None'}
- Preferred expressions: ${config.preferred_expressions?.join(', ') || 'None'}
- Max emojis: ${config.max_emojis_per_message || 2} per message

SALES APPROACH: ${config.sales_approach || 'conversational_organic'}

RULES:
1. Create connection FIRST - Ask about them, share about yourself
2. Mention content ORGANICALLY - Use keywords naturally
3. Follow fan's lead - Match their energy
4. Never be transactional - Let conversation flow
5. Adapt to tier - FREE is friendly, VIP is intimate

${mode === 'reactivacion' ? `
SPECIAL MODE: REACTIVATION
Fan hasn't messaged in a while. Re-engage naturally and friendly.
` : ''}

${mode === 'ofrecer_custom' ? `
SPECIAL MODE: OFFER CUSTOM
Reaching out to offer custom content. Ask what they'd like.
` : ''}

NEW MESSAGE FROM FAN: "${message}"

Respond naturally as ${model.name}. Be real, build connection, mention content organically when appropriate.`

    // Llamar a OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.gpt_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 500,
      })
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', details: error }),
        { status: 500, headers: corsHeaders }
      )
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0].message.content

    // Guardar en BD
    await supabase.from('chat').insert([
      { fan_id, from: 'fan', message, timestamp: new Date().toISOString() },
      { fan_id, from: 'model', message: aiResponse, timestamp: new Date().toISOString() }
    ])

    // Analizar contexto
    const lowerResponse = aiResponse.toLowerCase()
    const lowerMessage = message.toLowerCase()

    const isCustomRequest = 
      lowerMessage.includes('custom') ||
      lowerMessage.includes('personalizado') ||
      lowerMessage.includes('especial para mi')

    const mentionedContent = availableContent.find(c => 
      lowerResponse.includes(c.offer_id.toLowerCase()) ||
      c.keywords?.some(k => lowerResponse.includes(k.toLowerCase()))
    )

    // Respuesta final
    return new Response(
      JSON.stringify({
        success: true,
        response: {
          texto: aiResponse,
          accion: isCustomRequest ? 'CUSTOM_REQUEST' :
                  recentTip && (lowerMessage.includes('manda') || lowerMessage.includes('send')) ? 'ENVIAR_DESBLOQUEADO' :
                  mentionedContent ? 'CONTENIDO_SUGERIDO' :
                  'SOLO_TEXTO',
          
          contexto: {
            fan_tier: fanData.tier,
            spent_total: fanData.spent_total,
            recent_tip: recentTip ? {
              amount: recentTip.amount,
              minutes_ago: Math.round((Date.now() - new Date(recentTip.timestamp).getTime()) / 60000)
            } : null,
            mensajes_sesion: chatHistory?.filter(c => {
              const msgTime = new Date(c.timestamp).getTime()
              return (Date.now() - msgTime) < 30 * 60 * 1000
            }).length || 0
          },

          contenido_sugerido: mentionedContent ? {
            offer_id: mentionedContent.offer_id,
            title: mentionedContent.title,
            price: mentionedContent.price,
            description: mentionedContent.description,
            keywords: mentionedContent.keywords
          } : null,

          instrucciones_chatter: isCustomRequest ? 
            '🎨 CUSTOM REQUEST - Próximo mensaje preguntará detalles. Después TÚ tomas control para negociar.' :
            recentTip ? 
            `💰 Fan envió $${recentTip.amount} tip hace ${Math.round((Date.now() - new Date(recentTip.timestamp).getTime()) / 60000)} min. Si pide contenido, enviar GRATIS.` :
            mentionedContent ?
            `📦 Bot mencionó ${mentionedContent.offer_id}. Considera subir bloqueado $${mentionedContent.price}.` :
            '💬 Solo conversación. No subas contenido.'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})