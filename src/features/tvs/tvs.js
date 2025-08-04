import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const tvListContainer = document.getElementById('tv-list-container');
const addTvBtn = document.getElementById('add-tv-btn');
// ... (outros seletores permanecem iguais)
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
const tvPairingCodeInput = document.getElementById('tv-pairing-code');
const pairingCodeGroup = document.getElementById('pairing-code-group');

let clientId = null;

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado.");
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

// --- FUNÇÕES DO MODAL (sem alterações) ---
async function openTvModal(tv = null) {
    tvForm.reset();
    if (tv) {
        tvModalTitle.textContent = 'Editar TV';
        tvIdInput.value = tv.id;
        tvNameInput.value = tv.name;
        tvLocationInput.value = tv.location;
        tvOrientationSelect.value = tv.orientation;
        pairingCodeGroup.style.display = 'none';
        tvPairingCodeInput.required = false;
        await populatePlaylistSelect(tv.playlist_id);
    } else {
        tvModalTitle.textContent = 'Registrar Nova TV';
        tvIdInput.value = '';
        pairingCodeGroup.style.display = 'block';
        tvPairingCodeInput.required = true;
        await populatePlaylistSelect();
    }
    tvModal.style.display = 'flex';
}
function closeTvModal() { tvModal.style.display = 'none'; }
addTvBtn.addEventListener('click', () => openTvModal());
closeTvModalBtn.addEventListener('click', closeTvModal);
cancelTvBtn.addEventListener('click', closeTvModal);

async function populatePlaylistSelect(selectedPlaylistId = null) {
    try {
        const { data: playlists, error } = await supabase.from('playlists').select('id, name');
        if (error) throw error;
        tvPlaylistSelect.innerHTML = '<option value="">Nenhuma</option>';
        playlists.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            if (p.id === selectedPlaylistId) option.selected = true;
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
            tvListContainer.innerHTML = '<p>Nenhuma TV registrada. Ligue uma TV e use o código para registrar.</p>';
            return;
        }
        tvListContainer.innerHTML = tvs.map(tv => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${tv.name}</div>
                    <div class="details">Local: ${tv.location || 'N/A'} | Playlist: ${tv.playlists?.name || 'Nenhuma'}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary edit-tv-btn" data-id="${tv.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-tv-btn" data-id="${tv.id}">Excluir</button>
                </div>
            </div>
        `).join('');
        document.querySelectorAll('.edit-tv-btn').forEach(b => {
            b.addEventListener('click', () => {
                const tv = tvs.find(t => t.id === b.dataset.id);
                openTvModal(tv);
            });
        });
        document.querySelectorAll('.delete-tv-btn').forEach(b => b.addEventListener('click', (e) => deleteTv(e.target.dataset.id)));
    } catch (error) {
        tvListContainer.innerHTML = `<p style="color:red;">Erro ao carregar TVs: ${error.message}</p>`;
    }
}

// ***** FUNÇÃO DE SUBMISSÃO DO FORMULÁRIO ATUALIZADA *****
tvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = tvIdInput.value;

    try {
        let error;
        if (id) {
            // Editando TV existente (lógica inalterada)
            const tvData = {
                name: tvNameInput.value,
                location: tvLocationInput.value,
                playlist_id: tvPlaylistSelect.value || null,
                orientation: tvOrientationSelect.value,
            };
            ({ error } = await supabase.from('tvs').update(tvData).eq('id', id));
        } else {
            // Pareando uma nova TV usando a função RPC
            const pairingCode = tvPairingCodeInput.value.trim().toUpperCase();
            if (!pairingCode) {
                alert("O código de pareamento é obrigatório.");
                return;
            }
            
            // Chama a nossa nova função 'claim_tv'
            const { error: rpcError } = await supabase.rpc('claim_tv', {
                p_pairing_code: pairingCode,
                p_name: tvNameInput.value,
                p_location: tvLocationInput.value,
                p_playlist_id: tvPlaylistSelect.value || null,
                p_orientation: tvOrientationSelect.value
            });
            error = rpcError;
        }

        if (error) throw error;
        closeTvModal();
        loadTvs();
    } catch (error) {
        // A mensagem de erro agora virá diretamente da nossa função RPC
        alert('Erro ao salvar TV: ' + error.message);
    }
});

async function deleteTv(id) {
    if (!confirm('Tem certeza que deseja excluir esta TV?')) return;
    try {
        const { error } = await supabase.from('tvs').delete().eq('id', id);
        if (error) throw error;
        loadTvs();
    } catch (error) {
        alert('Erro ao excluir TV: ' + error.message);
    }
}