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
    const { client_name, user_email, password } = await req.json()
    if (!client_name || !user_email || !password) {
      throw new Error("Nome, e-mail e senha são obrigatórios.")
    }
    if (password.length < 6) {
      throw new Error("A senha precisa ter no mínimo 6 caracteres.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // --- MELHORIA: VERIFICA SE O UTILIZADOR JÁ EXISTE ---
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(user => user.email === user_email);
    if (existingUser) {
        throw new Error("Este e-mail já está cadastrado no sistema.");
    }
    // --- FIM DA MELHORIA ---

    // Insere o pedido na tabela de pendentes
    const { error } = await supabaseAdmin
      .from('pending_signups')
      .insert({ 
        client_name: client_name, 
        user_email: user_email,
        password_temp: password
      })

    if (error) {
      if (error.code === '23505') { 
        throw new Error('Este e-mail já foi utilizado para uma solicitação e aguarda aprovação.');
      }
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
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