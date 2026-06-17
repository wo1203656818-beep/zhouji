// ==================== 辅助工具页面（CBT速记 + 网易云音乐）====================

// ========== CBT 速记 ==========
var cbtMoods = [
  { key: 'anxious', icon: '😰', label: '焦虑' },
  { key: 'frustrated', icon: '😤', label: '挫败' },
  { key: 'angry', icon: '😠', label: '生气' },
  { key: 'sad', icon: '😢', label: '难过' },
  { key: 'tired', icon: '😩', label: '疲惫' },
  { key: 'guilty', icon: '😞', label: '内疚' },
];

window.renderAssistant = async function() {
  var div = el('div', 'p-3 md:p-6 max-w-5xl mx-auto fade-in');
  var recent = await loadRecentCbt();

  div.innerHTML = `
    <div class="mb-4">
      <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
        <i class="fas fa-brain text-indigo-500" style="font-size:18px"></i> CBT 速记
      </h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">捕获消极思维 → 理性重构</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
      <!-- CBT 速记表单 -->
      <div class="md:col-span-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <i class="fas fa-pen-fancy text-indigo-500" style="font-size:12px"></i> 即时记录
        </h3>

        <!-- 触发情境 -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">发生了什么？</label>
          <input id="cbt-trigger" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" placeholder="例如：看到待办清单就心烦..." maxlength="200">
        </div>

        <!-- 自动思维 -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">脑海里冒出了什么想法？<span class="text-gray-300">（自动思维）</span></label>
          <textarea id="cbt-thought" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm h-16 resize-none" placeholder='"这个任务太难了，我做不了"…' maxlength="500"></textarea>
        </div>

        <!-- 情绪选择 -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">现在感觉如何？</label>
          <div class="flex gap-2" id="cbt-mood-list">
            ${cbtMoods.map(function(m) {
              return '<button onclick="selectCbtMood(\'' + m.key + '\',this)" class="cbt-mood-btn flex flex-col items-center gap-0.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent transition-all" data-key="' + m.key + '">' +
                '<span class="text-lg">' + m.icon + '</span>' +
                '<span class="text-[10px] text-gray-500">' + m.label + '</span></button>';
            }).join('')}
          </div>
        </div>

        <!-- 思维重构 -->
        <div class="mb-4">
          <label class="text-xs text-gray-500 block mb-1">换个角度想想？<span class="text-gray-300">（重构）</span></label>
          <textarea id="cbt-reframe" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm h-16 resize-none" placeholder='"可以先拆成小步骤，做2分钟试试"…' maxlength="500"></textarea>
        </div>

        <!-- 行动一步 -->
        <div class="mb-4">
          <label class="text-xs text-gray-500 block mb-1">下一步做什么？<span class="text-gray-300">（微小行动）</span></label>
          <input id="cbt-action" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" placeholder="比如：打开文档写第一句" maxlength="200">
        </div>

        <button onclick="saveCbtEntry()" class="w-full py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-all"><i class="fas fa-save mr-1"></i>保存记录</button>
      </div>

      <!-- 右侧：近期记录 + 音乐 -->
      <div class="md:col-span-2 space-y-3">
        <!-- 近期CBT记录 -->
        <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <i class="fas fa-history text-gray-400" style="font-size:12px"></i> 近期记录
          </h3>
          <div id="cbt-recent-list">
            ${recent || '<p class="text-xs text-gray-400 text-center py-6">还没有CBT记录</p>'}
          </div>
        </div>

        <!-- 网易云音乐（折叠版） -->
        <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <i class="fas fa-music text-rose-500" style="font-size:12px"></i> 专注音乐
          </h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="music-search-input" placeholder="搜索轻音乐/白噪音..." class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs" onkeypress="if(event.key==='Enter') searchMusic()">
            <button onclick="searchMusic()" class="px-3 py-2 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-all"><i class="fas fa-search"></i></button>
          </div>
          <div id="music-player" class="mb-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600" style="display:none">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-rose-400 to-indigo-500 flex items-center justify-center text-white shrink-0"><i class="fas fa-music" style="font-size:10px"></i></div>
              <div class="flex-1 min-w-0"><p id="music-player-title" class="text-xs font-medium text-gray-800 dark:text-white truncate">未选择</p><p id="music-player-status" class="text-[10px] text-gray-500">选择歌曲播放</p></div>
              <button onclick="closeMusicPlayer()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times" style="font-size:10px"></i></button>
            </div>
            <div id="music-player-container" style="display:none"><iframe id="music-iframe" class="w-full h-14 rounded-lg mt-1" frameborder="0" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>
          </div>
          <div id="music-search-results" class="space-y-1 max-h-48 overflow-y-auto"></div>
        </div>
      </div>
    </div>
  `;
  return div;
}

var selectedCbtMood = null;

function selectCbtMood(key, btn) {
  selectedCbtMood = key;
  document.querySelectorAll('.cbt-mood-btn').forEach(function(b) {
    b.className = b.className.replace(' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30', '');
    b.className += ' border-transparent';
  });
  btn.className = btn.className.replace(' border-transparent', '');
  btn.className += ' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30';
}

