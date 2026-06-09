// weg!gelegd - App Logic & State Management

// --- STATE MANAGEMENT ---
let state = {
    rooms: [],
    subLocations: [],
    items: [],
    currentView: 'dashboard', // 'dashboard' | 'room-detail' | 'settings' | 'search-results'
    activeRoomId: null,
    activeSubLocationId: null, // null means "All"
    searchQuery: '',
    isMockMode: true,
    supabaseConfig: {
        url: '',
        key: ''
    }
};

let supabaseClient = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('weggelegd_supabase_config');
    const savedMode = localStorage.getItem('weggelegd_mode');
    
    if (savedConfig) {
        state.supabaseConfig = JSON.parse(savedConfig);
        document.getElementById('settings-supabase-url').value = state.supabaseConfig.url;
        document.getElementById('settings-supabase-key').value = state.supabaseConfig.key;
    }
    
    if (savedMode === 'supabase' && state.supabaseConfig.url && state.supabaseConfig.key) {
        state.isMockMode = false;
        initSupabase();
    } else {
        state.isMockMode = true;
        updateConnectionStatus(false, 'Demo-modus actief (Offline)');
        loadMockData();
    }

    setupEventListeners();
    enableVoiceRecognition();
    navigateTo('dashboard');
}

// --- SUPABASE CONNECTIVITY ---
let realtimeChannel = null;

function initSupabase() {
    try {
        if (!state.supabaseConfig.url || !state.supabaseConfig.key) {
            throw new Error('Geen credentials');
        }
        
        // Supabase is loaded from CDN in index.html
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase library niet geladen');
        }
        
        supabaseClient = supabase.createClient(state.supabaseConfig.url, state.supabaseConfig.key);
        state.isMockMode = false;
        localStorage.setItem('weggelegd_mode', 'supabase');
        
        updateConnectionStatus(true, 'Verbonden met Supabase');
        loadAllData();
        setupRealtimeSubscriptions();
    } catch (error) {
        console.error('Supabase init failed:', error);
        state.isMockMode = true;
        updateConnectionStatus(false, `Verbindingsfout: ${error.message}. Demo-modus actief.`);
        loadMockData();
    }
}

function setupRealtimeSubscriptions() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
            loadAllDataSilently();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_locations' }, () => {
            loadAllDataSilently();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
            loadAllDataSilently();
        })
        .subscribe();
}

async function loadAllDataSilently() {
    if (state.isMockMode) return;
    
    try {
        const { data: roomsData, error: roomsError } = await supabaseClient
            .from('rooms')
            .select('*')
            .order('name');
        if (roomsError) throw roomsError;
        state.rooms = roomsData || [];

        const { data: subLocsData, error: subLocsError } = await supabaseClient
            .from('sub_locations')
            .select('*')
            .order('name');
        if (subLocsError) throw subLocsError;
        state.subLocations = subLocsData || [];

        const { data: itemsData, error: itemsError } = await supabaseClient
            .from('items')
            .select('*')
            .order('name');
        if (itemsError) throw itemsError;
        state.items = itemsData || [];
        
        renderAll();
    } catch (error) {
        console.error('Silent sync failed:', error);
    }
}

function updateConnectionStatus(isOnline, message) {
    const statusDiv = document.getElementById('connection-status');
    const statusText = statusDiv.querySelector('.status-text');
    
    if (isOnline) {
        statusDiv.className = 'connection-status status-online';
        statusText.textContent = message;
    } else {
        statusDiv.className = 'connection-status status-offline';
        statusText.textContent = message;
    }
}

// --- DATA FETCHING & SYNC ---
async function loadAllData() {
    showLoaders();
    if (state.isMockMode) {
        // Mock data is already loaded or is in localStorage
        renderAll();
        return;
    }
    
    try {
        // Fetch rooms
        const { data: roomsData, error: roomsError } = await supabaseClient
            .from('rooms')
            .select('*')
            .order('name');
        if (roomsError) throw roomsError;
        state.rooms = roomsData || [];

        // Fetch sub_locations
        const { data: subLocsData, error: subLocsError } = await supabaseClient
            .from('sub_locations')
            .select('*')
            .order('name');
        if (subLocsError) throw subLocsError;
        state.subLocations = subLocsData || [];

        // Fetch items
        const { data: itemsData, error: itemsError } = await supabaseClient
            .from('items')
            .select('*')
            .order('name');
        if (itemsError) throw itemsError;
        state.items = itemsData || [];
        
        renderAll();
    } catch (error) {
        console.error('Fout bij ophalen databasegegevens:', error);
        alert('Er ging iets mis bij het ophalen van de data uit Supabase. We schakelen over naar demo-modus.');
        state.isMockMode = true;
        updateConnectionStatus(false, 'Fout bij synchroniseren. Demo-modus actief.');
        loadMockData();
    }
}

function renderAll() {
    updateCategoriesDatalist();
    if (state.currentView === 'dashboard') {
        renderDashboard();
    } else if (state.currentView === 'room-detail') {
        renderRoomDetail();
    } else if (state.currentView === 'search-results') {
        renderSearchResults();
    }
}

