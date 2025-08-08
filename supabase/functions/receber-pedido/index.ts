import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_name, user_email } = await req.json()
    if (!client_name || !user_email) {
      throw new Error("Nome da empresa e e-mail são obrigatórios.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('MY_SERVICE_KEY')!
    )

    const { error } = await supabaseAdmin
      .from('pending_signups')
      .insert({ client_name, user_email })

    if (error) {
      if (error.code === '23505') { 
        throw new Error('Este e-mail já foi utilizado para uma solicitação.');
      }
      throw error;
    }

    return new Response(JSON.stringify({ success: true, message: "Solicitação recebida com sucesso." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})