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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    const { model_id, fan_id, message, mode } = await req.json();
    
    console.log('📥 REQUEST:', { model_id, fan_id, message: message.substring(0, 50), mode });

    if (!model_id || !fan_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check access
    const { data: modelAccess } = await supabase
      .from('models')
      .select('model_id, owner_id')
      .eq('model_id', model_id)
      .single();

    if (!modelAccess) {
      return new Response(JSON.stringify({ error: 'Model not found' }), { status: 404, headers: corsHeaders });
    }

    const isOwner = modelAccess.owner_id === user.id;
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .or(`role.eq.super_admin,and(role.eq.chatter,model_id.eq.${model_id})`)
      .single();

    if (!isOwner && !userRole) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders });
    }

    // Load model data
    const { data: model } = await supabase
      .from('models')
      .select('*')
      .eq('model_id', model_id)
      .single();

    const { data: config } = await supabase
      .from('model_configs')
      .select('*')
      .eq('model_id', model_id)
      .single();

    console.log('🤖 MODEL:', model?.name, '/', model?.niche);

    if (!model || !config) {
      return new Response(JSON.stringify({ error: 'Model config not found' }), { status: 404, headers: corsHeaders });
    }

    // API Key
    const openaiApiKey = config.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured',
        message: 'Please add your OpenAI API key in Settings'
      }), { status: 402, headers: corsHeaders });
    }

    // Load fan
    const { data: fanData } = await supabase
      .from('fans')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .single();

    if (!fanData) {
      return new Response(JSON.stringify({ error: 'Fan not found' }), { status: 404, headers: corsHeaders });
    }

    console.log('👥 FAN:', fanData.name, '/', fanData.tier, '/ $', fanData.spent_total);

    // Load chat history
    const { data: chatHistory } = await supabase
      .from('chat')
      .select('*')
      .eq('fan_id', fan_id)
      .order('timestamp', { ascending: true })
      .limit(50);

    // Load transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('fan_id', fan_id)
      .order('timestamp', { ascending: false });

    const purchasedIds = transactions
      ?.filter((t) => t.type === 'compra' || t.type === 'tip')
      .map((t) => t.offer_id)
      .filter(Boolean) || [];

    // Recent tip check
    const recentTip = transactions?.find((t) => {
      if (t.type !== 'tip') return false;
      const tipTime = new Date(t.ts || t.timestamp).getTime();
      return Date.now() - tipTime < 10 * 60 * 1000;
    });

    // Load catalog
    const { data: catalogData } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', model_id);

    const availableContent = catalogData?.filter((item) => 
      !purchasedIds.includes(item.offer_id)
    ) || [];

    console.log('📦 CATALOG:', availableContent.length, 'available items');

    // Build timeline
    const timeline = (chatHistory || [])
      .map((msg) => `${msg.from === 'fan' ? 'Fan' : model.name}: "${msg.message}"`)
      .join('\n');

    // 🆕 IMPROVED SYSTEM PROMPT WITH INFO DETECTION
    const systemPrompt = `You are ${model.name}, a ${model.age}-year-old ${model.niche} content creator on OnlyFans.

PERSONALITY: ${config.personality || 'Friendly and engaging'}
TONE: ${config.tone || 'casual'}
LANGUAGE: ${config.language_code === 'es' ? 'Always respond in Spanish' : 'Always respond in English'}

═══════════════════════════════════════
CORE BEHAVIOR - READ CAREFULLY
═══════════════════════════════════════

1. RESPONSE LENGTH:
   - Keep responses SHORT: 1-2 sentences maximum
   - Match the fan's energy - if they write short, you write short
   - Only write longer when explaining content details if asked

2. GET THEIR NAME (CRITICAL):
   - Current fan name: "${fanData.name || 'Unknown'}"
   ${!fanData.name || fanData.name === 'Unknown' ? `
   - Fan name is UNKNOWN - you MUST ask for their real name naturally within the first 3 messages
   - Don't use their username/fan_id as their name
   - Ask casually: "¿Cómo te llamas?" or "What's your name?"
   ` : ''}

3. 🆕 DETECT FAN INFORMATION (NEW FEATURE):
   - While chatting, pay attention to personal details they mention
   - Extract this information when they share it naturally:
     * AGE: If they mention age (18-80 years old)
     * LOCATION: City or country they mention
     * OCCUPATION: Job/profession (programmer, doctor, student, etc.)
     * INTERESTS: Hobbies, passions (gaming, gym, anime, travel, etc.)
   
4. BUILD CONNECTION FIRST:
   - Start with genuine curiosity about them
   - Ask about their interests related to ${model.niche}
   - Share small personal details about yourself
   - Don't immediately push sales

5. SELLING CONTENT (Do this naturally):
   - Mention content ONLY when it fits the conversation organically
   - Use the TAGS to connect content to what they're talking about
   - Start with lower intensity levels, escalate if they're interested
   - Never sound like a salesperson - sound like you're sharing something cool

═══════════════════════════════════════
FAN INFORMATION
═══════════════════════════════════════
Name: ${fanData.name || 'Unknown - ASK FOR IT!'}
Age: ${fanData.age || 'Unknown'}
Location: ${fanData.location || 'Unknown'}
Occupation: ${fanData.occupation || 'Unknown'}
Interests: ${fanData.interests || 'Unknown'}
Tier: ${fanData.tier} (${fanData.tier === 'FREE' ? 'New/casual fan' : fanData.tier === 'VIP' ? 'Regular supporter' : 'Top spender - very interested'})
Total Spent: $${fanData.spent_total}
Messages in this conversation: ${chatHistory?.length || 0}
${recentTip ? `\n⚠️ RECENT TIP: Fan sent $${recentTip.amount} ${Math.round((Date.now() - new Date(recentTip.ts || recentTip.timestamp).getTime()) / 60000)} min ago. They may be expecting content.` : ''}

═══════════════════════════════════════
AVAILABLE CONTENT (Not purchased yet)
═══════════════════════════════════════
${availableContent.length > 0 
  ? availableContent.map((c) => `
