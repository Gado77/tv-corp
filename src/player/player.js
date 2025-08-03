// A MUDANÇA MAIS IMPORTANTE: Importa o cliente Supabase da pasta compartilhada
import { supabase } from '../shared/js/supabase-client.js';

// --- Seletores de Elementos do DOM ---
const body = document.body;
const mediaContainer = document.getElementById('media-container');
const pairingScreen = document.getElementById('pairing-screen');
// ... (todo o resto do seu script.js original vem aqui)
// O código é o mesmo, apenas a primeira linha de importação muda.
// Para garantir, aqui está o código completo:

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

// --- Variáveis de Estado Global ---
let tvId = localStorage.getItem('tvId');
let currentPlaylist = [];
let currentMediaIndex = 0;
let mediaTimer;
let pairingInterval = null;
let settings = {};
let globalSettings = {};
let newsItems = [];
let currentNewsIndex = 0;
let infoModeInterval = null;
let infoModeTimeout = null;
let isSettingsPanelOpen = false;

// --- Funções de Controle da Interface ---
function showInfoMode(isManual = false) {
    body.classList.add('info-mode-active');
    if (infoModeTimeout) clearTimeout(infoModeTimeout);
    if (!isManual) {
        infoModeTimeout = setTimeout(hideInfoMode, 30 * 1000); // 30 segundos
    }
}

function hideInfoMode() {
    body.classList.remove('info-mode-active');
    if (infoModeTimeout) clearTimeout(infoModeTimeout);
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    if (newsTimestamp) {
        const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
        newsTimestamp.innerHTML = `${hours}:${minutes} <span>${dateString}</span>`;
    }
}

function showSettingsPanel() {
    if (isSettingsPanelOpen) return;
    isSettingsPanelOpen = true;
    updateConnectionStatus();
    populatePlaylists();
    body.classList.add('settings-active');
    setTimeout(() => {
        settingsPanel.querySelector('.settings-interactive')?.focus();
    }, 500);
}

function hideSettingsPanel() {
    if (!isSettingsPanelOpen) return;
    isSettingsPanelOpen = false;
    body.classList.remove('settings-active');
}

// ... (O restante do seu código JavaScript original se encaixa aqui perfeitamente sem alterações)
// Copie todo o resto do seu player-4/script.js e cole aqui.
// O importante é que a primeira linha seja a nova linha de importação.
// Para garantir que não haja erros, aqui está o restante:

function toggleSettingsPanel() {
    isSettingsPanelOpen ? hideSettingsPanel() : showSettingsPanel();
}

