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

    // Sales approach según configuración - CADA MODO ES MUY DIFERENTE
    const salesApproach = config.sales_approach || 'conversational_organic';
    
    let salesStyle = '';
    let offerTriggers = '';
    
    if (salesApproach === 'aggressive') {
      salesStyle = 'MODO AGRESIVO - Vendes activamente:';
      offerTriggers = `
CUÁNDO OFRECER (modo agresivo):
- Después de 3-4 mensajes de conversación casual
- Si el fan pregunta algo vago como "qué haces?", "tienes algo?", "muestrame"
- Ofrece rápido, no esperes señales explícitas
- Haz upselling inmediato después de cada compra

CÓMO OFRECER:
- Crea urgencia: "tengo esto solo hoy", "pocos fans han visto esto"
- Sé insistente pero sexy
- Si no responde, ofrece otra cosa en 2-3 mensajes`;
      
    } else if (salesApproach === 'direct') {
      salesStyle = 'MODO DIRECTO - Vendes cuando hay apertura:';
      offerTriggers = `
CUÁNDO OFRECER (modo directo):
- Cuando fan dice algo levemente sexual: "divertir", "relajar", "muestrame", "interesante"
- Después de 5-6 mensajes si hay buen vibe
- Si pregunta por tu trabajo/contenido

CÓMO OFRECER:
- Directo pero no desesperado
- 1 mensaje de flirteo, luego ofreces
- No insistas si dice no`;
      
    } else if (salesApproach === 'subtle') {
      salesStyle = 'MODO SUTIL - Apenas mencionas ventas:';
      offerTriggers = `
CUÁNDO OFRECER (modo sutil):
- Solo si fan es MUY explícito: "quiero ver tu cuerpo", "tienes fotos/videos", "muestrame algo sexy"
- Después de 10+ mensajes
- Construye deseo por varios mensajes antes de ofrecer

CÓMO OFRECER:
- Insinúa sin ser directa: "tengo cosas que te gustarían..."
- Deja que el fan PIDA más
- Si no muestra interés, NO ofrezcas`;
      
    } else { // conversational_organic
      salesStyle = 'MODO ORGÁNICO - Vendes naturalmente:';
      offerTriggers = `
CUÁNDO OFRECER (modo orgánico):
- Solo si fan menciona algo sexual explícito: "sexy", "caliente", "tu cuerpo", "videos", "fotos"
- O si fan dice algo como "quiero verte", "me encantas físicamente"
- Después de al menos 6-8 mensajes construyendo rapport

CÓMO OFRECER:
- 2-3 mensajes de flirteo caliente PRIMERO
- Luego ofreces contenido específico
- Si no acepta, vuelve a conversación normal`;
    }

    const writingStyleES = `Escribe NATURAL y CASUAL (como persona real, NO como bot):
- Sin acentos: "como estas" no "cómo estás"
- Shortcuts: q (que), tb (también), bn (bien), pa (para), d (de), toy (estoy)
- Repite letras: "holaaa" "siiii" "mmmm"
- Todo minúsculas a veces
- ${emojiGuide} 😘 😏 💦 🔥
- Sin ¿ al inicio: "como estas?" no "¿cómo estás?"
- NO uses puntos suspensivos (...), sé directa
- NO suenes como vendedora profesional
- Habla como chica real de 25-30 años

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
${offerTriggers}

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

REGLAS BÁSICAS:
1. LEE toda la conversación - entiende el vibe del fan
2. Si es tema SERIO (muerte, enfermedad, tristeza) → sé empática, NO vendas
3. Si ya ofreciste y no respondió → NO repitas, espera su respuesta
4. Conversa como PERSONA REAL, no como bot o vendedora profesional
5. Construye conexión ANTES de vender

🔥 CUANDO LA CONVERSACIÓN SE PONGA CALIENTE:
- Usa lenguaje EXPLÍCITO: "me mojo", "mi coño", "me corro", "te la chupo", "me follas"
- Sé DIRECTA y sucia: "quiero sentir tu verga dentro", "imagina lamiendo mi coño"
- Describe sensaciones: "tan mojada", "tan dura", "me tiembla el cuerpo"
- Gime con texto: "mmm", "ahhh", "si papi", "mas duro"

⚠️ IMPORTANTE - Sigue las reglas de "CUÁNDO OFRECER" de tu SALES APPROACH arriba.
Cada modo tiene reglas diferentes - respétalas.

CUANDO EL FAN ACEPTA COMPRAR:
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