async function saveCbtEntry() {
  var trigger = document.getElementById('cbt-trigger')?.value?.trim();
  var thought = document.getElementById('cbt-thought')?.value?.trim();
  var reframe = document.getElementById('cbt-reframe')?.value?.trim();
  var action = document.getElementById('cbt-action')?.value?.trim();

  if (!thought && !trigger) { showToast('请描述你的想法或情境', 'warning'); return; }

  try {
    var title = (trigger || 'CBT速记').substring(0, 100);
    var content = (trigger ? '触发情境：' + trigger : '') + (action ? '\n下一步行动：' + action : '');
    await api.post('/api/diary', {
      title: title,
      content: content || ' ',
      mood: selectedCbtMood || 'neutral',
      template_type: 'cbt_thought',
      cbt_thought: thought || '',
      cbt_reframe: reframe || '',
      is_private: true
    });
    showToast('已保存', 'success');
    // 重置表单
    document.getElementById('cbt-trigger').value = '';
    document.getElementById('cbt-thought').value = '';
    document.getElementById('cbt-reframe').value = '';
    document.getElementById('cbt-action').value = '';
    selectedCbtMood = null;
    document.querySelectorAll('.cbt-mood-btn').forEach(function(b) {
      b.className = b.className.replace(' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30', '') + ' border-transparent';
    });
    // 刷新近期记录
    var recent = await loadRecentCbt();
    var list = document.getElementById('cbt-recent-list');
    if (list) list.innerHTML = recent || '<p class="text-xs text-gray-400 text-center py-4">还没有CBT记录</p>';
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

async function loadRecentCbt() {
  try {
    var data = await api.get('/api/diary');
    var entries = (data.entries || []).filter(function(e) { return e.cbt_thought || e.cbt_reframe; });
    if (entries.length === 0) return null;
    return entries.slice(0, 8).map(function(e) {
      var thought = (e.cbt_thought || '').substring(0, 60);
      var reframe = (e.cbt_reframe || '').substring(0, 60);
      return '<div class="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 mb-1.5 last:mb-0">' +
        '<div class="flex items-center gap-2 mb-1">' +
        '<span class="text-[10px] text-gray-400">' + new Date(e.created_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) + '</span>' +
        (e.mood ? '<span class="text-xs">' + (cbtMoods.find(function(m){return m.key===e.mood})?.icon||'') + '</span>' : '') +
        '</div>' +
        (thought ? '<p class="text-xs text-gray-600 dark:text-gray-400"><span class="text-red-400">💭</span> ' + escapeHtml(thought) + '</p>' : '') +
        (reframe ? '<p class="text-xs text-green-600 dark:text-green-400 mt-0.5"><span class="text-green-400">🔄</span> ' + escapeHtml(reframe) + '</p>' : '') +
        '</div>';
    }).join('');
  } catch(e) {
    return null;
  }
}

// ========== 网易云音乐搜索（保留原功能）==========
window.searchMusic = async function() {
  var keyword = document.getElementById('music-search-input')?.value?.trim();
  if (!keyword) { showToast('请输入关键词', 'warning'); return; }
  showToast('搜索中...', 'info');
  try {
    var resp = await api.get('/api/music/search?keyword=' + encodeURIComponent(keyword));
    if (!resp.songs || resp.songs.length === 0) {
      document.getElementById('music-search-results').innerHTML = '<div class="text-center py-4 text-gray-400"><i class="fas fa-music text-xl mb-1"></i><p class="text-[10px]">未找到结果</p></div>';
      showToast('未找到结果', 'info'); return;
    }
    document.getElementById('music-search-results').innerHTML = resp.songs.map(function(song, idx) {
      var min = Math.floor(song.duration / 1000 / 60), sec = Math.floor(song.duration / 1000 % 60);
      var safeName = (song.name||'').replace(/'/g,'').replace(/"/g,'');
      var safeArtist = (song.artists||'').replace(/'/g,'').replace(/"/g,'');
      var safeUrl = (song.embedUrl||'').replace(/'/g,'').replace(/"/g,'');
      return '<div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-rose-400/50 cursor-pointer transition-all song-item" data-idx="' + idx + '">' +
        '<div class="flex items-center gap-2"><div class="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 shrink-0"><i class="fas fa-play" style="font-size:9px"></i></div>' +
        '<div class="flex-1 min-w-0"><p class="text-xs font-medium text-gray-800 dark:text-white truncate">' + safeName + '</p><p class="text-[10px] text-gray-500 truncate">' + safeArtist + '</p></div>' +
        '<span class="text-[10px] text-gray-400">' + (min<10?'0':'')+min+':'+(sec<10?'0':'')+sec+'</span></div></div>';
    }).join('');
    // 绑定点击事件
    var _songs = resp.songs;
    document.querySelectorAll('.song-item').forEach(function(el, i) {
      el.onclick = function() {
        var s = _songs[i];
        if (s) playSong(s.id, s.name, s.artists, s.embedUrl);
      };
    });
  } catch (err) {
    document.getElementById('music-search-results').innerHTML = '<div class="text-center py-4 text-gray-400"><i class="fas fa-exclamation-circle text-xl mb-1"></i><p class="text-[10px]">搜索失败</p></div>';
  }
};

window.playSong = function(id, name, artists, embedUrl) {
  document.getElementById('music-player').style.display = 'block';
  document.getElementById('music-player-container').style.display = 'block';
  document.getElementById('music-iframe').src = embedUrl;
  document.getElementById('music-player-title').textContent = name + ' - ' + artists;
  document.getElementById('music-player-status').textContent = '播放中...';
  document.getElementById('music-player').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeMusicPlayer = function() {
  document.getElementById('music-iframe').src = '';
  document.getElementById('music-player-container').style.display = 'none';
  document.getElementById('music-player').style.display = 'none';
};
