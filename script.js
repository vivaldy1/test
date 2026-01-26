const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;

window.switchTab = (t) => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-btn-' + t)?.classList.add('active');
    document.getElementById(t + '-tab')?.classList.add('active');
};

window.onload = async () => {
    initDragScroll();
    const loader = document.getElementById('loadingOverlay');
    const searchInput = document.getElementById('searchQuery');
    const clearBtn = document.getElementById('clearSearch');

    clearBtn.onclick = () => { 
        searchInput.value = ''; 
        performSearch(); 
    };

    try {
        const res = await fetch(GAS_URL);
        allSongs = await res.json();
        
        searchInput?.addEventListener('input', performSearch);
        document.querySelectorAll('input[name="stype"]').forEach(r => r.addEventListener('change', performSearch));
        
        renderTable();
        if (loader) loader.classList.add('hidden');
    } catch (e) { console.error(e); }
};

function performSearch() {
    const input = document.getElementById('searchQuery');
    const query = input.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearch');
    const type = document.querySelector('input[name="stype"]:checked').value;
    const container = document.getElementById('searchResults');
    const headerYtLink = document.getElementById('headerYtLink');
    const liveBadge = document.getElementById('liveBadge');

    if (query) clearBtn.classList.add('show'); else clearBtn.classList.remove('show');

    if (!query) { 
        container.innerHTML = ''; 
        document.getElementById('resultCountInline').innerText = '';
        headerYtLink.href = 'https://www.youtube.com/@asaxmayo';
        liveBadge.classList.remove('active');
        return; 
    }

    const filtered = allSongs.filter(s => {
        const fields = {
            song: [s['曲名'], s['曲名の読み']],
            artist: [s['アーティスト'], s['アーティストの読み']],
            tieup: [s['タイアップ']],
            all: [s['曲名'], s['曲名の読み'], s['アーティスト'], s['アーティストの読み'], s['タイアップ']]
        };
        return (fields[type] || fields['all']).some(f => String(f || '').toLowerCase().includes(query));
    });

    document.getElementById('resultCountInline').innerText = filtered.length + '件';

    // ヘッダーアイコン連動
    const firstWithYt = filtered.find(s => s['YouTube']);
    if (firstWithYt) {
        headerYtLink.href = `https://www.youtube.com/live/${firstWithYt['YouTube']}`;
        liveBadge.classList.add('active');
    } else {
        headerYtLink.href = 'https://www.youtube.com/@asaxmayo';
        liveBadge.classList.remove('active');
    }
    
    container.innerHTML = filtered.map(s => `
        <div class="result-item">
            <div class="song-title">${s['曲名']}<span class="ruby">${s['曲名の読み'] || ''}</span></div>
            <div class="song-artist">${s['アーティスト']}<span class="ruby">${s['アーティストの読み'] || ''}</span></div>
            ${s['タイアップ'] ? `<div class="song-tieup">${s['タイアップ']}</div>` : ''}
            <div class="song-meta">
                <span>演奏回数: ${s['演奏回数'] || 0}回</span>
                <span>最終演奏: ${formatDate(s['最終演奏'])}</span>
            </div>
            <button class="copy-btn" onclick="copyText('${(s['曲名']||'').replace(/'/g,"\\'")} / ${(s['アーティスト']||'').replace(/'/g,"\\'")}')">コピー</button>
        </div>`).join('');
}

function renderTable() {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;
    const sorted = [...allSongs].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { v1 = Number(v1) || 0; v2 = Number(v2) || 0; }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });
    tbody.innerHTML = sorted.map(s => `<tr><td>${s['曲名']||'-'}</td><td>${s['アーティスト']||'-'}</td><td>${s['演奏回数']||0}</td><td>${formatDate(s['最終演奏'])}</td></tr>`).join('');
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
}

window.handleSort = (key) => {
    sortAsc = (sortKey === key) ? !sortAsc : false;
    sortKey = key;
    renderTable();
};

