/* script.js - キャッシュ機能付き修正版 - BUGFIX */

// ==================== CONFIGURATION ====================
const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';

// Cache configuration
const CACHE_KEY = 'songListCache';
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1時間
const SEARCH_LIMIT = 50; // 検索結果の最大件数
const LIST_PAGE_SIZE = 50; // リスト表示の1ページあたりの件数

// ==================== CACHE MANAGEMENT ====================
function isLocalStorageAvailable() {
    try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        console.warn('localStorage not available:', e);
        return false;
    }
}

function getCachedData() {
    if (!isLocalStorageAvailable()) return null;
    
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_EXPIRY_MS) {
            console.log('キャッシュから読み込み');
            return data;
        }
        
        // 有効期限切れのキャッシュを削除
        localStorage.removeItem(CACHE_KEY);
        return null;
    } catch (e) {
        console.error('キャッシュ読み込みエラー:', e);
        return null;
    }
}

function setCachedData(data) {
    if (!isLocalStorageAvailable()) return;
    
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        console.log('キャッシュに保存');
    } catch (e) {
        console.error('キャッシュ保存エラー:', e);
    }
}

function clearCache() {
    if (!isLocalStorageAvailable()) return;
    
    try {
        localStorage.removeItem(CACHE_KEY);
        console.log('キャッシュをクリア');
    } catch (e) {
        console.error('キャッシュクリアエラー:', e);
    }
}

// ==================== GLOBAL STATE ====================
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;
let filteredListSongs = [];
let currentPage = 1;
let itemsPerPage = LIST_PAGE_SIZE;
let listFilterTimeout = null;
let isUpdating = false; // データ更新フラグ

// ==================== UTILITY FUNCTIONS ====================

/**
 * BUGFIX: Fixed RegExp syntax error
 * Original: new RegExp`(${q})`, 'gi')  <- WRONG
 * Fixed: new RegExp(`(${q})`, 'gi')     <- CORRECT
 */
function highlight(text, q) {
    if (!q) return text;
    
    // Escape special regex characters
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = new RegExp(`(${escaped})`, 'gi');
    return text.replace(r, '<span class="highlight">$1</span>');
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    } catch (e) { 
        console.error('Date formatting error:', e);
        return dateStr; 
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', 
        '<': '&lt;', 
        '>': '&gt;', 
        '"': '&quot;', 
        "'": '&#39;'
    }[m]));
}

// ==================== TAB SWITCHING ====================
window.switchTab = (t) => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-btn-' + t)?.classList.add('active');
    document.getElementById(t + '-tab')?.classList.add('active');
};

