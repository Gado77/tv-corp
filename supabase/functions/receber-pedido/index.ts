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
    const trimmedEmail = user_email.trim();

    if (!client_name || !trimmedEmail) {
      throw new Error("Nome da empresa e e-mail são obrigatórios.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // --- LÓGICA DE VERIFICAÇÃO FINAL E CORRIGIDA ---

    // 1. Pega a lista de TODOS os usuários
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
        throw listError;
    }

    // 2. Procura manualmente na lista pelo e-mail exato.
    const existingUser = users.find(user => user.email === trimmedEmail);

    // 3. Se um usuário com o e-mail exato foi encontrado, lança o erro.
    if (existingUser) {
        throw new Error("Este e-mail já está cadastrado no sistema. Se você esqueceu sua senha, use a opção 'Esqueci minha senha' na tela de login.");
    }
    
    // --- FIM DA CORREÇÃO ---

    // 4. Se o e-mail é novo, prossegue com a criação da solicitação
    const { error: insertError } = await supabaseAdmin
      .from('pending_signups')
      .insert({ client_name: client_name, user_email: trimmedEmail })

    if (insertError) {
      if (insertError.code === '23505') { 
        throw new Error('Este e-mail já foi utilizado para uma solicitação e aguarda aprovação.');
      }
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, message: "Solicitação recebida com sucesso." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Erro na função receber-pedido:', err.message);
    return new Response(JSON.stringify({ message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})