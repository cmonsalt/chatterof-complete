import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS - Funciones auxiliares simples
// ═══════════════════════════════════════════════════════════════
function detectLanguage(text) {
  const esWords = [
    'hola',
    'como',
    'que',
    'amor',
    'papi',
    'bb',
    'hermosa'
  ];
  const lowerText = text.toLowerCase();
  return esWords.some((w)=>lowerText.includes(w)) ? 'es' : 'en';
}
function detectEnergy(message) {
  const lower = message.toLowerCase();
  const explicitWords = [
    'pussy',
    'dick',
    'cock',
    'tits',
    'ass',
    'fuck',
    'verga',
    'culo',
    'tetas',
    'coño',
    'follar',
    'desnuda',
    'naked',
    'nude',
    'vagina'
  ];
  const flirtyWords = [
    'sexy',
    'hot',
    'beautiful',
    'linda',
    'hermosa',
    'guapa',
    'cute',
    'babe'
  ];
  if (explicitWords.some((w)=>lower.includes(w))) return 'explicit';
  if (flirtyWords.some((w)=>lower.includes(w))) return 'flirty';
  return 'casual';
}
function isRequestingContent(message) {
  const lower = message.toLowerCase();
  const requestWords = [
    'show',
    'send',
    'pic',
    'photo',
    'video',
    'ver',
    'envia',
    'manda',
    'foto',
    'muestra',
    'quiero ver',
    'tienes algo',
    'twerk',
    'dance',
    'bailar',
    'baila',
    'sexy',
    'desnuda',
    'naked'
  ];
  return requestWords.some((w)=>lower.includes(w));
}
function isSeriousTopic(message) {
  const lower = message.toLowerCase();
  const seriousWords = [
    'died',
    'death',
    'cancer',
    'sick',
    'hospital',
    'sad',
    'depressed',
    'suicide',
    'murio',
    'muerte',
    'enfermo',
    'hospital',
    'triste'
  ];
  return seriousWords.some((w)=>lower.includes(w));
}
// ═══════════════════════════════════════════════════════════════
// 🎯 MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { model_id, fan_id, message } = await req.json();
    if (!model_id || !fan_id || !message) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // ═══════════════════════════════════════════════════════════════
    // 📊 CARGAR TODA LA DATA
    // ═══════════════════════════════════════════════════════════════
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Cargar todo en paralelo (más rápido)
    const [modelRes, configRes, fanRes, chatRes, transRes, catalogRes] = await Promise.all([
      supabase.from('models').select('*').eq('model_id', model_id).single(),
      supabase.from('model_configs').select('*').eq('model_id', model_id).single(),
      supabase.from('fans').select('*').eq('fan_id', fan_id).eq('model_id', model_id).single(),
      supabase.from('chat').select('*').eq('fan_id', fan_id).order('timestamp', {
        ascending: true
      }).limit(30),
      supabase.from('transactions').select('*').eq('fan_id', fan_id).eq('model_id', model_id).order('ts', {
        ascending: false
      }),
      supabase.from('catalog').select('*').eq('model_id', model_id).eq('is_active', true).order('nivel', {
        ascending: true
      })
    ]);
    const model = modelRes.data;
    const config = configRes.data;
    const fan = fanRes.data;
    const chatHistory = chatRes.data || [];
    const transactions = transRes.data || [];
    const catalog = catalogRes.data || [];
    if (!model || !config || !fan) {
      return new Response(JSON.stringify({
        error: 'Data not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    const openaiApiKey = config.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 402,
        headers: corsHeaders
      });
    }
    console.log('🤖 MODEL:', model.name, '| 👤 FAN:', fan.name, fan.tier, `$${fan.spent_total}`);
    // ═══════════════════════════════════════════════════════════════
    // 🧠 ANÁLISIS DEL CONTEXTO
    // ═══════════════════════════════════════════════════════════════
    const lang = detectLanguage(message);
    const energy = detectEnergy(message);
    const requesting = isRequestingContent(message);
    const serious = isSeriousTopic(message);
    const messageCount = chatHistory.length;
    // Contenido ya comprado
    const purchased = transactions.filter((t)=>t.type === 'compra' && t.offer_id).map((t)=>t.offer_id);
    // Contenido disponible (que NO ha comprado)
    const available = catalog.filter((c)=>!purchased.includes(c.offer_id));
    console.log('📦 CATALOG:', {
      total: catalog.length,
      purchased: purchased.length,
      available: available.length,
      items: available.map((c)=>`${c.title} (${c.offer_id})`)
    });
    // Última oferta activa
    const lastMessages = chatHistory.slice(-5);
    const lastModelMsg = lastMessages.reverse().find((m)=>m.from === 'model')?.message || '';
    const hasActiveOffer = lastModelMsg.includes('$') || lastModelMsg.includes('video') || lastModelMsg.includes('foto');
    console.log('📊 CONTEXT:', {
      messageCount,
      energy,
      requesting,
      serious,
      hasActiveOffer,
      availableContent: available.length
    });
    // ═══════════════════════════════════════════════════════════════
    // 🎯 DECISIÓN: ¿QUÉ PUEDE HACER?
    // ═══════════════════════════════════════════════════════════════
    let mode = 'NORMAL';
    let contentToOffer = null;
    // REGLA 1: Si es tema serio → Solo empatía
    if (serious) {
      mode = 'EMPATHY';
    } else if (messageCount < 5 && !requesting) {
      mode = 'CONNECTION';
    } else if (hasActiveOffer && !requesting) {
      mode = 'WAITING_RESPONSE';
    } else if (requesting && available.length > 0) {
      mode = 'OFFER';
      // Buscar mejor match por keywords
      const msgLower = message.toLowerCase();
      contentToOffer = available.find((c)=>{
        const keywords = (c.keywords || []).concat((c.tags || '').split(','));
        return keywords.some((kw)=>msgLower.includes(kw.toLowerCase().trim()));
      });
      // Si no hay match exacto, ofrecer según energía del fan
      if (!contentToOffer) {
        if (energy === 'explicit') {
          // Fan explícito → Nivel 2 o 3
          contentToOffer = available.find((c)=>c.nivel >= 2) || available[0];
        } else if (energy === 'flirty') {
          // Fan coqueto → Nivel 1 o 2
          contentToOffer = available.find((c)=>c.nivel <= 2) || available[0];
        } else {
          // Fan casual → Nivel 1
          contentToOffer = available[0];
        }
      }
    }
    console.log('🎯 MODE:', mode, contentToOffer ? `| Offering: ${contentToOffer.title}` : '');
    // ═══════════════════════════════════════════════════════════════
    // 💬 CONSTRUIR PROMPT SIMPLIFICADO
    // ═══════════════════════════════════════════════════════════════
    const writingStyle = lang === 'es' ? `Escribe natural sin acentos: "como estas" no "cómo estás". Usa shortcuts: q (que), tb (también), bn (bien), pa (para), d (de). Repite letras: "holaaa" "siiii". Usa emojis. Todo minúsculas a veces.` : `Write casually: "ur" "u" "gonna" "wanna". Use emojis. lowercase sometimes.`;
    let systemPrompt = `You are ${model.name}, OnlyFans creator (${model.niche}).

WRITING STYLE: ${writingStyle}

FAN INFO:
- Name: ${fan.name || 'Unknown'}
- Tier: ${fan.tier} (spent $${fan.spent_total})
- Message count: ${messageCount}
- Energy: ${energy}
- Already purchased: ${purchased.length > 0 ? purchased.map((id)=>catalog.find((c)=>c.offer_id === id)?.title).join(', ') : 'nothing yet'}

AVAILABLE CONTENT TO OFFER:
${available.slice(0, 5).map((c)=>`- ${c.title}: $${c.base_price} (Level ${c.nivel}/3)`).join('\n') || 'No content available'}
`;
    // Instrucciones según el modo
    if (mode === 'EMPATHY') {
      systemPrompt += `\n\n🎯 MODE: EMPATHY
Fan mentioned something serious/sad. Be supportive and empathetic. DO NOT offer any content.
Just be a caring person.`;
    } else if (mode === 'CONNECTION') {
      systemPrompt += `\n\n🎯 MODE: CONNECTION BUILDING (Messages 1-4)
Build rapport first. Be friendly, flirty if appropriate. You can mention activities (yoga, gym).
DO NOT offer content yet. Just chat naturally.`;
    } else if (mode === 'WAITING_RESPONSE') {
      systemPrompt += `\n\n🎯 MODE: WAITING
You already offered something. DO NOT repeat the offer. 
If fan says yes → confirm price and ask for payment
If fan asks price → tell them the price
Otherwise → just chat normally`;
    } else if (mode === 'OFFER' && contentToOffer) {
      systemPrompt += `\n\n🎯 MODE: OFFER CONTENT
Fan is interested. Suggest this content naturally:

"${contentToOffer.title}" - ${contentToOffer.description}
Level ${contentToOffer.nivel}/3 • $${contentToOffer.base_price}

CREATE A FANTASY (not a product description):
${energy === 'explicit' ? `"mmm papi me pones cachonda 💦 tengo un video donde ${contentToOffer.description.toLowerCase()}... se me ve todoo 😈 lo quieres?"` : `"ay amor 😏 tengo un video de ${contentToOffer.description.toLowerCase()}... se ve tan sexy 🔥 lo quieres ver?"`}

Use sensory details: "toda sudada", "se me ve todoo", "me quite el top"
DO NOT mention price unless fan asks.`;
    } else {
      systemPrompt += `\n\n🎯 MODE: NORMAL CONVERSATION
Chat naturally. If they ask what you do, mention activities casually.
${available.length > 0 ? 'You have content but wait for them to show interest first.' : ''}`;
    }
    systemPrompt += `\n\nRespond in JSON format: {"texto": "your response"}`;
    // ═══════════════════════════════════════════════════════════════
    // 🤖 LLAMAR A OPENAI CON HISTORIAL COMPLETO
    // ═══════════════════════════════════════════════════════════════
    // Construir mensajes: system + historial + nuevo mensaje
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      // ✅ HISTORIAL COMPLETO (últimos 20 mensajes)
      ...chatHistory.slice(-20).map((msg)=>({
          role: msg.from === 'fan' ? 'user' : 'assistant',
          content: msg.message
        })),
      // ✅ MENSAJE NUEVO
      {
        role: 'user',
        content: message
      }
    ];
    console.log(`📨 Sending ${messages.length} messages to OpenAI`);
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.gpt_model || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300,
        response_format: {
          type: "json_object"
        }
      })
    });
    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('❌ OpenAI error:', error);
      return new Response(JSON.stringify({
        error: 'OpenAI API error'
      }), {
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
      parsed = {
        texto: aiResponseRaw
      };
    }
    const responseText = parsed.texto || aiResponseRaw;
    console.log('✅ AI Response:', responseText.substring(0, 100));
    // ═══════════════════════════════════════════════════════════════
    // 📤 RESPUESTA FINAL
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
          mode: mode,
          fan_tier: fan.tier,
          spent_total: fan.spent_total,
          message_count: messageCount,
          energy: energy,
          can_offer: mode === 'OFFER'
        }
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
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
