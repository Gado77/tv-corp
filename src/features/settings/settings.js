import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const settingsForm = document.getElementById('settings-form');
const logoUploadInput = document.getElementById('logo-upload');
const logoSizeInput = document.getElementById('logo-size');
const logoSizeValue = document.getElementById('logo-size-value'); // NOVO SELETOR
const currentLogoPreview = document.getElementById('current-logo-preview');
const infoPanelEnabledInput = document.getElementById('info-panel-enabled');
const weatherApiKeyInput = document.getElementById('weather-api-key');
const weatherCityInput = document.getElementById('weather-city');
const feedbackMessage = document.getElementById('feedback-message');

let clientId = null;
let currentSettings = {};

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
        await supabase.auth.signOut();
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadSettings();

    // ALTERAÇÃO: Adiciona o "escutador" para o evento de deslizar
    logoSizeInput.addEventListener('input', () => {
        if (logoSizeValue) {
            logoSizeValue.textContent = logoSizeInput.value;
        }
    });
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/src/features/auth/auth.html';
});

// --- LÓGICA DE CONFIGURAÇÕES ---
async function loadSettings() {
    try {
        const { data, error } = await supabase.from('settings').select('*').eq('client_id', clientId).single();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            currentSettings = data;
            const size = data.logo_size || 10;
            logoSizeInput.value = size;
            logoSizeValue.textContent = size; // ALTERAÇÃO: Atualiza o valor no carregamento
            infoPanelEnabledInput.checked = data.info_panel_enabled;
            weatherApiKeyInput.value = data.weather_api_key || '';
            weatherCityInput.value = data.weather_city || '';

            if (data.logo_url) {
                currentLogoPreview.innerHTML = `<p>Logo Atual:</p><img src="${data.logo_url}" alt="Logo atual" style="max-height: 80px; background: #555; padding: 10px; border-radius: 5px;">`;
            } else {
                currentLogoPreview.innerHTML = '';
            }
        }
    } catch (error) {
        showFeedback(`Erro ao carregar configurações: ${error.message}`, 'error');
    }
}

settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = settingsForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
        const newLogoFile = logoUploadInput.files[0];
        let logoUpdate = {};

        if (newLogoFile) {
            if (currentSettings.logo_file_path) {
                await supabase.storage.from('midias').remove([currentSettings.logo_file_path]);
            }
            const newFilePath = `${clientId}/logo/${Date.now()}_${newLogoFile.name}`;
            const { error: uploadError } = await supabase.storage.from('midias').upload(newFilePath, newLogoFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('midias').getPublicUrl(newFilePath);
            logoUpdate = { logo_url: urlData.publicUrl, logo_file_path: newFilePath };
        }

        const updatedSettings = {
            client_id: clientId,
            ...logoUpdate,
            logo_size: parseInt(logoSizeInput.value),
            info_panel_enabled: infoPanelEnabledInput.checked,
            weather_api_key: weatherApiKeyInput.value.trim(),
            weather_city: weatherCityInput.value.trim(),
        };

        const { error } = await supabase.from('settings').upsert(updatedSettings, { onConflict: 'client_id' });
        if (error) throw error;

        showFeedback('Configurações salvas com sucesso!', 'success');
        loadSettings();

    } catch (error) {
        showFeedback(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Configurações';
    }
});

function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 4000);
}