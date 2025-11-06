import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const API_KEY = process.env.ONLYFANS_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accountId, modelId } = req.body

    if (!accountId || !modelId) {
      return res.status(400).json({ error: 'Missing accountId or modelId' })
    }

    console.log(`🔍 Checking notifications for account: ${accountId}`)

    // Get notifications from OnlyFans API
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/notifications/list`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`OnlyFans API error: ${response.status}`)
    }

    const data = await response.json()
    const notifications = data.data?.list || []

    console.log(`📬 Found ${notifications.length} notifications`)

    let likesProcessed = 0
    
    // Get last check time from DB
    const { data: lastCheck } = await supabase
      .from('models')
      .select('last_notification_check')
      .eq('model_id', modelId)
      .single()

    const lastCheckTime = lastCheck?.last_notification_check 
      ? new Date(lastCheck.last_notification_check)
      : new Date(Date.now() - 5 * 60 * 1000) // Default: last 5 minutes

    // Process notifications
    for (const notif of notifications) {
      const notifDate = new Date(notif.createdAt || notif.created_at)
      
      // Skip if already processed
      if (notifDate <= lastCheckTime) continue

      // Check if it's a like notification
      const isLike = (
        notif.type === 'like' || 
        notif.type === 'post_like' ||
        notif.action === 'like' ||
        notif.text?.toLowerCase().includes('liked your')
      )

      if (isLike) {
        console.log(`❤️ Found like notification:`, notif)

        const fanId = notif.user?.id?.toString() || notif.fromUser?.id?.toString()
        const fanName = notif.user?.name || notif.fromUser?.name || 'Un fan'
        
        if (fanId) {
          // Create notification in our DB
          await supabase
            .from('notifications')
            .insert({
              model_id: modelId,
              fan_id: fanId,
              type: 'new_like',
              title: `${fanName} le dio ❤️ a tu post`,
              message: notif.text?.slice(0, 100) || 'Le gustó tu contenido',
              amount: 0,
              metadata: {
                post_id: notif.post?.id || notif.postId,
                notification_id: notif.id
              }
            })

          likesProcessed++
          console.log(`✅ Created like notification from ${fanName}`)
        }
      }
    }

    // Update last check time
    await supabase
      .from('models')
      .update({ last_notification_check: new Date().toISOString() })
      .eq('model_id', modelId)

    console.log(`✅ Processed ${likesProcessed} likes`)

    return res.status(200).json({
      success: true,
      notificationsChecked: notifications.length,
      likesProcessed
    })

  } catch (error) {
    console.error('💥 Error checking notifications:', error)
    return res.status(500).json({ error: error.message })
  }
}
