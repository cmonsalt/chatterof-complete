export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, chatId } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !chatId) {
    return res.status(400).json({ error: 'accountId and chatId required' });
  }

  try {
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/typing`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Typing indicator error:', error);
    res.status(500).json({ error: error.message });
  }
}
