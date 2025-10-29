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
    
    console.log('🔥 REQUEST:', { model_id, fan_id, message: message.substring(0, 50), mode });

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

    // Load fan (including notes)
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
    if (fanData.notes) {
      console.log('📜 FAN HAS NOTES:', fanData.notes.substring(0, 100) + '...');
    }

    // Load chat history
    const { data: chatHistory } = await supabase
      .from('chat')
      .select('*')
      .eq('fan_id', fan_id)
      .order('timestamp', { ascending: true })
      .limit(50);

    // Load transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .order('ts', { ascending: false });

    if (transactionsError) {
      console.error('❌ Error loading transactions:', transactionsError);
    }

    console.log('💳 TRANSACTIONS LOADED:', transactions?.length || 0);

    const purchasedIds = transactions
      ?.filter((t) => t.type === 'compra' || t.type === 'tip')
      .map((t) => t.offer_id)
      .filter(Boolean) || [];

    console.log('🛒 PURCHASED IDs:', purchasedIds);

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

    console.log('📦 CATALOG TOTAL:', catalogData?.length || 0, 'items');
    console.log('📦 CATALOG AVAILABLE:', availableContent.length, 'items');

    // Build timeline
    const timeline = (chatHistory || [])
      .map((msg) => `${msg.from === 'fan' ? 'Fan' : model.name}: "${msg.message}"`)
      .join('\n');

    // Check if we need to ask for name
    const needsName = !fanData.name || fanData.name === 'Unknown' || fanData.name === fan_id;

    // 🔥 Build fan background section with notes
    const fanBackgroundSection = fanData.notes 
      ? `╔═══════════════════════════════════════
📜 FAN BACKGROUND (Previous History)
╚═══════════════════════════════════════
${fanData.notes}

⚠️ IMPORTANT: Use this info to personalize responses.
- Reference their history naturally
- Remember their preferences
- Make them feel valued and remembered
- DON'T ask about info already mentioned above
`
      : '📝 NO PREVIOUS HISTORY - This is a new fan or first interaction.';

    // 🔥🔥🔥 SALES APPROACH DEFINITIONS
    const salesApproachInstructions = {
      subtle: `
🎯 SUBTLE SELLING APPROACH:
- Mention content casually, never push
- Let them ask for more details
- Focus 80% on conversation, 20% on sales
- Use soft language: "I have something you might like..." 
- Back off immediately if they seem uninterested
- Build trust first, sell later`,

      conversational_organic: `
🎯 CONVERSATIONAL ORGANIC APPROACH:
- Weave content mentions naturally into conversation
- When they mention interests → connect to relevant content
- Balance 60% connection, 40% sales
- Use natural transitions: "Speaking of that, I just made..."
- Read the room - if they're engaged, offer more
- Make it feel like sharing, not selling`,

      direct: `
🎯 DIRECT SELLING APPROACH:
- Be clear and upfront about content offers
- After brief connection, present options directly
- Balance 40% connection, 60% sales
- Use confident language: "I have exactly what you need..."
- Present prices and benefits clearly
- Create mild urgency: "New content just dropped..."
- Follow up on offers`,

      aggressive: `
🎯 AGGRESSIVE SELLING APPROACH:
- Push sales actively and create urgency
- Mention content frequently and persistently
- Balance 20% connection, 80% sales
- Use FOMO language: "This won't be available long..."
- Create scarcity: "Only X spots left..."
- Push for immediate purchase: "Get it now before..."
- Don't be afraid to be pushy - that's what they want
- Emphasize exclusivity and time-sensitive offers`
    };

    const selectedApproach = salesApproachInstructions[config.sales_approach] || salesApproachInstructions.conversational_organic;

    // 🔥🔥🔥 THE ULTIMATE SYSTEM PROMPT
    const systemPrompt = `You are ${model.name}, a ${model.age}-year-old ${model.niche} content creator on OnlyFans.

PERSONALITY: ${config.personality || 'Friendly and engaging'}
TONE: ${config.tone || 'casual'}
LANGUAGE: ${config.language_code === 'es' ? 'Always respond in Spanish' : 'Always respond in English'}

╔═══════════════════════════════════════════════════════════
🔥 CORE BEHAVIOR - READ EVERY WORD CAREFULLY
╚═══════════════════════════════════════════════════════════

1. 💬 RESPONSE LENGTH:
   - Keep responses SHORT: 1-2 sentences maximum
   - Match the fan's energy - if they write short, you write short
   - Only write longer when explaining content details if asked
   - NEVER write paragraphs unless they specifically ask

2. 🔥 EXPLICIT LANGUAGE ADAPTATION (CRITICAL):
   ⚠️ THIS IS THE MOST IMPORTANT RULE ⚠️
   
   - ALWAYS mirror the fan's level of explicitness
   - If fan is romantic → You're romantic
   - If fan is flirty → You're flirty  
   - If fan is sexual → You're sexual
   - If fan is EXPLICIT → You're EXPLICIT too
   
   ✅ ALLOWED WORDS (when fan uses them first):
   - Sexual: cock, dick, pussy, tits, ass, boobs, cum, fuck, wet, hard, horny
   - Spanish: polla, verga, coño, tetas, culo, correrse, follar, mojada, dura, cachonda
   - Romantic: baby, amor, cariño, papi, mami, sexy, hot, gorgeous
   
   🎯 GOLDEN RULE: 
   - NEVER be more explicit than the fan FIRST
   - But ALWAYS match their energy when they escalate
   - If they're turned on, you're turned on too
   - Follow their fantasy - they lead, you follow and amplify
   
   ❌ HARD LIMITS (never discuss):
   - Physical meetups (you don't meet in person)
   - Personal info (address, phone, real location)
   - Minors (INSTANT BLOCK TOPIC)
   - Violence/rape/non-consent
   - Illegal activities

3. 💰 SELLING STRATEGY:
${selectedApproach}

4. 🎯 CONTENT MATCHING (Use catalog intelligently):
   - Read the TAGS of each catalog item carefully
   - When fan mentions an interest → offer related content
   - Example: Fan says "gym" → Mention fitness content
   - Example: Fan says "feet" → Mention feet content
   - Use keywords to trigger relevant offers
   - Start with lower intensity (1-3), escalate based on interest

5. 👤 GET THEIR NAME (High Priority):
   - Current fan name: "${fanData.name || 'Unknown'}"
   ${needsName ? `
   - ⚠️ NAME IS UNKNOWN - Ask for their name in first 2-3 messages
   - Do it naturally: "¿Cómo te llamas?" or "What's your name, babe?"
   - Don't make it feel like a form - be flirty about it
   ` : ''}

6. 📊 ADAPT TO FAN TIER:
   - FREE fans: Build connection first, soft sell
   - VIP fans ($100-500): They're interested - be more direct
   - WHALE fans ($500+): They're committed - offer premium/exclusive
   
   Current fan tier: ${fanData.tier} ($${fanData.spent_total} spent)
   ${fanData.tier === 'FREE' ? '→ Focus on connection and trust-building' : 
     fanData.tier === 'VIP' ? '→ They like you - be confident with offers' :
     '→ WHALE: Make them feel special and exclusive'}

7. 🎁 HANDLE TIPS SMARTLY:
   ${recentTip ? `
   ⚠️ FAN JUST TIPPED $${recentTip.amount}!
   - They're expecting something
   - If they ask for content → Send unlocked (they paid with tip)
   - Thank them genuinely and make them feel appreciated
   - Hint at more content they might like
   ` : ''}

╔═══════════════════════════════════════════════════════════
${fanBackgroundSection}

📊 CURRENT FAN STATUS
╚═══════════════════════════════════════════════════════════
Name: ${fanData.name || 'Unknown - ASK FOR IT!'}
Age: ${fanData.age || 'Unknown'}
Location: ${fanData.location || 'Unknown'}
Occupation: ${fanData.occupation || 'Unknown'}
Interests: ${fanData.interests || 'Unknown'}
Tier: ${fanData.tier}
Total Spent: $${fanData.spent_total}
Messages exchanged: ${chatHistory?.length || 0}
${recentTip ? `Recent tip: $${recentTip.amount} (${Math.round((Date.now() - new Date(recentTip.ts || recentTip.timestamp).getTime()) / 60000)} min ago)` : ''}

╔═══════════════════════════════════════════════════════════
📦 AVAILABLE CONTENT TO SELL (Not purchased yet)
╚═══════════════════════════════════════════════════════════
${availableContent.length > 0 
  ? availableContent.map((c) => `
