import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos do DOM ---
const body = document.body;
const mediaContainer = document.getElementById('media-container');
const pairingScreen = document.getElementById('pairing-screen');
const pairingCodeEl = document.getElementById('pairing-code');
const settingsPanel = document.getElementById('settings-panel');
const sidebarLogoImg = document.getElementById('sidebar-logo-img');
const sidebarLocation = document.getElementById('sidebar-location');
const currentWeatherIcon = document.getElementById('current-weather-icon');
const currentWeatherTemp = document.getElementById('current-weather-temp');
const currentWeatherDesc = document.getElementById('current-weather-desc');
const dailyForecastContainer = document.getElementById('daily-forecast-container');
const newsTitle = document.getElementById('news-title');
const newsSummary = document.getElementById('news-summary');
const newsTimestamp = document.querySelector('.news-timestamp');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmationMessage = document.getElementById('confirmation-message');
// Os botões agora são selecionados dentro da função 'showConfirmationModal'

// --- Variáveis de Estado e Configuração ---
let tvId = localStorage.getItem('tvId');
let currentPlaylist = [];
let currentMediaIndex = 0;
let mediaTimer;
let realtimeChannel = null;
let pairingChannel = null;
let settings = {};
let isSettingsPanelOpen = false;
let isConfirmationModalOpen = false;
let newsItems = [];
let currentNewsIndex = 0;
const BUCKET_URL_CLIMA = 'https://hsimportssj.com/wp-content/uploads/2025/08/';
let newsInterval = null;
let infoPanelShowInterval = null;
let infoPanelHideTimer = null;

// --- LÓGICA DO MODAL DE CONFIRMAÇÃO (CORRIGIDA) ---
function showConfirmationModal(message, onConfirm) {
    // CORREÇÃO: Seleciona os botões aqui, quando a função é chamada
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    confirmationMessage.textContent = message;
    confirmationModal.style.display = 'flex';
    isConfirmationModalOpen = true;
    confirmBtn.focus();

    const handleConfirm = () => {
        onConfirm();
        closeConfirmationModal();
    };
    const handleCancel = () => closeConfirmationModal();
    
    // Limpa listeners antigos para evitar chamadas múltiplas
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    document.getElementById('confirm-btn').addEventListener('click', handleConfirm);
    document.getElementById('cancel-btn').addEventListener('click', handleCancel);
}

function closeConfirmationModal() {
    confirmationModal.style.display = 'none';
    isConfirmationModalOpen = false;
}

// --- Funções de Controle da Interface ---
function showInfoMode() {
    body.classList.add('info-mode-active');
    if (newsInterval) clearInterval(newsInterval);
    newsInterval = setInterval(() => {
        displayNews(currentNewsIndex + 1);
    }, 30000);
    if (infoPanelHideTimer) clearTimeout(infoPanelHideTimer);
    infoPanelHideTimer = setTimeout(() => {
        hideInfoMode();
    }, 90000);
}

function hideInfoMode() {
    body.classList.remove('info-mode-active');
    if (newsInterval) clearInterval(newsInterval);
    if (infoPanelHideTimer) clearTimeout(infoPanelHideTimer);
}

function showSettingsPanel() {
    if (isSettingsPanelOpen) return;
    isSettingsPanelOpen = true;
    updateConnectionStatus();
    populatePlaylists();
    body.classList.add('settings-active');
    setTimeout(() => { settingsPanel.querySelector('.settings-interactive')?.focus(); }, 500);
}

function hideSettingsPanel() {
    if (!isSettingsPanelOpen) return;
    isSettingsPanelOpen = false;
    body.classList.remove('settings-active');
}

// --- LÓGICA DE NAVEGAÇÃO POR TECLADO ---
function handleDialogNavigation(container, direction) {
    const focusable = Array.from(container.querySelectorAll('.settings-interactive, .dialog-interactive'));
    if (focusable.length === 0) return;
    const currentFocus = document.activeElement;
    let currentIndex = focusable.indexOf(currentFocus);
    if (direction === 'down') currentIndex = (currentIndex + 1) % focusable.length;
    else if (direction === 'up') currentIndex = (currentIndex - 1 + focusable.length) % focusable.length;
    focusable[currentIndex].focus();
}

