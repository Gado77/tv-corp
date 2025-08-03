import { supabase } from '../shared/js/supabase-client.js';

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

// --- Variáveis de Estado Global ---
let tvId = localStorage.getItem('tvId');
let currentPlaylist = [];
let currentMediaIndex = 0;
let mediaTimer;
let realtimeChannel = null;
let pairingChannel = null;
let settings = {};
let isSettingsPanelOpen = false;

// --- Funções de Controle da Interface ---
function showInfoMode() {
    body.classList.add('info-mode-active');
}

function hideInfoMode() {
    body.classList.remove('info-mode-active');
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

function toggleSettingsPanel() {
    isSettingsPanelOpen ? hideSettingsPanel() : showSettingsPanel();
}

async function populatePlaylists() {
    const select = document.getElementById('playlist-select');
    if (!select || !tvId) return;
    try {
        const { data, error } = await supabase.rpc('get_playlists_for_tv', { tv_id_input: tvId });
        if (error) throw error;
        
        select.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = playlist.name;
                if (playlist.id === settings.playlist_id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option>Nenhuma playlist encontrada</option>';
        }
    } catch (error) {
        console.error("Erro ao buscar playlists:", error);
        select.innerHTML = '<option>Erro ao carregar</option>';
    }
}

async function saveNewPlaylist() {
    const select = document.getElementById('playlist-select');
    const newPlaylistId = select.value;
    if (!newPlaylistId || !tvId) return;
    try {
        const { error } = await supabase.from('tvs').update({ playlist_id: newPlaylistId }).eq('id', tvId);
        if (error) throw error;
        alert("Playlist alterada com sucesso! A TV irá atualizar em breve.");
        hideSettingsPanel();
    } catch (error) {
        alert("Erro ao alterar a playlist.");
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
    if (internetStatusEl) internetStatusEl.textContent = navigator.onLine ? 'Conectado ✅' : 'Offline ❌';
    if (supabaseStatusEl) supabaseStatusEl.textContent = realtimeChannel && realtimeChannel.state === 'joined' ? 'Conectado ✅' : 'Conectando... 🟡';
}

function unpairTv(withConfirmation = true) {
    const doUnpair = () => {
        localStorage.removeItem('tvId');
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        if (pairingChannel) supabase.removeChannel(pairingChannel);
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
    if (direction === 'down') currentIndex = (currentIndex + 1) % focusable.length;
    else if (direction === 'up') currentIndex = (currentIndex - 1 + focusable.length) % focusable.length;
    focusable[currentIndex].focus();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(err.message));
    } else {
        document.exitFullscreen();
    }
}

function playMediaAtIndex(index) {
    clearTimeout(mediaTimer);
    if (!currentPlaylist || currentPlaylist.length === 0) {
        mediaContainer.innerHTML = `<div class="overlay"><h1>Playlist vazia ou sem mídias.</h1><p>Aguardando conteúdo do painel admin...</p></div>`;
        return;
    }
    currentMediaIndex = (index + currentPlaylist.length) % currentPlaylist.length;
    const media = currentPlaylist[currentMediaIndex];
    if (!media || !media.url) {
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 1000);
        return;
    }
    const oldElement = mediaContainer.querySelector('img, video');
    if (oldElement) {
        oldElement.classList.remove('active');
        setTimeout(() => oldElement.remove(), 800);
    }
    const elementType = media.type === 'image' ? 'img' : 'video';
    const newElement = document.createElement(elementType);
    newElement.onload = newElement.oncanplaythrough = () => {
        newElement.classList.add('active');
        if (elementType === 'video') {
            newElement.play().catch(e => console.error("Erro ao dar play no vídeo:", e));
            newElement.onended = () => playMediaAtIndex(currentMediaIndex + 1);
        } else {
            const duration = media.duration || 10;
            mediaTimer = setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), duration * 1000);
        }
    };
    newElement.onerror = () => playMediaAtIndex(currentMediaIndex + 1);
    if (elementType === 'video') {
        newElement.muted = true;
        newElement.autoplay = true;
        newElement.playsInline = true;
    }
    newElement.src = `${media.url}?t=${new Date().getTime()}`;
    mediaContainer.prepend(newElement);
}

// --- FIM DA PARTE 1 de 2 ---
// --- INÍCIO DA PARTE 2 de 2 ---