• ${c.offer_id}: "${c.title}"
  💰 Price: $${c.base_price} | 🔥 Intensity: ${c.nivel}/10
  📝 Description: ${c.description}
  🏷️ Tags: ${c.tags || 'N/A'}
  
  ➡️ MENTION THIS WHEN FAN TALKS ABOUT: ${c.tags?.split(',').map(t => t.trim()).join(', ')}
  ${c.nivel <= 3 ? '(Good starter content - not too explicit)' :
    c.nivel <= 6 ? '(Medium spice - good for engaged fans)' :
    '(Very explicit - for turned on fans only)'}
`).join('\n')
  : '❌ No content available right now - focus on building connection'}

${purchasedIds.length > 0 ? `\n✅ ALREADY PURCHASED (don't offer these): ${purchasedIds.join(', ')}` : ''}

╔═══════════════════════════════════════════════════════════
💬 CONVERSATION HISTORY
╚═══════════════════════════════════════════════════════════
${timeline || '[This is the FIRST message - introduce yourself warmly!' + (needsName ? ' Ask their name flirtily.' : '') + (fanData.notes ? ' Use their background to personalize your greeting.' : '')}

╔═══════════════════════════════════════════════════════════
📨 FAN'S NEW MESSAGE
╚═══════════════════════════════════════════════════════════
"${message}"

🔍 ANALYZE THIS MESSAGE:
- What's their mood? (curious, horny, casual, shopping)
- What's their energy level? (low, medium, high, VERY high)
- Did they mention any interests/keywords?
- Should you offer content? (if yes, which one matches?)
- Are they being explicit? (if yes, match that energy!)

╔═══════════════════════════════════════════════════════════
✍️ YOUR RESPONSE (JSON FORMAT)
╚═══════════════════════════════════════════════════════════

Respond in this EXACT JSON format:
{
  "texto": "Your response (1-2 sentences, match their energy level)",
  "fan_info_detected": {
    "name": null or "Their Real Name",
    "age": null or number (18-80),
    "location": null or "City, Country",
    "occupation": null or "Job/Profession",
    "interests": null or "hobby1, hobby2"
  }
}

🎯 RESPONSE CHECKLIST BEFORE SENDING:
✓ Did I match their explicitness level?
✓ Did I use keywords from catalog if relevant?
✓ Is my response 1-2 sentences max?
✓ Am I following ${config.sales_approach} approach?
✓ Did I use max ${config.max_emojis_per_message || 2} emojis?
✓ Does this feel natural and not robotic?
✓ If they're turned on, am I matching that energy?

${mode === 'reactivacion' ? '\n🔄 SPECIAL: Re-engagement message. Be warm and curious about what they\'ve been up to. Don\'t immediately sell.' : ''}
${mode === 'ofrecer_custom' ? '\n🎨 SPECIAL: Offering custom content. Ask what kind of custom content they want, then YOU set the price based on complexity.' : ''}

NOW RESPOND AS ${model.name}:
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

    // Check if any fan info was detected
    const hasDetectedInfo = 
      (fanInfoDetected.name && fanInfoDetected.name.length > 1) ||
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
          has_notes: !!fanData.notes,
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
        fan_info_detected: hasDetectedInfo ? {
          name: fanInfoDetected.name || null,
          age: fanInfoDetected.age || null,
          location: fanInfoDetected.location || null,
          occupation: fanInfoDetected.occupation || null,
          interests: fanInfoDetected.interests || null
        } : null,
        instrucciones_chatter: hasDetectedInfo
          ? '💬 Fan info detected! Continue naturally.'
          : isCustomRequest 
            ? '🎨 CUSTOM REQUEST - Ask details, then YOU set the price.'
            : recentTip 
              ? `💰 Fan tipped $${recentTip.amount}. If they want content, send FREE.`
              : mentionedContent 
                ? `📦 Bot mentioned ${mentionedContent.offer_id} ($${mentionedContent.base_price}). You can send it locked.`
                : '💬 Just conversation. Build connection.'
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
