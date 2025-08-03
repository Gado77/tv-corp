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
    const { pending_id } = await req.json()
    if (!pending_id) {
      throw new Error("O ID do pedido pendente é obrigatório.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // --- LÓGICA CORRIGIDA E REORDENADA ---

    // 1. Busca os dados do pedido pendente
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from('pending_signups')
      .select('client_name, user_email')
      .eq('id', pending_id)
      .eq('status', 'pending')
      .single();

    if (pendingError || !pendingData) {
        throw new Error(`Pedido pendente com ID ${pending_id} não encontrado ou já aprovado.`);
    }

    // 2. Cria o registro do cliente PRIMEIRO para obter o seu ID
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({ name: pendingData.client_name })
      .select('id')
      .single();

    if (clientError) {
        throw new Error(`Erro ao criar o registro do cliente: ${clientError.message}`);
    }
    const newClientId = clientData.id;

    // 3. Cria uma linha de configurações padrão para o novo cliente
    await supabaseAdmin.from('settings').insert({ client_id: newClientId });
    
    // 4. Cria o novo usuário no sistema de autenticação
    const { error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingData.user_email,
        // CORREÇÃO 1: Adiciona uma senha temporária, longa e aleatória.
        // O cliente nunca usará esta senha, ele irá redefini-la.
        password: crypto.randomUUID(), 
        email_confirm: true,
        // CORREÇÃO 2: Adiciona o 'client_id' nos metadados do usuário.
        // Isto é CRUCIAL para que o resto da aplicação funcione.
        user_metadata: {
            client_id: newClientId
        }
    });

    if (userError) {
        // Se a criação do usuário falhar, remove o cliente que foi criado para não deixar lixo.
        await supabaseAdmin.from('clients').delete().eq('id', newClientId);
        throw new Error(`Erro ao criar usuário: ${userError.message}`);
    }

    // 5. Marca o pedido como 'approved'
    await supabaseAdmin
      .from('pending_signups')
      .update({ status: 'approved' })
      .eq('id', pending_id);

    // --- FIM DA LÓGICA CORRIGIDA ---

    return new Response(JSON.stringify({ success: true, message: "Cliente aprovado e usuário criado. O cliente agora pode usar 'Esqueci minha senha' para logar." }), {
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