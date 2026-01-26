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