// --- MOCK DATA FALLBACK ---
const DEFAULT_MOCK_ROOMS = [
    { id: 'room-1', name: 'Woonkamer', photo_url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'room-2', name: 'Garage', photo_url: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?q=80&w=600&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'room-3', name: 'Zolder', photo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600&auto=format&fit=crop', created_at: new Date().toISOString() }
];

const DEFAULT_MOCK_SUB_LOCATIONS = [
    { id: 'sub-1', room_id: 'room-1', name: 'Boekenkast', description: 'Grote eikenhouten boekenkast naast de tv', photo_url: 'https://images.unsplash.com/photo-1544640808-32ca72ac7f37?q=80&w=200&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'sub-2', room_id: 'room-1', name: 'Dressoir', description: 'Ladekast bij de eettafel', created_at: new Date().toISOString() },
    { id: 'sub-3', room_id: 'room-2', name: 'Gereedschapswand', description: 'Boven de werkbank', photo_url: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?q=80&w=200&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'sub-4', room_id: 'room-2', name: 'Stellingkast', description: 'Achterin de garage', created_at: new Date().toISOString() },
    { id: 'sub-5', room_id: 'room-3', name: 'Verhuisdoos Blauw', description: 'Staat onder het schuine dak', created_at: new Date().toISOString() }
];

const DEFAULT_MOCK_ITEMS = [
    { id: 'item-1', room_id: 'room-1', sub_location_id: 'sub-2', name: 'Paspoorten', category: 'Documenten', description: 'Ligt in de bovenste la in het lederen mapje.', status: 'Aanwezig', photo_url: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?q=80&w=400&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'item-2', room_id: 'room-1', sub_location_id: 'sub-1', name: 'Fotoboek 2024', category: 'Boeken', description: 'Plank 3 van boven.', status: 'Aanwezig', photo_url: '', created_at: new Date().toISOString() },
    { id: 'item-3', room_id: 'room-2', sub_location_id: 'sub-3', name: 'Accuboor Makita', category: 'Gereedschap', description: 'Met 2 accu\'s in de koffer. Koffer ligt onder het werkblad.', status: 'Aanwezig', photo_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=400&auto=format&fit=crop', created_at: new Date().toISOString() },
    { id: 'item-4', room_id: 'room-2', sub_location_id: 'sub-3', name: 'Rolmaat 5m', category: 'Gereedschap', description: 'In bruikleen gegeven aan buurman Henk.', status: 'Uitgeleend', photo_url: '', created_at: new Date().toISOString() },
    { id: 'item-5', room_id: 'room-3', sub_location_id: 'sub-5', name: 'Kerstballen rood', category: 'Feestdagen', description: 'In doos nr. 5.', status: 'Aanwezig', photo_url: '', created_at: new Date().toISOString() },
    { id: 'item-6', room_id: 'room-1', sub_location_id: 'sub-2', name: 'Huissleutels reserve', category: 'Sleutels', description: 'In het bakje in de lade.', status: 'Kwijt', photo_url: '', created_at: new Date().toISOString() }
];

function loadMockData() {
    const savedRooms = localStorage.getItem('weggelegd_mock_rooms');
    const savedSubLocs = localStorage.getItem('weggelegd_mock_sub_locations');
    const savedItems = localStorage.getItem('weggelegd_mock_items');

    state.rooms = savedRooms ? JSON.parse(savedRooms) : DEFAULT_MOCK_ROOMS;
    state.subLocations = savedSubLocs ? JSON.parse(savedSubLocs) : DEFAULT_MOCK_SUB_LOCATIONS;
    state.items = savedItems ? JSON.parse(savedItems) : DEFAULT_MOCK_ITEMS;
    
    // Save defaults to localStorage if empty
    if (!savedRooms) saveMockDataToLocalStorage();
    
    renderAll();
}

function saveMockDataToLocalStorage() {
    localStorage.setItem('weggelegd_mock_rooms', JSON.stringify(state.rooms));
    localStorage.setItem('weggelegd_mock_sub_locations', JSON.stringify(state.subLocations));
    localStorage.setItem('weggelegd_mock_items', JSON.stringify(state.items));
}

// --- VIEW NAVIGATION ---
function navigateTo(viewName, params = {}) {
    state.currentView = viewName;
    
    // Deactivate all views
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
    });

    // Handle view specific state transitions
    if (viewName === 'dashboard') {
        state.activeRoomId = null;
        state.activeSubLocationId = null;
        document.getElementById('search-section').style.display = 'block';
        document.getElementById('view-dashboard').classList.add('active');
        renderDashboard();
    } else if (viewName === 'room-detail') {
        state.activeRoomId = params.roomId;
        state.activeSubLocationId = null; // Reset filter
        document.getElementById('search-section').style.display = 'block';
        document.getElementById('view-room-detail').classList.add('active');
        renderRoomDetail();
    } else if (viewName === 'settings') {
        document.getElementById('search-section').style.display = 'none';
        document.getElementById('view-settings').classList.add('active');
    } else if (viewName === 'search-results') {
        document.getElementById('search-section').style.display = 'block';
        // Check if there is an active view container for search results, or render it inside dashboard
        // For simplicity, we can render search results inside the dashboard or custom grid
        document.getElementById('view-dashboard').classList.add('active');
        renderSearchResults();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- VIEW RENDERING ---

function showLoaders() {
    const loaderHtml = `<div class="loader-container"><div class="loader"></div></div>`;
    document.getElementById('rooms-grid').innerHTML = loaderHtml;
    document.getElementById('recent-items-grid').innerHTML = loaderHtml;
    document.getElementById('items-grid').innerHTML = loaderHtml;
}

function renderDashboard() {
    const roomsGrid = document.getElementById('rooms-grid');
    const recentItemsGrid = document.getElementById('recent-items-grid');
    
    roomsGrid.innerHTML = '';
    
    if (state.rooms.length === 0) {
        roomsGrid.innerHTML = `
            <div class="info-card" style="grid-column: 1/-1; padding: 32px; text-align: center; border-radius: var(--radius-lg);">
                <i class="fa-solid fa-house-chimney" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 16px;"></i>
                <h3>Nog geen ruimtes toegevoegd</h3>
                <p>Klik op 'Ruimte toevoegen' om je eerste ruimte of opbergplek te maken!</p>
            </div>
        `;
    } else {
        state.rooms.forEach(room => {
            const roomItems = state.items.filter(item => item.room_id === room.id);
            const lostItems = roomItems.filter(item => item.status === 'Kwijt');
            
            const card = document.createElement('article');
            card.className = 'room-card';
            card.addEventListener('click', () => navigateTo('room-detail', { roomId: room.id }));
            
            const imageStyle = room.photo_url ? `style="background-image: url('${room.photo_url}')"` : '';
            const fallbackIcon = room.photo_url ? '' : `<i class="fa-solid fa-door-open"></i>`;
            
            card.innerHTML = `
                <div class="room-card-image" ${imageStyle}>
                    ${fallbackIcon}
                </div>
                <div class="room-card-content">
                    <div>
                        <h3>${escapeHtml(room.name)}</h3>
                        <div class="room-card-meta">
                            <span><i class="fa-solid fa-box"></i> ${roomItems.length} voorwerpen</span>
                            ${lostItems.length > 0 ? `<span style="color: var(--color-danger); font-weight: 500;"><i class="fa-solid fa-triangle-exclamation"></i> ${lostItems.length} kwijt</span>` : ''}
                        </div>
                    </div>
                    <div class="room-card-cta">
                        Bekijk ruimte <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </div>
            `;
            roomsGrid.appendChild(card);
        });
    }

    // Render Recent Items
    recentItemsGrid.innerHTML = '';
    // Sort items by date added (mock data has created_at)
    const sortedItems = [...state.items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
    
    if (sortedItems.length === 0) {
        recentItemsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-light);">Nog geen voorwerpen toegevoegd.</p>`;
    } else {
        sortedItems.forEach(item => {
            const room = state.rooms.find(r => r.id === item.room_id);
            const subLoc = state.subLocations.find(s => s.id === item.sub_location_id);
            const itemCard = createItemCardHTML(item, room, subLoc);
            recentItemsGrid.appendChild(itemCard);
        });
    }
}

function renderRoomDetail() {
    const room = state.rooms.find(r => r.id === state.activeRoomId);
    if (!room) {
        navigateTo('dashboard');
        return;
    }

    // Render Hero Section
    const hero = document.getElementById('room-detail-hero');
    const title = document.getElementById('room-detail-title');
    
    title.textContent = room.name;
    if (room.photo_url) {
        hero.style.backgroundImage = `url('${room.photo_url}')`;
    } else {
        hero.style.backgroundImage = 'none';
        hero.style.backgroundColor = 'var(--color-primary)';
    }

    // Render Sub-locations Pill Tabs
    const subLocsList = document.getElementById('sub-locations-list');
    subLocsList.innerHTML = '';
    
    // Add "Alles" tab
    const allTab = document.createElement('button');
    allTab.className = `sub-loc-tab ${state.activeSubLocationId === null ? 'active' : ''}`;
    allTab.innerHTML = `<span class="sub-loc-thumb-icon"><i class="fa-solid fa-border-all"></i></span> <span>Alles</span>`;
    allTab.addEventListener('click', () => {
        state.activeSubLocationId = null;
        renderRoomItems();
        // Update active class on tabs
        document.querySelectorAll('.sub-loc-tab').forEach(t => t.classList.remove('active'));
        allTab.classList.add('active');
    });
    subLocsList.appendChild(allTab);

    // Filter sublocations for this room
    const roomSubLocs = state.subLocations.filter(sub => sub.room_id === state.activeRoomId);
    
    roomSubLocs.forEach(sub => {
        const tab = document.createElement('div');
        tab.className = `sub-loc-tab ${state.activeSubLocationId === sub.id ? 'active' : ''}`;
        
        // Add thumbnail photo or fallback icon
        let thumbHtml = '';
        if (sub.photo_url) {
            thumbHtml = `<img src="${sub.photo_url}" class="sub-loc-thumb" alt="${escapeHtml(sub.name)}">`;
        } else {
            thumbHtml = `<span class="sub-loc-thumb-icon"><i class="fa-solid fa-box-archive"></i></span>`;
        }
        
        tab.innerHTML = `${thumbHtml} <span>${escapeHtml(sub.name)}</span>`;
        
        tab.addEventListener('click', () => {
            state.activeSubLocationId = sub.id;
            renderRoomItems();
            document.querySelectorAll('.sub-loc-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
        
        // Add edit button for sub-location
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-card-action btn-edit-sub-loc';
        editBtn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
        editBtn.title = 'Bewerk plek';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSubLocationModal(sub);
        });
        tab.appendChild(editBtn);

        subLocsList.appendChild(tab);
    });

    renderRoomItems();
}

function renderRoomItems() {
    const itemsGrid = document.getElementById('items-grid');
    const itemsTitle = document.getElementById('items-section-title');
    itemsGrid.innerHTML = '';

    // Filter items based on active room & sub-location
    let roomItems = state.items.filter(item => item.room_id === state.activeRoomId);
    
    if (state.activeSubLocationId !== null) {
        roomItems = roomItems.filter(item => item.sub_location_id === state.activeSubLocationId);
        const sub = state.subLocations.find(s => s.id === state.activeSubLocationId);
        itemsTitle.textContent = `Voorwerpen in ${sub ? sub.name : 'deze kast'}`;
    } else {
        itemsTitle.textContent = 'Alle voorwerpen';
    }

    if (roomItems.length === 0) {
        itemsGrid.innerHTML = `
            <div class="info-card" style="grid-column: 1/-1; padding: 24px; text-align: center; width: 100%;">
                <i class="fa-solid fa-box-open" style="font-size: 2.5rem; color: var(--color-text-light); margin-bottom: 12px;"></i>
                <p>Nog geen voorwerpen in deze selectie.</p>
            </div>
        `;
    } else {
        roomItems.forEach(item => {
            const room = state.rooms.find(r => r.id === item.room_id);
            const subLoc = state.subLocations.find(s => s.id === item.sub_location_id);
            const itemCard = createItemCardHTML(item, room, subLoc);
            itemsGrid.appendChild(itemCard);
        });
    }
}

function renderSearchResults() {
    const roomsGrid = document.getElementById('rooms-grid');
    const recentItemsGrid = document.getElementById('recent-items-grid');
    const query = state.searchQuery.toLowerCase();
    
    // Change heading
    const dashboardHeader = document.querySelector('#view-dashboard .view-header h2');
    dashboardHeader.innerHTML = `Zoekresultaten voor: <em>"${escapeHtml(state.searchQuery)}"</em>`;

    // Filter items
    const matchingItems = state.items.filter(item => {
        const sub = state.subLocations.find(s => s.id === item.sub_location_id);
        const room = state.rooms.find(r => r.id === item.room_id);
        
        return (
            item.name.toLowerCase().includes(query) ||
            (item.category && item.category.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (sub && sub.name.toLowerCase().includes(query)) ||
            (room && room.name.toLowerCase().includes(query))
        );
    });

    // Filter rooms whose name matches OR which contain matching items
    const matchingRooms = state.rooms.filter(room => {
        const matchesName = room.name.toLowerCase().includes(query);
        const containsMatchingItems = matchingItems.some(item => item.room_id === room.id);
        return matchesName || containsMatchingItems;
    });

    roomsGrid.innerHTML = '';
    
    if (matchingRooms.length === 0 && matchingItems.length === 0) {
        roomsGrid.innerHTML = `
            <div class="info-card" style="grid-column: 1/-1; padding: 32px; text-align: center;">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 3rem; color: var(--color-text-light); margin-bottom: 16px;"></i>
                <h3>Niets gevonden</h3>
                <p>We konden geen ruimtes, kasten of voorwerpen vinden die voldoen aan "${escapeHtml(state.searchQuery)}".</p>
                <button class="btn btn-secondary" style="margin-top: 16px;" onclick="clearSearchFilter()">Wis zoekopdracht</button>
            </div>
        `;
        document.querySelector('.recent-items-section h3').textContent = 'Geen voorwerpen gevonden';
        recentItemsGrid.innerHTML = '';
    } else {
        // Render matching rooms
        matchingRooms.forEach(room => {
            const roomItems = state.items.filter(item => item.room_id === room.id);
            const lostItems = roomItems.filter(item => item.status === 'Kwijt');
            
            const card = document.createElement('article');
            card.className = 'room-card';
            card.addEventListener('click', () => navigateTo('room-detail', { roomId: room.id }));
            
            const imageStyle = room.photo_url ? `style="background-image: url('${room.photo_url}')"` : '';
            const fallbackIcon = room.photo_url ? '' : `<i class="fa-solid fa-door-open"></i>`;
            
            card.innerHTML = `
                <div class="room-card-image" ${imageStyle}>
                    ${fallbackIcon}
                </div>
                <div class="room-card-content">
                    <div>
                        <h3>${escapeHtml(room.name)}</h3>
                        <div class="room-card-meta">
                            <span><i class="fa-solid fa-box"></i> ${roomItems.length} voorwerpen</span>
                            ${lostItems.length > 0 ? `<span style="color: var(--color-danger); font-weight: 500;"><i class="fa-solid fa-triangle-exclamation"></i> ${lostItems.length} kwijt</span>` : ''}
                        </div>
                    </div>
                    <div class="room-card-cta">
                        Bekijk ruimte <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </div>
            `;
            roomsGrid.appendChild(card);
        });

        // Render matching items
        document.querySelector('.recent-items-section h3').textContent = `Voorwerpen (${matchingItems.length})`;
        recentItemsGrid.innerHTML = '';
        matchingItems.forEach(item => {
            const room = state.rooms.find(r => r.id === item.room_id);
            const subLoc = state.subLocations.find(s => s.id === item.sub_location_id);
            const itemCard = createItemCardHTML(item, room, subLoc, true);
            recentItemsGrid.appendChild(itemCard);
        });
    }
}

function createItemCardHTML(item, room, subLoc, showRoomLink = false) {
    const card = document.createElement('article');
    card.className = 'item-card';
    
    const imageStyle = item.photo_url ? `style="background-image: url('${item.photo_url}')"` : '';
    const fallbackIcon = item.photo_url ? '' : `<i class="fa-solid fa-box"></i>`;
    
    // Status badges
    let statusClass = 'badge-aanwezig';
    if (item.status === 'Uitgeleend') statusClass = 'badge-uitgeleend';
    if (item.status === 'Geleend') statusClass = 'badge-geleend';
    if (item.status === 'Kwijt') statusClass = 'badge-kwijt';

    const locationText = subLoc ? escapeHtml(subLoc.name) : 'Los in ruimte';
    const roomText = room ? escapeHtml(room.name) : '';
    
    card.innerHTML = `
        <div class="item-card-image" ${imageStyle}>
            ${fallbackIcon}
            <span class="item-card-status-badge ${statusClass}">${item.status}</span>
        </div>
        <div class="item-card-content">
            <div class="item-card-details">
                <h4>${escapeHtml(item.name)}</h4>
                <div class="item-card-location">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${showRoomLink ? `${roomText} &rsaquo; ` : ''}${locationText}</span>
                </div>
                ${item.category ? `<span class="item-card-category">${escapeHtml(item.category)}</span>` : ''}
                ${item.description ? `<p style="font-size: 0.85rem; margin-top: 6px; color: var(--color-text-light); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(item.description)}</p>` : ''}
            </div>
            
            <div class="item-card-actions">
                ${showRoomLink ? `<button class="btn-card-action" title="Naar ruimte" onclick="navigateTo('room-detail', { roomId: '${item.room_id}' })"><i class="fa-solid fa-share"></i></button>` : ''}
                <button class="btn-card-action" title="Bewerken" onclick="openItemModal('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-card-action delete" title="Verwijderen" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    return card;
}

function updateCategoriesDatalist() {
    const list = document.getElementById('categories-list');
    const categories = new Set(state.items.map(item => item.category).filter(Boolean));
    
    // Add default recommendations if they aren't already there
    const defaults = ["Gereedschap", "Documenten", "Kleding", "Elektronica", "Keuken", "Speelgoed", "Boeken"];
    defaults.forEach(c => categories.add(c));

    list.innerHTML = '';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        list.appendChild(option);
    });
}

// --- GLOBAL SEARCH ACTIONS ---
function handleSearchInput(e) {
    const value = e.target.value.trim();
    state.searchQuery = value;
    
    const clearBtn = document.getElementById('clear-search');
    if (value.length > 0) {
        clearBtn.style.display = 'block';
        navigateTo('search-results');
    } else {
        clearBtn.style.display = 'none';
        // Reset dashboard heading
        const dashboardHeader = document.querySelector('#view-dashboard .view-header h2');
        dashboardHeader.textContent = 'Mijn Huis';
        navigateTo('dashboard');
    }
}

function clearSearchFilter() {
    const searchInput = document.getElementById('global-search');
    searchInput.value = '';
    state.searchQuery = '';
    document.getElementById('clear-search').style.display = 'none';
    const dashboardHeader = document.querySelector('#view-dashboard .view-header h2');
    dashboardHeader.textContent = 'Mijn Huis';
    navigateTo('dashboard');
}

// --- PHOTO UPLOADING (BASE64 & SUPABASE) ---
async function handlePhotoUpload(file, bucket = 'photos') {
    if (state.isMockMode) {
        // Base64 Reader
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    } else {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error } = await supabaseClient.storage
                .from(bucket)
                .upload(filePath, file);

            if (error) throw error;

            // Get Public URL
            const { data: { publicUrl } } = supabaseClient.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Fout bij uploaden foto naar storage:', error);
            alert('Het uploaden van de afbeelding is mislukt. We proberen de afbeelding lokaal op te slaan.');
            // Fallback to base64 upload
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Navigation logo / Home
    document.getElementById('btn-home-logo').addEventListener('click', () => {
        clearSearchFilter();
        navigateTo('dashboard');
    });
    document.getElementById('btn-home').addEventListener('click', () => {
        clearSearchFilter();
        navigateTo('dashboard');
    });
    
    // Back to dashboard in details
    document.getElementById('btn-back-to-dashboard').addEventListener('click', () => {
        navigateTo('dashboard');
    });

    // Settings navigation
    document.getElementById('btn-settings').addEventListener('click', () => {
        navigateTo('settings');
    });

    // Search bar
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', handleSearchInput);
    document.getElementById('clear-search').addEventListener('click', clearSearchFilter);

    // Settings form save
    document.getElementById('supabase-config-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('settings-supabase-url').value.trim();
        const key = document.getElementById('settings-supabase-key').value.trim();
        
        state.supabaseConfig = { url, key };
        localStorage.setItem('weggelegd_supabase_config', JSON.stringify(state.supabaseConfig));
        
        initSupabase();
    });

    // Demo Mode toggle in settings
    document.getElementById('btn-use-mock').addEventListener('click', () => {
        state.isMockMode = true;
        localStorage.setItem('weggelegd_mode', 'mock');
        localStorage.removeItem('weggelegd_mock_rooms');
        localStorage.removeItem('weggelegd_mock_sub_locations');
        localStorage.removeItem('weggelegd_mock_items');
        updateConnectionStatus(false, 'Demo-modus actief (Offline)');
        
        if (realtimeChannel) {
            supabaseClient.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        
        loadMockData();
        alert('Je gebruikt nu de offline demo-modus met lokale data.');
    });

    // Modal Close Triggers
    document.querySelectorAll('.close-modal, .btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Add triggers
    document.getElementById('btn-add-room').addEventListener('click', () => openRoomModal());
    document.getElementById('btn-add-sub-location').addEventListener('click', () => openSubLocationModal());
    document.getElementById('btn-add-item').addEventListener('click', () => openItemModal());
    
    const addDashboardBtn = document.getElementById('btn-add-item-dashboard');
    if (addDashboardBtn) {
        addDashboardBtn.addEventListener('click', () => openItemModal());
    }
    
    const roomSelect = document.getElementById('item-room-select');
    if (roomSelect) {
        roomSelect.addEventListener('change', (e) => updateItemSubLocationDropdown(e.target.value));
    }

    // Edit and delete room
    document.getElementById('btn-edit-room').addEventListener('click', () => {
        const room = state.rooms.find(r => r.id === state.activeRoomId);
        if (room) openRoomModal(room);
    });
    
    document.getElementById('btn-delete-room').addEventListener('click', deleteActiveRoom);

    // Form Submissions
    document.getElementById('form-room').addEventListener('submit', saveRoom);
    document.getElementById('form-sub-location').addEventListener('submit', saveSubLocation);
    document.getElementById('form-item').addEventListener('submit', saveItem);

    // Image Input Previews
    setupImagePreview('room-photo', 'room-photo-preview');
    setupImagePreview('sub-location-photo', 'sub-location-photo-preview');
    setupImagePreview('item-photo', 'item-photo-preview');
}

function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.style.backgroundImage = `url('${e.target.result}')`;
                preview.style.display = 'flex';
                preview.textContent = '';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    });
}

// --- MODALS ACTIONS ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Room Modal
function openRoomModal(room = null) {
    const title = document.getElementById('modal-room-title');
    const idInput = document.getElementById('room-id');
    const nameInput = document.getElementById('room-name');
    const preview = document.getElementById('room-photo-preview');
    const fileInput = document.getElementById('room-photo');
    
    // Reset form
    document.getElementById('form-room').reset();
    preview.style.display = 'none';
    preview.style.backgroundImage = 'none';
    
    if (room) {
        title.textContent = 'Ruimte bewerken';
        idInput.value = room.id;
        nameInput.value = room.name;
        if (room.photo_url) {
            preview.style.backgroundImage = `url('${room.photo_url}')`;
            preview.style.display = 'flex';
        }
    } else {
        title.textContent = 'Ruimte toevoegen';
        idInput.value = '';
    }
    
    openModal('modal-room');
}

async function saveRoom(e) {
    e.preventDefault();
    const id = document.getElementById('room-id').value;
    const name = document.getElementById('room-name').value.trim();
    const photoFile = document.getElementById('room-photo').files[0];
    
    let photoUrl = '';
    
    // Keep existing photo if we are editing and no new photo was uploaded
    if (id) {
        const existing = state.rooms.find(r => r.id === id);
        photoUrl = existing ? existing.photo_url : '';
    }

    if (photoFile) {
        photoUrl = await handlePhotoUpload(photoFile);
    }

    if (state.isMockMode) {
        if (id) {
            // Edit
            state.rooms = state.rooms.map(r => r.id === id ? { ...r, name, photo_url: photoUrl } : r);
        } else {
            // New
            const newRoom = {
                id: 'room-' + Date.now(),
                name,
                photo_url: photoUrl,
                created_at: new Date().toISOString()
            };
            state.rooms.push(newRoom);
        }
        saveMockDataToLocalStorage();
        closeModal();
        renderAll();
    } else {
        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('rooms')
                    .update({ name, photo_url: photoUrl })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('rooms')
                    .insert([{ name, photo_url: photoUrl }]);
                if (error) throw error;
            }
            closeModal();
            loadAllData();
        } catch (error) {
            console.error('Fout bij opslaan ruimte:', error);
            alert('Fout bij opslaan ruimte in de database: ' + error.message);
        }
    }
}

