import { supabase } from '/src/shared/js/supabase-client.js';

// !!!!! IMPORTANTE: COLOQUE O SEU E-MAIL DE SUPER ADMIN AQUI !!!!!
const SUPER_ADMIN_EMAIL = 'vi.emanoel20152015@gmail.com'; 

const logoutBtn = document.getElementById('logout-btn');
const pendingClientsListDiv = document.getElementById('pending-clients-list');
const approvedClientsListDiv = document.getElementById('approved-clients-list');

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.email !== SUPER_ADMIN_EMAIL) {
        alert("Acesso negado. Esta área é restrita.");
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    console.log(`Acesso de Super Admin concedido para: ${session.user.email}`);
    
    loadPendingClients();
    loadApprovedClients();
    setupTabs();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- LÓGICA DAS ABAS ---
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-content`).classList.add('active');
        });
    });
}

// --- LÓGICA DE CARREGAMENTO DE CLIENTES ---

async function loadPendingClients() {
    pendingClientsListDiv.innerHTML = '<p>Buscando pedidos...</p>';
    try {
        const { data: pending, error } = await supabase.from('pending_signups').select('*');
        if (error) throw error;
        
        if (pending.length === 0) {
            pendingClientsListDiv.innerHTML = '<p>Nenhum pedido pendente.</p>';
            return;
        }
        
        pendingClientsListDiv.innerHTML = pending.map(client => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${client.client_name}</div>
                    <div class="details">${client.user_email}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-primary approve-btn" data-id="${client.id}">Aprovar</button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', handleApproveClick));
    } catch (error) {
        pendingClientsListDiv.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}

async function loadApprovedClients() {
    approvedClientsListDiv.innerHTML = '<p>Buscando clientes...</p>';
    try {
        const { data: clients, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (clients.length === 0) {
            approvedClientsListDiv.innerHTML = '<p>Nenhum cliente aprovado ainda.</p>';
            return;
        }
        
        approvedClientsListDiv.innerHTML = clients.map(client => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${client.name}</div>
                    <div class="details">ID: ${client.id}</div>
                </div>
                <div class="item-actions">
                    <span style="color: var(--success-color);">Aprovado</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        approvedClientsListDiv.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}

// --- FUNÇÃO DE APROVAÇÃO (COM DEBUG) ---
async function handleApproveClick(event) {
    const approveButton = event.target;
    const pendingId = approveButton.dataset.id;
    if (!confirm('Aprovar este cliente? Um e-mail será enviado para ele.')) return;

    // ----- NOVO CÓDIGO DE DEPURAÇÃO -----
    console.log("A tentar aprovar cliente. O ID pendente é:", pendingId);
    if (!pendingId) {
        alert("ERRO: O ID do cliente não foi encontrado no botão. Não é possível aprovar.");
        return;
    }
    // ------------------------------------

    approveButton.disabled = true;
    approveButton.textContent = 'Aprovando...';
    try {
        const { error } = await supabase.functions.invoke('aprovar-cadastro', { 
            body: { pending_id: pendingId } 
        });

        if (error) throw error;
        
        alert('Cliente aprovado com sucesso! E-mail de boas-vindas enviado.');
        loadPendingClients();
        loadApprovedClients();
    } catch (error) {
        alert(`Erro ao aprovar cliente: ${error.message}`);
        approveButton.disabled = false;
        approveButton.textContent = 'Aprovar';
    }
}