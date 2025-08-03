import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos e Variáveis Globais ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const addMediaForm = document.getElementById('add-media-form');
const mediaListContainer = document.getElementById('media-list-container');

// --- "SENTINELA" DE AUTENTICAÇÃO E INICIALIZAÇÃO DA PÁGINA ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    userEmailDisplay.textContent = session.user.email;
    loadMedias(); // Carrega as mídias assim que a página é validada
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

        // Cria o HTML para cada item de mídia e insere no container
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

        // Adiciona um "escutador" de eventos para cada botão de excluir
        document.querySelectorAll('.delete-media-btn').forEach(button => {
            button.addEventListener('click', handleDeleteMedia);
        });

    } catch (error) {
        mediaListContainer.innerHTML = `<p style="color:red;">Erro ao carregar mídias: ${error.message}</p>`;
    }
}

// Função para lidar com o envio do formulário de nova mídia
addMediaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = addMediaForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const mediaName = document.getElementById('media-name').value;
    const mediaFile = document.getElementById('media-file').files[0];
    const mediaDuration = document.getElementById('media-duration').value;

    if (!mediaFile) {
        alert("Por favor, selecione um arquivo.");
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Mídia';
        return;
    }

    try {
        // 1. Faz o upload do arquivo para o Supabase Storage
        const filePath = `public/${Date.now()}_${mediaFile.name}`;
        const { error: uploadError } = await supabase.storage.from('midias').upload(filePath, mediaFile);
        if (uploadError) throw uploadError;

        // 2. Pega a URL pública do arquivo que acabamos de enviar
        const { data: urlData } = supabase.storage.from('midias').getPublicUrl(filePath);

        // 3. Prepara os dados para salvar no banco de dados
        const mediaData = {
            name: mediaName,
            type: mediaFile.type.startsWith('video') ? 'video' : 'image',
            duration: mediaFile.type.startsWith('image') ? parseInt(mediaDuration) : null,
            url: urlData.publicUrl,
            file_path: filePath, // Salva o caminho para poder excluir depois
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
             if (storageError) console.error("Aviso: o arquivo no storage não foi removido. Pode já ter sido deletado.", storageError);
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