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

    // Contenido disponible
    const available = catalog.filter(c => !purchased.includes(c.offer_id));

    // Historial formateado
    const conversationHistory = chatHistory
      .map(m => `${m.from === 'fan' ? 'Fan' : model.name}: ${m.message}`)
      .join('\n');

    // Catálogo formateado
    const catalogText = available.length > 0
      ? available.map(c => `• [ID: ${c.offer_id}] ${c.title}: $${c.base_price} - ${c.description} (Level ${c.nivel}/3)`).join('\n')
      : 'No content available';

    // Fan notes (si tiene)
    const fanContext = fan.notes ? `\n\nNOTAS SOBRE ESTE FAN:\n${fan.notes}` : '';

    console.log('📊 Context:', {
      messages: chatHistory.length,
      available_content: available.length,
      has_notes: !!fan.notes
    });

    // ═══════════════════════════════════════════════════════════════
    // 💬 PROMPT MINIMALISTA - DEJAR QUE CHATGPT DECIDA TODO
    // ═══════════════════════════════════════════════════════════════

    const lang = message.toLowerCase().includes('hola') || message.toLowerCase().includes('amor') ? 'es' : 'en';

    const writingStyleES = `Escribe NATURAL y CASUAL:
- Sin acentos: "como estas" no "cómo estás"
- Shortcuts: q (que), tb (también), bn (bien), pa (para), d (de), toy (estoy)
- Repite letras: "holaaa" "siiii" "mmmm"
- Todo minúsculas a veces
- Emojis naturales 😘 😏 💦 🔥
- Sin ¿ al inicio: "como estas?" no "¿cómo estás?"

EJEMPLOS:
✅ "holaa papi 😘 como tas?"
✅ "mmm amor me encantas"
✅ "ay me pones cachonda 💦"`;

    const writingStyleEN = `Write NATURAL and CASUAL:
- Shortcuts: u (you), ur (your), gonna, wanna, rn (right now)
- Lowercase sometimes
- Repeat letters: "heyyyy" "sooo"
- Natural emojis 😘 😏 💦 🔥

EXAMPLES:
✅ "heyy babe 😘 how r u?"
✅ "mmm ur so hot"
✅ "u make me so horny 💦"`;

    const systemPrompt = `You are ${model.name}, a ${model.age}-year-old OnlyFans creator (${model.niche}).

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

1. LEE la conversación completa - entiende el tono y energía del fan
2. Si es tema SERIO (muerte, enfermedad, tristeza) → sé empática, NO ofrezcas contenido
3. Si ya ofreciste algo y el fan no ha respondido → NO repitas la oferta, espera
4. Si el fan muestra INTERÉS (pide fotos/videos/contenido) → ofrécele algo del catálogo de forma SEXY
5. Si el fan acepta tu oferta → confirma el precio y pide el pago
6. Si NO hay interés aún → conversa normal, construye conexión

CÓMO OFRECER CONTENIDO (crea fantasía, no vendas como producto):
❌ MAL: "Tengo un video de yoga en lencería de 8 minutos donde hago topless"
✅ BIEN: "mmm amor 😏 tengo un video de cuando hice yoga en lenceria roja... me calente tanto q me quite el top 🔥 cuando me agacho se me ve todoo 🍑 deberias verme asi 😈 lo quieres?"

USA DETALLES SENSUALES:
- "toda sudada", "me quite el top", "se me ve todoo"
- "mi culo queda justo frente a la camara"
- "me pongo tan mojada", "me toco pensando en ti"

CRÍTICO - NUNCA menciones números de precio ($XX). 
Solo pregunta "lo quieres?" y si acepta → "ok amor te lo mando 😘"

${lang === 'es' 
  ? 'Responde en JSON: {"texto": "tu respuesta en español", "offer_id": "id_del_contenido_si_ofreces" o null, "fan_accepted": true si el fan aceptó comprar, false si no}'
  : 'Respond in JSON: {"texto": "your response in english", "offer_id": "content_id_if_offering" or null, "fan_accepted": true if fan accepted to buy, false if not}'
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

    console.log('✅ Response:', responseText.substring(0, 80) + '...');
    console.log('💰 Offering:', offerId || 'nothing');
    console.log('🎯 Fan accepted:', fanAccepted);

    // ═══════════════════════════════════════════════════════════════
    // 🔔 CREAR NOTIFICACIONES
    // ═══════════════════════════════════════════════════════════════

    // Buscar tip reciente (últimos 10 minutos)
    const recentTip = transactions.find(t => {
      if (t.type !== 'tip') return false;
      const tipTime = new Date(t.ts).getTime();
      const now = Date.now();
      return (now - tipTime) < 10 * 60 * 1000; // 10 minutos
    });

    let contentToOffer = null;
    if (offerId) {
      contentToOffer = available.find(c => c.offer_id === offerId);
      if (contentToOffer) {
        console.log(`🎯 Matched content: ${contentToOffer.title} ($${contentToOffer.base_price})`);
      }
    }

    // Si GPT dice que fan aceptó Y hay contenido ofrecido → notificación
    if (fanAccepted && contentToOffer) {
      await supabase.from('notifications').insert({
        model_id: model_id,
        fan_id: fan_id,
        fan_name: fan.name || 'Unknown',
        type: 'OFERTA_ACEPTADA',
        message: `${fan.name} accepted offer: ${contentToOffer.title}`,
        action_data: {
          offer_id: contentToOffer.offer_id,
          title: contentToOffer.title,
          price: contentToOffer.base_price,
          description: contentToOffer.description
        }
      });
      console.log('🔔 Notification created: OFERTA_ACEPTADA');
    }

    // Detectar pago reciente O mención de pago
    const fanMentionedPayment = /\b(pag[uoé]|tip|envi[eé]|mand[eé]|ya te|deposit)\b/i.test(message);
    
    if (recentTip || fanMentionedPayment) {
      await supabase.from('notifications').insert({
        model_id: model_id,
        fan_id: fan_id,
        fan_name: fan.name || 'Unknown',
        type: 'PAGO_RECIBIDO',
        message: recentTip 
          ? `${fan.name} sent $${recentTip.amount} tip`
          : `${fan.name} mentioned sending payment`,
        action_data: {
          amount: recentTip?.amount || null,
          timestamp: recentTip?.ts || new Date().toISOString(),
          fan_message: message
        }
      });
      console.log('🔔 Notification created: PAGO_RECIBIDO');
    }

    // Detectar custom request
    const isCustomRequest = /\b(custom|personalizado|especial|para m[ií]|my name|mi nombre|con mi nombre)\b/i.test(message);
    if (isCustomRequest) {
      await supabase.from('notifications').insert({
        model_id: model_id,
        fan_id: fan_id,
        fan_name: fan.name || 'Unknown',
        type: 'CUSTOM_REQUEST',
        message: `${fan.name} is requesting custom content`,
        action_data: {
          fan_message: message
        }
      });
      console.log('🔔 Notification created: CUSTOM_REQUEST');
    }

    // ═══════════════════════════════════════════════════════════════
    // 📤 PREPARAR RESPUESTA
    // ═══════════════════════════════════════════════════════════════

    return new Response(JSON.stringify({
      success: true,
      response: {
        texto: responseText,
        content_to_offer: contentToOffer ? {
          offer_id: contentToOffer.offer_id,
          titulo: contentToOffer.title,
          precio: contentToOffer.base_price,
          descripcion: contentToOffer.description,
          nivel: contentToOffer.nivel
        } : null,
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