async function deleteActiveRoom() {
    const room = state.rooms.find(r => r.id === state.activeRoomId);
    if (!room) return;
    
    if (!confirm(`Weet je zeker dat je "${room.name}" wilt verwijderen? Alle kasten en voorwerpen in deze ruimte worden ook verwijderd!`)) {
        return;
    }

    if (state.isMockMode) {
        state.rooms = state.rooms.filter(r => r.id !== room.id);
        state.subLocations = state.subLocations.filter(s => s.room_id !== room.id);
        state.items = state.items.filter(i => i.room_id !== room.id);
        saveMockDataToLocalStorage();
        navigateTo('dashboard');
    } else {
        try {
            const { error } = await supabaseClient
                .from('rooms')
                .delete()
                .eq('id', room.id);
            if (error) throw error;
            navigateTo('dashboard');
        } catch (error) {
            console.error('Fout bij verwijderen ruimte:', error);
            alert('Fout bij verwijderen ruimte uit database: ' + error.message);
        }
    }
}

// Sub-location Modal
function openSubLocationModal(sub = null) {
    const title = document.getElementById('modal-sub-location-title');
    const idInput = document.getElementById('sub-location-id');
    const roomInput = document.getElementById('sub-location-room-id');
    const nameInput = document.getElementById('sub-location-name');
    const descInput = document.getElementById('sub-location-desc');
    const preview = document.getElementById('sub-location-photo-preview');
    
    document.getElementById('form-sub-location').reset();
    preview.style.display = 'none';
    preview.style.backgroundImage = 'none';

    roomInput.value = state.activeRoomId;

    if (sub) {
        title.textContent = 'Kast/Plek bewerken';
        idInput.value = sub.id;
        nameInput.value = sub.name;
        descInput.value = sub.description || '';
        if (sub.photo_url) {
            preview.style.backgroundImage = `url('${sub.photo_url}')`;
            preview.style.display = 'flex';
        }
    } else {
        title.textContent = 'Kast/Plek toevoegen';
        idInput.value = '';
    }

    openModal('modal-sub-location');
}

