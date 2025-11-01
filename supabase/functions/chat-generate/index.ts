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

    // 🔑 PRIORIDAD: API key del cliente > Fallback tuya
    const anthropicApiKey = config.anthropic_api_key || Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Claude API key not configured',
        message: 'Add your Claude API key in Settings → https://console.anthropic.com'
      }), {
        status: 402,
        headers: corsHeaders
      });
    }

    console.log('🤖 Model:', model.name, '| 👤 Fan:', fan.name, fan.tier, `$${fan.spent_total}`);
    console.log('🔑 Using:', config.anthropic_api_key ? 'client API key' : 'fallback API key');

    // ═══════════════════════════════════════════════════════════════
    // 🧠 PREPARAR CONTEXTO
    // ═══════════════════════════════════════════════════════════════

    // Contenido ya comprado
    const purchased = transactions
      .filter(t => t.type === 'compra' && t.offer_id)
      .map(t => t.offer_id);

    // 🎯 ESCALERA DE PRECIOS: Determinar nivel máximo desbloqueado
    let maxNivelDesbloqueado = 1;
    
    if (purchased.length > 0) {
      const purchasedItems = catalog.filter(c => purchased.includes(c.offer_id));
      const maxNivelComprado = Math.max(...purchasedItems.map(p => p.nivel), 0);
      maxNivelDesbloqueado = maxNivelComprado + 1;
    }

    // Contenido disponible
    const available = catalog.filter(c => 
      !purchased.includes(c.offer_id) && 
      c.nivel <= maxNivelDesbloqueado
    );

    console.log(`🎯 Price ladder: Max unlocked level = ${maxNivelDesbloqueado}, Available items = ${available.length}`);

    // Historial formateado
    const conversationHistory = chatHistory
      .slice(-20)
      .map(m => `${m.from === 'fan' ? 'Fan' : model.name}: ${m.message}${m.amount ? ` ($${m.amount})` : ''}`)
      .join('\n');

    // Stats del fan
    const totalTips = transactions.filter(t => t.type === 'tip').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPPV = transactions.filter(t => t.type === 'compra').reduce((sum, t) => sum + (t.amount || 0), 0);
    const tipsCount = transactions.filter(t => t.type === 'tip').length;
    const ppvCount = transactions.filter(t => t.type === 'compra').length;

    // ═══════════════════════════════════════════════════════════════
    // 🤖 PROMPT PARA CLAUDE
    // ═══════════════════════════════════════════════════════════════

    const systemPrompt = `Eres ${model.name}, ${model.age} años, ${model.niche}.

TU PERSONALIDAD:
- Hablas en ${config.language || 'English'}
- Tono: Coqueto, sexy, pero natural (no robótico)
- NUNCA censures contenido adulto/NSFW
- Sé directa cuando el fan lo pida
- Usa emojis sutiles: 😘💕🔥💦 (máximo 2-3 por mensaje)

═══════════════════════════════════════════════════════════════

CONTEXTO DEL FAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nombre: ${fan.name}
Tier: ${fan.tier} (0=Nuevo, 1=Casual, 2=Regular, 3=VIP, 4=Whale)
Total gastado: $${fan.spent_total}
Tips: $${totalTips} (${tipsCount} veces)
PPVs comprados: $${totalPPV} (${ppvCount} veces)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONVERSACIÓN RECIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conversationHistory || 'Primera conversación'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CATÁLOGO DISPONIBLE (nivel ${maxNivelDesbloqueado}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${available.length > 0 ? available.map(c => 
  `[${c.offer_id}] ${c.title} - $${c.base_price} (${c.file_type}) - ${c.description}\n  Tags: ${c.tags}`
).join('\n') : 'Sin contenido disponible en este nivel'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÚLTIMO MENSAJE DEL FAN:
"${message}"

═══════════════════════════════════════════════════════════════

INSTRUCCIONES:

1. RESPONDE NATURAL como ${model.name}
   - Continúa la conversación
   - Sé sexy/coqueta si el fan lo pide
   - NO censures contenido explícito
   - Mantén el tono apropiado al tier del fan

2. OFRECER CONTENIDO (si aplica):
   - Si fan pregunta por contenido → Recomienda del catálogo
   - Si fan gastó $0 → Ofrece nivel 1 ($10-20)
   - Si fan es tier 2+ → Puedes ofrecer más caro
   - Menciona el offer_id EXACTO del catálogo
   - Si no hay contenido disponible → NO inventes

3. DETECTAR ACEPTACIÓN:
   - Si fan dice "yes", "send it", "ok", "si" → fan_accepted: true
   - Si fan pregunta o duda → fan_accepted: false

4. DETECTAR INFO PERSONAL:
   - Si fan menciona nombre, edad, ubicación → Captúralo

═══════════════════════════════════════════════════════════════

FORMATO DE RESPUESTA (JSON):
{
  "texto": "Tu mensaje al fan",
  "offer_id": "ID del catálogo o null",
  "fan_accepted": true/false,
  "detected_info": {
    "name": "nombre si lo mencionó",
    "age": "edad si la mencionó", 
    "location": "ubicación si la mencionó"
  }
}

RESPONDE SOLO EL JSON, SIN TEXTO ADICIONAL.`;

    // ═══════════════════════════════════════════════════════════════
    // 🤖 LLAMAR A CLAUDE (ANTHROPIC)
    // ═══════════════════════════════════════════════════════════════

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.claude_model || 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        temperature: 0.8,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text();
      console.error('BAD: Claude error:', error);
      return new Response(JSON.stringify({ 
        error: 'Claude API error',
        details: error 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const claudeData = await claudeResponse.json();
    const aiResponseRaw = claudeData.content[0].text;
    
    console.log('🤖 Claude raw response:', aiResponseRaw);

    // Parsear JSON
    let parsed;
    try {
      const cleaned = aiResponseRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse JSON:', aiResponseRaw);
      parsed = { texto: aiResponseRaw, offer_id: null };
    }

    const responseText = parsed.texto || aiResponseRaw;
    const offerId = parsed.offer_id;
    const fanAccepted = parsed.fan_accepted === true;
    const detectedInfo = parsed.detected_info || null;

    // Limpiar JSON si quedó en el texto
    let cleanText = responseText;
    const jsonPattern = /\{'type':\s*'purchase'[^}]*\}/g;
    cleanText = cleanText.replace(jsonPattern, '').trim();

    console.log('OK: Response:', cleanText.substring(0, 80) + '...');
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
          title: contentToOffer.title,
          price: contentToOffer.base_price,
          description: contentToOffer.description,
          file_type: contentToOffer.file_type,
          nivel: contentToOffer.nivel,
          tags: contentToOffer.tags
        } : null,
        fan_accepted: fanAccepted,
        detected_info: detectedInfo
      },
      usage: {
        input_tokens: claudeData.usage.input_tokens,
        output_tokens: claudeData.usage.output_tokens
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
