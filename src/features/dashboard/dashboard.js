import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const statsContainer = document.getElementById('stats-container');
const mediaCountEl = document.getElementById('media-count');
const playlistCountEl = document.getElementById('playlist-count');
const tvCountEl = document.getElementById('tv-count');

// --- "SENTINELA" DE AUTENTICAÇÃO E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    userEmailDisplay.textContent = session.user.email;
    loadDashboardData();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- LÓGICA PRINCIPAL DO DASHBOARD ---

async function loadDashboardData() {
    try {
        const [mediaResponse, playlistResponse, tvResponse] = await Promise.all([
            supabase.from('medias').select('*', { count: 'exact', head: true }),
            supabase.from('playlists').select('*', { count: 'exact', head: true }),
            supabase.from('tvs').select('*', { count: 'exact', head: true })
        ]);

        if (mediaResponse.error) throw mediaResponse.error;
        if (playlistResponse.error) throw playlistResponse.error;
        if (tvResponse.error) throw tvResponse.error;

        mediaCountEl.textContent = mediaResponse.count;
        playlistCountEl.textContent = playlistResponse.count;
        tvCountEl.textContent = tvResponse.count;

        statsContainer.style.visibility = 'visible';
        
        // **NOVA FUNÇÃO ADICIONADA AQUI**
        // Ativa os links dos cartões de estatísticas
        setupClickableStats();

    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        statsContainer.innerHTML = `<p style="color:red;">Não foi possível carregar as estatísticas.</p>`;
    }
}

// **NOVA FUNÇÃO PARA TORNAR OS CARTÕES CLICÁVEIS**
function setupClickableStats() {
    document.querySelectorAll('.stat-card-link').forEach(link => {
        link.addEventListener('click', function(event) {
            // Previne o comportamento padrão do link para garantir que a navegação seja suave
            event.preventDefault(); 
            window.location.href = this.href; // Navega para o URL do link
        });
    });
}