async function saveSubLocation(e) {
    e.preventDefault();
    const id = document.getElementById('sub-location-id').value;
    const roomId = document.getElementById('sub-location-room-id').value;
    const name = document.getElementById('sub-location-name').value.trim();
    const description = document.getElementById('sub-location-desc').value.trim();
    const photoFile = document.getElementById('sub-location-photo').files[0];

    let photoUrl = '';
    if (id) {
        const existing = state.subLocations.find(s => s.id === id);
        photoUrl = existing ? existing.photo_url : '';
    }

    if (photoFile) {
        photoUrl = await handlePhotoUpload(photoFile);
    }

    if (state.isMockMode) {
        if (id) {
            state.subLocations = state.subLocations.map(s => s.id === id ? { ...s, name, description, photo_url: photoUrl } : s);
        } else {
            const newSub = {
                id: 'sub-' + Date.now(),
                room_id: roomId,
                name,
                description,
                photo_url: photoUrl,
                created_at: new Date().toISOString()
            };
            state.subLocations.push(newSub);
        }
        saveMockDataToLocalStorage();
        closeModal();
        renderAll();
    } else {
        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('sub_locations')
                    .update({ name, description, photo_url: photoUrl })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('sub_locations')
                    .insert([{ room_id: roomId, name, description, photo_url: photoUrl }]);
                if (error) throw error;
            }
            closeModal();
            loadAllData();
        } catch (error) {
            console.error('Fout bij opslaan sub-locatie:', error);
            alert('Fout bij opslaan in database: ' + error.message);
        }
    }
}

