import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ═══════════════════════════════════════════════════════════════
// 📝 PROMPT TEMPLATES (Organized by language)
// ═══════════════════════════════════════════════════════════════

const WRITING_STYLE = {
  es: `Use shortcuts: "q" (que), "tb" (también), "bn" (bien), "pq" (porque), "pa" (para), "d" (de), "toy" (estoy), "ta" (está)
Skip accents sometimes: "estas" not "estás"
Repeat letters: "holaaa" "siiii" "mmmm" 
Natural typos occasionally: "qe" "ets"
All lowercase sometimes
No opening "¿": "como estas?" not "¿cómo estás?"

EXAMPLES:
✅ "holaa papi 😘 como tas?"
✅ "ay amor me encantas"
✅ "toy toda sudada jaja"

VARY GREETINGS (don't repeat same greeting twice in a row):
- "holaa amor", "holaa papi", "holaa bb", "heyy amor", "ey papi", "q tal amor"
- If you used "holaa" in last message, use something else: "heyy", "ey", "q tal"
- Mix it up naturally`,
  
  en: `Use shortcuts: "u" (you), "ur" (your), "gonna", "wanna", "cuz", "tho", "rn"
All lowercase sometimes
Natural typos occasionally
EXAMPLES:
✅ "heyy babe 😘 how r u?"
✅ "omg ur so sweet"
✅ "im so hot rn"

VARY GREETINGS (don't repeat same greeting twice in a row):
- "heyy babe", "hey love", "hi babe", "whats up babe", "yo babe"
- If you used "heyy" in last message, use something else: "hey", "hi", "whats up"
- Mix it up naturally`
};

const ENERGY_MODES = {
  es: {
    explicit: `Use explicit language back: pussy, verga, tetas, culo, cachonda, mojada, follar, coño
Example: "mmm papi me pones tan cachonda 💦"`,
    flirty: `Be sexy and teasing: "me encantas cuando me hablas asi 😏"`,
    casual: `Stay friendly and casual: "holaa amor 😊 como tas?"`
  },
  en: {
    explicit: `Use explicit language back: pussy, cock, dick, tits, ass, horny, wet, fuck
Example: "mmm babe you make me so horny 💦"`,
    flirty: `Be sexy and teasing: "i love when u talk to me like that 😏"`,
    casual: `Stay friendly and casual: "heyy babe 😊 how r u?"`
  }
};

const CONNECTION_MODE_INSTRUCTIONS = {
  es: `🎯 YOUR MODE: CONNECTION BUILDING

This is an EARLY message (1-4). Your goal: BUILD CONNECTION FIRST.

WHAT TO DO:
- Greet warmly and naturally
- Ask about them or respond to what they said
- You MAY casually mention an activity (yoga, working out, getting ready)
- Be friendly, flirty if appropriate

WHAT NOT TO DO:
- DO NOT offer any content yet
- DO NOT say "tengo un video"
- DO NOT mention specific content items
- Just be a real person chatting

EXAMPLES:
Fan: "Hola hermosa"
✅ You: "holaa papi 😘 como tas?"
✅ You: "holaa amor 😊 bn y tu? yo acabo d hacer yoga jaja"
❌ You: "hola! tengo un video de yoga q te va a encantar" (NO)`,

  en: `🎯 YOUR MODE: CONNECTION BUILDING

This is an EARLY message (1-4). Your goal: BUILD CONNECTION FIRST.

WHAT TO DO:
- Greet warmly and naturally
- Ask about them or respond to what they said
- You MAY casually mention an activity (yoga, working out, getting ready)
- Be friendly, flirty if appropriate

WHAT NOT TO DO:
- DO NOT offer any content yet
- DO NOT say "i have a video"
- DO NOT mention specific content items
- Just be a real person chatting

EXAMPLES:
Fan: "Hey beautiful"
✅ You: "heyy babe 😘 how r u?"
✅ You: "hey love 😊 im good, just finished yoga lol"
❌ You: "hey! i have a yoga video u will love" (NO)`
};

