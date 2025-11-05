import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function cleanHTML(text) {
  if (!text) return ''
  return text
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { accountId, modelId, offset = 0 } = req.body
  const messagesLimit = 20 // Últimos 20 mensajes por chat

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' })
  }

  try {
    const API_KEY = process.env.ONLYFANS_API_KEY

    if (!API_KEY) {
      throw new Error('ONLYFANS_API_KEY not configured')
    }

    let syncedMessages = 0
    let totalChats = 0
    const chatsLimit = 10 // Solo 10 chats por llamada
    let creditsUsed = 0

    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/chats?limit=${chatsLimit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      
      // If auth error, mark as disconnected
      if (response.status === 401 || response.status === 403) {
        await supabase
          .from('models')
          .update({ connection_status: 'disconnected' })
          .eq('model_id', modelId)
        
        return res.status(401).json({
          error: 'Authentication failed',
          needsReauth: true,
          message: 'Account needs re-authorization'
        })
      }
      
      throw new Error(`OnlyFans API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    
    const chats = responseData.data || []
    const hasMore = responseData._pagination?.next_page ? true : false
    totalChats = chats.length
    creditsUsed = responseData._meta?._credits?.used || 1

    console.log('='.repeat(80))
    console.log('[DEBUG] SYNC CHATS - API RESPONSE')
    console.log('='.repeat(80))
    console.log(`Fetched: ${chats.length} chats`)
    console.log(`HasMore: ${hasMore}`)
    console.log(`Offset: ${offset}`)
    console.log(`Credits: ${creditsUsed}`)
    console.log('-'.repeat(80))

    // Log SAMPLE CHAT
    if (chats.length > 0) {
      const sampleChat = chats[0]
      console.log('💬 SAMPLE CHAT DATA (COMPLETE JSON):')
      console.log(JSON.stringify(sampleChat, null, 2))
      console.log('-'.repeat(80))
    }

    for (const chat of chats) {
      const fanData = chat.fan
      const fanId = fanData?.id?.toString()
      
      if (!fanId) {
        console.log('⚠️ Skipping chat without fanId')
        continue
      }

      console.log(`\n📋 Processing chat for fan: ${fanId}`)

      const subData = fanData.subscribedOnData
      const lastSubscribe = subData?.subscribes?.[0]

      // Ensure fan exists
      await supabase.from('fans').upsert({
        fan_id: fanId,
        name: fanData.name || fanData.username || 'Unknown',
        model_id: modelId,
        of_username: fanData.username,
        of_avatar_url: fanData.avatar,
        last_message_date: chat.lastMessage?.createdAt,
        spent_total: parseFloat(subData?.totalSumm || 0),
        subscription_type: lastSubscribe?.type || null,
        subscription_price: parseFloat(lastSubscribe?.price || 0),
        is_renewal_enabled: fanData.subscribedByAutoprolong || false,
        subscription_expires_at: lastSubscribe?.expireDate || null
      }, { onConflict: 'fan_id,model_id' })

      // Fetch messages for this chat
      try {
        console.log(`  📨 Fetching messages for fan ${fanId}...`)
        
        const messagesResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/chats/${fanId}/messages?limit=${messagesLimit}`,
          {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
          }
        )

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          const messages = messagesData.data || []
          creditsUsed += messagesData._meta?._credits?.used || 1

          console.log(`  ✅ Got ${messages.length} messages`)

          // Log SAMPLE MESSAGE (solo del primer chat)
          if (offset === 0 && chat === chats[0] && messages.length > 0) {
            const sampleMsg = messages[0]
            console.log('\n' + '='.repeat(80))
            console.log('📨 SAMPLE MESSAGE DATA (COMPLETE JSON):')
            console.log(JSON.stringify(sampleMsg, null, 2))
            console.log('='.repeat(80) + '\n')
          }

          for (const msg of messages) {
            // Generate of_message_id if null
            const messageId = msg.id?.toString() || `temp_${fanId}_${Date.now()}_${Math.random()}`
            
            const chatData = {
              fan_id: fanId,
              message: cleanHTML(msg.text),
              model_id: modelId,
              timestamp: msg.createdAt || new Date().toISOString(),
              from: msg.isSentByMe ? 'model' : 'fan',
              message_type: msg.mediaCount > 0 ? 'media' : 'text',
              of_message_id: messageId,
              media_url: msg.media?.[0]?.files?.full?.url || msg.media?.[0]?.files?.thumb?.url,
              media_urls: msg.media?.map(m => m.files?.full?.url || m.files?.thumb?.url).filter(Boolean).join(','),
              amount: parseFloat(msg.price || 0),
              read: msg.isOpened || false,
              source: 'api_sync',
              is_locked: !msg.isFree,
              is_purchased: msg.canPurchaseReason === 'purchased' || msg.canPurchaseReason === 'opened' || msg.isFree,
              locked_text: msg.lockedText || false
            }

            console.log(`    - Message ${messageId}: "${chatData.message.substring(0, 50)}..."`)

            const { error } = await supabase
              .from('chat')
              .upsert(chatData, { onConflict: 'of_message_id' })

            if (!error) {
              syncedMessages++
              console.log(`      ✅ Saved`)
            } else {
              console.error(`      ❌ Error:`, error)
            }
          }
        } else {
          console.log(`  ❌ Messages response not OK: ${messagesResponse.status}`)
        }
      } catch (msgError) {
        console.error(`  💥 Error fetching messages for fan ${fanId}:`, msgError)
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log(`✅ SYNC COMPLETE: ${syncedMessages} messages from ${totalChats} chats`)
    console.log('='.repeat(80))

    return res.status(200).json({
      success: true,
      syncedMessages,
      totalChats,
      hasMore,
      nextOffset: hasMore ? offset + chatsLimit : null,
      creditsUsed,
      message: `Synced ${syncedMessages} messages from ${totalChats} chats (${creditsUsed} credits)`
    })

  } catch (error) {
    console.error('💥 Sync chats error:', error)
    return res.status(500).json({
      error: 'Failed to sync chats',
      details: error.message
    })
  }
}
