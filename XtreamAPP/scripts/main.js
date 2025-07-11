console.log('main.js carregado.');

let currentSection = 'live';
let credentials = {};
let seriesInfo = {};
let currentSeriesId = null;
let historyStack = [];

chrome.storage.local.get(['host', 'username', 'password'], (result) => {
    credentials = {
        host: result.host,
        username: result.username,
        password: result.password
    };
    console.log('Credenciais carregadas:', credentials);
    
    if (!credentials.host || !credentials.username || !credentials.password) {
        console.log('Nenhuma credencial encontrada, redirecionando para index.html');
        window.location.href = chrome.runtime.getURL('index.html');
        window.location.hash = '';
    } else {
        console.log('Credenciais válidas, inicializando com loadSection("live")');
        loadSection('live');
        attachEventListeners();
    }
});

function attachEventListeners() {
    console.log('Anexando event listeners.');
    const sectionSelect = document.getElementById('sectionSelect');
    const searchButton = document.getElementById('searchButton');
    const accountButton = document.getElementById('accountButton');
    const logoutButton = document.getElementById('logoutButton');
    const playEpisodeButton = document.getElementById('playEpisodeButton');
    const backButton = document.getElementById('backButton');
    
    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => loadSection(sectionSelect.value));
        console.log('Event listener anexado ao sectionSelect.');
    } else {
        console.error('sectionSelect não encontrado.');
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', globalSearch);
        console.log('Event listener anexado ao searchButton.');
    } else {
        console.error('searchButton não encontrado.');
    }
    
    if (accountButton) {
        accountButton.addEventListener('click', showAccountInfo);
        console.log('Event listener anexado ao accountButton.');
    } else {
        console.error('accountButton não encontrado.');
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
        console.log('Event listener anexado ao logoutButton.');
    } else {
        console.error('logoutButton não encontrado.');
    }
    
    if (playEpisodeButton) {
        playEpisodeButton.addEventListener('click', playEpisode);
        console.log('Event listener anexado ao playEpisodeButton.');
    } else {
        console.error('playEpisodeButton não encontrado.');
    }
    
    if (backButton) {
        backButton.addEventListener('click', goBack);
        console.log('Event listener anexado ao backButton.');
    } else {
        console.error('backButton não encontrado.');
    }
    
    const seasonSelect = document.getElementById('season-select');
    if (seasonSelect) {
        seasonSelect.addEventListener('change', updateEpisodes);
        console.log('Event listener anexado ao season-select.');
    } else {
        console.error('season-select não encontrado.');
    }
}

function logout() {
    console.log('Fazendo logout, removendo credenciais do storage.');
    chrome.storage.local.remove(['host', 'username', 'password'], () => {
        historyStack = [];
        window.location.href = chrome.runtime.getURL('index.html');
        window.location.hash = '';
    });
}

function loadSection(section) {
    currentSection = section;
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    document.getElementById('content-grid').style.display = 'grid';
    document.getElementById('backButton').style.display = 'none';
    console.log('Carregando seção:', section);
    
    historyStack = [{ type: 'section', section }];
    console.log('Histórico atualizado:', historyStack);
    
    fetchCategories(section);
}