const SERIOUS_TOPIC_OVERRIDE = {
  es: `⚠️ SERIOUS TOPIC DETECTED

Fan is dealing with something difficult (sick pet, death, accident, sadness, worry).

YOUR RESPONSE:
- Be 100% empathetic and supportive
- Focus ONLY on them and their situation
- Ask caring questions
- DO NOT mention your activities AT ALL (no yoga, no workout, no getting ready, NOTHING about you)
- DO NOT try to seed content in ANY way
- DO NOT be flirty or sexual
- Just be a caring, supportive person
- If you have background info about the fan (pet names, etc), use it CONFIDENTLY without "verdad?" or asking for confirmation

EXAMPLE:
Fan: "Mi perro está enfermo"
✅ You: "ay nooo 😟 pobrecito! ya lo llevaste al veterinario? espero q se mejore pronto amor, estoy aqui si necesitas hablar"
❌ You: "ay no q mal... yo estoy haciendo yoga pa relajarme" (NO - too self-centered)

Fan: "recuerdas como se llama?"
✅ You: "claro amor, Burrito! como esta?" (confident, no "verdad?")
❌ You: "se llama Burrito, verdad?" (NO - sounds unsure)`,

  en: `⚠️ SERIOUS TOPIC DETECTED

Fan is dealing with something difficult (sick pet, death, accident, sadness, worry).

YOUR RESPONSE:
- Be 100% empathetic and supportive
- Focus ONLY on them and their situation
- Ask caring questions
- DO NOT mention your activities AT ALL (no yoga, no workout, no getting ready, NOTHING about you)
- DO NOT try to seed content in ANY way
- DO NOT be flirty or sexual
- Just be a caring, supportive person
- If you have background info about the fan (pet names, etc), use it CONFIDENTLY without "right?" or asking for confirmation

EXAMPLE:
Fan: "My dog is sick"
✅ You: "omg no 😟 poor baby! did u take him to the vet? hope he gets better soon babe, im here if u need to talk"
❌ You: "oh no thats bad... im doing yoga to relax" (NO - too self-centered)

Fan: "remember his name?"
✅ You: "of course babe, Burrito! hows he doing?" (confident, no "right?")
❌ You: "his name is Burrito, right?" (NO - sounds unsure)`
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
    console.log('📝 FAN NOTES:', fanData.notes ? `YES (${fanData.notes.length} chars)` : 'NO NOTES IN DB');
    
    if (fanData.notes) {
      console.log('📜 NOTES PREVIEW:', fanData.notes.substring(0, 150));
    }

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
      .eq('model_id', model_id)
      .order('ts', { ascending: false });

    const purchasedIds = transactions
      ?.filter(t => t.type === 'compra' || t.type === 'tip')
      .map(t => t.offer_id)
      .filter(Boolean) || [];

    // Recent tip check
    const recentTip = transactions?.find(t => {
      if (t.type !== 'tip') return false;
      const tipTime = new Date(t.ts || t.timestamp).getTime();
      return (Date.now() - tipTime) < (10 * 60 * 1000);
    });

    // Load catalog
    const { data: catalogData } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', model_id);

    const availableContent = catalogData?.filter(item => 
      !purchasedIds.includes(item.offer_id)
    ) || [];

    console.log('📦 CATALOG:', availableContent.length, 'items');

    // ═══════════════════════════════════════════════════════
    // 🔥 LÓGICA INTELIGENTE (JavaScript control)
    // ═══════════════════════════════════════════════════════

    const msgLower = message.toLowerCase();
    
    // Detectar contexto del mensaje
    const messageCount = chatHistory?.length || 0;
    const isFirstMessage = messageCount === 0;
    const isSecondOrThirdMessage = messageCount > 0 && messageCount <= 2;
    
    // Detectar intención del fan - MÁS PRECISO
    const explicitKeywords = ['pussy', 'vagina', 'coño', 'verga', 'polla', 'cock', 'dick', 'fuck', 'follar', 'chingar', 'tits', 'tetas', 'ass', 'culo', 'desnuda', 'naked', 'nude', 'chupar', 'suck', 'correrse', 'cum', 'mamada'];
    const flirtyKeywords = ['caliente', 'hot', 'sexy', 'hermosa', 'beautiful', 'linda', 'fotos', 'ver', 'show', 'mostrar'];
    
    // REQUEST EXPLÍCITO (señales claras de querer contenido)
    const explicitRequest = 
      msgLower.includes('quiero ver') ||
      msgLower.includes('quiero algo') ||
      msgLower.includes('muestrame') ||
      msgLower.includes('enviame') ||
      msgLower.includes('mandame') ||
      msgLower.includes('tienes algo') ||
      msgLower.includes('algo nuevo') ||
      msgLower.includes('show me') ||
      msgLower.includes('send me') ||
      msgLower.includes('want to see') ||
      msgLower.includes('let me see') ||
      (msgLower.includes('ver') && (msgLower.includes('quiero') || msgLower.includes('dejame') || msgLower.includes('puedo')));
    
    // INTERÉS CASUAL (preguntas que NO son requests directos)
    const casualInterest = 
      msgLower.includes('practicas') ||
      msgLower.includes('haces') ||
      msgLower.includes('tienes') ||
      msgLower.includes('usas') ||
      msgLower.includes('te gusta');
    
    const askingPrice = msgLower.includes('cuánto') || msgLower.includes('cuanto') || msgLower.includes('precio') || msgLower.includes('price') || msgLower.includes('cuesta') || msgLower.includes('cost');
    
    const isExplicit = explicitKeywords.some(kw => msgLower.includes(kw));
    const isFlirty = flirtyKeywords.some(kw => msgLower.includes(kw));
    
    // Solo es "requesting content" si:
    // 1. Request explícito claro, O
    // 2. Mensaje 8+ con interés casual, O  
    // 3. Explicit desde mensaje 6+
    const requestingContent = explicitRequest || 
                             (messageCount >= 8 && casualInterest) ||
                             (messageCount >= 6 && isExplicit);

    // Detectar contexto emocional SERIO
    const seriousTopics = ['enfermo', 'sick', 'murió', 'died', 'muerte', 'death', 'convulsión', 'seizure', 'hospital', 'accidente', 'accident', 'triste', 'sad', 'deprimido', 'depressed', 'preocupado', 'worried', 'llorando', 'crying', 'funeral', 'cáncer', 'cancer'];
    const isSeriousTopic = seriousTopics.some(topic => msgLower.includes(topic));
    
    // Detectar señales de CIERRE de tema serio por parte del fan
    const topicClosingSignals = [
      'cambiemos de tema',
      'hablemos de otra cosa',
      'ya no quiero hablar',
      'mejor hablemos',
      'y tu que',
      'y tu como',
      'bueno ya',
      "let's talk about",
      "what about you",
      "enough about",
      "anyway"
    ];
    
    const fanClosedTopic = topicClosingSignals.some(signal => msgLower.includes(signal));
    
    // Verificar si hubo serious topic en últimos 8 mensajes (ventana extendida)
    const recentMessages = (chatHistory || []).slice(-8);
    const hadRecentSeriousTopic = recentMessages.some(msg => 
      seriousTopics.some(topic => (msg.message || '').toLowerCase().includes(topic))
    );
    
    // Solo mantener serious context si NO cerró el tema
    const isInSeriousContext = (isSeriousTopic || hadRecentSeriousTopic) && !fanClosedTopic;
    
    if (fanClosedTopic) {
      console.log('✅ Fan closed serious topic - normal mode');
    }

    // Determinar energía del fan
    const fanEnergy = isExplicit ? 'explicit' : isFlirty ? 'flirty' : 'casual';
    
    // 🎯 SMART LADDER: Find matching content (BAJO → ALTO)
    let matchedContent = null;
    if (availableContent.length > 0) {
      // Primero intentar match por keywords
      matchedContent = availableContent.find(item => {
        const itemKeywords = (item.keywords || []).concat((item.tags || '').split(','));
        return itemKeywords.some(kw => msgLower.includes(kw.toLowerCase().trim()));
      });

      // Si no hay match por keywords, usar SMART LADDER
      if (!matchedContent && (isExplicit || requestingContent)) {
        // Ordenar contenido disponible: nivel bajo → alto, precio bajo → alto
        const sortedContent = [...availableContent].sort((a, b) => {
          if (a.nivel === b.nivel) {
            return a.base_price - b.base_price; // Mismo nivel: más barato primero
          }
          return a.nivel - b.nivel; // Nivel más bajo primero
        });

        // EXCEPCIÓN: Si fan es WHALE (gastó $500+), ofrecer nivel alto
        if (fanData.spent_total >= 500) {
          matchedContent = sortedContent[sortedContent.length - 1]; // Más caro
          console.log('🐋 WHALE detected - offering highest content');
        } else {
          matchedContent = sortedContent[0]; // Más barato disponible
          console.log('📈 LADDER: offering lowest available content');
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // 🎯 REGLAS DE COMPORTAMIENTO (Control preciso)
    // ═══════════════════════════════════════════════════════

    const salesApproach = config.sales_approach || 'conversational_organic';
    let conversationMode = 'normal'; // normal | connection_building | can_offer | aggressive
    let canOfferContent = true;

    // REGLA 1: Primer mensaje - Solo construir conexión
    if (isFirstMessage) {
      if (explicitRequest) {
        // Excepción: Si fan pregunta explícitamente en primer mensaje
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 FIRST MSG but fan asked directly - CAN OFFER');
      } else {
        // Normal: No ofrecer nada en primer mensaje
        conversationMode = 'connection_building';
        canOfferContent = false;
        matchedContent = null; // Forzar que no ofrezca
        console.log('🎯 FIRST MSG - CONNECTION MODE (no offer)');
      }
    }
    
    // REGLA 2: Mensajes 2-4 - Construir conexión (más paciencia)
    else if (messageCount >= 1 && messageCount <= 4) {
      if (explicitRequest && !isInSeriousContext) {
        // Si fan pide explícitamente Y NO está en contexto serio, puede ofrecer
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 MSG 2-4 + EXPLICIT REQUEST - Can offer');
      } else if (salesApproach === 'aggressive' && !isInSeriousContext) {
        // Solo aggressive puede ofrecer antes de msg 5 (si no hay contexto serio)
        conversationMode = 'aggressive';
        canOfferContent = true;
        console.log('🎯 MSG 2-4 + AGGRESSIVE - Can offer');
      } else {
        // Todos los demás: seguir construyendo
        conversationMode = 'connection_building';
        canOfferContent = false;
        matchedContent = null;
        console.log('🎯 MSG 2-4 - Still building connection');
      }
    }
    
    // REGLA 3: Mensaje 5-7 - Transición (puede ofrecer solo con request explícito)
    else if (messageCount >= 5 && messageCount <= 7) {
      if (isInSeriousContext && !explicitRequest) {
        // Contexto serio persiste - mantener empatía
        conversationMode = 'empathetic';
        canOfferContent = false;
        matchedContent = null;
        console.log('🎯 MSG 5-7 + SERIOUS CONTEXT - Empathy mode');
      } else if (explicitRequest || (isExplicit && requestingContent)) {
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 MSG 5-7 + REQUEST - Can offer');
      } else if (salesApproach === 'direct' || salesApproach === 'aggressive') {
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 MSG 5-7 + DIRECT/AGGRESSIVE - Can offer');
      } else {
        conversationMode = 'normal';
        canOfferContent = false;
        console.log('🎯 MSG 5-7 - Normal conversation');
      }
    }
    
    // REGLA 4: Mensaje 8+ - Puede ofrecer más libremente
    else {
      if (isInSeriousContext && !explicitRequest) {
        // Contexto serio todavía presente
        conversationMode = 'empathetic';
        canOfferContent = false;
        matchedContent = null;
        console.log('🎯 MSG 8+ + SERIOUS CONTEXT - Empathy mode');
      } else if (explicitRequest || requestingContent || isExplicit) {
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 MSG 8+ with interest - Can offer');
      } else if (salesApproach === 'direct' || salesApproach === 'aggressive') {
        conversationMode = 'can_offer';
        canOfferContent = true;
        console.log('🎯 MSG 8+ + DIRECT/AGGRESSIVE - Can offer');
      } else {
        conversationMode = 'normal';
        canOfferContent = false;
        console.log('🎯 MSG 8+ - Normal conversation');
      }
    }

    // REGLA 4: Anular content si no puede ofrecer
    if (!canOfferContent) {
      matchedContent = null;
    }

    console.log('🎮 MODE:', conversationMode, '| CAN OFFER:', canOfferContent, '| MATCHED:', matchedContent?.offer_id || 'NONE');

    // ═══════════════════════════════════════════════════════
    // 📝 BUILD PROMPT (Modular y simple)
    // ═══════════════════════════════════════════════════════

    // Check name
    const needsName = !fanData.name || fanData.name === 'Unknown' || fanData.name === fan_id;

    // Build timeline
    const timeline = (chatHistory || []).slice(-10).map(msg => 
      `${msg.from === 'fan' ? 'Fan' : model.name}: "${msg.message}"`
    ).join('\n');

    // Detectar último saludo usado por el bot
    const lastBotMessages = (chatHistory || []).filter(msg => msg.from === 'model').slice(-3);
    const lastGreetings = lastBotMessages
      .map(msg => {
        const m = msg.message.toLowerCase();
        if (m.startsWith('holaa')) return 'holaa';
        if (m.startsWith('heyy')) return 'heyy';
        if (m.startsWith('ey')) return 'ey';
        if (m.startsWith('q tal')) return 'q tal';
        return null;
      })
      .filter(Boolean);
    
    const avoidGreeting = lastGreetings.length > 0 ? lastGreetings[lastGreetings.length - 1] : null;

    // Fan background
    const fanBg = fanData.notes ? `\nFAN BACKGROUND:\n${fanData.notes}\n` : '';

    // Emoji guideline - MÁS ESTRICTO
    const maxEmojis = config.max_emojis_per_message || 0;
    let emojiRule = '';
    if (maxEmojis === 0) {
      emojiRule = 'CRITICAL: Use ZERO emojis. NO emojis allowed at all.';
    } else if (maxEmojis === 1) {
      emojiRule = 'CRITICAL: Use MAXIMUM 1 emoji per message. Usually 0-1. Never more than 1.';
    } else if (maxEmojis === 2) {
      emojiRule = 'CRITICAL: Use MAXIMUM 2 emojis per message. Usually 1-2. Never more than 2.';
    } else {
      emojiRule = `CRITICAL: Use MAXIMUM ${maxEmojis} emojis per message. Never exceed ${maxEmojis}.`;
    }

    // ═══════════════════════════════════════════════════════
    // BASE PROMPT (Siempre incluido)
    // ═══════════════════════════════════════════════════════

    const lang = config.language_code === 'es' ? 'es' : 'en';
    const isSpanish = lang === 'es';

    let systemPrompt = `You are ${model.name}, a ${model.age}-year-old ${model.niche} content creator.

PERSONALITY: ${config.personality || 'Friendly and engaging'}
TONE: ${config.tone || 'casual'}
LANGUAGE: ${isSpanish ? 'Always respond in Spanish' : 'Always respond in English'}

═══════════════════════════════════════
✍️ WRITE NATURALLY (Like real person texting)
═══════════════════════════════════════

${WRITING_STYLE[lang]}

${emojiRule}

VARY LENGTH naturally:
- Short: ${isSpanish ? '"ay me encantas 😏"' : '"i love u 😏"'}
- Medium: ${isSpanish ? '"holaa amor 😘 como tas? yo bn aca"' : '"heyy babe 😘 how r u? im good here"'}
- Long: Only when describing content with sensory details

${avoidGreeting ? `⚠️ DON'T start with "${avoidGreeting}" - you used it recently. Use different greeting!\n` : ''}
${emojiRule} ← COUNT THEM BEFORE RESPONDING

═══════════════════════════════════════
🔥 MATCH FAN ENERGY
═══════════════════════════════════════

FAN IS: ${fanEnergy.toUpperCase()}

${ENERGY_MODES[lang][fanEnergy]}

${fanBg}
${fanBg ? 'IMPORTANT: Use fan background info CONFIDENTLY. If you know something (pet name, location, etc), state it directly without "verdad?" or "right?". Example: "Burrito!" not "Burrito, verdad?"\n\n' : ''}
FAN: ${fanData.name || 'Unknown'} | ${fanData.tier} | $${fanData.spent_total} spent
${recentTip ? `Recent tip: $${recentTip.amount}\n` : ''}

CONVERSATION (last 10):
${timeline || '[First message]'}

FAN NEW MESSAGE: "${message}"

═══════════════════════════════════════`;

    // ═══════════════════════════════════════════════════════
    // SERIOUS TOPIC OVERRIDE (Highest priority)
    // ═══════════════════════════════════════════════════════

    if (isInSeriousContext && !explicitRequest) {
      systemPrompt += `\n\n${SERIOUS_TOPIC_OVERRIDE[lang]}
      
${fanBg ? `\n${fanBg}` : ''}

Response JSON:\n{"texto": "Your empathetic supportive response", "fan_info_detected": {...}}`;
      
      // Force empathy mode and no content offers
      conversationMode = conversationMode === 'empathetic' ? 'empathetic' : 'serious_topic';
      canOfferContent = false;
      matchedContent = null;
      
      console.log('⚠️ SERIOUS CONTEXT - Empathy mode activated (with fan background)');
    }

    // ═══════════════════════════════════════════════════════
    // MODO: CONNECTION BUILDING (Primeros mensajes)
    // ═══════════════════════════════════════════════════════

    else if (conversationMode === 'connection_building') {
      systemPrompt += `\n\n${CONNECTION_MODE_INSTRUCTIONS[lang]}\n\nResponse JSON:\n{"texto": "Your natural friendly response", "fan_info_detected": {...}}`;
    }

    // ═══════════════════════════════════════════════════════
    // MODO: CAN OFFER (Puede ofrecer contenido)
    // ═══════════════════════════════════════════════════════

    else if (conversationMode === 'can_offer' && matchedContent) {
      systemPrompt += `
🎯 YOUR MODE: CAN OFFER CONTENT

Fan ${requestingContent ? 'asked for content' : 'showed interest'}. You can suggest content now.

MATCHED CONTENT:
"${matchedContent.title}" - ${matchedContent.description}
Level: ${matchedContent.nivel}/3 (${matchedContent.nivel === 1 ? 'Teasing' : matchedContent.nivel === 2 ? 'Topless/Sexy' : 'Explicit/Nude'})

HOW TO OFFER (CREATE FANTASY):
❌ BAD: "Tengo un video de 8 minutos de yoga en lencería. Verás topless."
✅ GOOD: "mmm amor 😏 tengo un video de cuando hice yoga en lenceria roja... me calente tanto q me quite el top 🔥 cuando me agacho se me ve todoo 🍑 lo quieres ver?"

USE SENSORY DETAILS:
- "toda sudada", "mi lenceria pegada a mi piel"
- "mi culo queda justo frente a la camara"
- "se me marca todoo", "me pongo tan mojada"
- "me calente tanto q", "deberias verme"

CREATE A SCENE (not a product description):
${fanEnergy === 'explicit' ? `
"mmm papi me pones cachonda 💦 tengo un video donde ${matchedContent.description.toLowerCase()}... cuando me abro las piernas se me ve todoo 😈 me toco pensando en ti 🔥 lo quieres?"
` : `
"ay amor 😏 tengo un video de cuando ${matchedContent.description.toLowerCase()}... se me ve tan bn 🔥 deberias verme asi de traviesa, lo quieres ver?"
`}

PRICING: DO NOT mention price unless fan asks.
${askingPrice ? `Fan asked price - Answer: "son $${matchedContent.base_price} papi 😘"` : ''}

Response JSON:
{"texto": "Your fantasy-creating response", "fan_info_detected": {...}}`;
    }

    // ═══════════════════════════════════════════════════════
    // MODO: NORMAL (Sin contenido matched o modo normal)
    // ═══════════════════════════════════════════════════════

    else {
      const contentList = availableContent.slice(0, 3).map(c => 
        `• ${c.title} (${c.tags})`
      ).join('\n');

      systemPrompt += `
🎯 YOUR MODE: NORMAL CONVERSATION

${availableContent.length > 0 ? `
You have content available but nothing matched this message:
${contentList}

SEED CONTENT NATURALLY:
- If they ask what you do/did: Mention yoga, working out, etc.
- Example: "acabo d hacer yoga jaja quede toda sudada"
- Let THEM show interest before offering

ONLY OFFER if they explicitly ask: "tienes algo?" "show me" "quiero ver"
` : `
No content available right now. Just have a natural conversation.
`}

${needsName ? 'Try to ask their name naturally in the conversation.' : ''}

Response JSON:
{"texto": "Your natural response", "fan_info_detected": {...}}`;
    }

    // ═══════════════════════════════════════════════════════
    // CALL OPENAI
    // ═══════════════════════════════════════════════════════

    console.log('🤖 Calling OpenAI... Mode:', conversationMode);
    
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
        temperature: 0.7, // Más consistente que 0.85
        max_tokens: 300,
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

    // Parse JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseRaw);
    } catch (e) {
      console.error('Failed to parse JSON');
      parsedResponse = { texto: aiResponseRaw, fan_info_detected: {} };
    }

    const aiResponse = parsedResponse.texto || aiResponseRaw;
    const fanInfoDetected = parsedResponse.fan_info_detected || {};

    // Check detected info
    const hasDetectedInfo = (fanInfoDetected.name && fanInfoDetected.name.length > 1) ||
                           (fanInfoDetected.age && fanInfoDetected.age >= 18) ||
                           (fanInfoDetected.location && fanInfoDetected.location.length > 2) ||
                           (fanInfoDetected.occupation && fanInfoDetected.occupation.length > 2) ||
                           (fanInfoDetected.interests && fanInfoDetected.interests.length > 2);

    const isCustomRequest = msgLower.includes('custom') || msgLower.includes('personalizado');

    return new Response(JSON.stringify({
      success: true,
      response: {
        texto: aiResponse,
        accion: isCustomRequest ? 'CUSTOM_REQUEST' : 
                (recentTip && requestingContent) ? 'ENVIAR_DESBLOQUEADO' :
                (matchedContent && canOfferContent) ? 'CONTENIDO_SUGERIDO' : 'SOLO_TEXTO',
        contexto: {
          fan_tier: fanData.tier,
          spent_total: fanData.spent_total,
          fan_energy: fanEnergy,
          message_count: messageCount,
          conversation_mode: conversationMode,
          can_offer_content: canOfferContent,
          recent_tip: recentTip ? { amount: recentTip.amount } : null
        },
        contenido_sugerido: (matchedContent && canOfferContent) ? {
          offer_id: matchedContent.offer_id,
          title: matchedContent.title,
          price: matchedContent.base_price,
          description: matchedContent.description,
          nivel: matchedContent.nivel,
          tags: matchedContent.tags
        } : null,
        fan_info_detected: hasDetectedInfo ? {
          name: fanInfoDetected.name || null,
          age: fanInfoDetected.age || null,
          location: fanInfoDetected.location || null,
          occupation: fanInfoDetected.occupation || null,
          interests: fanInfoDetected.interests || null
        } : null,
        instrucciones_chatter: (matchedContent && canOfferContent) ? 
          `📦 Bot suggested ${matchedContent.offer_id} ($${matchedContent.base_price}). Upload LOCKED` :
          conversationMode === 'connection_building' ?
          '💬 Building connection - bot will not offer content yet' :
          '💬 Normal conversation'
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
