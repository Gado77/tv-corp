// supabase/functions/aprovar-cadastro/index.ts

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
    const { pending_id } = await req.json();
    if (!pending_id) throw new Error("O ID do pedido pendente é obrigatório.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Busca os dados pendentes
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from('pending_signups')
      .select('client_name, user_email, password_temp')
      .eq('id', pending_id)
      .single();
    if (pendingError) throw new Error(`Erro ao buscar pedido: ${pendingError.message}`);
    if (!pendingData) throw new Error(`Pedido pendente não encontrado.`);

    // 2. Cria o cliente
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({ name: pendingData.client_name })
      .select('id')
      .single();
    if (clientError) throw new Error(`Erro ao criar cliente: ${clientError.message}`);
    const newClientId = clientData.id;

    // 3. Cria o utilizador no Auth
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingData.user_email,
        password: pendingData.password_temp,
        email_confirm: true,
        user_metadata: { client_id: newClientId }
    });
    if (authError) {
      await supabaseAdmin.from('clients').delete().eq('id', newClientId);
      throw new Error(`Erro ao criar utilizador: ${authError.message}`);
    }

    // 4. Cria as configurações
    await supabaseAdmin.from('settings').insert({ client_id: newClientId });

    // 5. Apaga o pedido pendente
    await supabaseAdmin.from('pending_signups').delete().eq('id', pending_id);
    
    // 6. CORREÇÃO: Envia o e-mail de boas-vindas usando generateLink
    const loginUrl = (Deno.env.get('SITE_URL') || `https://hsimportssj.com`) + '/src/features/auth/auth.html';
    await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink', // Envia um link de login direto
        email: pendingData.user_email,
        options: {
            redirectTo: loginUrl
        }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Erro na função aprovar-cadastro:", err.message);
    return new Response(JSON.stringify({ message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});