document.addEventListener('keydown', (event) => {
    if (isConfirmationModalOpen) {
        event.preventDefault();
        switch (event.key) {
            case 'ArrowUp': handleDialogNavigation(confirmationModal, 'up'); break;
            case 'ArrowDown': handleDialogNavigation(confirmationModal, 'down'); break;
            case 'Enter': document.activeElement?.click(); break;
            case 'Escape': closeConfirmationModal(); break;
        }
        return;
    }
    if (isSettingsPanelOpen) {
        event.preventDefault();
        switch (event.key) {
            case 'ArrowUp': handleDialogNavigation(settingsPanel, 'up'); break;
            case 'ArrowDown': handleDialogNavigation(settingsPanel, 'down'); break;
            case 'Enter': document.activeElement?.click(); break;
            case 'Escape': hideSettingsPanel(); break;
        }
        return;
    }
    switch (event.key) {
        case 'ArrowUp': body.classList.contains('info-mode-active') ? hideInfoMode() : showInfoMode(); break;
        case 'ArrowDown': if (!body.classList.contains('info-mode-active')) showSettingsPanel(); break;
        case 'Escape': hideInfoMode(); hideSettingsPanel(); break;
        case 'Enter': if (!isSettingsPanelOpen && !body.classList.contains('info-mode-active')) toggleFullscreen(); break;
        case 'ArrowRight':
            if (body.classList.contains('info-mode-active')) { displayNews(currentNewsIndex + 1); showInfoMode(); } 
            else { playMediaAtIndex(currentMediaIndex + 1); }
            break;
        case 'ArrowLeft':
            if (body.classList.contains('info-mode-active')) { displayNews(currentNewsIndex - 1); showInfoMode(); } 
            else { playMediaAtIndex(currentMediaIndex - 1); }
            break;
    }
});

// --- LÓGICA DE CLIMA ---
function getIconFilename(iconCode) {
    const codeNumber = iconCode.substring(0, 2);
    switch (codeNumber) {
        case '03': case '04': case '09': case '11': case '13': case '50': return `${codeNumber}dn.png`;
        case '01': case '02': case '10': return `${iconCode}.png`;
        default: return '01d.png';
    }
}

async function fetchWeather() {
    if (!settings.weather_api_key || !settings.weather_city) return;
    try {
        const baseUrl = 'https://api.openweathermap.org/data/2.5/';
        const apiKey = settings.weather_api_key;
        const city = settings.weather_city;
        const [currentWeatherResponse, forecastResponse] = await Promise.all([
            fetch(`${baseUrl}weather?q=${city}&appid=${apiKey}&units=metric&lang=pt_br`),
            fetch(`${baseUrl}forecast?q=${city}&appid=${apiKey}&units=metric&lang=pt_br`)
        ]);
        const currentData = await currentWeatherResponse.json();
        const forecastData = await forecastResponse.json();
        if (currentData.cod !== 200) throw new Error(currentData.message);
        if (forecastData.cod !== "200") throw new Error(forecastData.message);
        
        sidebarLocation.textContent = currentData.name;
        currentWeatherTemp.textContent = `${Math.round(currentData.main.temp)}°`;
        currentWeatherDesc.textContent = currentData.weather[0].description;
        const iconCode = currentData.weather[0].icon;
        const iconFilename = getIconFilename(iconCode);
        currentWeatherIcon.innerHTML = `<img src="${BUCKET_URL_CLIMA + iconFilename}" alt="${currentData.weather[0].description}">`;

        const dailyForecasts = {};
        forecastData.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            if (!dailyForecasts[date]) dailyForecasts[date] = { minTemps: [], maxTemps: [] };
            dailyForecasts[date].minTemps.push(item.main.temp_min);
            dailyForecasts[date].maxTemps.push(item.main.temp_max);
        });
        dailyForecastContainer.innerHTML = '';
        Object.keys(dailyForecasts).slice(0, 4).forEach(date => {
            const dayData = dailyForecasts[date];
            const minTemp = Math.round(Math.min(...dayData.minTemps));
            const maxTemp = Math.round(Math.max(...dayData.maxTemps));
            const dateObj = new Date(date + 'T12:00:00');
            const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
            dailyForecastContainer.innerHTML += `<div class="day-item"><span class="day-name">${dayName}</span><div class="day-details"><span class="temps"><span class="max">${maxTemp}°</span><span class="min">${minTemp}°</span></span></div></div>`;
        });
    } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error.message);
        sidebarLocation.textContent = "Erro de Clima";
    }
}

