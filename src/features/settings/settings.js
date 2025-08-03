import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const settingsForm = document.getElementById('settings-form');
const logoUploadInput = document.getElementById('logo-upload');
const logoSizeInput = document.getElementById('logo-size');
const currentLogoPreview = document.getElementById('current-logo-preview');
const infoPanelEnabledInput = document.getElementById('info-panel-enabled');
const weatherApiKeyInput = document.getElementById('weather-api-key');
const weatherCityInput = document.getElementById('weather-city');
const feedbackMessage = document.getElementById('feedback-message');

let currentSettings = {};

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/src/features/auth/auth.html';
        return;
    }
    userEmailDisplay.textContent = session.user.email;
    loadSettings();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- LÓGICA DE CONFIGURAÇÕES ---

// Carrega as configurações atuais do banco de dados e preenche o formulário
async function loadSettings() {
    try {
        const { data, error } = await supabase.from('settings').select('*').single();
        if (error && error.code !== 'PGRST116') { // PGRST116 = 'no rows returned'
            throw error;
        }

        if (data) {
            currentSettings = data;
            logoSizeInput.value = data.logo_size || 10;
            infoPanelEnabledInput.checked = data.info_panel_enabled || false;
            weatherApiKeyInput.value = data.weather_api_key || '';
            weatherCityInput.value = data.weather_city || '';

            if (data.logo_url) {
                currentLogoPreview.innerHTML = `
                    <p>Logo Atual:</p>
                    <img src="${data.logo_url}" alt="Logo atual" style="max-height: 80px; background: #555; padding: 10px; border-radius: 5px;">
                `;
            }
        }
    } catch (error) {
        showFeedback(`Erro ao carregar configurações: ${error.message}`, 'error');
    }
}

// Lida com o envio do formulário para salvar as alterações
settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = settingsForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
        const newLogoFile = logoUploadInput.files[0];
        let logoUpdate = {};

        // Se um novo logo foi enviado, faz o upload
        if (newLogoFile) {
            // Remove o logo antigo do storage, se existir
            if (currentSettings.logo_file_path) {
                await supabase.storage.from('midias').remove([currentSettings.logo_file_path]);
            }

            const newFilePath = `logo/${Date.now()}_${newLogoFile.name}`;
            const { error: uploadError } = await supabase.storage.from('midias').upload(newFilePath, newLogoFile);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('midias').getPublicUrl(newFilePath);
            logoUpdate = {
                logo_url: urlData.publicUrl,
                logo_file_path: newFilePath
            };
        }

        // Prepara todos os dados para serem salvos
        const updatedSettings = {
            id: 1, // A tabela de settings tem apenas uma linha, com id=1
            ...logoUpdate,
            logo_size: parseInt(logoSizeInput.value),
            info_panel_enabled: infoPanelEnabledInput.checked,
            weather_api_key: weatherApiKeyInput.value,
            weather_city: weatherCityInput.value,
        };

        // Usa 'upsert' para criar a linha se não existir, ou atualizar se já existir
        const { error } = await supabase.from('settings').upsert(updatedSettings);
        if (error) throw error;

        showFeedback('Configurações salvas com sucesso!', 'success');
        loadSettings(); // Recarrega para mostrar o novo logo, se houver

    } catch (error) {
        showFeedback(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Configurações';
    }
});

// --- Função de Feedback Visual ---
function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 4000);
}