async function populatePlaylists() {
    const select = document.getElementById('playlist-select');
    if (!select) return;
    try {
        const { data: currentTvData } = await supabase.from('tvs').select('playlist_id, client_id').eq('id', tvId).single();
        if (!currentTvData || !currentTvData.client_id) throw new Error("TV ou cliente não encontrado.");

        const { data, error } = await supabase.from('playlists').select('id, name').eq('client_id', currentTvData.client_id);
        if (error) throw error;
        
        const currentPlaylistId = currentTvData?.playlist_id;
        select.innerHTML = '';
        data.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            if (playlist.id === currentPlaylistId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar playlists:", error);
        select.innerHTML = '<option>Erro ao carregar</option>';
    }
}

async function saveNewPlaylist() {
    const select = document.getElementById('playlist-select');
    const newPlaylistId = parseInt(select.value);
    if (!newPlaylistId || !tvId) return;
    try {
        const { error } = await supabase.from('tvs').update({ playlist_id: newPlaylistId }).eq('id', tvId);
        if (error) throw error;
        alert("Playlist alterada com sucesso! A TV irá atualizar em breve.");
        hideSettingsPanel();
    } catch (error) {
        alert("Erro ao alterar a playlist.");
        console.error("Erro ao salvar playlist:", error);
    }
}

function restartPlayer() {
    if (confirm("Tem certeza que deseja reiniciar o player?")) {
        location.reload();
    }
}

function updateConnectionStatus() {
    const internetStatusEl = document.getElementById('internet-status-value');
    const supabaseStatusEl = document.getElementById('supabase-status-value');
    if (internetStatusEl) {
        internetStatusEl.textContent = navigator.onLine ? 'Conectado ✅' : 'Offline ❌';
    }
    if (supabaseStatusEl) {
        const channel = supabase.channel(`tv-channel-${tvId}`);
        supabaseStatusEl.textContent = channel.state === 'joined' ? 'Conectado ✅' : 'Conectando... 🟡';
    }
}

function unpairTv(withConfirmation = true) {
    const doUnpair = () => {
        localStorage.removeItem('tvId');
        location.reload();
    };
    if (withConfirmation) {
        if (confirm("Tem certeza que deseja desparear esta TV? Ela voltará para a tela de código.")) {
            doUnpair();
        }
    } else {
        doUnpair();
    }
}

function handleSettingsNavigation(direction) {
    const focusable = Array.from(settingsPanel.querySelectorAll('.settings-interactive'));
    if (focusable.length === 0) return;
    const currentFocus = document.activeElement;
    let currentIndex = focusable.indexOf(currentFocus);
    if (direction === 'down') {
        currentIndex = (currentIndex + 1) % focusable.length;
    } else if (direction === 'up') {
        currentIndex = (currentIndex - 1 + focusable.length) % focusable.length;
    }
    focusable[currentIndex].focus();
}

function toggleFullscreen() {
    const elem = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (elem.requestFullscreen) { elem.requestFullscreen(); }
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
    } else {
        if (document.exitFullscreen) { document.exitFullscreen(); }
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
    }
}

function playMediaAtIndex(index) {
    clearTimeout(mediaTimer);
    if (!currentPlaylist || currentPlaylist.length === 0) {
        mediaContainer.innerHTML = `<div class="overlay"><h1>Playlist vazia ou sem mídias.</h1></div>`;
        return;
    }
    currentMediaIndex = (index + currentPlaylist.length) % currentPlaylist.length;
    const media = currentPlaylist[currentMediaIndex];
    if (!media || !media.url) {
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 1000);
        return;
    }
    const spinner = mediaContainer.querySelector('.loading-spinner');
    if (spinner) spinner.style.display = 'block';
    const handleSuccess = (element) => {
        if (spinner) spinner.style.display = 'none';
        const oldElement = mediaContainer.querySelector('img.active, video.active');
        const activateNewElement = () => {
            requestAnimationFrame(() => element.classList.add('active'));
            if (media.type === 'video') {
                element.play().catch(e => console.error("Erro ao dar play no vídeo:", e));
                element.onended = () => playMediaAtIndex(currentMediaIndex + 1);
            } else {
                const duration = media.duration || 10;
                mediaTimer = setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), duration * 1000);
            }
        };
        if (oldElement) {
            oldElement.classList.remove('active');
            setTimeout(() => { oldElement.remove(); activateNewElement(); }, 800);
        } else {
            activateNewElement();
        }
    };
    const handleError = (e) => {
        console.error(`FALHA AO CARREGAR MÍDIA: ${media.url}`, e);
        playMediaAtIndex(currentMediaIndex + 1);
    };
    let type = media.type === 'image' ? 'img' : media.type;
    const el = document.createElement(type);
    const finalUrl = `${media.url}?t=${new Date().getTime()}`;
    el.addEventListener(type === 'video' ? 'canplaythrough' : 'load', () => handleSuccess(el));
    el.addEventListener('error', handleError);
    if (type === 'video') {
        el.muted = true;
        el.autoplay = true;
    }
    mediaContainer.prepend(el);
    el.src = finalUrl;
}