function fetchCategories(section) {
    if (!credentials.host || !credentials.username || !credentials.password) {
        console.error('Credenciais inválidas ao buscar categorias:', credentials);
        alert('Erro: Credenciais não disponíveis. Redirecionando para login.');
        window.location.href = chrome.runtime.getURL('index.html');
        window.location.hash = '';
        return;
    }

    const action = section === 'live' ? 'get_live_categories' :
                  section === 'movies' ? 'get_vod_categories' : 'get_series_categories';
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=${action}`;
    console.log('Buscando categorias:', { section, action, url });

    fetch(url)
        .then(response => {
            console.log('Resposta da API de categorias:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(categories => {
            const sidebar = document.getElementById('categories');
            sidebar.innerHTML = '<ul>' + categories.map(cat => `<li data-section="${section}" data-category-id="${cat.category_id}" data-category-name="${cat.category_name}">${cat.category_name}</li>`).join('') + '</ul>';
            attachCategoryListeners(section);
            if (categories.length > 0) {
                loadCategory(section, categories[0].category_id, categories[0].category_name);
            } else {
                console.log('Nenhuma categoria disponível, limpando content-grid');
                const contentGrid = document.getElementById('content-grid');
                contentGrid.innerHTML = '<p>Nenhuma categoria disponível.</p>';
                contentGrid.style.display = 'grid';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar categorias:', error);
            alert('Erro ao carregar categorias: ' + error.message);
        });
}

function attachCategoryListeners(section) {
    const categoryItems = document.querySelectorAll('#categories li');
    console.log(`Anexando listeners para ${categoryItems.length} itens de categoria na seção ${section}`);
    categoryItems.forEach(item => {
        item.removeEventListener('click', handleCategoryClick);
        item.addEventListener('click', handleCategoryClick);
    });
}

function handleCategoryClick(event) {
    const item = event.currentTarget;
    const section = item.dataset.section;
    const categoryId = item.dataset.categoryId;
    const categoryName = item.dataset.categoryName;
    console.log('Categoria clicada:', { section, categoryId, categoryName });
    loadCategory(section, categoryId, categoryName);
}

function loadCategory(section, categoryId, categoryName) {
    const action = section === 'live' ? 'get_live_streams' :
                  section === 'movies' ? 'get_vod_streams' : 'get_series';
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=${action}&category_id=${categoryId}`;
    console.log('Buscando itens da categoria:', { section, categoryId, categoryName, url });

    if (historyStack.length === 0 || historyStack[historyStack.length - 1].type !== 'category' ||
        historyStack[historyStack.length - 1].categoryId !== categoryId) {
        historyStack.push({ type: 'category', section, categoryId, categoryName });
        console.log('Histórico atualizado:', historyStack);
    }

    // Ensure other views are hidden
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    const contentGrid = document.getElementById('content-grid');
    contentGrid.style.display = 'none'; // Hide initially to avoid flicker
    contentGrid.innerHTML = ''; // Clear previous content
    document.getElementById('backButton').style.display = 'inline-block';

    fetch(url)
        .then(response => {
            console.log('Resposta da API de itens:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(items => {
            console.log('Itens recebidos:', items);
            contentGrid.innerHTML = items.length > 0 ? items.map(item => {
                const imageSrc = section === 'series' ? (item.cover || 'https://via.placeholder.com/150') : (item.stream_icon || 'https://via.placeholder.com/150');
                return `
                    <div class="content-item" data-section="${section}" data-stream-id="${item.stream_id || item.series_id}" data-name="${item.name}" data-icon="${imageSrc}">
                        <img src="${imageSrc}" alt="${item.name}">
                        <p class="title">${item.name}</p>
                    </div>
                `;
            }).join('') : '<p>Nenhum item disponível.</p>';
            contentGrid.style.display = 'grid'; // Show after updating
            console.log('Content-grid atualizado:', contentGrid.innerHTML);

            // Trigger reflow to ensure DOM update
            contentGrid.offsetHeight;

            const contentItems = contentGrid.querySelectorAll('.content-item');
            console.log(`Anexando listeners para ${contentItems.length} itens de conteúdo`);
            contentItems.forEach(item => {
                item.removeEventListener('click', handleContentItemClick);
                item.addEventListener('click', handleContentItemClick);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar itens:', error);
            contentGrid.innerHTML = '<p>Erro ao carregar itens.</p>';
            contentGrid.style.display = 'grid';
            alert('Erro ao carregar itens: ' + error.message);
        });
}

function handleContentItemClick(event) {
    const item = event.currentTarget;
    const section = item.dataset.section;
    const streamId = item.dataset.streamId;
    const name = item.dataset.name;
    const icon = item.dataset.icon;
    console.log('Item de conteúdo clicado:', { section, streamId, name });
    playStream(section, streamId, name, icon);
}

function playStream(section, streamId, name, icon) {
    console.log('Reproduzindo stream:', { section, streamId, name });
    document.getElementById('content-grid').style.display = 'none';
    const playerDiv = document.getElementById('video-player');
    const videoTitle = document.getElementById('video-title');
    const videoInfo = document.getElementById('video-info');
    const seriesSelector = document.getElementById('series-selector');
    playerDiv.style.display = 'block';
    videoTitle.textContent = name;
    videoInfo.innerHTML = '';
    videoInfo.style.display = 'none';
    document.getElementById('backButton').style.display = 'inline-block';

    if (historyStack.length === 0 || historyStack[historyStack.length - 1].type !== 'stream' ||
        historyStack[historyStack.length - 1].streamId !== streamId) {
        historyStack.push({ type: 'stream', section, streamId, name, icon });
        console.log('Histórico atualizado:', historyStack);
    }

    if (section === 'movies') {
        const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_vod_info&vod_id=${streamId}`;
        console.log('Buscando informações do filme:', url);
        fetch(url)
            .then(response => {
                console.log('Resposta da API de filme:', response.status, response.statusText);
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Informações do filme:', data);
                const genre = data.info && data.info.genre ? data.info.genre : 'N/A';
                const synopsis = data.info && data.info.plot ? data.info.plot : 'Sem descrição';
                videoInfo.innerHTML = `
                    <p class="genre"><strong>Gênero:</strong> ${genre}</p>
                    <p class="description">${synopsis}</p>
                `;
                videoInfo.style.display = 'block';
            })
            .catch(error => {
                console.error('Erro ao carregar informações do filme:', error);
                videoInfo.innerHTML = '<p>Erro ao carregar informações.</p>';
                videoInfo.style.display = 'block';
            });
    } else if (section === 'series') {
        currentSeriesId = streamId;
        fetchSeriesInfo(streamId);
        seriesSelector.style.display = 'block';
    } else {
        videoInfo.style.display = 'none';
    }

    const player = videojs('player');
    if (section !== 'series') {
        seriesSelector.style.display = 'none';
        const streamUrl = `${credentials.host}/${section === 'live' ? 'live' : 'movie'}/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${streamId}.${section === 'movies' ? 'mp4' : 'm3u8'}`;
        console.log('URL do stream:', streamUrl);
        if (section === 'movies') {
            player.src({
                src: streamUrl,
                type: 'video/mp4'
            });
        } else {           
            player.src({
                src: streamUrl,
                type: 'application/x-mpegURL'
            });
        }
        player.play();
    }

    if (section === 'live') {
        fetchEPG(streamId);
    } else {
        document.getElementById('epg').style.display = 'none';
    }
}

function fetchSeriesInfo(seriesId) {
    console.log('Buscando informações da série:', seriesId);
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_series_info&series_id=${seriesId}`;
    fetch(url)
        .then(response => {
            console.log('Resposta da API de série:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            seriesInfo = data;
            const seasonSelect = document.getElementById('season-select');
            seasonSelect.innerHTML = '<option value="">Selecione a temporada</option>';
            if (data.seasons && Array.isArray(data.seasons)) {
                data.seasons.forEach(season => {
                    const option = document.createElement('option');
                    option.value = season.season_number;
                    option.textContent = `Temporada ${season.season_number}`;
                    seasonSelect.appendChild(option);
                });
            }
            updateEpisodes();

            console.log('Informações da série:', data);
            const videoInfo = document.getElementById('video-info');
            const genre = data.info && data.info.genre ? data.info.genre : 'N/A';
            const synopsis = data.info && data.info.plot ? data.info.plot : 'Sem descrição';
            videoInfo.innerHTML = `
                <p class="genre"><strong>Gênero:</strong> ${genre}</p>
                <p class="description">${synopsis}</p>
            `;
            videoInfo.style.display = 'block';
        })
        .catch(error => {
            console.error('Erro ao carregar informações da série:', error);
            const videoInfo = document.getElementById('video-info');
            videoInfo.innerHTML = '<p>Erro ao carregar informações.</p>';
            videoInfo.style.display = 'block';
            document.getElementById('series-selector').style.display = 'none';
        });
}

function updateEpisodes() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    const selectedSeason = seasonSelect.value;
    episodeSelect.innerHTML = '<option value="">Selecione o episódio</option>';

    if (selectedSeason && seriesInfo && seriesInfo.episodes && seriesInfo.episodes[selectedSeason]) {
        seriesInfo.episodes[selectedSeason].forEach(episode => {
            const option = document.createElement('option');
            option.value = episode.id;
            option.textContent = episode.title || `Episódio ${episode.episode_num}`;
            episodeSelect.appendChild(option);
        });
    }
}

function playEpisode() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    const selectedEpisodeId = episodeSelect.value;

    if (selectedEpisodeId && seriesInfo && seriesInfo.episodes && seriesInfo.episodes[seasonSelect.value]) {
        const episode = seriesInfo.episodes[seasonSelect.value].find(ep => ep.id === selectedEpisodeId);
        if (episode) {
            const player = videojs('player');
            const streamUrl = `${credentials.host}/series/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${selectedEpisodeId}.${episode.container_extension || 'm3u8'}`;
            console.log('URL do episódio:', streamUrl);
            if (episode.container_extension === 'mp4') {
                player.src({
                    src: streamUrl,
                    type: 'video/mp4'
                });
            } else {           
                player.src({
                    src: streamUrl,
                    type: 'application/x-mpegURL'
                });
            }            
            player.play();
        }
    }
}

function fetchEPG(streamId) {
    console.log('Buscando EPG para stream:', streamId);
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_short_epg&stream_id=${streamId}`;
    fetch(url)
        .then(response => {
            console.log('Resposta da API de EPG:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const epgDiv = document.getElementById('epg');
            if (data.epg_listings && Array.isArray(data.epg_listings)) {
                epgDiv.innerHTML = data.epg_listings.map(program => {
                    const startTimestamp = program.start_timestamp || null;
                    const endTimestamp = program.stop_timestamp || null;
                    const start = startTimestamp ? new Date(startTimestamp * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';
                    const end = endTimestamp ? new Date(endTimestamp * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';
                    let title = 'Sem título';
                    let description = '';
                    try {
                        title = program.title ? decodeURIComponent(escape(atob(program.title))) : 'Sem título';
                        description = program.description ? decodeURIComponent(escape(atob(program.description))) : '';
                    } catch (e) {
                        console.error('Erro ao decodificar título ou descrição:', e);
                    }
                    if (!title || title.trim() === '') {
                        title = 'Sem título';
                    }
                    if (!description || description.trim() === '') {
                        description = 'Sem descrição';
                    }

                    return `
                        <div>
                            <strong>${title}</strong>
                            <p>${start} - ${end}</p>
                            <p>${description}</p>
                        </div>
                    `;
                }).join('');
                epgDiv.style.display = 'block';
            } else {
                epgDiv.innerHTML = '<p>Nenhum EPG disponível.</p>';
                epgDiv.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar EPG:', error);
            alert('Erro ao carregar EPG: ' + error.message);
            document.getElementById('epg').style.display = 'none';
        });
}

function globalSearch() {
    const query = document.getElementById('search').value.toLowerCase();
    console.log('Pesquisando:', query);
    if (!query) {
        loadSection(currentSection);
        return;
    }
    
    if (historyStack.length === 0 || historyStack[historyStack.length - 1].type !== 'search' ||
        historyStack[historyStack.length - 1].query !== query) {
        historyStack.push({ type: 'search', query });
        console.log('Histórico atualizado:', historyStack);
    }
    document.getElementById('backButton').style.display = 'inline-block';

    // Hide other views and clear content-grid
    const contentGrid = document.getElementById('content-grid');
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    contentGrid.style.display = 'none';
    contentGrid.innerHTML = '';

    const liveUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_live_streams`;
    fetch(liveUrl)
        .then(response => {
            console.log('Resposta da API de live streams:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(live => {
            console.log('Live streams recebidos:', live);
            const liveResults = Array.isArray(live) ? live.filter(item => {
                const name = item.name || '';
                const matches = name.toLowerCase().includes(query);
                console.log(`Filtrando live item: ${name}, matches: ${matches}`);
                return matches;
            }).map(item => ({ section: 'live', ...item })) : [];
            console.log('Live results:', liveResults);

            const vodUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_vod_streams`;
            fetch(vodUrl)
                .then(response => {
                    console.log('Resposta da API de VOD:', response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(vod => {
                    console.log('VOD streams recebidos:', vod);
                    const vodResults = Array.isArray(vod) ? vod.filter(item => {
                        const name = item.name || '';
                        const matches = name.toLowerCase().includes(query);
                        console.log(`Filtrando VOD item: ${name}, matches: ${matches}`);
                        return matches;
                    }).map(item => ({ section: 'movies', ...item })) : [];
                    console.log('VOD results:', vodResults);

                    const seriesUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_series`;
                    fetch(seriesUrl)
                        .then(response => {
                            console.log('Resposta da API de séries:', response.status, response.statusText);
                            if (!response.ok) {
                                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(series => {
                            console.log('Séries recebidas:', series);
                            const seriesResults = Array.isArray(series) ? series.filter(item => {
                                const name = item.name || '';
                                const matches = name.toLowerCase().includes(query);
                                console.log(`Filtrando série item: ${name}, matches: ${matches}`);
                                return matches;
                            }).map(item => ({ section: 'series', ...item })) : [];
                            console.log('Series results:', seriesResults);

                            const results = [...liveResults, ...vodResults, ...seriesResults];
                            console.log('Resultados finais da busca:', results);

                            contentGrid.innerHTML = results.length > 0 ? results.map(item => {
                                const imageSrc = item.section === 'series' ? (item.cover || 'https://via.placeholder.com/150') : (item.stream_icon || 'https://via.placeholder.com/150');
                                const itemName = item.name || 'Sem título';
                                const itemId = item.stream_id || item.series_id || '';
                                return `
                                    <div class="content-item" data-section="${item.section}" data-stream-id="${itemId}" data-name="${itemName}" data-icon="${imageSrc}">
                                        <img src="${imageSrc}" alt="${itemName}">
                                        <p class="title">${itemName}</p>
                                    </div>
                                `;
                            }).join('') : '<p>Nenhum resultado encontrado.</p>';
                            contentGrid.style.display = 'grid';
                            console.log('Content-grid atualizado (busca):', contentGrid.innerHTML);

                            // Trigger reflow to ensure DOM update
                            contentGrid.offsetHeight;

                            const contentItems = contentGrid.querySelectorAll('.content-item');
                            console.log(`Anexando listeners para ${contentItems.length} itens de conteúdo (busca)`);
                            contentItems.forEach(item => {
                                item.removeEventListener('click', handleContentItemClick);
                                item.addEventListener('click', handleContentItemClick);
                            });
                        })
                        .catch(error => {
                            console.error('Erro ao carregar séries:', error);
                            contentGrid.innerHTML = '<p>Erro ao carregar resultados da busca.</p>';
                            contentGrid.style.display = 'grid';
                            alert('Erro ao carregar séries: ' + error.message);
                        });
                })
                .catch(error => {
                    console.error('Erro ao carregar VOD:', error);
                    contentGrid.innerHTML = '<p>Erro ao carregar resultados da busca.</p>';
                    contentGrid.style.display = 'grid';
                    alert('Erro ao carregar VOD: ' + error.message);
                });
        })
        .catch(error => {
            console.error('Erro ao carregar live streams:', error);
            contentGrid.innerHTML = '<p>Erro ao carregar resultados da busca.</p>';
            contentGrid.style.display = 'grid';
            alert('Erro ao carregar live streams: ' + error.message);
        });
}

function showAccountInfo() {
    console.log('Exibindo informações da conta em modal.');
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`;
    fetch(url)
        .then(response => {
            console.log('Resposta da API de conta:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const userInfo = data.user_info;
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="modal-close">×</span>
                    <h3>Informações da Conta</h3>
                    <p><strong>Usuário:</strong> ${userInfo.username}</p>
                    <p><strong>Senha:</strong> ${userInfo.password}</p>
                    <p><strong>Data de Criação:</strong> ${new Date(userInfo.created_at * 1000).toLocaleDateString()}</p>
                    <p><strong>Expiração:</strong> ${new Date(userInfo.exp_date * 1000).toLocaleDateString()}</p>
                </div>
            `;
            document.body.appendChild(modal);
            
            const closeButton = modal.querySelector('.modal-close');
            closeButton.addEventListener('click', () => {
                modal.remove();
            });
        })
        .catch(error => {
            console.error('Erro ao carregar informações da conta:', error);
            alert('Erro ao carregar informações da conta: ' + error.message);
        });
}

function goBack() {
    console.log('Histórico antes de voltar:', historyStack);
    if (historyStack.length <= 1) {
        console.log('Nenhum estado anterior no histórico.');
        document.getElementById('backButton').style.display = 'none';
        return;
    }

    // Pop the current state
    historyStack.pop();
    const previousState = historyStack[historyStack.length - 1];
    console.log('Voltando para estado anterior:', previousState);

    // Reset player and clear current view
    const player = videojs('player');
    player.pause();
    player.src([]);
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    document.getElementById('content-grid').style.display = 'none';

    // Restore previous state
    if (previousState.type === 'section') {
        loadSection(previousState.section);
    } else if (previousState.type === 'category') {
        loadCategory(previousState.section, previousState.categoryId, previousState.categoryName);
    } else if (previousState.type === 'stream') {
        playStream(previousState.section, previousState.streamId, previousState.name, previousState.icon);
    } else if (previousState.type === 'search') {
        globalSearch(previousState.query);
    }

    // Re-attach category listeners
    attachCategoryListeners(previousState.section || currentSection);
}