window.copyText = (txt) => {
    navigator.clipboard.writeText(txt).then(() => {
        const t = document.getElementById('copyToast');
        if (t) { t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
    });
};

function initDragScroll() {
    const s = document.getElementById('searchTypeGroup');
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.onmousedown=(e)=>{ isDown=true; startX=e.pageX-s.offsetLeft; scrollLeft=s.scrollLeft; };
    s.onmouseleave=s.onmouseup=()=>{ isDown=false; };
    s.onmousemove=(e)=>{ if(!isDown) return; const x=e.pageX-s.offsetLeft; s.scrollLeft=scrollLeft-(x-startX); };
}



var allSongs = [];
var filteredListSongs = [];
var searchTimeout = null;
var listFilterTimeout = null;
var currentSort = { key: '最終演奏', ascending: false };
var currentPage = 1;
var itemsPerPage = 50;

// ドラッグスクロール機能
function initDragScroll() {
    const searchType = document.querySelector('.search-type');
    let isDown = false;
    let startX;
    let scrollLeft;

    searchType.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - searchType.offsetLeft;
        scrollLeft = searchType.scrollLeft;
        searchType.style.cursor = 'grabbing';
        // ドラッグ開始時にアニメーションを隠す
        searchType.style.setProperty('--hide-arrow', 'none');
    });

    searchType.addEventListener('mouseleave', () => {
        isDown = false;
        searchType.style.cursor = 'grab';
    });

    searchType.addEventListener('mouseup', () => {
        isDown = false;
        searchType.style.cursor = 'grab';
    });

    searchType.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - searchType.offsetLeft;
        const walk = (x - startX) * 1;
        searchType.scrollLeft = scrollLeft - walk;
    });

    searchType.style.cursor = 'grab';
}

window.onload = function () {
    initDragScroll();
    
    fetch('https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLg3Mh9pD1cfoLjzGKoWN85Gk3bYFpPA8-oPlNbFXDQwZSrx-7YQn1Qy7_tmEpzzorOTQow9QIbVsKVjgfXUiI3hUpHNtQaVxF5FRYozt4ziG3OutQJSWtSqXCcdeJU7a_Uhr2j0KiH3Kw9PaSSjYaZ-Pxx2MUB2AEtN-ozLj-H6GBxw8JOISVRz8QT-ziXa-lUbnL0NULykgmNlOLH-s4Jnt-Py_bQ05foDbnH9BD7EgMzudhnWfWM6yEP4M21osh0JprLH-ddjFiDhSqven0yIHGmO3cNRqPPRjvzm&lib=MXVx9ipRNFTfomE6WbanXaGJpguNqVXQJ')
        .then(response => response.json())
        .then(data => {
            const ytLink = document.getElementById('ytLink');
            if (data.liveVideoUrl && data.liveVideoUrl.trim() !== '') {
                ytLink.href = data.liveVideoUrl;
                ytLink.title = 'ライブ配信を開く';
                const liveBadge = document.createElement('span');
                liveBadge.className = 'live-badge';
                liveBadge.textContent = 'LIVE';
                ytLink.appendChild(liveBadge);
            }
        })
        .catch(error => {
            console.error('ライブ配信URL取得エラー:', error);
        });
    
    google.script.run
        .withSuccessHandler(onDataLoaded)
        .withFailureHandler(onError)
        .getSongData();
};

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');
}

function onDataLoaded(data) {
    allSongs = data;
    filteredListSongs = [...allSongs];
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('search-tab').classList.add('active');
    document.getElementById('search-tab').classList.remove('hidden');
    document.getElementById('searchQuery').focus();
    sortData(currentSort.key, currentSort.ascending);
    renderListTable();
}