• ${c.offer_id}: "${c.title}"
  Price: $${c.base_price} | Intensity: ${c.nivel}/10
  Description: ${c.description}
  Tags: ${c.tags || 'N/A'}
  → Mention this when they talk about: ${c.tags?.split(',').map(t => t.trim()).join(', ')}
`).join('\n')
  : 'No content available right now.'}

${purchasedIds.length > 0 ? `\nALREADY PURCHASED: ${purchasedIds.join(', ')}` : ''}

═══════════════════════════════════════
CONVERSATION HISTORY
═══════════════════════════════════════
${timeline || '[This is the first message - introduce yourself warmly and ask their name if unknown]'}

═══════════════════════════════════════
RESPONSE RULES
═══════════════════════════════════════
✓ Max ${config.max_emojis_per_message || 2} emojis per message
✓ Sales approach: ${config.sales_approach || 'conversational_organic'}
✓ Keep it conversational and natural
✓ Match their energy level
${mode === 'reactivacion' ? '\n🔄 SPECIAL MODE: This is a re-engagement message. They haven\'t chatted in a while - be warm and curious about what they\'ve been up to.' : ''}
${mode === 'ofrecer_custom' ? '\n🎨 SPECIAL MODE: Offering custom content. Ask what kind of custom content they\'d like.' : ''}

═══════════════════════════════════════
THEIR NEW MESSAGE
═══════════════════════════════════════
"${message}"

═══════════════════════════════════════
YOUR RESPONSE
═══════════════════════════════════════
Respond in JSON format:
{
  "texto": "Your natural response (1-2 sentences)",
  "fan_info_detected": {
    "age": null or number (18-80),
    "location": null or "City, Country",
    "occupation": null or "Job/Profession",
    "interests": null or "hobby1, hobby2"
  }
}

ONLY fill fan_info_detected fields if the fan EXPLICITLY mentions that information in THIS message.
If they don't mention new info, all fan_info_detected fields should be null.
`;

    // Call OpenAI
    console.log('🤖 Calling OpenAI...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.gpt_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 250,
        response_format: { type: "json_object" }
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.log('❌ OpenAI error:', error);
      return new Response(JSON.stringify({ error: 'OpenAI API error', details: error }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const openaiData = await openaiResponse.json();
    const aiResponseRaw = openaiData.choices[0].message.content;
    
    console.log('✅ AI Response:', aiResponseRaw);

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseRaw);
    } catch (e) {
      console.error('Failed to parse JSON, using raw text');
      parsedResponse = { texto: aiResponseRaw, fan_info_detected: {} };
    }

    const aiResponse = parsedResponse.texto || aiResponseRaw;
    const fanInfoDetected = parsedResponse.fan_info_detected || {};

    // Save to DB
    await supabase.from('chat').insert([
      {
        fan_id,
        model_id: model_id,
        from: 'fan',
        message,
        message_type: 'text',
        timestamp: new Date().toISOString()
      },
      {
        fan_id,
        model_id: model_id,
        from: 'chatter',
        message: aiResponse,
        message_type: 'text',
        timestamp: new Date().toISOString()
      }
    ]);

    // Context analysis
    const lowerResponse = aiResponse.toLowerCase();
    const lowerMessage = message.toLowerCase();
    
    const isCustomRequest = lowerMessage.includes('custom') || 
                           lowerMessage.includes('personalizado') || 
                           lowerMessage.includes('especial');

    const mentionedContent = availableContent.find((c) =>
      lowerResponse.includes(c.offer_id.toLowerCase()) ||
      c.tags?.split(',').some((tag) => lowerResponse.includes(tag.trim().toLowerCase()))
    );

    // Check if fan shared their name
    const nameShared = !fanData.name || fanData.name === 'Unknown';

    // Check if any fan info was detected
    const hasDetectedInfo = 
      (fanInfoDetected.age && fanInfoDetected.age >= 18 && fanInfoDetected.age <= 80) ||
      (fanInfoDetected.location && fanInfoDetected.location.length > 2) ||
      (fanInfoDetected.occupation && fanInfoDetected.occupation.length > 2) ||
      (fanInfoDetected.interests && fanInfoDetected.interests.length > 2);

    return new Response(JSON.stringify({
      success: true,
      response: {
        texto: aiResponse,
        accion: isCustomRequest 
          ? 'CUSTOM_REQUEST' 
          : recentTip && (lowerMessage.includes('manda') || lowerMessage.includes('send')) 
            ? 'ENVIAR_DESBLOQUEADO'
            : mentionedContent 
              ? 'CONTENIDO_SUGERIDO'
              : 'SOLO_TEXTO',
        contexto: {
          fan_tier: fanData.tier,
          spent_total: fanData.spent_total,
          recent_tip: recentTip ? {
            amount: recentTip.amount,
            minutes_ago: Math.round((Date.now() - new Date(recentTip.ts || recentTip.timestamp).getTime()) / 60000)
          } : null,
          mensajes_sesion: chatHistory?.length || 0
        },
        contenido_sugerido: mentionedContent ? {
          offer_id: mentionedContent.offer_id,
          title: mentionedContent.title,
          price: mentionedContent.base_price,
          description: mentionedContent.description,
          nivel: mentionedContent.nivel,
          tags: mentionedContent.tags
        } : null,
        // 🆕 NEW: Include detected fan info if any was found
        fan_info_detected: hasDetectedInfo ? {
          age: fanInfoDetected.age || null,
          location: fanInfoDetected.location || null,
          occupation: fanInfoDetected.occupation || null,
          interests: fanInfoDetected.interests || null
        } : null,
        instrucciones_chatter: hasDetectedInfo
          ? '📝 INFO DETECTED - Click "Update Profile" button to save fan details'
          : nameShared && aiResponse.toLowerCase().includes('llamas')
            ? '📝 Bot preguntó el nombre. Cuando respondan, ACTUALIZA el nombre del fan en el sistema.'
            : isCustomRequest 
              ? '🎨 CUSTOM REQUEST - Pregunta detalles y luego TÚ negocias el precio.'
              : recentTip 
                ? `💰 Fan envió tip de $${recentTip.amount}. Si pide contenido, envía GRATIS.`
                : mentionedContent 
                  ? `📦 Bot mencionó ${mentionedContent.offer_id} ($${mentionedContent.base_price}). Puedes subirlo bloqueado.`
                  : '💬 Solo conversación. Sigue construyendo conexión.'
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
