const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;

window.onload = async () => {
    initDragScroll();
    try {
        const res = await fetch(GAS_URL);
        allSongs = await res.json();
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('searchQuery').addEventListener('input', performSearch);
        document.querySelectorAll('input[name="stype"]').forEach(r => r.addEventListener('change', performSearch));
        renderTable();
    } catch (e) { console.error(e); }
};

function switchTab(t) {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-btn-' + t).classList.add('active');
    document.getElementById(t + '-tab').classList.add('active');
}

// ハイライト処理用関数
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return String(text).replace(regex, '<span class="highlight">$1</span>');
}

function performSearch() {
    const query = document.getElementById('searchQuery').value.trim();
    const type = document.querySelector('input[name="stype"]:checked').value;
    const container = document.getElementById('searchResults');
    
    if (!query) {
        container.innerHTML = '';
        document.getElementById('resultCountInline').innerText = '';
        return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allSongs.filter(s => {
        const fields = {
            song: [s['曲名'], s['曲名の読み']],
            artist: [s['アーティスト'], s['アーティストの読み']],
            tieup: [s['タイアップ']],
            all: [s['曲名'], s['曲名の読み'], s['アーティスト'], s['アーティストの読み'], s['タイアップ']]
        };
        return fields[type].some(f => (f || '').toLowerCase().includes(lowerQuery));
    });

    document.getElementById('resultCountInline').innerText = filtered.length + '件';
    
    container.innerHTML = filtered.slice(0, 50).map(s => `
        <div class="result-item">
            <div class="song-title">${highlightText(s['曲名'], query)}</div>
            <div class="song-artist">${highlightText(s['アーティスト'], query)}</div>
            ${s['タイアップ'] ? `<div class="song-tieup">📺 ${highlightText(s['タイアップ'], query)}</div>` : ''}
            <div class="song-meta">演奏回数: ${s['演奏回数'] || 0}回 / 最終演奏: ${s['最終演奏'] || '-'}</div>
            <button class="copy-btn" onclick="copyText('${s['曲名']} / ${s['アーティスト']}')">コピー</button>
        </div>
    `).join('');
}

function handleSort(key) {
    sortAsc = (sortKey === key) ? !sortAsc : false;
    sortKey = key;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('songListBody');
    const sorted = [...allSongs].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { v1 = Number(v1) || 0; v2 = Number(v2) || 0; }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });
    
    // 一覧バグ回避：全件表示するように修正
    tbody.innerHTML = sorted.map(s => `
        <tr>
            <td>${s['曲名'] || '-'}</td>
            <td>${s['アーティスト'] || '-'}</td>
            <td>${s['演奏回数'] || 0}</td>
            <td>${s['最終演奏'] || '-'}</td>
        </tr>
    `).join('');
}

function copyText(txt) {
    navigator.clipboard.writeText(txt).then(() => {
        const t = document.getElementById('copyToast');
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    });
}

function initDragScroll() {
    const s = document.getElementById('searchTypeGroup');
    let isDown = false, startX, scrollLeft;
    s.onmousedown = (e) => { isDown = true; s.style.cursor = 'grabbing'; startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; };
    s.onmouseleave = s.onmouseup = () => { isDown = false; s.style.cursor = 'grab'; };
    s.onmousemove = (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX); };
}
