// Crear: api/onlyfans/typing-indicator.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, chatId } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !chatId) {
    return res.status(400).json({ 
      error: 'accountId and chatId required' 
    });
  }

  try {
    // Enviar typing indicator a OnlyFans
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/typing`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.warn('⚠️ Typing indicator failed (non-critical)');
      return res.status(200).json({ success: false });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Typing indicator error:', error);
    // No fallar - typing indicator no es crítico
    return res.status(200).json({ success: false });
  }
}
