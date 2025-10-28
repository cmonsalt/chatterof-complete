import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, role, model_id, model_name } = await req.json()

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Crear usuario
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    const user = authData.user

    // Si es cliente, crear modelo
    if (role === 'client' && model_name) {
      const model_id_generated = `m${Date.now()}`
      
      await supabaseAdmin
        .from('models')
        .insert({
          model_id: model_id_generated,
          name: model_name,
          owner_id: user.id,
          age: 25,
          niche: 'fitness'
        })

      // Asignar rol de cliente
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'client',
          model_id: model_id_generated
        })

      // Crear config por defecto
      await supabaseAdmin
        .from('model_configs')
        .insert({
          model_id: model_id_generated,
          personality: 'Friendly and engaging',
          tone: 'casual',
          language_code: 'en',
          sales_approach: 'conversational_organic',
          max_emojis_per_message: 2
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          user,
          model_id: model_id_generated 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Si es chatter, asignar a modelo
    if (role === 'chatter' && model_id) {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'chatter',
          model_id: model_id
        })
    }

    return new Response(
      JSON.stringify({ success: true, user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})