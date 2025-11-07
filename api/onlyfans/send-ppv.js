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

    // Validar campos requeridos
    if (!fan_id || !model_id || !catalog_id || !of_media_ids || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['fan_id', 'model_id', 'catalog_id', 'of_media_ids', 'price']
      });
    }

    const API_KEY = process.env.ONLYFANS_API_KEY;

    // 1. Obtener account_id del model
    const { data: accountData, error: accountError } = await supabase
      .from('onlyfans_accounts')
      .select('account_id')
      .eq('model_id', model_id)
      .single();

    if (accountError || !accountData?.account_id) {
      return res.status(404).json({ error: 'Model OnlyFans account not found' });
    }

    // 2. Construir el mensaje
    const messageText = custom_message 
      ? `<p>${custom_message}</p>` 
      : `<p>💎 ${title}</p>`;

    // 3. Preparar payload para OnlyFans API
    const payload = {
      text: messageText,
      mediaFiles: of_media_ids, // Array de IDs directamente
      price: price // Ya en dólares, el API wrapper lo maneja
    };

    console.log('📤 Sending PPV:', {
      account_id: accountData.account_id,
      fan_id,
      price,
      media_count: of_media_ids.length
    });

    // 4. Enviar a OnlyFans API
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountData.account_id}/chats/${fan_id}/messages`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OnlyFans API error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to send PPV to OnlyFans',
        details: errorText
      });
    }

    const ofResult = await response.json();
    console.log('✅ OnlyFans response:', ofResult);

    // 5. Guardar en content_offers (tracking)
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
      console.error('⚠️ Error saving offer:', offerError);
      // No bloqueamos el envío si falla el tracking
    }

    // 6. Guardar mensaje en chat table
    const { error: chatError } = await supabase
      .from('chat')
      .insert({
        of_message_id: ofResult.id?.toString(),
        fan_id,
        model_id,
        message: messageText.replace(/<[^>]*>/g, ''), // Quitar HTML
        ts: new Date().toISOString(),
        from: 'model',
        read: false,
        is_ppv: true,
        ppv_price: price,
        ppv_catalog_id: catalog_id,
        media_url: of_media_ids[0] || null
      });

    if (chatError) {
      console.error('⚠️ Error saving chat:', chatError);
    }

    return res.status(200).json({
      success: true,
      message: 'PPV sent successfully',
      of_message_id: ofResult.id,
      price,
      fan_id
    });

  } catch (error) {
    console.error('❌ Error in send-ppv:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
