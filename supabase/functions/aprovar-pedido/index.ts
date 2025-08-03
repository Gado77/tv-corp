import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Lida com a requisição OPTIONS (necessária para CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pending_id } = await req.json()
    if (!pending_id) {
      throw new Error("O ID do pedido pendente é obrigatório.")
    }

    // Cria um cliente Supabase com privilégios de admin DENTRO da função
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // --- INÍCIO DA NOVA LÓGICA ---

    // 1. Busca os dados do pedido pendente e o marca como 'approved'
    const { data: pendingData, error: updateError } = await supabaseAdmin
      .from('pending_signups')
      .update({ status: 'approved' })
      .eq('id', pending_id)
      .eq('status', 'pending') // Garante que só aprovamos pedidos pendentes
      .select()
      .single();

    if (updateError || !pendingData) {
        throw new Error(`Pedido pendente com ID ${pending_id} não encontrado ou já aprovado.`);
    }

    // 2. Cria o novo usuário no sistema de autenticação
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingData.user_email,
        email_confirm: true, // Já marca o e-mail como confirmado
    });

    if (userError) {
        // Se o usuário já existir, podemos tentar pegá-lo, mas por enquanto vamos lançar um erro claro.
        throw new Error(`Erro ao criar usuário: ${userError.message}`);
    }

    const newUserId = userData.user.id;

    // 3. Cria o registro do cliente na tabela 'clients', associando ao novo user_id
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
          name: pendingData.client_name,
          user_id: newUserId
      });

    if (clientError) {
        throw new Error(`Erro ao criar o registro do cliente: ${clientError.message}`);
    }

    // --- FIM DA NOVA LÓGICA ---

    return new Response(JSON.stringify({ success: true, message: "Cliente aprovado e usuário criado com sucesso!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Erro na função aprovar-pedido:', err);
    return new Response(JSON.stringify({ message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})