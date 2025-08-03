import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos e Variáveis Globais ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const addMediaForm = document.getElementById('add-media-form');
const mediaListContainer = document.getElementById('media-list-container');
let clientId = null; // Variável para guardar o ID do cliente

// --- "SENTINELA" DE AUTENTICAÇÃO E INICIALIZAÇÃO DA PÁGINA ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }

    // ALTERAÇÃO 1: Captura e guarda o client_id para uso futuro.
    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        window.location.href = '/src/features/auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadMedias();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- LÓGICA DE GERENCIAMENTO DE MÍDIAS ---

// Função para carregar e exibir todas as mídias do banco de dados
async function loadMedias() {
    mediaListContainer.innerHTML = '<p>Buscando mídias...</p>';
    try {
        const { data: medias, error } = await supabase.from('medias').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (medias.length === 0) {
            mediaListContainer.innerHTML = '<p>Nenhuma mídia encontrada. Adicione a primeira!</p>';
            return;
        }

        mediaListContainer.innerHTML = medias.map(media => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${media.name}</div>
                    <div class="details">Tipo: ${media.type} | Duração: ${media.duration || 'N/A'}s</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-danger delete-media-btn" data-id="${media.id}" data-path="${media.file_path}">Excluir</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.delete-media-btn').forEach(button => {
            button.addEventListener('click', handleDeleteMedia);
        });

    } catch (error) {
        mediaListContainer.innerHTML = `<p style="color:red;">Erro ao carregar mídias: ${error.message}</p>`;
    }
}

// Função para obter a duração de um arquivo de vídeo
function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration));
        }
        video.onerror = function() {
            reject("Não foi possível carregar os metadados do vídeo.");
        }
        video.src = URL.createObjectURL(file);
    });
}

// Função para lidar com o envio do formulário de nova mídia
addMediaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = addMediaForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const mediaName = document.getElementById('media-name').value;
    const mediaFile = document.getElementById('media-file').files[0];
    const mediaDurationInput = document.getElementById('media-duration').value;

    if (!mediaFile || !mediaName) {
        alert("Por favor, selecione um arquivo e preencha o nome.");
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Mídia';
        return;
    }

    try {
        // ALTERAÇÃO 2: Lógica aprimorada para upload e inserção
        const isVideo = mediaFile.type.startsWith('video');
        const duration = isVideo ? await getVideoDuration(mediaFile) : parseInt(mediaDurationInput) || 10;
        
        // 1. Faz o upload do arquivo para o Supabase Storage, agora dentro de uma pasta do cliente
        const filePath = `${clientId}/${Date.now()}_${mediaFile.name}`;
        const { error: uploadError } = await supabase.storage.from('midias').upload(filePath, mediaFile);
        if (uploadError) throw uploadError;

        // 2. Pega a URL pública do arquivo
        const { data: urlData } = supabase.storage.from('midias').getPublicUrl(filePath);

        // 3. Prepara os dados para salvar no banco, incluindo o client_id
        const mediaData = {
            name: mediaName,
            type: isVideo ? 'video' : 'image',
            duration: duration,
            url: urlData.publicUrl,
            file_path: filePath,
            client_id: clientId // CORREÇÃO DE SEGURANÇA
        };

        // 4. Insere o registro na tabela 'medias'
        const { error: insertError } = await supabase.from('medias').insert([mediaData]);
        if (insertError) throw insertError;

        alert('Mídia adicionada com sucesso!');
        addMediaForm.reset();
        loadMedias(); // Recarrega a lista de mídias

    } catch (error) {
        alert(`Erro ao adicionar mídia: ${error.message}`);
        console.error("Detalhes do erro:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Mídia';
    }
});

// Função para lidar com a exclusão de uma mídia
async function handleDeleteMedia(event) {
    const mediaId = event.target.dataset.id;
    const mediaPath = event.target.dataset.path;

    if (!confirm('Tem certeza que deseja excluir esta mídia? Esta ação não pode ser desfeita.')) return;

    try {
        // 1. Exclui o arquivo do Supabase Storage
        if (mediaPath) {
             const { error: storageError } = await supabase.storage.from('midias').remove([mediaPath]);
             if (storageError) console.error("Aviso: o arquivo no storage não foi removido.", storageError);
        }

        // 2. Exclui o registro da tabela 'medias' no banco de dados
        const { error: dbError } = await supabase.from('medias').delete().eq('id', mediaId);
        if (dbError) throw dbError;

        alert('Mídia excluída com sucesso.');
        loadMedias(); // Recarrega a lista de mídias

    } catch (error) {
        alert(`Erro ao excluir mídia: ${error.message}`);
        console.error("Detalhes do erro:", error);
    }
}