// Voorwerp (Item) Modal
window.openItemModal = function(itemId = null) {
    const title = document.getElementById('modal-item-title');
    const idInput = document.getElementById('item-id');
    const roomSelect = document.getElementById('item-room-select');
    const nameInput = document.getElementById('item-name');
    const subInput = document.getElementById('item-sub-location');
    const categoryInput = document.getElementById('item-category');
    const statusInput = document.getElementById('item-status');
    const descInput = document.getElementById('item-desc');
    const preview = document.getElementById('item-photo-preview');

    document.getElementById('form-item').reset();
    preview.style.display = 'none';
    preview.style.backgroundImage = 'none';

    // Populate room select dropdown
    roomSelect.innerHTML = '<option value="">-- Selecteer een ruimte --</option>';
    state.rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        roomSelect.appendChild(opt);
    });

    // Handle target room
    let targetRoomId = state.activeRoomId;
    let targetSubLocationId = state.activeSubLocationId;
    
    if (itemId) {
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            targetRoomId = item.room_id;
            targetSubLocationId = item.sub_location_id;
        }
    }

    // Set values
    roomSelect.value = targetRoomId || '';
    
    // Keep the room select enabled so the user can easily change/switch the room/space
    roomSelect.disabled = false;

    // Load sub-locations for selected room
    updateItemSubLocationDropdown(targetRoomId, targetSubLocationId);

    if (itemId) {
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            title.textContent = 'Voorwerp bewerken';
            idInput.value = item.id;
            nameInput.value = item.name;
            categoryInput.value = item.category || '';
            statusInput.value = item.status;
            descInput.value = item.description || '';
            if (item.photo_url) {
                preview.style.backgroundImage = `url('${item.photo_url}')`;
                preview.style.display = 'flex';
            }
        }
    } else {
        title.textContent = 'Voorwerp toevoegen';
        idInput.value = '';
        subInput.value = state.activeSubLocationId || '';
    }

    openModal('modal-item');
};

