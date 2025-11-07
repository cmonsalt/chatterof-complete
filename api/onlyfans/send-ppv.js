import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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
      content_type, // 'session' or 'single'
      title
    } = req.body

    // Validar campos requeridos
    if (!fan_id || !model_id || !catalog_id || !of_media_ids || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['fan_id', 'model_id', 'catalog_id', 'of_media_ids', 'price']
      })
    }

    // 1. Obtener auth del model desde DB
    const { data: modelData, error: modelError } = await supabase
      .from('onlyfans_accounts')
      .select('auth_id, user_agent, x_bc')
      .eq('model_id', model_id)
      .single()

    if (modelError || !modelData) {
      return res.status(404).json({ error: 'Model OnlyFans account not found' })
    }

    // 2. Obtener fan_of_id (el ID del fan en OnlyFans)
    const { data: fanData, error: fanError } = await supabase
      .from('fans')
      .select('of_fan_id')
      .eq('fan_id', fan_id)
      .eq('model_id', model_id)
      .single()

    if (fanError || !fanData?.of_fan_id) {
      return res.status(404).json({ error: 'Fan OnlyFans ID not found' })
    }

    // 3. Construir el mensaje
    const messageText = custom_message || `💎 ${title}`

    // 4. Enviar PPV a OnlyFans
    const ofResponse = await fetch(`https://onlyfans.com/api2/v2/chats/${fanData.of_fan_id}/messages`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': modelData.user_agent,
        'Cookie': `auth_id=${modelData.auth_id}; auth_uid_=${fanData.of_fan_id}`,
        'x-bc': modelData.x_bc
      },
      body: JSON.stringify({
        text: messageText,
        price: price * 100, // OnlyFans usa centavos
        lockedText: true,
        mediaIds: of_media_ids,
        mediaFiles: of_media_ids.map(id => ({
          id: id,
          type: 'photo' // o 'video', por ahora asumimos que el vault tiene esa info
        }))
      })
    })

    if (!ofResponse.ok) {
      const errorText = await ofResponse.text()
      console.error('OnlyFans API error:', errorText)
      return res.status(500).json({ 
        error: 'Failed to send PPV to OnlyFans',
        details: errorText
      })
    }

    const ofResult = await ofResponse.json()

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
        of_message_id: ofResult.id || null,
        custom_message: custom_message
      })

    if (offerError) {
      console.error('Error saving offer:', offerError)
      // No bloqueamos el envío si falla el tracking
    }

    // 6. Guardar mensaje en chat table
    const { error: chatError } = await supabase
      .from('chat')
      .insert({
        fan_id,
        model_id,
        from: 'model',
        text: messageText,
        ts: new Date().toISOString(),
        read: false,
        is_ppv: true,
        ppv_price: price,
        ppv_catalog_id: catalog_id
      })

    if (chatError) {
      console.error('Error saving chat:', chatError)
    }

    return res.status(200).json({
      success: true,
      message: 'PPV sent successfully',
      of_message_id: ofResult.id,
      price,
      fan_id
    })

  } catch (error) {
    console.error('Error in send-ppv:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