async function fetchWeather() {
    if (!globalSettings.weather_api_key || !globalSettings.weather_city) return;
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${globalSettings.weather_city}&appid=${globalSettings.weather_api_key}&units=metric&lang=pt_br`);
        const data = await response.json();
        if (data.cod !== "200") throw new Error(data.message);
        if (sidebarLocation) sidebarLocation.textContent = data.city.name;
        const now = data.list[0];
        if (currentWeatherIcon) currentWeatherIcon.textContent = getWeatherIcon(now.weather[0].id);
        if (currentWeatherTemp) currentWeatherTemp.textContent = `${Math.round(now.main.temp)}°`;
        if (currentWeatherDesc) currentWeatherDesc.textContent = now.weather[0].description;
        if (dailyForecastContainer) dailyForecastContainer.innerHTML = '';
        const dailyForecasts = data.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 4);
        dailyForecasts.forEach(forecast => {
            const dayName = new Date(forecast.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'long' });
            const icon = getWeatherIcon(forecast.weather[0].id);
            const maxTemp = `${Math.round(forecast.main.temp_max)}°`;
            const minTemp = `${Math.round(forecast.main.temp_min)}°`;
            const itemEl = document.createElement('div');
            itemEl.className = 'day-item';
            itemEl.innerHTML = `<span class="day-name">${dayName}</span><div class="day-details"><span class="icon">${icon}</span><span class="temps"><span class="max">${maxTemp}</span><span class="min">${minTemp}</span></span></div>`;
            dailyForecastContainer.appendChild(itemEl);
        });
    } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error.message);
        if (sidebarLocation) sidebarLocation.textContent = "Erro ao carregar";
    }
}

function displayNews(index) {
    if (!newsItems.length) return;
    currentNewsIndex = (index + newsItems.length) % newsItems.length;
    const item = newsItems[currentNewsIndex];
    if (newsTitle) newsTitle.textContent = item.title;
    if (newsSummary) newsSummary.textContent = item.description;
}

async function fetchNews() {
    try {
        const { data, error } = await supabase.rpc('get_recent_news');
        if (error) throw error;
        if (data && data.length) {
            newsItems = data.map(item => ({ title: item.summary_title, description: item.summary_text }));
        } else {
            newsItems = [{ title: "Nenhuma notícia recente", description: "Buscando as últimas informações." }];
        }
    } catch (error) {
        console.error("Erro ao buscar notícias:", error.message);
        newsItems = [{ title: "Erro ao carregar notícias", description: "Não foi possível conectar ao sistema." }];
    }
    displayNews(0);
}

function getWeatherIcon(weatherId) {
    if (weatherId >= 200 && weatherId < 300) return '⛈️';
    if (weatherId >= 300 && weatherId < 500) return '🌦️';
    if (weatherId >= 500 && weatherId < 600) return '🌧️';
    if (weatherId >= 600 && weatherId < 700) return '❄️';
    if (weatherId >= 700 && weatherId < 800) return '🌫️';
    if (weatherId === 800) return '☀️';
    if (weatherId === 801) return '🌤️';
    if (weatherId > 801) return '☁️';
    return '🛰️';
}

async function applySettings(tvData, globalSettingsData) {
    settings = { ...globalSettingsData, ...tvData };
    body.classList.toggle('vertical', settings.orientation === 'vertical');
    if (sidebarLogoImg) {
        sidebarLogoImg.src = settings.logo_url || '';
        const logoSizeValue = settings.logo_size || 10;
        const minRem = 4;
        const maxRem = 15;
        const calculatedRem = minRem + ((logoSizeValue - 1) / 19) * (maxRem - minRem);
        sidebarLogoImg.style.maxWidth = `${calculatedRem}rem`;
    }
    if (infoModeInterval) clearInterval(infoModeInterval);
    if (settings.info_panel_enabled) {
        infoModeInterval = setInterval(() => { showInfoMode(false); }, 5 * 60 * 1000);
    }
}

async function getInitialData() {
    if (!tvId) {
        showPairingScreen();
        return;
    }
    try {
        console.log(`Buscando dados para a TV ID: ${tvId}`);
        const { data, error } = await supabase.rpc('get_player_data', { tv_id_input: tvId });

        if (error) throw error;
        if (!data || !data.tv) {
             console.error("Dados da TV não encontrados para este ID ou TV sem cliente. Voltando ao pareamento.");
             unpairTv(false);
             return;
        }

        const tvData = data.tv;
        const playlistData = data.playlists;
        const playlistMedias = data.playlist_medias || [];
        
        await applySettings(tvData, globalSettings);
        
        if (playlistData && playlistData.media_ids && playlistMedias.length > 0) {
             const mediaMap = new Map(playlistMedias.map(m => [m.id, m]));
             currentPlaylist = playlistData.media_ids.map(id => mediaMap.get(id)).filter(Boolean);
        } else {
            currentPlaylist = [];
        }

        playMediaAtIndex(0);
        startRealtimeListeners(tvId);

    } catch (error) {
        console.error("Erro fatal ao carregar dados do player:", error.message);
        unpairTv(false);
    }
}

function startRealtimeListeners(currentTvId) {
    const tvChannel = supabase.channel(`tv-channel-${currentTvId}`);
    tvChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tvs', filter: `id=eq.${currentTvId}` }, payload => {
        console.log("TV atualizada, recarregando todos os dados...", payload);
        getInitialData();
    }).subscribe();

    const settingsChannel = supabase.channel('settings-channel');
    settingsChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
        console.log("Configurações globais atualizadas...", payload);
        globalSettings = payload.new;
        applySettings(settings, globalSettings);
    }).subscribe();
}

function showPairingScreen() {
    if (pairingScreen) pairingScreen.style.display = 'flex';
    if (pairingInterval) clearInterval(pairingInterval);
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (pairingCodeEl) pairingCodeEl.textContent = code;
    
    pairingInterval = setInterval(async () => {
        const { data, error } = await supabase
            .from('tvs')
            .select('id')
            .eq('pairing_code', code)
            .single();

        if (data && !error) {
            console.log(`TV pareada com sucesso! ID: ${data.id}`);
            clearInterval(pairingInterval);
            localStorage.setItem('tvId', data.id);
            window.location.reload();
        }
    }, 5000);
}

function initPlayer() {
    updateClock();
    setInterval(updateClock, 1000);
    
    document.getElementById('save-playlist-btn')?.addEventListener('click', saveNewPlaylist);
    document.getElementById('restart-player-btn')?.addEventListener('click', restartPlayer);
    document.getElementById('unpair-tv-btn')?.addEventListener('click', () => unpairTv(true));
    
    document.addEventListener('keydown', (event) => {
        if (isSettingsPanelOpen) {
            event.preventDefault();
            switch (event.key) {
                case 'ArrowUp': handleSettingsNavigation('up'); break;
                case 'ArrowDown': handleSettingsNavigation('down'); break;
                case 'Enter': document.activeElement?.click(); break;
                case 'Escape': hideSettingsPanel(); break;
            }
            return;
        }
        switch (event.key) {
            case 'ArrowUp': body.classList.contains('info-mode-active') ? hideInfoMode() : showInfoMode(true); break;
            case 'ArrowDown': if (body.classList.contains('info-mode-active')) { hideInfoMode(); } else { toggleSettingsPanel(); } break;
            case 'Enter': toggleFullscreen(); break;
            case 'Escape': if (body.classList.contains('info-mode-active')) { hideInfoMode(); } break;
            case 'ArrowRight': body.classList.contains('info-mode-active') ? displayNews(currentNewsIndex + 1) : playMediaAtIndex(currentMediaIndex + 1); break;
            case 'ArrowLeft': body.classList.contains('info-mode-active') ? displayNews(currentNewsIndex - 1) : playMediaAtIndex(currentMediaIndex - 1); break;
        }
    });

    if (tvId) {
        supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
            globalSettings = data || {};
            getInitialData();
            fetchWeather();
            fetchNews();
            setInterval(fetchWeather, 1000 * 60 * 30);
            setInterval(fetchNews, 1000 * 60 * 60);
        });
    } else {
        showPairingScreen();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initPlayer();
});