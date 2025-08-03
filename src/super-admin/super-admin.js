import { supabase } from '../shared/js/supabase-client.js';

// !!!!! IMPORTANTE: COLOQUE O SEU E-MAIL DE SUPER ADMIN AQUI !!!!!
const SUPER_ADMIN_EMAIL = 'vi.emanoel20152015@gmail.com'; 

const logoutBtn = document.getElementById('logout-btn');
const pendingClientsListDiv = document.getElementById('pending-clients-list');

// --- "SENTINELA" REFORÇADA PARA SUPER ADMIN ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    // Se não há sessão OU o e-mail logado NÃO É o do Super Admin, expulsa.
    if (!session || session.user.email !== SUPER_ADMIN_EMAIL) {
        alert("Acesso negado. Esta área é restrita.");
        window.location.href = '../features/auth/auth.html';
        return;
    }

    console.log(`Acesso de Super Admin concedido para: ${session.user.email}`);
    loadPendingClients();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../features/auth/auth.html';
});

// --- LÓGICA DE APROVAÇÃO (movida para cá) ---
async function loadPendingClients() {
    // ... (O código é o mesmo que estava no dashboard.js)
    pendingClientsListDiv.innerHTML = '<p>Buscando pedidos...</p>';
    try {
        const { data: pending, error } = await supabase.from('pending_signups').select('*').eq('status', 'pending');
        if (error) throw error;
        if (pending.length === 0) {
            pendingClientsListDiv.innerHTML = '<p>Nenhum pedido pendente.</p>';
            return;
        }
        pendingClientsListDiv.innerHTML = '';
        pending.forEach(client => {
            const clientDiv = document.createElement('div');
            clientDiv.className = 'item';
            clientDiv.innerHTML = `
                <div class="item-info">
                    <div class="name">${client.client_name}</div>
                    <div class="details">${client.user_email}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-primary approve-btn" data-id="${client.id}">Aprovar</button>
                </div>
            `;
            pendingClientsListDiv.appendChild(clientDiv);
        });
        document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', handleApproveClick));
    } catch (error) {
        pendingClientsListDiv.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}

async function handleApproveClick(event) {
    const approveButton = event.target;
    const pendingId = approveButton.dataset.id; // pendingId aqui é um UUID string
    if (!confirm('Aprovar este cliente?')) return;

    approveButton.disabled = true;
    approveButton.textContent = 'Aprovando...';
    try {
        // A CORREÇÃO ESTÁ AQUI: Enviamos pendingId como string, sem parseInt()
        const { error } = await supabase.functions.invoke('aprovar-pedido', { 
            body: { pending_id: pendingId } 
        });

        if (error) throw error;
        alert('Cliente aprovado com sucesso!');
        loadPendingClients();
    } catch (error) {
        alert(`Erro: ${error.message}`);
        approveButton.disabled = false;
        approveButton.textContent = 'Aprovar';
    }
}