// Helper to update sublocations select when room changes
function updateItemSubLocationDropdown(roomId, activeSubLocationId = null) {
    const subInput = document.getElementById('item-sub-location');
    subInput.innerHTML = '<option value="">-- Geen specifieke kast (los in ruimte) --</option>';
    
    if (!roomId) return;
    
    const roomSubLocs = state.subLocations.filter(s => s.room_id === roomId);
    roomSubLocs.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.textContent = sub.name;
        subInput.appendChild(opt);
    });
    
    if (activeSubLocationId) {
        subInput.value = activeSubLocationId;
    }
}

async function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const roomId = document.getElementById('item-room-select').value;
    const name = document.getElementById('item-name').value.trim();
    const subLocationId = document.getElementById('item-sub-location').value || null;
    const category = document.getElementById('item-category').value.trim() || null;
    const status = document.getElementById('item-status').value;
    const description = document.getElementById('item-desc').value.trim();
    const photoFile = document.getElementById('item-photo').files[0];

    let photoUrl = '';
    if (id) {
        const existing = state.items.find(i => i.id === id);
        photoUrl = existing ? existing.photo_url : '';
    }

    if (photoFile) {
        photoUrl = await handlePhotoUpload(photoFile);
    }

    if (state.isMockMode) {
        if (id) {
            state.items = state.items.map(i => i.id === id ? { 
                ...i, name, room_id: roomId, sub_location_id: subLocationId, category, status, description, photo_url: photoUrl 
            } : i);
        } else {
            const newItem = {
                id: 'item-' + Date.now(),
                room_id: roomId,
                sub_location_id: subLocationId,
                name,
                category,
                status,
                description,
                photo_url: photoUrl,
                created_at: new Date().toISOString()
            };
            state.items.push(newItem);
        }
        saveMockDataToLocalStorage();
        closeModal();
        renderAll();
    } else {
        try {
            const payload = {
                room_id: roomId,
                sub_location_id: subLocationId,
                name,
                category,
                status,
                description,
                photo_url: photoUrl
            };
            
            if (id) {
                const { error } = await supabaseClient
                    .from('items')
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('items')
                    .insert([payload]);
                if (error) throw error;
            }
            closeModal();
            loadAllData();
        } catch (error) {
            console.error('Fout bij opslaan voorwerp:', error);
            alert('Fout bij opslaan in database: ' + error.message);
        }
    }
}

