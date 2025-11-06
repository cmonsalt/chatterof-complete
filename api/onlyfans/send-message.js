import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, chatId, text, mediaFiles, price } = req.body
  const API_KEY = process.env.ONLYFANS_API_KEY

  if (!accountId || !chatId || !text) {
    return res.status(400).json({ error: 'accountId, chatId, and text required' })
  }

  try {
    console.log('📤 Sending message to OF:', { accountId, chatId, textLength: text.length })

    // Formatear texto con HTML básico
    const formattedText = text.startsWith('<p>') ? text : `<p>${text}</p>`

    const payload = {
      text: formattedText,
      ...(mediaFiles && mediaFiles.length > 0 && { mediaFiles }),
      ...(price && price > 0 && { price })
    }

    // Enviar a OnlyFans
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
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ OF API Error:', error)
      throw new Error(error.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ Message sent to OF:', data.id)

    // Guardar en BD - Webhook lo hará también, pero guardamos por si acaso
    try {
      const messageData = {
        of_message_id: data.id?.toString(),
        fan_id: chatId,
        message: text,
        ts: new Date().toISOString(),
        from: 'model',
        message_type: mediaFiles && mediaFiles.length > 0 ? 'media' : 'text',
        media_url: mediaFiles?.[0]?.url || null,
        amount: price || 0,
        model_id: accountId,
        source: 'manual',
        is_locked: price > 0,
        is_purchased: false,
        read: true
      }

      console.log('💾 Attempting to save to DB:', messageData)

      const { data: insertedData, error: dbError } = await supabase
        .from('chat')
        .insert(messageData)
        .select()

      if (dbError) {
        console.error('❌ DB Error:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint
        })
        
        // No fallar, webhook lo guardará
        return res.status(200).json({ 
          success: true, 
          messageId: data.id,
          savedToDb: false,
          dbError: dbError.message,
          note: 'Message sent but not saved. Webhook will handle it.'
        })
      }

      console.log('✅ Saved to DB:', insertedData)

      return res.status(200).json({ 
        success: true, 
        messageId: data.id,
        savedToDb: true,
        dbData: insertedData
      })

    } catch (dbError) {
      console.error('💥 DB Exception:', dbError)
      
      // Mensaje enviado exitosamente, solo falló el guardado
      return res.status(200).json({ 
        success: true, 
        messageId: data.id,
        savedToDb: false,
        error: dbError.message,
        note: 'Message sent successfully. DB save failed but webhook will handle it.'
      })
    }

  } catch (error) {
    console.error('💥 Send message error:', error)
    return res.status(500).json({ error: error.message })
  }
}