function onError(error) {
    document.getElementById('loadingOverlay').innerHTML = '<div class="loading-text" style="color:white;">エラーが発生しました: ' + error.message + '</div>';
}

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchQuery');
    const searchClear = document.getElementById('searchClear');
    const searchRadios = document.querySelectorAll('input[name="searchType"]');
    
    function updateSearchClear() {
        searchClear.classList.toggle('visible', searchInput.value.length > 0);
    }
    
    searchInput.addEventListener('input', function () {
        updateSearchClear();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });
    
    searchClear.addEventListener('click', function () {
        searchInput.value = '';
        updateSearchClear();
        searchInput.focus();
        performSearch();
    });
    
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); }
    });
    
    searchRadios.forEach(radio => radio.addEventListener('change', performSearch));
    
    const listFilter = document.getElementById('listFilter');
    const filterClear = document.getElementById('filterClear');
    
    function updateFilterClear() {
        filterClear.classList.toggle('visible', listFilter.value.length > 0);
    }
    
    listFilter.addEventListener('input', function () {
        updateFilterClear();
        clearTimeout(listFilterTimeout);
        listFilterTimeout = setTimeout(filterList, 300);
    });
    
    filterClear.addEventListener('click', function () {
        listFilter.value = '';
        updateFilterClear();
        listFilter.focus();
        filterList();
    });
});

function performSearch() {
    var query = document.getElementById('searchQuery').value.trim();
    var queryLower = query.toLowerCase();
    var searchType = document.querySelector('input[name="searchType"]:checked').value;
    var resultsDiv = document.getElementById('searchResults');
    var countSpan = document.getElementById('resultCountInline');
    var noResults = document.getElementById('noSearchResults');
    
    resultsDiv.innerHTML = '';
    
    if (!query) {
        countSpan.textContent = '';
        noResults.style.display = 'none';
        return;
    }
    
    const results = allSongs.filter(song => {
        const title = (song['曲名'] || '').toLowerCase();
        const titleYomi = (song['曲名の読み'] || '').toLowerCase().replace(/ /g,'');
        const artist = (song['アーティスト'] || '').toLowerCase();
        const artistYomi = (song['アーティストの読み'] || '').toLowerCase().replace(/ /g,'');
        const tieup = (song['タイアップ'] || '').toLowerCase();
        
        if (searchType === 'song') return title.includes(queryLower) || titleYomi.includes(queryLower);
        if (searchType === 'artist') return artist.includes(queryLower) || artistYomi.includes(queryLower);
        if (searchType === 'tieup') return tieup.includes(queryLower);
        
        return title.includes(queryLower) || titleYomi.includes(queryLower) || 
               artist.includes(queryLower) || artistYomi.includes(queryLower) || 
               tieup.includes(queryLower);
    });
    
    if (results.length === 0) {
        countSpan.textContent = '0件';
        noResults.style.display = 'block';
    } else {
        countSpan.textContent = results.length + '件';
        noResults.style.display = 'none';
        const displayLimit = 50;
        const displayResults = results.slice(0, displayLimit);
        let html = '';
        displayResults.forEach(song => { html += createResultItem(song, query); });
        if (results.length > displayLimit) {
            html += '<div style="text-align:center; padding:10px; color:#aaa;">他 ' + (results.length - displayLimit) + ' 件...</div>';
        }
        resultsDiv.innerHTML = html;
    }
}

