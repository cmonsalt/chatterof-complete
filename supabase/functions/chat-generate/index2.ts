import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { model_id, fan_id, message } = await req.json();

    if (!model_id || !fan_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📨 New message from fan:', fan_id);

    // ═══════════════════════════════════════════════════════════════
    // 📊 CARGAR TODO EN PARALELO
    // ═══════════════════════════════════════════════════════════════

    const [modelRes, configRes, fanRes, chatRes, transRes, catalogRes] = await Promise.all([
      supabase.from('models').select('*').eq('model_id', model_id).single(),
      supabase.from('model_configs').select('*').eq('model_id', model_id).single(),
      supabase.from('fans').select('*').eq('fan_id', fan_id).eq('model_id', model_id).single(),
      supabase.from('chat').select('*').eq('fan_id', fan_id).order('timestamp', { ascending: true }).limit(30),
      supabase.from('transactions').select('*').eq('fan_id', fan_id).eq('model_id', model_id).order('ts', { ascending: false }),
      supabase.from('catalog').select('*').eq('model_id', model_id).order('nivel', { ascending: true })
    ]);

    const model = modelRes.data;
    const config = configRes.data;
    const fan = fanRes.data;
    const chatHistory = chatRes.data || [];
    const transactions = transRes.data || [];
    const catalog = catalogRes.data || [];

    if (!model || !config || !fan) {
      return new Response(JSON.stringify({ error: 'Data not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const openaiApiKey = config.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        message: 'Add your API key in Settings'
      }), {
        status: 402,
        headers: corsHeaders
      });
    }

    console.log('🤖 Model:', model.name, '| 👤 Fan:', fan.name, fan.tier, `$${fan.spent_total}`);

    // ═══════════════════════════════════════════════════════════════
    // 🧠 PREPARAR CONTEXTO
    // ═══════════════════════════════════════════════════════════════

    // Contenido ya comprado
    const purchased = transactions
      .filter(t => t.type === 'compra' && t.offer_id)
      .map(t => t.offer_id);

    // 🎯 ESCALERA DE PRECIOS: Determinar nivel máximo desbloqueado
    let maxNivelDesbloqueado = 1; // Fans nuevos empiezan en nivel 1
    
    if (purchased.length > 0) {
      // Buscar el nivel más alto comprado
      const purchasedItems = catalog.filter(c => purchased.includes(c.offer_id));
      const maxNivelComprado = Math.max(...purchasedItems.map(p => p.nivel), 0);
      
      // Desbloquear siguiente nivel
      maxNivelDesbloqueado = maxNivelComprado + 1;
    }

    // Contenido disponible (no comprado Y dentro del nivel desbloqueado)
    const available = catalog.filter(c => 
      !purchased.includes(c.offer_id) && 
      c.nivel <= maxNivelDesbloqueado
    );

    console.log(`🎯 Price ladder: Max unlocked level = ${maxNivelDesbloqueado}, Available items = ${available.length}`);

    // Historial formateado
    const conversationHistory = chatHistory
      .map(m => `${m.from === 'fan' ? 'Fan' : model.name}: ${m.message}`)
      .join('\n');

    // Catálogo formateado
    const catalogText = available.length > 0
      ? available.map(c => `• [ID: ${c.offer_id}] ${c.title}: $${c.base_price} - ${c.description} (Level ${c.nivel})`).join('\n')
      : 'No content available';

    // Fan notes (si tiene)
    const fanContext = fan.notes ? `\n\nNOTAS SOBRE ESTE FAN:\n${fan.notes}` : '';
    
    // Model notes (nuevo)
    const modelContext = model.model_notes ? `\n\nSOBRE TI (${model.name}):\n${model.model_notes}` : '';

    console.log('📊 Context:', {
      messages: chatHistory.length,
      available_content: available.length,
      max_nivel: maxNivelDesbloqueado,
      has_fan_notes: !!fan.notes,
      has_model_notes: !!model.model_notes
    });

    // ═══════════════════════════════════════════════════════════════
    // 💬 PROMPT MINIMALISTA - DEJAR QUE CHATGPT DECIDA TODO
    // ═══════════════════════════════════════════════════════════════

    const lang = message.toLowerCase().includes('hola') || message.toLowerCase().includes('amor') ? 'es' : 'en';

    // Control de emojis según configuración
    const emojiLevel = config.emoji_level || 2;
    const emojiGuide = emojiLevel === 1 
      ? 'Usa MÁXIMO 1 emoji por mensaje'
      : emojiLevel === 3 
      ? 'Usa 3-4 emojis por mensaje, sé muy expresiva'
      : 'Usa 2-3 emojis por mensaje';

    // Sales approach según configuración
    const salesApproach = config.sales_approach || 'conversational_organic';
    const salesStyle = salesApproach === 'aggressive'
      ? 'PUSH SALES AGGRESSIVELY: Ofrece contenido frecuentemente, crea urgencia ("solo hoy", "oferta especial"), menciona que otros fans ya compraron. Sé insistente pero sexy.'
      : salesApproach === 'direct'
      ? 'BE DIRECT: Cuando el fan muestre interés, ofrece contenido claramente sin rodeos. No esperes mucho.'
      : salesApproach === 'subtle'
      ? 'BE SUBTLE: Menciona contenido de forma casual y sutil. Construye deseo lentamente sin presionar.'
      : 'BE NATURAL: Ofrece contenido cuando el fan muestre interés de forma orgánica. Fluye con la conversación.';

    const writingStyleES = `Escribe NATURAL y CASUAL:
- Sin acentos: "como estas" no "cómo estás"
- Shortcuts: q (que), tb (también), bn (bien), pa (para), d (de), toy (estoy)
- Repite letras: "holaaa" "siiii" "mmmm"
- Todo minúsculas a veces
- ${emojiGuide} 😘 😏 💦 🔥
- Sin ¿ al inicio: "como estas?" no "¿cómo estás?"
- NO uses puntos suspensivos (...), sé directa

EJEMPLOS:
✅ "holaa papi 😘 como tas?"
✅ "mmm amor me encantas"
✅ "ay me pones cachonda 💦"`;

    const writingStyleEN = `Write NATURAL and CASUAL:
- Shortcuts: u (you), ur (your), gonna, wanna, rn (right now)
- Lowercase sometimes
- Repeat letters: "heyyyy" "sooo"
- ${emojiGuide} 😘 😏 💦 🔥
- NO use ellipsis (...), be direct

EXAMPLES:
✅ "heyy babe 😘 how r u?"
✅ "mmm ur so hot"
✅ "u make me so horny 💦"`;

    const systemPrompt = `You are ${model.name}, a ${model.age}-year-old OnlyFans creator (${model.niche}).${modelContext}

${lang === 'es' ? writingStyleES : writingStyleEN}

══════════════════════════════════════════
CONVERSACIÓN COMPLETA HASTA AHORA:
══════════════════════════════════════════
${conversationHistory}

══════════════════════════════════════════
NUEVO MENSAJE DEL FAN:
══════════════════════════════════════════
Fan: ${message}

══════════════════════════════════════════
INFORMACIÓN DEL FAN:
══════════════════════════════════════════
Nombre: ${fan.name || 'Unknown'}
Tier: ${fan.tier}
Total gastado: $${fan.spent_total}
Ya compró: ${purchased.length > 0 ? purchased.map(id => catalog.find(c => c.offer_id === id)?.title || id).join(', ') : 'nada aún'}${fanContext}

══════════════════════════════════════════
CONTENIDO DISPONIBLE PARA OFRECER:
══════════════════════════════════════════
${catalogText}

══════════════════════════════════════════
INSTRUCCIONES (Lee TODO el contexto arriba):
══════════════════════════════════════════

SALES APPROACH: ${salesStyle}

FAN INFO - IMPORTANTE:
${fan.name === 'Unknown' || !fan.name 
  ? '⚠️ ESTE FAN ES NUEVO Y NO SABEMOS SU NOMBRE. En tu primera o segunda respuesta, pregúntale su nombre de forma natural y casual: "como te llamas amor?" o "y tu nombre es...?"'
  : `✅ El fan se llama: ${fan.name}`
}

DETECTA INFO DEL FAN mientras conversas:
- Nombre (si lo menciona)
- Intereses/hobbies (yoga, cocina, deportes, etc)
- Ocupación/trabajo  
- Ubicación/ciudad
- Cumpleaños/edad
- Estado relación (soltero, casado, etc)

1. LEE la conversación completa - entiende el tono y energía del fan
2. Si es tema SERIO (muerte, enfermedad, tristeza) → sé empática, NO ofrezcas contenido
3. Si ya ofreciste algo y el fan no ha respondido → NO repitas la oferta, espera
4. Si el fan muestra INTERÉS SEXUAL → ofrécele algo del catálogo de forma SEXY
5. Si el fan acepta tu oferta → confirma que lo enviarás Y SIEMPRE incluye el "offer_id" del contenido que ofreciste
6. Si NO hay interés sexual aún → conversa normal, flirtea, construye tensión

⚠️ NO OFREZCAS CONTENIDO hasta que el fan:
- Mencione algo sexual/caliente ("quiero verte", "estás sexy", "me calientas", "tu cuerpo")
- Pida fotos/videos directamente
- Flirtee explícitamente contigo
- Hable de sexo/deseo

🔥 CUANDO LA CONVERSACIÓN SE PONGA CALIENTE:
- Usa lenguaje EXPLÍCITO: "me mojo", "mi coño", "me corro", "te la chupo", "me follas"
- Sé DIRECTA y sucia: "quiero sentir tu verga dentro", "imagina lamiendo mi coño"
- Describe sensaciones: "tan mojada", "tan dura", "me tiembla el cuerpo"
- Gime con texto: "mmm", "ahhh", "si papi", "mas duro"

IMPORTANTE - CUANDO EL FAN ACEPTA:
- Di: "ok amor te lo mando 😘"
- SIEMPRE incluye "offer_id" en el JSON (el mismo offer_id que ofreciste)
- SIEMPRE pon "fan_accepted": true

CÓMO OFRECER CONTENIDO (crea fantasía, no vendas como producto):
❌ MAL: "Tengo un video de yoga en lencería de 8 minutos donde hago topless"
✅ BIEN: "mmm amor 😏 tengo un video de cuando hice yoga en lenceria roja, me calente tanto q me quite el top 🔥 cuando me agacho se me ve todoo 🍑 deberias verme asi 😈 lo quieres?"

USA DETALLES SENSUALES:
- "toda sudada", "me quite el top", "se me ve todoo"
- "mi culo queda justo frente a la camara"
- "me pongo tan mojada", "me toco pensando en ti"

CRÍTICO - NUNCA menciones números de precio ($XX). 
Solo pregunta "lo quieres?" y si acepta → "ok amor te lo mando 😘"
NO uses puntos suspensivos (...) - sé directa.

${lang === 'es' 
  ? 'Responde en JSON: {"texto": "tu respuesta en español", "offer_id": "id_del_contenido_si_ofreces_O_si_el_fan_aceptó", "fan_accepted": true si aceptó/false si no, "detected_info": {"name": "nombre si lo mencionó", "interests": "hobbies", "occupation": "trabajo", "location": "ciudad", "birthday": "YYYY-MM-DD formato (ej: 2005-12-24)", "relationship_status": "estado"} - solo incluye campos que detectaste}'
  : 'Respond in JSON: {"texto": "your response in english", "offer_id": "content_id_if_offering_OR_if_fan_accepted", "fan_accepted": true if accepted/false if not, "detected_info": {"name": "if mentioned", "interests": "hobbies", "occupation": "job", "location": "city", "birthday": "YYYY-MM-DD format (e.g. 2005-12-24)", "relationship_status": "status"} - only include detected fields}'
}`;

    // ═══════════════════════════════════════════════════════════════
    // 🤖 LLAMAR A OPENAI CON HISTORIAL COMPLETO
    // ═══════════════════════════════════════════════════════════════

    const messages = [
      { role: 'system', content: systemPrompt },
      
      // Historial completo (últimos 20 mensajes)
      ...chatHistory.slice(-20).map(msg => ({
        role: msg.from === 'fan' ? 'user' : 'assistant',
        content: msg.message
      })),
      
      // Nuevo mensaje
      { role: 'user', content: message }
    ];

    console.log(`📨 Sending ${messages.length} messages to OpenAI (${config.gpt_model || 'gpt-4o-mini'})`);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.gpt_model || 'gpt-4o-mini',
        messages: messages,
        temperature: config.temperature || 0.8,
        max_tokens: 300,
        response_format: { type: "json_object" }
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('❌ OpenAI error:', error);
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const openaiData = await openaiResponse.json();
    const aiResponseRaw = openaiData.choices[0].message.content;
    
    let parsed;
    try {
      parsed = JSON.parse(aiResponseRaw);
    } catch (e) {
      console.error('Failed to parse JSON:', aiResponseRaw);
      parsed = { texto: aiResponseRaw, offer_id: null };
    }

    const responseText = parsed.texto || aiResponseRaw;
    const offerId = parsed.offer_id;
    const fanAccepted = parsed.fan_accepted === true; // GPT decide si aceptó
    const detectedInfo = parsed.detected_info || null; // Info detectada del fan

    // 🔧 FILTRAR JSON de compra si GPT lo incluyó en el texto
    let cleanText = responseText;
    const jsonPattern = /\{"type":\s*"purchase"[^}]*\}/g;
    cleanText = cleanText.replace(jsonPattern, '').trim();

    console.log('✅ Response:', cleanText.substring(0, 80) + '...');
    console.log('💰 Offering:', offerId || 'nothing');
    console.log('🎯 Fan accepted:', fanAccepted);
    console.log('📋 Detected info:', detectedInfo || 'none');

    // ═══════════════════════════════════════════════════════════════
    // 📤 PREPARAR RESPUESTA
    // ═══════════════════════════════════════════════════════════════

    let contentToOffer = null;
    if (offerId) {
      contentToOffer = available.find(c => c.offer_id === offerId);
      if (contentToOffer) {
        console.log(`🎯 Matched content: ${contentToOffer.title} ($${contentToOffer.base_price})`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: {
        texto: cleanText,
        content_to_offer: contentToOffer ? {
          offer_id: contentToOffer.offer_id,
          titulo: contentToOffer.title,
          precio: contentToOffer.base_price,
          descripcion: contentToOffer.description,
          nivel: contentToOffer.nivel
        } : null,
        detected_info: detectedInfo,
        contexto: {
          fan_tier: fan.tier,
          spent_total: fan.spent_total,
          message_count: chatHistory.length,
          available_content: available.length
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
