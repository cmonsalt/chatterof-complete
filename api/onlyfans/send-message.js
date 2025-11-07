import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    accountId, 
    modelId, 
    chatId, 
    text, 
    mediaFiles, 
    price,
    replyToMessageId,
    replyToText
  } = req.body;
  
  const API_KEY = process.env.ONLYFANS_API_KEY;

  console.log('📥 Send message request:', { 
    accountId, 
    chatId, 
    text: text?.substring(0, 50), 
    price, 
    mediaFiles,
    hasMedia: mediaFiles?.length > 0
  });

  if (!accountId || !modelId || !chatId || !text) {
    return res.status(400).json({ 
      error: 'accountId, modelId, chatId, and text required' 
    });
  }

  if (price && price > 0 && (!mediaFiles || mediaFiles.length === 0)) {
    return res.status(400).json({
      error: 'PPV messages must include media files'
    });
  }

  try {
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`;

    const payload = {
      text: formattedText,
      ...(mediaFiles && mediaFiles.length > 0 && { mediaFiles }),
      ...(price && price > 0 && { price })
    };

    console.log('📦 Full payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const responseText = await response.text();
    console.log('📨 OnlyFans response:', { status: response.status, body: responseText.substring(0, 200) });

    if (!response.ok) {
      const error = JSON.parse(responseText);
      console.error('❌ OnlyFans error:', error);
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = JSON.parse(responseText);

    let mediaType = null;
    if (mediaFiles && mediaFiles.length > 0) {
      const firstMedia = mediaFiles[0];
      if (typeof firstMedia === 'string') {
        if (firstMedia.includes('.mp4') || firstMedia.includes('video')) {
          mediaType = 'video';
        } else if (firstMedia.includes('.gif')) {
          mediaType = 'gif';
        } else {
          mediaType = 'photo';
        }
      }
    }

    const { error: dbError } = await supabase.from('chat').insert({
      of_message_id: data.id?.toString(),
      fan_id: chatId,
      model_id: modelId,
      message: text,
      ts: new Date().toISOString(),
      from: 'model',
      read: false,
      amount: price || null,
      media_url: mediaFiles?.[0] || null,
      media_type: mediaType,
      reply_to_message_id: replyToMessageId || null,
      reply_to_text: replyToText || null
    });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw new Error('Failed to save message to database');
    }

    console.log('✅ Message sent successfully');

    res.status(200).json({ 
      success: true, 
      message: data 
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ error: error.message });
  }
}
