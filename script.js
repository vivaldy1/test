const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;

window.onload = async () => {
    initDragScroll();
    
    // HTML側の id="loadingOverlay" または class="loading-overlay" の両方に対応
    const loader = document.getElementById('loadingOverlay') || document.querySelector('.loading-overlay');
    const loadingText = document.querySelector('.loading-text');

    try {
        const res = await fetch(GAS_URL);
        if (!res.ok) throw new Error('通信エラーが発生しました');
        
        allSongs = await res.json();

        // 検索と一覧の初期化
        initApp();

        // 【修正】正常にデータが処理された後、クラスを追加して消す
        if (loader) {
            loader.classList.add('hidden');
        }

    } catch (e) {
        console.error("Critical Error:", e);
        if (loadingText) {
            loadingText.style.color = "#ff4d4d";
            loadingText.innerText = `エラー: ${e.message}`;
        }
    }
};

function initApp() {
    document.getElementById('searchQuery')?.addEventListener('input', performSearch);
    document.querySelectorAll('input[name="stype"]').forEach(r => {
        r.addEventListener('change', performSearch);
    });
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;

    const sorted = [...allSongs].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') {
            v1 = parseInt(v1) || 0; v2 = parseInt(v2) || 0;
        }
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

// --- 以下、補助関数（formatDate, performSearch, copyText, initDragScroll）は変更なし ---

function performSearch() {
    const query = document.getElementById('searchQuery')?.value.trim().toLowerCase();
    const type = document.querySelector('input[name="stype"]:checked')?.value || 'all';
    const container = document.getElementById('searchResults');
    if (!container || !query) { if (container) container.innerHTML = ''; return; }

    const filtered = allSongs.filter(s => {
        const fields = {
            song: [s['曲名'], s['曲名の読み']],
            artist: [s['アーティスト'], s['アーティストの読み']],
            tieup: [s['タイアップ']],
            all: [s['曲名'], s['曲名の読み'], s['アーティスト'], s['アーティストの読み'], s['タイアップ']]
        };
        return (fields[type] || fields['all']).some(f => String(f || '').toLowerCase().includes(query));
    });

    container.innerHTML = filtered.map(s => `
        <div class="result-item">
            <div class="song-title">${s['曲名']}</div>
            <div class="song-artist">${s['アーティスト']}</div>
            ${s['タイアップ'] ? `<div class="song-tieup">📺 ${s['タイアップ']}</div>` : ''}
            <div class="song-meta">
                <span>演奏回数: ${s['演奏回数']}回</span>
                <span>最終演奏: ${formatDate(s['最終演奏'])}</span>
            </div>
            <button class="copy-btn" onclick="copyText('${(s['曲名']||'').replace(/'/g,"\\'")} / ${(s['アーティスト']||'').replace(/'/g,"\\'")}')">コピー</button>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
}

function copyText(txt) {
    navigator.clipboard.writeText(txt).then(() => {
        const t = document.getElementById('copyToast');
        if (t) { t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
    });
}

function initDragScroll() {
    const s = document.getElementById('searchTypeGroup');
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.onmousedown=(e)=>{ isDown=true; startX=e.pageX-s.offsetLeft; scrollLeft=s.scrollLeft; };
    s.onmouseleave=s.onmouseup=()=>{ isDown=false; };
    s.onmousemove=(e)=>{ if(!isDown) return; const x=e.pageX-s.offsetLeft; s.scrollLeft=scrollLeft-(x-startX); };
}
