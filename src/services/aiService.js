// AI Service - Mock only

export async function generateAISuggestion(fanData, chatHistory, catalogParts) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return generateMockSuggestion(fanData, catalogParts);
}

function generateMockSuggestion(fanData, catalogParts) {
  const suggestions = {
    0: {
      message: "Hey love! 😘 I was just thinking about you... How's your day going?",
      lockedText: "Unlock to see what I've been up to 💦",
      partIndex: 0
    },
    1: {
      message: "Baby! 🔥 I just finished my yoga session and you were on my mind the whole time... Want to see?",
      lockedText: "Unlock to watch me stretch 🧘‍♀️💕",
      partIndex: 1
    },
    2: {
      message: "Hey handsome 😍 I have something SPECIAL just for you... You're gonna love this",
      lockedText: "Unlock for exclusive content 🔥💦",
      partIndex: 2
    }
  };

  const suggestion = suggestions[fanData.tier] || suggestions[0];
  
  let recommendedPPV = null;
  if (catalogParts && catalogParts.length > 0) {
    const firstSession = catalogParts[0];
    if (firstSession && firstSession.parts) {
      recommendedPPV = firstSession.parts[suggestion.partIndex] || firstSession.parts[0];
    }
  }

  return {
    message: suggestion.message,
    lockedText: suggestion.lockedText,
    recommendedPPV: recommendedPPV,
    reasoning: `Mock suggestion for ${fanData.tier_name || 'FREE'} tier`
  };
}