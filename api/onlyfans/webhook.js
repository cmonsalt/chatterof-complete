// 🔥 ACTUALIZACIÓN WEBHOOK - Solo la sección que necesitas cambiar
// Ubicación: webhook.js (REEMPLAZAR la función handleMessage líneas 141-230)

// ✅ REEMPLAZA LA FUNCIÓN handleMessage COMPLETA con esta:

async function handleMessage(data, modelId) {
  try {
    const fanId = data.fromUser?.id?.toString() || data.user?.id?.toString()
    
    if (!fanId) {
      console.log('⚠️ No fanId found')
      return
    }

    // 🔥 NO GUARDAR mensajes del vault fan en catalog automáticamente
    // El vault fan ya NO se usa para subir contenido
    // Ahora el contenido se sube directamente con upload-to-vault.js

    // Solo guardar mensaje normal en chat
    const cleanText = cleanHTML(data.text || '')
    
    let mediaUrl = null
    let mediaThumb = null
    let mediaType = null
    
    if (data.media && data.media.length > 0) {
      const firstMedia = data.media[0]
      mediaUrl = firstMedia.files?.full?.url || firstMedia.url
      mediaThumb = firstMedia.files?.thumb?.url || firstMedia.thumb
      mediaType = firstMedia.type
    }
    
    // Determinar si es tip (tiene price > 0 sin ser PPV unlock)
    const isTip = data.price > 0 && !data.isOpened
    const isMessage = data.text || data.media?.length > 0
    
    if (isMessage) {
      const messageData = {
        of_message_id: data.id?.toString(),
        fan_id: fanId,
        model_id: modelId,
        message: cleanText,
        timestamp: data.createdAt || new Date().toISOString(),
        from: data.fromUser ? 'fan' : 'model',
        read: false,
        source: 'webhook',
        media_url: mediaUrl,
        media_thumb: mediaThumb,
        media_type: mediaType,
        amount: isTip ? data.price : 0,
        is_ppv: false,
        ppv_price: 0
      }
      
      const { error: chatError } = await supabase
        .from('chat')
        .upsert(messageData, { onConflict: 'of_message_id' })
      
      if (chatError) {
        console.error('❌ Chat save error:', chatError)
      } else {
        console.log('✅ Message saved to chat')
      }
    }
    
    // Si es tip, crear notificación
    if (isTip) {
      await createNotification(
        modelId,
        fanId,
        'new_tip',
        'New Tip Received! 💰',
        `You received a $${data.price} tip!`,
        data.price,
        { message_id: data.id }
      )
      
      // Actualizar spent_total del fan
      await supabase.rpc('increment_fan_spent', {
        p_fan_id: fanId,
        p_model_id: modelId,
        p_amount: data.price
      })
    }
    
    // Si es mensaje del fan, crear notificación
    if (data.fromUser && isMessage) {
      await createNotification(
        modelId,
        fanId,
        'new_message',
        'New Message 💬',
        cleanText.substring(0, 100) || 'New media message',
        null,
        { message_id: data.id }
      )
    }
    
  } catch (error) {
    console.error('❌ Error in handleMessage:', error)
  }
}

// ✅ El resto del webhook.js permanece igual