// ==================== SEARCH FUNCTIONALITY ====================
function performSearch() {
    const input = document.getElementById('searchQuery');
    const query = input.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearch');
    const type = document.querySelector('input[name="stype"]:checked').value;
    const container = document.getElementById('searchResults');
    const countDisplay = document.getElementById('resultCountInline');
    
    // Display/hide clear button
    if (query) clearBtn.classList.add('show'); 
    else clearBtn.classList.remove('show');
    
    // Reset if no query
    if (!query) {
        container.innerHTML = '';
        if (countDisplay) countDisplay.innerText = '';
        return;
    }
    
    // Filter results
    const filtered = allSongs.filter(s => {
        const fields = {
            song: [s['曲名'], s['曲名の読み']],
            artist: [s['アーティスト'], s['アーティストの読み']],
            tieup: [s['タイアップ']],
            all: [s['曲名'], s['曲名の読み'], s['アーティスト'], s['アーティストの読み'], s['タイアップ']]
        };
        const targets = fields[type] || fields['all'];
        return targets.some(f => String(f || '').toLowerCase().includes(query));
    });
    
    // Display count
    if (countDisplay) countDisplay.innerText = filtered.length + '件';
    
    // Render results
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const displayCount = Math.min(filtered.length, SEARCH_LIMIT);
    
    if (filtered.length === 0) {
        // Show empty state
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: #718096; font-size: 16px;';
        emptyMsg.innerText = '検索結果が見つかりません。';
        container.appendChild(emptyMsg);
        return;
    }
    
    filtered.slice(0, displayCount).forEach(s => {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        const title = highlight(escapeHtml(s['曲名'] || '不明'), query);
        const artist = highlight(escapeHtml(s['アーティスト'] || '不明'), query);
        const titleYomi = highlight(escapeHtml(s['曲名の読み'] || ''), query);
        const artistYomi = highlight(escapeHtml(s['アーティストの読み'] || ''), query);
        const tieup = s['タイアップ'] ? `<div class="song-tieup"><div class="tv-icon-20"></div><span>${highlight(escapeHtml(s['タイアップ']), query)}</span></div>` : '';
        const count = s['演奏回数'] || 0;
        const date = formatDate(s['最終演奏']);
        
        // BUGFIX: Replaced onclick handler with data attribute for better security
        const copyVal = escapeHtml(`${s['曲名'] || ''} / ${s['アーティスト'] || ''}`);
        item.innerHTML = `
            <div class="song-title">${title}</div>
            <div class="song-artist">${artist}</div>
            <div class="song-yomi">${titleYomi} ${artistYomi}</div>
            ${tieup}
            <div class="song-meta">
                <span>演奏回数: ${count}回</span>
                <span>最終演奏: ${date}</span>
            </div>
            <button class="copy-btn" data-copy-text="${copyVal}">コピー</button>
        `;
        fragment.appendChild(item);
    });
    container.appendChild(fragment);
    
    // Show "more results" message
    if (filtered.length > SEARCH_LIMIT) {
        const moreMsg = document.createElement('div');
        moreMsg.style.cssText = 'text-align: center; padding: 20px; color: #718096; font-size: 14px;';
        moreMsg.innerText = `... 他 ${filtered.length - SEARCH_LIMIT} 件 ...`;
        container.appendChild(moreMsg);
    }
}

// ==================== LIST FUNCTIONALITY ====================
function renderTable() {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;
    
    const targetList = filteredListSongs.length > 0 || (document.getElementById('listFilter') && document.getElementById('listFilter').value === '') ? filteredListSongs : allSongs;
    
    const sorted = [...targetList].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { 
            v1 = Number(v1) || 0; 
            v2 = Number(v2) || 0; 
        }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });
    
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = sorted.slice(start, start + itemsPerPage);
    
    tbody.innerHTML = '';
    
    if (pageItems.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" style="text-align: center; color: #718096; padding: 40px;">検索結果がありません。</td>';
        tbody.appendChild(emptyRow);
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    pageItems.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(s['曲名'] || '-')}</td>
            <td>${escapeHtml(s['アーティスト'] || '-')}</td>
            <td>${s['演奏回数'] || 0}</td>
            <td>${formatDate(s['最終演奏'])}</td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
    renderPagination(Math.ceil(sorted.length / itemsPerPage));
}

function renderPagination(totalPages) {
    const div = document.getElementById('listPagination');
    if (!div) return;
    div.innerHTML = '';
    if (totalPages <= 1) return;
    
    const createBtn = (text, page) => {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (page === currentPage ? ' active' : '');
        btn.textContent = text;
        btn.onclick = () => { 
            currentPage = page; 
            renderTable(); 
            document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth' }); 
        };
        return btn;
    };
    
    div.appendChild(createBtn('<', Math.max(1, currentPage - 1)));
    div.appendChild(createBtn(currentPage + ' / ' + totalPages, currentPage));
    div.appendChild(createBtn('>', Math.min(totalPages, currentPage + 1)));
}

function filterList() {
    const query = document.getElementById('listFilter').value.trim().toLowerCase();
    if (!query) {
        filteredListSongs = [...allSongs];
    } else {
        filteredListSongs = allSongs.filter(s =>
            String(s['曲名'] || '').toLowerCase().includes(query) ||
            String(s['アーティスト'] || '').toLowerCase().includes(query) ||
            String(s['タイアップ'] || '').toLowerCase().includes(query)
        );
    }
    currentPage = 1;
    renderTable();
}