function createResultItem(song, query) {
    const date = song['最終演奏'] ? formatDate(song['最終演奏']) : '-';
    const count = song['演奏回数'] || 0;
    const title = song['曲名'] || '不明';
    const artist = song['アーティスト'] || '不明';
    const titleYomi = song['曲名の読み'] || '';
    const artistYomi = song['アーティストの読み'] || '';
    const tieup = song['タイアップ'] || '';
    
    const hTitle = highlightText(title, query);
    const hArtist = highlightText(artist, query);
    const hTitleYomi = highlightText(titleYomi, query);
    const hArtistYomi = highlightText(artistYomi, query);
    const hTieup = highlightText(tieup, query);
    
    const copyText = title + '／' + artist;
    
    let yomiDisplay = (titleYomi || artistYomi) ? `<div class="song-yomi">${hTitleYomi} ${artistYomi ? '/ ' + hArtistYomi : ''}</div>` : '';
    let tieupDisplay = tieup ? `<div class="song-tieup"><div class="tv-icon-20"></div><span>${hTieup}</span></div>` : '';
    
    return `
        <div class="result-item">
            <div class="song-title">${hTitle}</div>
            <div class="song-artist">${hArtist}</div>
            ${yomiDisplay}
            ${tieupDisplay}
            <div class="song-meta">
              <span>演奏回数: ${count}回</span>
              <span>最終演奏: ${date}</span>
            </div>
            <button class="copy-button" onclick="copyToClipboard('${escapeQuotes(copyText)}')">コピー</button>
        </div>
      `;
}

function filterList() {
    const query = document.getElementById('listFilter').value.trim().toLowerCase();
    filteredListSongs = !query ? [...allSongs] : allSongs.filter(song =>
        (song['曲名'] || '').toLowerCase().includes(query) ||
        (song['曲名の読み'] || '').toLowerCase().includes(query) ||
        (song['アーティスト'] || '').toLowerCase().includes(query) ||
        (song['アーティストの読み'] || '').toLowerCase().includes(query) ||
        (song['タイアップ'] || '').toLowerCase().includes(query)
    );
    sortData(currentSort.key, currentSort.ascending);
    currentPage = 1;
    renderListTable();
}

function sortTable(key) {
    if (currentSort.key === key) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.key = key;
        currentSort.ascending = (key !== '最終演奏' && key !== '演奏回数');
    }
    sortData(currentSort.key, currentSort.ascending);
    renderListTable();
}

function sortData(key, ascending) {
    filteredListSongs.sort((a, b) => {
        let valA = a[key] ?? '';
        let valB = b[key] ?? '';
        if (key === '演奏回数') { valA = parseInt(valA) || 0; valB = parseInt(valB) || 0; }
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
}

function renderListTable() {
    const tbody = document.getElementById('songListBody');
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredListSongs.slice(start, start + itemsPerPage);
    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">データがありません</td></tr>';
        renderPagination(0);
        return;
    }
    tbody.innerHTML = pageItems.map(song => `
        <tr>
          <td>${escapeHtml(song['曲名'])}</td>
          <td>${escapeHtml(song['アーティスト'])}</td>
          <td style="font-size:0.9em; color:#666;">${song['最終演奏'] ? formatDate(song['最終演奏']) : '-'}</td>
          <td style="text-align:center;">${song['演奏回数'] || 0}</td>
        </tr>
      `).join('');
    renderPagination(Math.ceil(filteredListSongs.length / itemsPerPage));
}

function renderPagination(totalPages) {
    const div = document.getElementById('listPagination');
    div.innerHTML = '';
    if (totalPages <= 1) return;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    if (currentPage > 1) div.appendChild(createPageBtn('<', currentPage - 1));
    for (let i = start; i <= end; i++) div.appendChild(createPageBtn(i, i));
    if (currentPage < totalPages) div.appendChild(createPageBtn('>', currentPage + 1));
}

function createPageBtn(text, pageNum) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (pageNum === currentPage ? ' active' : '');
    btn.textContent = text;
    btn.onclick = () => {
        currentPage = pageNum;
        renderListTable();
        document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return btn;
}

function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) { return string.replace(/[*|[\]\\]/g, '\\$&').replace(/./g, '\\s*$&').replace(/[.+?^${}()]/g, '\\$&'); }

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
    return String(text ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeQuotes(text) { return text.replace(/'/g, "\\'").replace(/"/g, '\\"'); }

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopyToast).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
}

function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showCopyToast();
}

function showCopyToast() {
    const toast = document.getElementById('copyToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}