async function fetchWeather() {
    if (!settings.weather_api_key || !settings.weather_city) return;
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${settings.weather_city}&appid=${settings.weather_api_key}&units=metric&lang=pt_br`);
        const data = await response.json();
        if (data.cod !== "200") throw new Error(data.message);
        
        sidebarLocation.textContent = data.city.name;
        const now = data.list[0];
        currentWeatherTemp.textContent = `${Math.round(now.main.temp)}°`;
        currentWeatherDesc.textContent = now.weather[0].description;
        
        dailyForecastContainer.innerHTML = '';
        const dailyForecasts = data.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 4);
        dailyForecasts.forEach(forecast => {
            const dayName = new Date(forecast.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'long' });
            dailyForecastContainer.innerHTML += `<div class="day-item"><span class="day-name">${dayName}</span><div class="day-details"><span class="temps"><span class="max">${Math.round(forecast.main.temp_max)}°</span><span class="min">${Math.round(forecast.main.temp_min)}°</span></span></div></div>`;
        });
    } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error.message);
        sidebarLocation.textContent = "Erro de Clima";
    }
}

async function fetchNews() {
    try {
        const { data, error } = await supabase.rpc('get_recent_news');
        if (error) throw error;
        const newsItems = data && data.length ? data.map(item => ({ title: item.summary_title, description: item.summary_text })) : [];
        if (newsItems.length > 0) {
            let currentNewsIndex = 0;
            const display = () => {
                if (!document.body.classList.contains('info-mode-active')) return;
                const item = newsItems[currentNewsIndex];
                newsTitle.textContent = item.title;
                newsSummary.textContent = item.description;
                currentNewsIndex = (currentNewsIndex + 1) % newsItems.length;
            };
            display();
            setInterval(display, 15000); // Muda a notícia a cada 15 segundos
        } else {
            newsTitle.textContent = "Sem notícias recentes.";
        }
    } catch (error) {
        console.error("Erro ao buscar notícias:", error.message);
        newsTitle.textContent = "Erro ao carregar notícias.";
    }
}

function applySettings(tvData, clientSettingsData) {
    settings = { ...(clientSettingsData || {}), ...(tvData || {}) };
    body.classList.toggle('vertical', settings.orientation === 'vertical');
    if (sidebarLogoImg && settings.logo_url) {
        sidebarLogoImg.src = settings.logo_url;
        const logoSize = Math.max(1, Math.min(20, settings.logo_size || 10));
        const minRem = 4, maxRem = 15;
        sidebarLogoImg.style.maxWidth = `${minRem + ((logoSize - 1) / 19) * (maxRem - minRem)}rem`;
    }
}

async function getInitialData() {
    if (!tvId) {
        showPairingScreen();
        return;
    }
    try {
        const { data, error } = await supabase.rpc('get_player_data', { tv_id_input: tvId });
        if (error) throw error;

        if (!data || !data.tv || !data.tv.client_id || !data.playlist) {
             console.error("Pareamento incompleto. TV não tem cliente ou playlist associada. Voltando à tela de código.");
             unpairTv(false);
             return;
        }
        
        pairingScreen.style.display = 'none';
        applySettings(data.tv, data.client_settings);
        currentPlaylist = data.playlist_medias || [];
        playMediaAtIndex(0);
        startRealtimeListeners(tvId);
        fetchWeather();
        fetchNews();
    } catch (error) {
        console.error("Erro fatal ao carregar dados do player:", error.message);
        unpairTv(false);
    }
}

function startRealtimeListeners(currentTvId) {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase.channel(`tv-channel-${currentTvId}`);
    realtimeChannel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tvs', filter: `id=eq.${currentTvId}` }, 
        () => getInitialData()
    ).subscribe();
}

// Substitua a sua função showPairingScreen antiga por esta
async function showPairingScreen() {
    pairingScreen.style.display = 'flex';
    if (pairingChannel) supabase.removeChannel(pairingChannel);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    pairingCodeEl.textContent = code;

    try {
        // CORREÇÃO: Em vez de 'insert', chama a nossa nova função RPC segura
        const { data: newTvId, error } = await supabase.rpc('register_new_tv', {
            pairing_code_input: code
        });
        
        if (error) throw error;
        
        // Fica a escutar por atualizações na TV que acabamos de criar
        pairingChannel = supabase
            .channel(`pairing-channel-${newTvId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'tvs', filter: `id=eq.${newTvId}`
            }, (payload) => {
                if (payload.new.client_id) {
                    console.log(`TV pareada com sucesso! ID: ${newTvId}`);
                    localStorage.setItem('tvId', newTvId);
                    if (pairingChannel) supabase.removeChannel(pairingChannel);
                    location.reload();
                }
            })
            .subscribe();

    } catch (error) {
        console.error("Erro ao criar TV para pareamento:", error.message);
        pairingCodeEl.textContent = "ERRO";
    }
}

function initPlayer() {
    updateClock();
    setInterval(updateClock, 30000);
    
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
            case 'ArrowUp': showInfoMode(); break;
            case 'ArrowDown': toggleSettingsPanel(); break;
            case 'Escape': hideInfoMode(); break;
            case 'Enter': toggleFullscreen(); break;
        }
    });
    getInitialData();
}

window.addEventListener('DOMContentLoaded', initPlayer);