// --- Funções Principais do Player ---
function restartPlayer() { showConfirmationModal("Tem certeza que deseja reiniciar o player?", () => { location.reload(); }); }
function unpairTv() { showConfirmationModal("Tem certeza que deseja desparear esta TV?", () => { localStorage.removeItem('tvId'); if (realtimeChannel) supabase.removeChannel(realtimeChannel); if (pairingChannel) supabase.removeChannel(pairingChannel); location.reload(); }); }
async function populatePlaylists() { const select = document.getElementById('playlist-select'); if (!select || !tvId) return; try { const { data, error } = await supabase.rpc('get_playlists_for_tv', { tv_id_input: tvId }); if (error) throw error; select.innerHTML = ''; if (data && data.length > 0) { data.forEach(playlist => { const option = document.createElement('option'); option.value = playlist.id; option.textContent = playlist.name; if (playlist.id === settings.playlist_id) option.selected = true; select.appendChild(option); }); } else { select.innerHTML = '<option>Nenhuma playlist encontrada</option>'; } } catch (error) { console.error("Erro ao buscar playlists:", error); select.innerHTML = '<option>Erro ao carregar</option>'; } }
async function saveNewPlaylist() { const select = document.getElementById('playlist-select'); const newPlaylistId = select.value; if (!newPlaylistId || !tvId) return; try { const { error } = await supabase.from('tvs').update({ playlist_id: newPlaylistId }).eq('id', tvId); if (error) throw error; showConfirmationModal("Playlist alterada com sucesso! A TV irá atualizar em breve.", () => {}); hideSettingsPanel(); } catch (error) { showConfirmationModal(`Erro ao alterar a playlist: ${error.message}`, () => {}); } }
function updateConnectionStatus() { const internetStatusEl = document.getElementById('internet-status-value'); const supabaseStatusEl = document.getElementById('supabase-status-value'); if (internetStatusEl) internetStatusEl.textContent = navigator.onLine ? 'Conectado ✅' : 'Offline ❌'; if (supabaseStatusEl) supabaseStatusEl.textContent = realtimeChannel && realtimeChannel.state === 'joined' ? 'Conectado ✅' : 'Conectando... 🟡'; }
function toggleFullscreen() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.error(err.message)); } else { document.exitFullscreen(); } }
function playMediaAtIndex(index) { clearTimeout(mediaTimer); const spinner = mediaContainer.querySelector('.loading-spinner'); if (!currentPlaylist || currentPlaylist.length === 0) { if (spinner) spinner.style.display = 'none'; mediaContainer.innerHTML = `<div class="overlay"><h1>Nenhuma playlist selecionada.</h1><p>Por favor, associe uma playlist a esta TV no painel de administração.</p></div>`; return; } if (spinner) spinner.style.display = 'block'; currentMediaIndex = (index + currentPlaylist.length) % currentPlaylist.length; const media = currentPlaylist[currentMediaIndex]; if (!media || !media.url) { console.warn("Mídia inválida encontrada, a pular..."); if (spinner) spinner.style.display = 'none'; setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 500); return; } const oldElement = mediaContainer.querySelector('img, video'); if (oldElement) { oldElement.classList.remove('active'); setTimeout(() => oldElement.remove(), 800); } const elementType = media.type === 'image' ? 'img' : 'video'; const newElement = document.createElement(elementType); const onMediaReady = () => { if (spinner) spinner.style.display = 'none'; newElement.classList.add('active'); if (elementType === 'video') { newElement.play().catch(e => console.error("Erro ao dar play no vídeo:", e)); newElement.onended = () => playMediaAtIndex(currentMediaIndex + 1); } else { const duration = media.duration || 10; mediaTimer = setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), duration * 1000); } }; const onMediaError = () => { console.error(`Falha ao carregar mídia: ${media.url}`); if (spinner) spinner.style.display = 'none'; setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 500); }; newElement.addEventListener('load', onMediaReady); newElement.addEventListener('canplaythrough', onMediaReady); newElement.addEventListener('error', onMediaError); if (elementType === 'video') { newElement.muted = true; newElement.autoplay = true; newElement.playsInline = true; } newElement.src = `${media.url}?t=${new Date().getTime()}`; mediaContainer.prepend(newElement); }
async function fetchNews() { try { const { data, error } = await supabase.rpc('get_recent_news'); if (error) throw error; newsItems = data && data.length ? data.map(item => ({ title: item.summary_title, description: item.summary_text })) : []; if (newsItems.length > 0) { displayNews(0); } else { newsTitle.textContent = "Sem notícias recentes."; } } catch (error) { console.error("Erro ao buscar notícias:", error.message); newsTitle.textContent = "Erro ao carregar notícias."; } }
function displayNews(index) { if (!newsItems || newsItems.length === 0) return; currentNewsIndex = (index + newsItems.length) % newsItems.length; const item = newsItems[currentNewsIndex]; if (newsTitle) newsTitle.textContent = item.title; if (newsSummary) newsSummary.textContent = item.description; }
function applySettings(tvData, clientSettingsData) { settings = { ...(clientSettingsData || {}), ...(tvData || {}) }; body.classList.toggle('vertical', settings.orientation === 'vertical'); if (sidebarLogoImg && settings.logo_url) { sidebarLogoImg.src = settings.logo_url; const logoSize = Math.max(1, Math.min(20, settings.logo_size || 10)); const minRem = 4, maxRem = 15; sidebarLogoImg.style.maxWidth = `${minRem + ((logoSize - 1) / 19) * (maxRem - minRem)}rem`; } }
async function getInitialData() { if (!tvId) { showPairingScreen(); return; } pairingScreen.style.display = 'flex'; pairingCodeEl.textContent = "Conectando..."; try { const { data, error } = await supabase.rpc('get_player_data', { tv_id_input: tvId }); if (error) throw error; if (!data || !data.tv || !data.tv.client_id) { console.error("TV não pareada ou sem cliente. A voltar à tela de código."); setTimeout(() => { localStorage.removeItem('tvId'); location.reload(); }, 3000); return; } pairingScreen.style.display = 'none'; applySettings(data.tv, data.client_settings); currentPlaylist = data.playlist_medias || []; playMediaAtIndex(0); startRealtimeListeners(tvId); fetchWeather(); fetchNews(); } catch (error) { console.error("Erro fatal ao carregar dados do player:", error.message); setTimeout(() => { localStorage.removeItem('tvId'); location.reload(); }, 3000); } }
function startRealtimeListeners(currentTvId) { if (realtimeChannel) supabase.removeChannel(realtimeChannel); realtimeChannel = supabase.channel(`tv-channel-${currentTvId}`); realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'tvs', filter: `id=eq.${currentTvId}` }, () => getInitialData()).subscribe(); }
async function showPairingScreen() { pairingScreen.style.display = 'flex'; if (pairingChannel) supabase.removeChannel(pairingChannel); const code = Math.random().toString(36).substring(2, 8).toUpperCase(); pairingCodeEl.textContent = code; try { await supabase.from('tvs').insert({ pairing_code: code }); console.log(`TV registada com o código ${code}. A aguardar pareamento...`); pairingChannel = supabase.channel(`pairing-channel-${code}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tvs', filter: `pairing_code=eq.${code}`}, (payload) => { if (payload.new.client_id) { console.log('Pareamento recebido!', payload.new); localStorage.setItem('tvId', payload.new.id); tvId = payload.new.id; if (pairingChannel) supabase.removeChannel(pairingChannel); getInitialData(); } }).subscribe(); } catch (error) { console.error("Erro ao criar TV para pareamento:", error.message); pairingCodeEl.textContent = "ERRO"; } }
function updateClock() { const now = new Date(); const hours = now.getHours().toString().padStart(2, '0'); const minutes = now.getMinutes().toString().padStart(2, '0'); if (newsTimestamp) { const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }); newsTimestamp.innerHTML = `${hours}:${minutes} <span>${dateString}</span>`; } }

function initPlayer() {
    updateClock();
    setInterval(updateClock, 30000);
    
    document.getElementById('save-playlist-btn')?.addEventListener('click', saveNewPlaylist);
    document.getElementById('restart-player-btn')?.addEventListener('click', restartPlayer);
    document.getElementById('unpair-tv-btn')?.addEventListener('click', unpairTv);
    closeSettingsBtn.addEventListener('click', hideSettingsPanel);
    
    getInitialData();

    if (infoPanelShowInterval) clearInterval(infoPanelShowInterval);
    infoPanelShowInterval = setInterval(() => {
        showInfoMode();
    }, 1200000);

    setInterval(() => {
        fetchWeather();
    }, 1800000);
}

window.addEventListener('DOMContentLoaded', initPlayer);