// ==================== EVENT HANDLERS ====================
window.handleSort = (key) => {
    sortAsc = (sortKey === key) ? !sortAsc : false;
    sortKey = key;
    renderTable();
};

window.copyText = (txt) => {
    navigator.clipboard.writeText(txt).then(() => {
        const t = document.getElementById('copyToast');
        if (t) {
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2000);
        }
    }).catch(err => {
        console.error('Copy failed:', err);
    });
};

function initDragScroll() {
    const s = document.getElementById('searchTypeGroup');
    if (!s) return;
    let isDown = false, startX, scrollLeft;
    
    s.onmousedown = (e) => {
        isDown = true;
        s.style.cursor = 'grabbing';
        startX = e.pageX - s.offsetLeft;
        scrollLeft = s.scrollLeft;
    };
    
    window.onmouseup = () => {
        isDown = false;
        if (s) s.style.cursor = 'grab';
    };
    
    s.onmousemove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - s.offsetLeft;
        s.scrollLeft = scrollLeft - (x - startX);
    };
}

// ==================== INITIALIZATION ====================
window.onload = async () => {
    initDragScroll();
    
    const loader = document.getElementById('loadingOverlay');
    const searchInput = document.getElementById('searchQuery');
    const clearBtn = document.getElementById('clearSearch');
    const listFilter = document.getElementById('listFilter');
    const filterClear = document.getElementById('filterClear');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Setup event listeners for clear buttons
    if (clearBtn) {
        clearBtn.onclick = () => {
            searchInput.value = '';
            performSearch();
        };
    }
    
    if (filterClear) {
        filterClear.onclick = () => {
            listFilter.value = '';
            filterList();
        }
    }
    
    // リロードボタンのイベントリスナー
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            await forceReloadData(refreshBtn, loader);
        };
    }
    
    // BUGFIX: Use event delegation for copy buttons instead of onclick handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-btn')) {
            const text = e.target.dataset.copyText;
            if (text) copyText(text);
        }
    });
    
    // Fetch live stream status (non-blocking)
    fetchLiveStatus();
    
    try {
        // Check cache first
        const cachedData = getCachedData();
        
        if (cachedData) {
            // Display from cache immediately
            allSongs = cachedData;
            filteredListSongs = [...allSongs];
            
            // Setup event listeners
            setupEventListeners();
            
            // Render initial content
            renderTable();
            
            // Hide loading IMMEDIATELY after cache render
            if (loader) loader.classList.add('hidden');
            
            // BUGFIX: Prevent data race - only update if fetch succeeds and data is different
            // This runs in background without blocking UI
            fetchDataInBackground();
        } else {
            // No cache, fetch from server
            try {
                const data = await fetchDataFromServer();
                if (data && data.length > 0) {
                    allSongs = data;
                    filteredListSongs = [...allSongs];
                    setCachedData(allSongs);
                    
                    // Setup event listeners
                    setupEventListeners();
                    
                    // Render initial content
                    renderTable();
                } else {
                    throw new Error('No data returned from server');
                }
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                handleLoadingError(loader, "データの読み込みに失敗しました。再読み込みしてください。");
                return; // Stop execution here
            }
            
            // Hide loading after successful fetch and render
            if (loader) loader.classList.add('hidden');
        }
    } catch (e) {
        console.error("Data Load Error:", e);
        handleLoadingError(loader, "データの読み込みに失敗しました。再読み込みしてください。");
    }
};

/**
 * BUGFIX: Separated fetch logic to prevent race conditions
 */
function setupEventListeners() {
    const searchInput = document.getElementById('searchQuery');
    const listFilter = document.getElementById('listFilter');
    const filterClear = document.getElementById('filterClear');
    
    searchInput?.addEventListener('input', performSearch);
    document.querySelectorAll('input[name="stype"]').forEach(r => {
        r.addEventListener('change', performSearch);
    });
    
    listFilter?.addEventListener('input', function () {
        clearTimeout(listFilterTimeout);
        listFilterTimeout = setTimeout(filterList, 300);
        if (filterClear) filterClear.classList.toggle('visible', listFilter.value.length > 0);
    });
}

