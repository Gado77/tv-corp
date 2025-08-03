import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const tvListContainer = document.getElementById('tv-list-container');
const addTvBtn = document.getElementById('add-tv-btn');

// Modal de TV
const tvModal = document.getElementById('tv-modal');
const tvForm = document.getElementById('tv-form');
const tvModalTitle = document.getElementById('tv-modal-title');
const closeTvModalBtn = document.getElementById('close-tv-modal');
const cancelTvBtn = document.getElementById('cancel-tv-btn');
const tvIdInput = document.getElementById('tv-id');
const tvNameInput = document.getElementById('tv-name');
const tvLocationInput = document.getElementById('tv-location');
const tvPlaylistSelect = document.getElementById('tv-playlist-select');
const tvOrientationSelect = document.getElementById('tv-orientation');


// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    userEmailDisplay.textContent = session.user.email;
    loadTvs();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- FUNÇÕES DO MODAL ---
function openTvModal(tv = null) {
    tvForm.reset();
    populatePlaylistSelect(); // Carrega as playlists no seletor

    if (tv) {
        tvModalTitle.textContent = 'Editar TV';
        tvIdInput.value = tv.id;
        tvNameInput.value = tv.name;
        tvLocationInput.value = tv.location;
        tvOrientationSelect.value = tv.orientation;
        // A seleção da playlist será feita após o populate
    } else {
        tvModalTitle.textContent = 'Registrar Nova TV';
        tvIdInput.value = '';
    }
    tvModal.style.display = 'flex';
}

function closeTvModal() {
    tvModal.style.display = 'none';
}

addTvBtn.addEventListener('click', () => openTvModal());
closeTvModalBtn.addEventListener('click', closeTvModal);
cancelTvBtn.addEventListener('click', closeTvModal);

async function populatePlaylistSelect(selectedPlaylistId = null) {
    try {
        const { data: playlists, error } = await supabase.from('playlists').select('id, name');
        if (error) throw error;
        
        tvPlaylistSelect.innerHTML = '<option value="">Selecione uma playlist</option>';
        playlists.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            if (p.id === selectedPlaylistId) {
                option.selected = true;
            }
            tvPlaylistSelect.appendChild(option);
        });
    } catch (error) {
        tvPlaylistSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}


// --- LÓGICA DE GERENCIAMENTO DE TVS (CRUD) ---

async function loadTvs() {
    tvListContainer.innerHTML = '<p>Buscando TVs registradas...</p>';
    try {
        const { data: tvs, error } = await supabase.from('tvs').select('*, playlists(name)').order('created_at', { ascending: false });
        if (error) throw error;

        if (tvs.length === 0) {
            tvListContainer.innerHTML = '<p>Nenhuma TV registrada. Clique em "Registrar Nova TV" para começar.</p>';
            return;
        }

        tvListContainer.innerHTML = tvs.map(tv => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${tv.name}</div>
                    <div class="details">
                        Local: ${tv.location || 'N/A'} | Playlist: ${tv.playlists?.name || 'Nenhuma'}
                    </div>
                </div>
                <div class="item-info" style="text-align: center;">
                    <strong style="font-size: 1.2rem; letter-spacing: 2px; font-family: monospace;">${tv.pairing_code}</strong>
                    <div class="details">CÓDIGO DE PAREAMENTO</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary edit-tv-btn" data-id="${tv.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-tv-btn" data-id="${tv.id}">Excluir</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.edit-tv-btn').forEach(b => b.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const { data: tv } = await supabase.from('tvs').select('*').eq('id', id).single();
            await populatePlaylistSelect(tv.playlist_id); // Pré-carrega e seleciona a playlist correta
            openTvModal(tv); // Abre o modal depois que as playlists foram carregadas
        }));
        document.querySelectorAll('.delete-tv-btn').forEach(b => b.addEventListener('click', (e) => deleteTv(e.target.dataset.id)));

    } catch (error) {
        tvListContainer.innerHTML = `<p style="color:red;">Erro ao carregar TVs: ${error.message}</p>`;
    }
}

tvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = tvIdInput.value;
    const tvData = {
        name: tvNameInput.value,
        location: tvLocationInput.value,
        playlist_id: parseInt(tvPlaylistSelect.value),
        orientation: tvOrientationSelect.value,
    };

    try {
        let error;
        if (id) {
            // Editando TV existente
            ({ error } = await supabase.from('tvs').update(tvData).eq('id', id));
        } else {
            // Criando nova TV
            // Gera um código de pareamento de 6 caracteres aleatórios
            tvData.pairing_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            ({ error } = await supabase.from('tvs').insert([tvData]));
        }
        if (error) throw error;
        closeTvModal();
        loadTvs();
    } catch (error) {
        alert('Erro ao salvar TV: ' + error.message);
    }
});

async function deleteTv(id) {
    if (!confirm('Tem certeza que deseja excluir esta TV? O player correspondente voltará para a tela de pareamento.')) return;
    try {
        const { error } = await supabase.from('tvs').delete().eq('id', id);
        if (error) throw error;
        loadTvs();
    } catch (error) {
        alert('Erro ao excluir TV: ' + error.message);
    }
}