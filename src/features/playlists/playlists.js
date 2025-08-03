import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const playlistListContainer = document.getElementById('playlist-list-container');
const addPlaylistBtn = document.getElementById('add-playlist-btn');
const playlistModal = document.getElementById('playlist-modal');
const playlistForm = document.getElementById('playlist-form');
const modalTitle = document.getElementById('modal-title');
const closePlaylistModalBtn = document.getElementById('close-playlist-modal');
const cancelPlaylistBtn = document.getElementById('cancel-playlist-btn');
const playlistIdInput = document.getElementById('playlist-id');
const playlistNameInput = document.getElementById('playlist-name');
const playlistDescriptionInput = document.getElementById('playlist-description');
const editMediaModal = document.getElementById('edit-media-modal');
const closeEditMediaModalBtn = document.getElementById('close-edit-media-modal');
const playlistMediasList = document.getElementById('playlist-medias-list');
const availableMediasList = document.getElementById('available-medias-list');
const saveMediaChangesBtn = document.getElementById('save-media-changes-btn');

let currentEditingPlaylistId = null;
let clientId = null; // Variável para guardar o ID do cliente

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    
    // Captura e guarda o client_id dos metadados do usuário
    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado no perfil do usuário. Por favor, faça login novamente com uma conta válida.");
        await supabase.auth.signOut();
        window.location.href = '/src/features/auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadPlaylists();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- FUNÇÕES DE MODAL ---
function openPlaylistModal(playlist = null) {
    playlistForm.reset();
    if (playlist) {
        modalTitle.textContent = 'Editar Playlist';
        playlistIdInput.value = playlist.id;
        playlistNameInput.value = playlist.name;
        playlistDescriptionInput.value = playlist.description;
    } else {
        modalTitle.textContent = 'Criar Nova Playlist';
        playlistIdInput.value = '';
    }
    playlistModal.style.display = 'flex';
}
function closePlaylistModal() { playlistModal.style.display = 'none'; }
addPlaylistBtn.addEventListener('click', () => openPlaylistModal());
closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
cancelPlaylistBtn.addEventListener('click', closePlaylistModal);

function openEditMediaModal(playlistId, playlistName) {
    currentEditingPlaylistId = playlistId;
    document.getElementById('edit-media-modal-title').textContent = `Editando mídias de: ${playlistName}`;
    loadMediasForPlaylist();
    editMediaModal.style.display = 'flex';
}
function closeEditMediaModal() { editMediaModal.style.display = 'none'; currentEditingPlaylistId = null; }
closeEditMediaModalBtn.addEventListener('click', closeEditMediaModal);
saveMediaChangesBtn.addEventListener('click', savePlaylistMediaOrder);


