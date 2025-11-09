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
    const { model_id, fan_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ════════════════════════════════════════════════════════
    // 📊 CARGAR DATA NECESARIA
    // ════════════════════════════════════════════════════════
    const [fanRes, messagesRes, catalogRes, transactionsRes] = await Promise.all([
      supabase.from('fans').select('*').eq('fan_id', fan_id).eq('model_id', model_id).single(),
      supabase.from('chat').select('*').eq('fan_id', fan_id).order('timestamp', { ascending: false }).limit(10),
      supabase.from('catalog').select('*').eq('model_id', model_id).eq('session_id', 'not.null').order('step_number'),
      supabase.from('transactions').select('*').eq('fan_id', fan_id).eq('type', 'ppv')
    ]);

    const fan = fanRes.data;
    const messages = messagesRes.data || [];
    const catalog = catalogRes.data || [];
    const transactions = transactionsRes.data || [];

    if (!fan) {
      return new Response(JSON.stringify({ error: 'Fan not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Agrupar catalog en sessions
    const sessionsMap = new Map();
    catalog.forEach(item => {
      if (!sessionsMap.has(item.session_id)) {
        sessionsMap.set(item.session_id, {
          session_name: item.session_name,
          parts: []
        });
      }
      sessionsMap.get(item.session_id).parts.push(item);
    });

    const sessions = Array.from(sessionsMap.values());

    // PPVs ya comprados
    const purchasedOfferIds = transactions.map(t => t.offer_id);

    // Último mensaje del fan
    const lastFanMessage = messages.find(m => m.from === 'fan')?.message || 'No messages yet';

    // ════════════════════════════════════════════════════════
    // 🤖 PROMPT SIMPLE PARA CLAUDE
    // ════════════════════════════════════════════════════════
    const prompt = `Eres una asistente IA que ayuda a chatters de OnlyFans a vender contenido.

FAN INFO:
- Name: ${fan.name || 'Unknown'}
- Tier: ${fan.tier_name || 'FREE'} (Tier ${fan.tier})
- Total Spent: $${fan.spent_total || 0}
- Notes: ${fan.notes || 'None'}

LAST FAN MESSAGE:
"${lastFanMessage}"

AVAILABLE SESSIONS:
${sessions.map(s => 
  `${s.session_name}:\n${s.parts.map(p => 
    `  - Part ${p.step_number}: ${p.title} ($${p.base_price}, Level ${p.nivel}/10)${purchasedOfferIds.includes(p.offer_id) ? ' [PURCHASED]' : ''}`
  ).join('\n')}`
).join('\n\n')}

INSTRUCTIONS:
1. Generate a flirty message to continue the conversation
2. Recommend a PPV to send (if appropriate)
3. Generate a tease/locked text for the PPV

RULES:
- Be natural and conversational
- Match the fan's vibe
- Don't recommend already purchased content
- Start with FREE teasers for new fans
- Escalate to higher parts for paying fans

Return JSON:
{
  "message": "Your suggested message to fan",
  "lockedText": "Tease text (optional)",
  "recommendedPart": {
    "offer_id": "...",
    "session_name": "...",
    "step_number": 1,
    "reason": "Why recommend this"
  }
}

RESPOND ONLY WITH JSON.`;

    // ════════════════════════════════════════════════════════
    // 🤖 LLAMAR CLAUDE (HAIKU - BARATO)
    // ════════════════════════════════════════════════════════
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // HAIKU = MÁS BARATO
        max_tokens: 500,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    const aiText = data.content[0].text;

    // Limpiar y parsear JSON
    const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestion = JSON.parse(cleaned);

    // Buscar el part recomendado
    let recommendedPPV = null;
    if (suggestion.recommendedPart?.offer_id) {
      recommendedPPV = catalog.find(c => c.offer_id === suggestion.recommendedPart.offer_id);
    }

    return new Response(JSON.stringify({
      success: true,
      suggestion: {
        message: suggestion.message,
        lockedText: suggestion.lockedText || '',
        recommendedPPV: recommendedPPV,
        reasoning: suggestion.recommendedPart?.reason || ''
      },
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
