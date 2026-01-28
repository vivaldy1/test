/* script.js - キャッシュ機能付き修正版 */
// 1. 設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';

// キャッシュ機能
const CACHE_KEY = 'songListCache';
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1時間

function getCachedData() {
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
    try {
        localStorage.removeItem(CACHE_KEY);
        console.log('キャッシュをクリア');
    } catch (e) {
        console.error('キャッシュクリアエラー:', e);
    }
}

let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;
let filteredListSongs = [];
let currentPage = 1;
let itemsPerPage = 50;
let listFilterTimeout = null;

function highlight(text, q) {
    if (!q) return text;
    const r = new RegExp(`(${q})`, 'gi');
    return text.replace(r, '<span class="highlight">$1</span>');
}

// 2. タブ切り替え
window.switchTab = (t) => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-btn-' + t)?.classList.add('active');
    document.getElementById(t + '-tab')?.classList.add('active');
};

// 3. 初期化
window.onload = async () => {
    initDragScroll();
    
    // LIVEステータス取得
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
            console.error('ライブ配信URL取得エラー:', error);
        });

    const loader = document.getElementById('loadingOverlay');
    const searchInput = document.getElementById('searchQuery');
    const clearBtn = document.getElementById('clearSearch');
    const listFilter = document.getElementById('listFilter');
    const filterClear = document.getElementById('filterClear');

    // ×ボタンのクリックイベント
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

    try {
        // キャッシュから先に確認
        const cachedData = getCachedData();
        
        if (cachedData) {
            // キャッシュがある場合は即座に表示
            allSongs = cachedData;
            filteredListSongs = [...allSongs];
            
            // イベントリスナーの登録
            searchInput?.addEventListener('input', performSearch);
            document.querySelectorAll('input[name="stype"]').forEach(r => {
                r.addEventListener('change', performSearch);
            });
            listFilter?.addEventListener('input', function () {
                clearTimeout(listFilterTimeout);
                listFilterTimeout = setTimeout(filterList, 300);
                if (filterClear) filterClear.classList.toggle('visible', listFilter.value.length > 0);
            });
            
            // 初期表示
            renderTable();
            if (loader) loader.classList.add('hidden');
            
            // バックグラウンドで新しいデータを取得（キャッシュを更新）
            fetch(GAS_URL)
                .then(res => res.json())
                .then(data => {
                    allSongs = data;
                    setCachedData(data);
                    filteredListSongs = [...allSongs];
                    renderTable();
                    console.log('バックグラウンドで更新完了');
                })
                .catch(error => console.error('バックグラウンド更新エラー:', error));
        } else {
            // キャッシュがない場合はサーバーから取得
            const res = await fetch(GAS_URL);
            allSongs = await res.json();
            filteredListSongs = [...allSongs];
            setCachedData(allSongs);
            
            // イベントリスナーの登録
            searchInput?.addEventListener('input', performSearch);
            document.querySelectorAll('input[name="stype"]').forEach(r => {
                r.addEventListener('change', performSearch);
            });
            listFilter?.addEventListener('input', function () {
                clearTimeout(listFilterTimeout);
                listFilterTimeout = setTimeout(filterList, 300);
                if (filterClear) filterClear.classList.toggle('visible', listFilter.value.length > 0);
            });
            
            // 初期表示
            renderTable();
            if (loader) loader.classList.add('hidden');
        }
    } catch (e) {
        console.error("Data Load Error:", e);
        if (loader) {
            const text = loader.querySelector('.loading-text');
            if (text) text.innerText = "データの読み込みに失敗しました。";
        }
    }
};

// 4. 検索処理
function performSearch() {
    const input = document.getElementById('searchQuery');
    const query = input.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearch');
    const type = document.querySelector('input[name="stype"]:checked').value;
    const container = document.getElementById('searchResults');
    const countDisplay = document.getElementById('resultCountInline');

    // クリアボタンの表示制御
    if (query) clearBtn.classList.add('show'); else clearBtn.classList.remove('show');

    // 検索語がない場合はリセット
    if (!query) {
        container.innerHTML = '';
        if (countDisplay) countDisplay.innerText = '';
        return;
    }

    // フィルタリング
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

    // 件数表示
    if (countDisplay) countDisplay.innerText = filtered.length + '件';

    // 結果表示
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const displayCount = Math.min(filtered.length, 50);
    
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
        
        const copyVal = `${s['曲名'] || ''} / ${s['アーティスト'] || ''}`.replace(/'/g, "\\'");
        item.innerHTML = `
            <div class="song-title">${title}</div>
            <div class="song-artist">${artist}</div>
            <div class="song-yomi">${titleYomi} ${artistYomi}</div>
            ${tieup}
            <div class="song-meta">
                <span>演奏回数: ${count}回</span>
                <span>最終演奏: ${date}</span>
            </div>
            <button class="copy-btn" onclick="copyText('${copyVal}')">コピー</button>
        `;
        fragment.appendChild(item);
    });
    container.appendChild(fragment);
    
    if (filtered.length > 50) {
        const moreMsg = document.createElement('div');
        moreMsg.style.cssText = 'text-align: center; padding: 20px; color: #718096; font-size: 14px;';
        moreMsg.innerText = `... 他 ${filtered.length - 50} 件 ...`;
        container.appendChild(moreMsg);
    }
}

// 5. 一覧テーブル表示
function renderTable() {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;
    
    const targetList = filteredListSongs.length > 0 || (document.getElementById('listFilter') && document.getElementById('listFilter').value === '') ? filteredListSongs : allSongs;
    const sorted = [...targetList].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { v1 = Number(v1) || 0; v2 = Number(v2) || 0; }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });

    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = sorted.slice(start, start + itemsPerPage);
    tbody.innerHTML = '';
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

// ページネーション
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

// リスト内フィルタリング
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

// 6. ユーティリティ
function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    } catch (e) { return dateStr; }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

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
