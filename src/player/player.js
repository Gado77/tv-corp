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

let newsItems = [];
let currentNewsIndex = 0

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
        // Usa a função RPC segura para buscar as playlists
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

// Substitua a sua função playMediaAtIndex antiga por esta
function playMediaAtIndex(index) {
    clearTimeout(mediaTimer);
    const spinner = mediaContainer.querySelector('.loading-spinner');

    if (!currentPlaylist || currentPlaylist.length === 0) {
        if(spinner) spinner.style.display = 'none'; // Esconde o spinner se a playlist estiver vazia
        mediaContainer.innerHTML = `<div class="overlay"><h1>Nenhuma playlist selecionada.</h1><p>Por favor, associe uma playlist a esta TV no painel de administração.</p></div>`;
        return;
    }
    
    if(spinner) spinner.style.display = 'block'; // Mostra o spinner no início de cada mídia

    currentMediaIndex = (index + currentPlaylist.length) % currentPlaylist.length;
    const media = currentPlaylist[currentMediaIndex];

    if (!media || !media.url) {
        console.warn("Mídia inválida encontrada, a pular...");
        if(spinner) spinner.style.display = 'none';
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 500);
        return;
    }

    const oldElement = mediaContainer.querySelector('img, video');
    if (oldElement) {
        oldElement.classList.remove('active');
        setTimeout(() => oldElement.remove(), 800);
    }
    
    const elementType = media.type === 'image' ? 'img' : 'video';
    const newElement = document.createElement(elementType);

    const onMediaReady = () => {
        if(spinner) spinner.style.display = 'none'; // Esconde o spinner
        newElement.classList.add('active');
        if (elementType === 'video') {
            newElement.play().catch(e => console.error("Erro ao dar play no vídeo:", e));
            newElement.onended = () => playMediaAtIndex(currentMediaIndex + 1);
        } else {
            const duration = media.duration || 10;
            mediaTimer = setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), duration * 1000);
        }
    };
    
    const onMediaError = () => {
        console.error(`Falha ao carregar mídia: ${media.url}`);
        if(spinner) spinner.style.display = 'none'; // Esconde o spinner em caso de erro
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 500); // Tenta a próxima mídia
    };

    newElement.addEventListener('load', onMediaReady);
    newElement.addEventListener('canplaythrough', onMediaReady);
    newElement.addEventListener('error', onMediaError);

    if (elementType === 'video') {
        newElement.muted = true;
        newElement.autoplay = true;
        newElement.playsInline = true;
    }
    
    newElement.src = `${media.url}?t=${new Date().getTime()}`;
    mediaContainer.prepend(newElement);
}

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
        
        // Preenche a variável global newsItems
        newsItems = data && data.length ? data.map(item => ({ title: item.summary_title, description: item.summary_text })) : [];
        
        if (newsItems.length > 0) {
            displayNews(0); // Exibe a primeira notícia assim que são carregadas
        } else {
            newsTitle.textContent = "Sem notícias recentes.";
        }
    } catch (error) {
        console.error("Erro ao buscar notícias:", error.message);
        newsTitle.textContent = "Erro ao carregar notícias.";
    }
}

function displayNews(index) {
    if (!newsItems || newsItems.length === 0) return;

    // Garante que o índice seja sempre válido e que a navegação seja circular
    currentNewsIndex = (index + newsItems.length) % newsItems.length;
    
    const item = newsItems[currentNewsIndex];
    if (newsTitle) newsTitle.textContent = item.title;
    if (newsSummary) newsSummary.textContent = item.description;
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
    
    pairingScreen.style.display = 'flex';
    pairingCodeEl.textContent = "Conectando...";

    try {
        const { data, error } = await supabase.rpc('get_player_data', { tv_id_input: tvId });
        if (error) throw error;

        // Verificação final e robusta
        if (!data || !data.tv || !data.tv.client_id) {
             console.error("TV não pareada ou sem cliente. Voltando à tela de código.");
             setTimeout(() => unpairTv(false), 3000);
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
        setTimeout(() => unpairTv(false), 3000);
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

async function showPairingScreen() {
    pairingScreen.style.display = 'flex';
    if (pairingChannel) supabase.removeChannel(pairingChannel);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    pairingCodeEl.textContent = code;

    try {
        const { error: insertError } = await supabase
            .from('tvs')
            .insert({ pairing_code: code }, { returning: 'minimal' });
            
        if (insertError) throw insertError;

        console.log(`TV registada com o código ${code}. A aguardar pareamento...`);

        pairingChannel = supabase
            .channel(`pairing-channel-${code}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tvs',
                    filter: `pairing_code=eq.${code}`
                },
                (payload) => {
                    if (payload.new.client_id) {
                        console.log('Pareamento recebido!', payload.new);
                        
                        localStorage.setItem('tvId', payload.new.id); 
                        tvId = payload.new.id;
                        
                        if (pairingChannel) supabase.removeChannel(pairingChannel);
                        
                        // Em vez de recarregar, chama a função de carregar dados diretamente
                        getInitialData(); 
                    }
                }
            )
            .subscribe();

    } catch (error) {
        console.error("Erro ao criar TV para pareamento:", error.message);
        pairingCodeEl.textContent = "ERRO";
    }
}

function initPlayer() {
    updateClock();
    setInterval(updateClock, 30000);
    
    // Adiciona "escutadores" de eventos para os botões no painel de configurações
    document.getElementById('save-playlist-btn')?.addEventListener('click', saveNewPlaylist);
    document.getElementById('restart-player-btn')?.addEventListener('click', restartPlayer);
    document.getElementById('unpair-tv-btn')?.addEventListener('click', () => unpairTv(true));
    
    // Adiciona o "escutador" principal para os eventos de teclado
   // Substitua o seu bloco addEventListener('keydown') por este

document.addEventListener('keydown', (event) => {
    // Se o painel de configurações estiver aberto, a navegação é SÓ dentro dele
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

    // Se o painel de configurações NÃO estiver aberto, usa a lógica de controlo principal
    switch (event.key) {
        case 'ArrowUp':
            body.classList.contains('info-mode-active') ? hideInfoMode() : showInfoMode();
            break;

        case 'ArrowDown':
            if (!body.classList.contains('info-mode-active')) {
                toggleSettingsPanel();
            }
            break;

        case 'Escape':
            hideInfoMode();
            hideSettingsPanel();
            break;

        case 'Enter':
            if (!isSettingsPanelOpen && !body.classList.contains('info-mode-active')) {
                toggleFullscreen();
            }
            break;
        
        // ***** LÓGICA DE NAVEGAÇÃO ADICIONADA AQUI *****
        case 'ArrowRight':
            // Se o modo de info estiver ativo, avança a notícia. Se não, avança a mídia.
            if (body.classList.contains('info-mode-active')) {
                displayNews(currentNewsIndex + 1);
            } else {
                playMediaAtIndex(currentMediaIndex + 1);
            }
            break;

        case 'ArrowLeft':
            // Se o modo de info estiver ativo, retrocede a notícia. Se não, retrocede a mídia.
            if (body.classList.contains('info-mode-active')) {
                displayNews(currentNewsIndex - 1);
            } else {
                playMediaAtIndex(currentMediaIndex - 1);
            }
            break;
    }
});

    // Inicia o processo de carregar os dados do Player
    getInitialData();
}

// Garante que a função initPlayer() seja chamada quando a página terminar de carregar
window.addEventListener('DOMContentLoaded', initPlayer);