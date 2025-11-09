import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { model_id } = req.body

  if (!model_id) {
    return res.status(400).json({ error: 'model_id required' })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    // Obtener o crear límite
    let { data: limit, error: fetchError } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('model_id', model_id)
      .single()

    // Si no existe, crear
    if (fetchError && fetchError.code === 'PGRST116') {
      const { data: newLimit, error: insertError } = await supabase
        .from('usage_limits')
        .insert({ 
          model_id, 
          messages_limit: 500,
          messages_today: 0 
        })
        .select()
        .single()

      if (insertError) throw insertError
      limit = newLimit
    } else if (fetchError) {
      throw fetchError
    }

    // Verificar si pasaron 24h y resetear contador
    const now = new Date()
    const lastReset = new Date(limit.last_reset)
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60)

    if (hoursSinceReset >= 24) {
      const { error: resetError } = await supabase
        .from('usage_limits')
        .update({ 
          messages_today: 0, 
          last_reset: now.toISOString() 
        })
        .eq('model_id', model_id)

      if (resetError) throw resetError
      limit.messages_today = 0
    }

    // Verificar si alcanzó el límite
    if (limit.messages_today >= limit.messages_limit) {
      return res.status(429).json({ 
        error: 'Daily AI limit reached',
        limit: limit.messages_limit,
        used: limit.messages_today,
        reset_in_hours: Math.ceil(24 - hoursSinceReset)
      })
    }

    // Incrementar contador
    const { error: updateError } = await supabase
      .from('usage_limits')
      .update({ messages_today: limit.messages_today + 1 })
      .eq('model_id', model_id)

    if (updateError) throw updateError

    return res.json({ 
      ok: true, 
      remaining: limit.messages_limit - limit.messages_today - 1,
      limit: limit.messages_limit
    })

  } catch (error) {
    console.error('Error checking AI limit:', error)
    return res.status(500).json({ error: error.message })
  }
}
