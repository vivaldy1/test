const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;

window.onload = async () => {
    initDragScroll();
    const loadingText = document.querySelector('.loading-text');
    
    try {
        console.log("Fetching data from GAS...");
        const res = await fetch(GAS_URL);
        
        if (!res.ok) {
            throw new Error(`HTTPエラー! ステータス: ${res.status}`);
        }

        const rawData = await res.json();
        console.log("Data received:", rawData);

        if (rawData.error) {
            throw new Error(`GAS内部エラー: ${rawData.error}`);
        }

        allSongs = rawData;
        
        // 正常終了
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('searchQuery').addEventListener('input', performSearch);
        document.querySelectorAll('input[name="stype"]').forEach(r => r.addEventListener('change', performSearch));
        renderTable();

    } catch (e) {
        console.error("Debug Error:", e);
        // ユーザーの画面にエラーを表示して「なぜ止まっているか」を可視化
        loadingText.style.color = "#ff4d4d";
        loadingText.innerHTML = `
            読み込み失敗<br>
            <span style="font-size:0.8em; font-weight:normal;">
                理由: ${e.message}<br>
                ※GASのURLが正しいか、公開設定が「全員」か確認してください。
            </span>`;
    }
};

// --- 以下、描画処理（変更なし） ---

function switchTab(t) {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-btn-' + t).classList.add('active');
    document.getElementById(t + '-tab').classList.add('active');
}

function highlightText(text, query) {
    if (!query || !text) return text || '';
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
    
    container.innerHTML = filtered.map(s => `
        <div class="result-item">
            <div class="song-title">${highlightText(s['曲名'], query)}</div>
            <div class="song-artist">${highlightText(s['アーティスト'], query)}</div>
            ${s['タイアップ'] ? `<div class="song-tieup">📺 ${highlightText(s['タイアップ'], query)}</div>` : ''}
            <div class="song-meta">
                <span>演奏回数: ${s['演奏回数'] || 0}回</span>
                <span>最終演奏: ${formatDate(s['最終演奏'])}</span>
            </div>
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
    if (!tbody) return;
    const sorted = [...allSongs].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { v1 = Number(v1) || 0; v2 = Number(v2) || 0; }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });
    
    tbody.innerHTML = sorted.map(s => `
        <tr>
            <td>${s['曲名'] || '-'}</td>
            <td>${s['アーティスト'] || '-'}</td>
            <td>${s['演奏回数'] || 0}</td>
            <td>${formatDate(s['最終演奏'])}</td>
        </tr>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    } catch (e) { return dateStr; }
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
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.onmousedown = (e) => { isDown = true; s.style.cursor = 'grabbing'; startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; };
    s.onmouseleave = s.onmouseup = () => { isDown = false; s.style.cursor = 'grab'; };
    s.onmousemove = (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX); };
}
