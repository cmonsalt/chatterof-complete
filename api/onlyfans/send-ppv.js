import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      fan_id,
      model_id,
      catalog_id,
      session_id,
      part_number,
      of_media_ids,
      price,
      custom_message,
      content_type,
      title
    } = req.body;

    console.log('📥 PPV Request:', { fan_id, model_id, catalog_id, price });

    // Validar campos requeridos
    if (!fan_id || !model_id || !catalog_id || !of_media_ids || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields'
      });
    }

    if (!Array.isArray(of_media_ids) || of_media_ids.length === 0) {
      return res.status(400).json({ 
        error: 'of_media_ids must be a non-empty array'
      });
    }

    const API_KEY = process.env.ONLYFANS_API_KEY;

    // 1. Obtener of_account_id de la tabla models
    const { data: modelData, error: modelError } = await supabase
      .from('models')
      .select('of_account_id')
      .eq('model_id', model_id)
      .single();

    console.log('🔍 Model lookup:', { found: !!modelData, error: modelError });

    if (modelError || !modelData?.of_account_id) {
      console.error('❌ Model not found');
      return res.status(404).json({ 
        error: 'Model OnlyFans account not found',
        model_id
      });
    }

    const accountId = modelData.of_account_id;
    console.log('✅ Account ID found:', accountId);

    // 2. Construir el mensaje
    const messageText = custom_message 
      ? (custom_message.startsWith('<p>') ? custom_message : `<p>${custom_message}</p>`)
      : `<p>💎 ${title}</p>`;

    // 3. Preparar payload
    const payload = {
      text: messageText,
      mediaFiles: of_media_ids,
      price: price
    };

    console.log('📤 Sending to OnlyFans:', {
      url: `https://app.onlyfansapi.com/api/${accountId}/chats/${fan_id}/messages`,
      media_count: of_media_ids.length,
      price
    });

    // 4. Enviar a OnlyFans API
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats/${fan_id}/messages`,
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
    console.log('📨 OnlyFans response:', { 
      status: response.status, 
      body: responseText.substring(0, 200) 
    });

    if (!response.ok) {
      console.error('❌ OnlyFans API error');
      return res.status(500).json({ 
        error: 'Failed to send PPV to OnlyFans',
        status: response.status,
        details: responseText
      });
    }

    const ofResult = JSON.parse(responseText);
    console.log('✅ PPV sent successfully');

    // 5. Guardar en content_offers
    const { error: offerError } = await supabase
      .from('content_offers')
      .insert({
        fan_id,
        model_id,
        catalog_id,
        session_id: session_id || null,
        step_number: part_number || null,
        offered_at: new Date().toISOString(),
        offer_method: 'manual_send',
        offer_price: price,
        status: 'pending',
        of_message_id: ofResult.id?.toString() || null,
        custom_message: custom_message
      });

    if (offerError) {
      console.error('⚠️ Tracking error:', offerError);
    }

    // 6. Guardar en chat
    const { error: chatError } = await supabase
      .from('chat')
      .insert({
        of_message_id: ofResult.id?.toString(),
        fan_id,
        model_id,
        message: messageText.replace(/<[^>]*>/g, ''),
        ts: new Date().toISOString(),
        from: 'model',
        read: false,
        is_ppv: true,
        ppv_price: price,
        ppv_catalog_id: catalog_id
      });

    if (chatError) {
      console.error('⚠️ Chat save error:', chatError);
    }

    return res.status(200).json({
      success: true,
      message: 'PPV sent successfully',
      of_message_id: ofResult.id,
      price,
      fan_id
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      error: error.message
    });
  }
}