/**
 * BUGFIX: Separate background fetch to prevent overwriting user data
 */
async function fetchDataInBackground() {
    if (isUpdating) return;
    isUpdating = true;
    
    try {
        const data = await fetchDataFromServer();
        if (data && data.length > 0) {
            // Only update if data is different
            if (JSON.stringify(data) !== JSON.stringify(allSongs)) {
                allSongs = data;
                setCachedData(allSongs);
                
                // Re-filter and render only if needed
                if (filteredListSongs.length === 0) {
                    filteredListSongs = [...allSongs];
                }
                renderTable();
                console.log('バックグラウンドで更新完了');
            }
        }
    } catch (error) {
        console.error('バックグラウンド更新エラー:', error);
    } finally {
        isUpdating = false;
    }
}

/**
 * BUGFIX: Added proper error handling for fetch
 */
async function fetchDataFromServer() {
    try {
        const response = await fetch(GAS_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format: expected array');
        }
        
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

/**
 * BUGFIX: Better error handling
 */
function handleLoadingError(loader, message) {
    if (loader) {
        const text = loader.querySelector('.loading-text');
        if (text) text.innerText = message;
        // Hide the loader after showing error for 3 seconds
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 3000);
    }
}

/**
 * 強制的にデータをリロード
 */
async function forceReloadData(refreshBtn, loader) {
    // すでにリロード中なら実行しない
    if (isUpdating) return;
    
    isUpdating = true;
    refreshBtn.classList.add('loading');
    
    try {
        // キャッシュをクリア
        clearCache();
        
        // サーバーから強制取得
        const data = await fetchDataFromServer();
        if (data && data.length > 0) {
            allSongs = data;
            filteredListSongs = [...allSongs];
            setCachedData(allSongs);
            
            // 現在のビューをリセット
            currentPage = 1;
            sortKey = '最終演奏';
            sortAsc = false;
            
            // テーブルを再描画
            renderTable();
            
            // 検索結果をクリア
            const searchInput = document.getElementById('searchQuery');
            searchInput.value = '';
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('resultCountInline').innerText = '';
            
            // リスト内フィルタをクリア
            const listFilter = document.getElementById('listFilter');
            listFilter.value = '';
            
            console.log('データを強制リロードしました');
        } else {
            throw new Error('No data returned from server');
        }
    } catch (error) {
        console.error('Reload error:', error);
        // エラートースト表示
        const toast = document.getElementById('copyToast');
        if (toast) {
            toast.textContent = 'リロードに失敗しました';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }
    } finally {
        isUpdating = false;
        refreshBtn.classList.remove('loading');
    }
}

/**
 * Fetch live stream status
 */
function fetchLiveStatus() {
    fetch('https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLg3Mh9pD1cfoLjzGKoWN85Gk3bYFpPA8-oPlNbFXDQwZSrx-7YQn1Qy7_tmEpzzorOTQow9QIbVsKVjgfXUiI3hUpHNtQaVxF5FRYozt4ziG3OutQJSWtSqXCcdeJU7a_Uhr2j0KiH3Kw9PaSSjYaZ-Pxx2MUB2AEtN-ozLj-H6GBxw8JOISVRz8QT-ziXa-lUbnL0NULykgmNlOLH-s4Jnt-Py_bQ05foDbnH9BD7EgMzudhnWfWM6yEP4M21osh0JprLH-ddjFiDhSqven0yIHGmO3cNRqPPRjvzm&lib=MXVx9ipRNFTfomE6WbanXaGJpguNqVXQJ')
        .then(response => response.json())
        .then(data => {
            const ytLink = document.getElementById('headerYtLink');
            if (data.liveVideoUrl && data.liveVideoUrl.trim() !== '') {
                ytLink.href = data.liveVideoUrl;
                ytLink.title = 'ライブ配信を開く';
                const liveBadge = document.getElementById('liveBadge');
                if (liveBadge) {
                    liveBadge.classList.add('active');
                }
            }
        })
        .catch(error => {
            console.warn('ライブ配信URL取得エラー:', error);
        });
}
