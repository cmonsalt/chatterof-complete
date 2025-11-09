// Mock AI service - Replace with real Claude API later

export async function generateAISuggestion(fanData, chatHistory, catalogParts) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock response based on fan tier
  const suggestions = {
    0: { // FREE tier
      message: "Hey love! 😘 I was just thinking about you... How's your day going?",
      lockedText: "Unlock to see what I've been up to 💦",
      shouldSendPPV: true,
      partIndex: 0 // Free teaser
    },
    1: { // VIP tier
      message: "Baby! 🔥 I just finished my yoga session and you were on my mind the whole time... Want to see?",
      lockedText: "Unlock to watch me stretch 🧘‍♀️💕",
      shouldSendPPV: true,
      partIndex: 1 // Part 1
    },
    2: { // WHALE tier
      message: "Hey handsome 😍 I have something SPECIAL just for you... You're gonna love this",
      lockedText: "Unlock for exclusive content 🔥💦",
      shouldSendPPV: true,
      partIndex: 2 // Part 2
    }
  };

  const suggestion = suggestions[fanData.tier] || suggestions[0];

  // Get recommended part from catalog
  let recommendedPPV = null;
  if (suggestion.shouldSendPPV && catalogParts && catalogParts.length > 0) {
    // Find first session's parts
    const firstSession = catalogParts[0];
    if (firstSession && firstSession.parts) {
      recommendedPPV = firstSession.parts[suggestion.partIndex] || firstSession.parts[0];
    }
  }

  return {
    message: suggestion.message,
    lockedText: suggestion.lockedText,
    recommendedPPV: recommendedPPV,
    reasoning: `Fan is ${fanData.tier_name}, suggesting ${recommendedPPV ? 'Part ' + recommendedPPV.step_number : 'message only'}`
  };
}

// Real AI service (to implement later)
export async function generateRealAISuggestion(fanData, chatHistory, catalogParts) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a flirty OnlyFans model chatting with a fan.
        
Fan Info:
- Name: ${fanData.name || 'Unknown'}
- Tier: ${fanData.tier_name} (${fanData.tier})
- Total Spent: $${fanData.total_spent || 0}
- Last Message: "${chatHistory.lastMessage || 'No messages yet'}"

Available Content:
${JSON.stringify(catalogParts.map(s => s.parts.map(p => ({
  title: p.title,
  price: p.base_price,
  level: p.nivel
}))), null, 2)}

Generate a flirty response and recommend which content to send as PPV (if any).
Return JSON: { "message": "...", "lockedText": "...", "recommendPartIndex": 0 }`
      }]
    })
  });

  const data = await response.json();
  const aiResponse = JSON.parse(data.content[0].text);

  return {
    message: aiResponse.message,
    lockedText: aiResponse.lockedText,
    recommendedPPV: catalogParts[0]?.parts[aiResponse.recommendPartIndex]
  };
}