window.deleteItem = function(itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) {
        return;
    }

    if (state.isMockMode) {
        state.items = state.items.filter(i => i.id !== itemId);
        saveMockDataToLocalStorage();
        renderAll();
    } else {
        deleteItemFromSupabase(itemId);
    }
};

async function deleteItemFromSupabase(itemId) {
    try {
        const { error } = await supabaseClient
            .from('items')
            .delete()
            .eq('id', itemId);
        if (error) throw error;
        loadAllData();
    } catch (error) {
        console.error('Fout bij verwijderen item:', error);
        alert('Fout bij verwijderen uit database: ' + error.message);
    }
}

// --- UTILITY FUNCTIONS ---
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function enableVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.log("Web Speech API not supported in this browser.");
        return;
    }

    const voiceInputs = [
        'global-search',
        'room-name',
        'sub-location-name',
        'sub-location-desc',
        'item-name',
        'item-category',
        'item-desc'
    ];

    voiceInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        // Wrap input in a relative container if not already wrapped
        const parent = input.parentElement;
        const wrapper = document.createElement('div');
        wrapper.className = 'voice-input-wrapper';
        
        // Insert wrapper before input, then move input inside wrapper
        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        // Add padding-right to input to make space for the mic icon
        if (id === 'global-search') {
            input.style.paddingRight = '75px';
        } else {
            input.style.paddingRight = '44px';
        }

        // Create mic button
        const micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.className = 'btn-voice-input';
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        micBtn.title = 'Spreek in';
        
        if (id === 'global-search') {
            micBtn.style.right = '42px';
        }
        
        wrapper.appendChild(micBtn);

        // Setup recognition for this input
        const recognition = new SpeechRecognition();
        recognition.lang = 'nl-NL'; // Dutch language
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let isListening = false;

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('listening');
            micBtn.innerHTML = '<i class="fa-solid fa-microphone-lines pulse-animation"></i>';
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('listening');
            micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        };

        recognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            
            if (input.tagName.toLowerCase() === 'textarea' && input.value.trim().length > 0) {
                input.value = input.value.trim() + ' ' + resultText;
            } else {
                input.value = resultText;
            }
            
            // Trigger input event
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microfoontoegang is geweigerd. Geef de browser toestemming om je microfoon te gebruiken.');
            }
        };

        micBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    });
}