// --- LÓGICA DE PLAYLISTS ---
async function loadPlaylists() {
    playlistListContainer.innerHTML = '<p>Buscando playlists...</p>';
    try {
        // RLS garante que só vemos as playlists do nosso cliente
        const { data: playlists, error } = await supabase.from('playlists').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (playlists.length === 0) {
            playlistListContainer.innerHTML = '<p>Nenhuma playlist encontrada. Crie a primeira!</p>';
            return;
        }

        playlistListContainer.innerHTML = playlists.map(p => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${p.name}</div>
                    <div class="details">${p.description || 'Sem descrição'}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary edit-playlist-btn" data-id="${p.id}">Editar</button>
                    <button class="btn btn-sm btn-primary edit-media-btn" data-id="${p.id}" data-name="${p.name}">Editar Mídias</button>
                    <button class="btn btn-sm btn-danger delete-playlist-btn" data-id="${p.id}">Excluir</button>
                </div>
            </div>
        `).join('');

        // Reatribui os event listeners após renderizar
        document.querySelectorAll('.edit-playlist-btn').forEach(b => b.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const playlist = playlists.find(p => p.id === id);
            openPlaylistModal(playlist);
        }));
        document.querySelectorAll('.edit-media-btn').forEach(b => b.addEventListener('click', (e) => openEditMediaModal(e.target.dataset.id, e.target.dataset.name)));
        document.querySelectorAll('.delete-playlist-btn').forEach(b => b.addEventListener('click', (e) => deletePlaylist(e.target.dataset.id)));

    } catch (error) {
        playlistListContainer.innerHTML = `<p style="color:red;">Erro ao carregar playlists: ${error.message}</p>`;
    }
}

playlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = playlistIdInput.value;
    const playlistData = { 
        name: playlistNameInput.value, 
        description: playlistDescriptionInput.value 
    };
    
    // **AQUI ESTÁ A CORREÇÃO CRUCIAL**
    // Se for uma nova playlist (sem ID), adiciona o client_id que foi capturado no login.
    if (!id) {
        playlistData.client_id = clientId;
    }

    try {
        let error;
        if (id) {
            ({ error } = await supabase.from('playlists').update(playlistData).eq('id', id));
        } else {
            ({ error } = await supabase.from('playlists').insert([playlistData]));
        }
        if (error) throw error;
        closePlaylistModal();
        loadPlaylists();
    } catch (error) {
        alert('Erro ao salvar playlist: ' + error.message);
    }
});

async function deletePlaylist(id) {
    if (!confirm('Tem certeza que deseja excluir esta playlist?')) return;
    try {
        const { error } = await supabase.from('playlists').delete().eq('id', id);
        if (error) throw error;
        loadPlaylists();
    } catch (error) {
        alert('Erro ao excluir playlist: ' + error.message);
    }
}

// --- LÓGICA PARA ORGANIZAR MÍDIAS NA PLAYLIST ---
async function loadMediasForPlaylist() {
    playlistMediasList.innerHTML = '<p>Carregando...</p>';
    availableMediasList.innerHTML = '<p>Carregando...</p>';
    try {
        const [ { data: allMedias }, { data: playlistData } ] = await Promise.all([
            supabase.from('medias').select('id, name'),
            supabase.from('playlists').select('media_ids').eq('id', currentEditingPlaylistId).single()
        ]);
        const mediaIdsInPlaylist = playlistData.media_ids || [];
        const mediasInPlaylist = mediaIdsInPlaylist.map(id => allMedias.find(m => m.id === id)).filter(Boolean);
        const mediasAvailable = allMedias.filter(m => !mediaIdsInPlaylist.includes(m.id));
        renderMediaList(playlistMediasList, mediasInPlaylist, true);
        renderMediaList(availableMediasList, mediasAvailable, false);
    } catch (error) { console.error("Erro ao carregar mídias", error); }
}

function renderMediaList(listElement, mediaItems, isInPlaylist) {
    listElement.innerHTML = '';
    if (mediaItems.length === 0) {
        listElement.innerHTML = `<p>Nenhuma mídia aqui.</p>`;
        return;
    }
    mediaItems.forEach(media => {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.dataset.id = media.id;
        if (isInPlaylist) {
            itemEl.draggable = true;
        }
        itemEl.innerHTML = `
            <span>${media.name}</span>
            <button class="move-btn">${isInPlaylist ? '–' : '+'}</button>
        `;
        listElement.appendChild(itemEl);
    });
}

availableMediasList.addEventListener('click', (e) => {
    if (e.target.classList.contains('move-btn')) {
        const item = e.target.closest('.item');
        item.draggable = true;
        playlistMediasList.appendChild(item);
    }
});
playlistMediasList.addEventListener('click', (e) => {
    if (e.target.classList.contains('move-btn')) {
        const item = e.target.closest('.item');
        item.draggable = false;
        availableMediasList.appendChild(item);
    }
});

// --- LÓGICA DE DRAG AND DROP ---
let draggedItem = null;

playlistMediasList.addEventListener('dragstart', (e) => {
    draggedItem = e.target;
    setTimeout(() => {
        e.target.classList.add('dragging');
    }, 0);
});

playlistMediasList.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    draggedItem = null;
});

playlistMediasList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(playlistMediasList, e.clientY);
    if (afterElement == null) {
        playlistMediasList.appendChild(draggedItem);
    } else {
        playlistMediasList.insertBefore(draggedItem, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function savePlaylistMediaOrder() {
    saveMediaChangesBtn.disabled = true;
    saveMediaChangesBtn.textContent = 'Salvando...';
    const mediaIdsInOrder = Array.from(playlistMediasList.querySelectorAll('.item')).map(item => item.dataset.id);
    try {
        const { error } = await supabase.from('playlists').update({ media_ids: mediaIdsInOrder }).eq('id', currentEditingPlaylistId);
        if (error) throw error;
        alert('Playlist atualizada com sucesso!');
        closeEditMediaModal();
    } catch (error) {
        alert('Erro ao salvar as alterações: ' + error.message);
    } finally {
        saveMediaChangesBtn.disabled = false;
        saveMediaChangesBtn.textContent = 'Salvar Alterações';
    }
}