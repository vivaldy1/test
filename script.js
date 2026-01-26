/* script.js - 修正・統合版 */

// 1. 設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycby4dEto3Abr_bmC7nCMBjALGkxut24WTWtDoODMUWXWvx4W7TTNTqXCGQhxRT5QV8qqeA/exec';
let allSongs = [];
let sortKey = '最終演奏';
let sortAsc = false;

function highlight(text, q){
    if(!q) return text;
    const r = new RegExp(`(${q})`,'gi');
    return text.replace(r,'<span class="highlight">$1</span>');
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
    const loader = document.getElementById('loadingOverlay');
    const searchInput = document.getElementById('searchQuery');
    const clearBtn = document.getElementById('clearSearch');

    // ×ボタンのクリックイベント
    if (clearBtn) {
        clearBtn.onclick = () => { 
            searchInput.value = ''; 
            performSearch(); 
        };
    }

    try {
        // データの読み込み
        const res = await fetch(GAS_URL);
        allSongs = await res.json();
        
        // イベントリスナーの登録
        searchInput?.addEventListener('input', performSearch);
        document.querySelectorAll('input[name="stype"]').forEach(r => {
            r.addEventListener('change', performSearch);
        });
        
        // 初期表示
        renderTable();
        if (loader) loader.classList.add('hidden');
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
    const headerYtLink = document.getElementById('headerYtLink');
    const liveBadge = document.getElementById('liveBadge');
    const countDisplay = document.getElementById('resultCountInline');

    // クリアボタンの表示制御
    if (query) clearBtn.classList.add('show'); else clearBtn.classList.remove('show');

    // 検索語がない場合はリセット
    if (!query) { 
        container.innerHTML = ''; 
        if (countDisplay) countDisplay.innerText = '';
        headerYtLink.href = 'https://www.youtube.com/@asaxmayo';
        liveBadge.classList.remove('active');
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

    // ヘッダーアイコン連動 (YouTube IDがある最初の曲のリンクを貼る)
    const firstWithYt = filtered.find(s => s['YouTube']);
    if (firstWithYt) {
        headerYtLink.href = `https://www.youtube.com/live/${firstWithYt['YouTube']}`;
        liveBadge.classList.add('active');
    } else {
        headerYtLink.href = 'https://www.youtube.com/@asaxmayo';
        liveBadge.classList.remove('active');
    }
    
    // 結果表示 (セキュリティに配慮しTrustedHTMLを意識した構造)
    container.innerHTML = ''; // 一旦クリア
    const fragment = document.createDocumentFragment();
    
    filtered.forEach(s => {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        // 特殊文字をエスケープした安全なテキスト作成
        const title = escapeHtml(s['曲名'] || '不明');
        const titleYomi = escapeHtml(s['曲名の読み'] || '');
        const artist = escapeHtml(s['アーティスト'] || '不明');
        const artistYomi = escapeHtml(s['アーティストの読み'] || '');
        const tieup = s['タイアップ'] ? `<div class="song-tieup">${escapeHtml(s['タイアップ'])}</div>` : '';
        const count = s['演奏回数'] || 0;
        const date = formatDate(s['最終演奏']);
        
        // コピー用テキスト
        const copyVal = `${s['曲名'] || ''} / ${s['アーティスト'] || ''}`.replace(/'/g, "\\'");

        item.innerHTML = `
            <div class="song-title">${title}<span class="ruby">${titleYomi}</span></div>
            <div class="song-artist">${artist}<span class="ruby">${artistYomi}</span></div>
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
}

// 5. 一覧テーブル表示
function renderTable() {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;

    const sorted = [...allSongs].sort((a, b) => {
        let v1 = a[sortKey] || '', v2 = b[sortKey] || '';
        if (sortKey === '演奏回数') { v1 = Number(v1) || 0; v2 = Number(v2) || 0; }
        return sortAsc ? (v1 > v2 ? 1 : -1) : (v1 < v2 ? 1 : -1);
    });

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    sorted.forEach(s => {
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
}

// 6. ユーティリティ
function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
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
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.onmousedown=(e)=>{ 
        isDown=true; 
        s.style.cursor = 'grabbing';
        startX=e.pageX-s.offsetLeft; 
        scrollLeft=s.scrollLeft; 
    };
    window.onmouseup=()=>{ 
        isDown=false; 
        if(s) s.style.cursor = 'grab';
    };
    s.onmousemove=(e)=>{ 
        if(!isDown) return; 
        e.preventDefault();
        const x=e.pageX-s.offsetLeft; 
        s.scrollLeft=scrollLeft-(x-startX); 
    };
}
