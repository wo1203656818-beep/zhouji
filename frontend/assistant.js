// ==================== 辅助工具页面（灵感记录 + 网易云音乐）====================
// 灵感记录替代了原来的CBT速记

// ========== 灵感来源选项 ==========
var inspirationSources = [
  { key: 'delivery', icon: '🏍️', label: '送外卖路上' },
  { key: 'running', icon: '🏃', label: '跑步时' },
  { key: 'x-twitter', icon: '🐦', label: '刷X时' },
  { key: 'reading', icon: '📖', label: '读书/看视频' },
  { key: 'shower', icon: '🚿', label: '洗澡/睡前' },
  { key: 'other', icon: '💡', label: '其他' },
];

// ========== 主渲染函数 ==========
window.renderAssistant = async function() {
  var div = el('div', 'p-3 md:p-6 max-w-5xl mx-auto fade-in');
  var recentList = await loadInspirations();

  div.innerHTML = `
    <div class="mb-4">
      <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
        <i class="fas fa-lightbulb text-yellow-500" style="font-size:18px"></i> 灵感记录
      </h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">随时随地捕获灵感 · 自动保存到云端</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
      <!-- 灵感记录表单 -->
      <div class="md:col-span-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <i class="fas fa-pen-fancy text-yellow-500" style="font-size:12px"></i> 新灵感
        </h3>

        <!-- 标题（一句话概括） -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">一句话概括 <span class="text-gray-300">（可选）</span></label>
          <input id="insp-title" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" placeholder="例如：送外卖时想到的短视频脚本..." maxlength="200">
        </div>

        <!-- 灵感内容 -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">灵感/文案内容</label>
          <textarea id="insp-content" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm h-28 resize-none" placeholder="把你的想法写下来，完整的句子、关键词、或者一句文案都行..." maxlength="2000"></textarea>
        </div>

        <!-- 灵感来源 -->
        <div class="mb-3">
          <label class="text-xs text-gray-500 block mb-1">灵感来源</label>
          <div class="flex gap-2 flex-wrap" id="insp-source-list">
            ${inspirationSources.map(function(s) {
              return '<button onclick="selectInspSource(\'' + s.key + '\',this)" class="insp-source-btn flex items-center gap-1 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border border-transparent transition-all text-xs" data-key="' + s.key + '">' +
                '<span>' + s.icon + '</span>' +
                '<span class="text-gray-600 dark:text-gray-400">' + s.label + '</span></button>';
            }).join('')}
          </div>
        </div>

        <!-- 用途标签 -->
        <div class="mb-4">
          <label class="text-xs text-gray-500 block mb-1">用途标签 <span class="text-gray-300">（可选）</span></label>
          <div class="flex gap-2 flex-wrap">
            <button onclick="toggleInspTag('video',this)" class="insp-tag-btn px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent text-xs text-gray-600 dark:text-gray-400 transition-all">🎬 短视频脚本</button>
            <button onclick="toggleInspTag('thread',this)" class="insp-tag-btn px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent text-xs text-gray-600 dark:text-gray-400 transition-all">📝 X Thread</button>
            <button onclick="toggleInspTag('copy',this)" class="insp-tag-btn px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent text-xs text-gray-600 dark:text-gray-400 transition-all">✍️ 文案</button>
            <button onclick="toggleInspTag('idea',this)" class="insp-tag-btn px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent text-xs text-gray-600 dark:text-gray-400 transition-all">💡 创业想法</button>
            <button onclick="toggleInspTag('other',this)" class="insp-tag-btn px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent text-xs text-gray-600 dark:text-gray-400 transition-all">📌 其他</button>
          </div>
        </div>

        <button onclick="saveInspiration()" class="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 transition-all shadow-sm"><i class="fas fa-save mr-1"></i>保存灵感</button>
      </div>

      <!-- 右侧：近期灵感 + 音乐 -->
      <div class="md:col-span-2 space-y-3">
        <!-- 近期灵感列表 -->
        <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <i class="fas fa-history text-gray-400" style="font-size:12px"></i> 近期灵感
            <span id="insp-count-badge" class="ml-auto text-[10px] text-gray-400"></span>
          </h3>
          <div class="relative mb-2">
            <input id="insp-search-input" type="text" placeholder="搜索灵感..." class="w-full px-3 py-1.5 pl-8 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs" oninput="window._fkFilterInsp()" style="box-sizing:border-box;">
            <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:11px;color:#9ca3af;"></i>
          </div>
          <div id="insp-recent-list" class="space-y-1.5 max-h-80 overflow-y-auto">
            ${recentList || '<div class="text-center py-8"><i class="far fa-lightbulb text-3xl text-gray-300 dark:text-gray-600 mb-2"></i><p class="text-xs text-gray-400">还没有灵感记录</p><p class="text-[10px] text-gray-300 dark:text-gray-500 mt-1">随便写点什么吧，灵感不等人</p></div>'}
          </div>
        </div>

        <!-- 网易云音乐 -->
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

// ========== 灵感来源选择 ==========
var selectedInspSource = null;

function selectInspSource(key, btn) {
  selectedInspSource = key;
  document.querySelectorAll('.insp-source-btn').forEach(function(b) {
    b.className = b.className.replace(' border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30', '');
    b.className = b.className.replace('border-transparent', '') + ' border-transparent';
  });
  btn.className = btn.className.replace(' border-transparent', '');
  btn.className += ' border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
}
window.selectInspSource = selectInspSource;

// ========== 编辑状态 ==========
var _editingId = null;

window.editInspiration = function(id, b64Title, b64Content) {
  _editingId = id;
  try {
    document.getElementById('insp-title').value = decodeURIComponent(escape(atob(b64Title || '')));
  } catch(e) {
    document.getElementById('insp-title').value = '';
  }
  try {
    document.getElementById('insp-content').value = decodeURIComponent(escape(atob(b64Content || '')));
  } catch(e) {
    document.getElementById('insp-content').value = '';
  }
  // 滚动到表单
  document.querySelector('.md\\:col-span-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('insp-content')?.focus();
  // 更新按钮文字
  var btn = document.querySelector('[onclick="saveInspiration()"]');
  if (btn) btn.innerHTML = '<i class="fas fa-pen mr-1"></i>更新灵感';
  showToast('正在编辑...', 'info');
};

// ========== 用途标签选择 ==========
var selectedInspTags = [];

function toggleInspTag(tag, btn) {
  var idx = selectedInspTags.indexOf(tag);
  if (idx > -1) {
    selectedInspTags.splice(idx, 1);
    btn.className = btn.className.replace(' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400', '');
    btn.className += ' border-transparent text-gray-600 dark:text-gray-400';
  } else {
    selectedInspTags.push(tag);
    btn.className = btn.className.replace(' border-transparent', '');
    btn.className += ' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
  }
}
window.toggleInspTag = toggleInspTag;

// ========== 保存灵感到数据库（新建或更新）==========
async function saveInspiration() {
  var title = document.getElementById('insp-title')?.value?.trim();
  var content = document.getElementById('insp-content')?.value?.trim();

  if (!content) { showToast('请写点什么再保存', 'warning'); return; }

  try {
    var finalTitle = title || '灵感 ' + new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    var extra = '';
    if (selectedInspSource) extra += '来源：' + (inspirationSources.find(function(s){return s.key===selectedInspSource})?.icon||selectedInspSource) + ' ';
    if (selectedInspTags.length > 0) extra += '标签：#' + selectedInspTags.join(' #') + ' ';

    if (_editingId) {
      await api.put('/api/diary/' + _editingId, {
        title: finalTitle.substring(0, 100),
        content: content,
        mood: selectedInspSource || 'neutral',
        cbt_thought: extra
      });
      showToast('灵感已更新 ✏️', 'success');
      _editingId = null;
    } else {
      await api.post('/api/diary', {
        title: finalTitle.substring(0, 100),
        content: content,
        mood: selectedInspSource || 'neutral',
        template_type: 'inspiration',
        cbt_thought: extra,
        is_private: true
      });
      showToast('灵感已保存 ✨', 'success');
    }
    // 重置表单
    document.getElementById('insp-title').value = '';
    document.getElementById('insp-content').value = '';
    selectedInspSource = null;
    document.querySelectorAll('.insp-source-btn').forEach(function(b) {
      b.className = b.className.replace(' border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30', '') + ' border-transparent';
    });
    selectedInspTags = [];
    document.querySelectorAll('.insp-tag-btn').forEach(function(b) {
      b.className = b.className.replace(' border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400', '');
      b.className += ' border-transparent text-gray-600 dark:text-gray-400';
    });
    // 刷新列表
    var listHtml = await loadInspirations();
    var list = document.getElementById('insp-recent-list');
    if (list) list.innerHTML = listHtml || '<div class="text-center py-8"><i class="far fa-lightbulb text-3xl text-gray-300 dark:text-gray-600 mb-2"></i><p class="text-xs text-gray-400">还没有灵感记录</p></div>';
    // 重置按钮文字
    _editingId = null;
    var btn = document.querySelector('[onclick="saveInspiration()"]');
    if (btn) btn.innerHTML = '<i class="fas fa-save mr-1"></i>保存灵感';
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}
window.saveInspiration = saveInspiration;

// ========== 删除灵感 ==========
async function deleteInspiration(id, el) {
  if (!confirm('确定删除这条灵感吗？')) return;
  try {
    await api.del('/api/diary/' + id);
    var card = el.closest('.insp-card') || el.parentElement;
    if (card) {
      card.style.transition = 'all 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(30px)';
      setTimeout(function() { card.remove(); }, 300);
    }
    showToast('已删除', 'info');
    var countBadge = document.getElementById('insp-count-badge');
    if (countBadge) {
      var remaining = document.querySelectorAll('.insp-card').length;
      if (remaining === 0) {
        document.getElementById('insp-recent-list').innerHTML = '<div class="text-center py-8"><i class="far fa-lightbulb text-3xl text-gray-300 dark:text-gray-600 mb-2"></i><p class="text-xs text-gray-400">还没有灵感记录</p></div>';
      }
    }
  } catch(err) {
    showToast('删除失败', 'error');
  }
}
window.deleteInspiration = deleteInspiration;

// ========== 加载灵感列表 ==========
var _allInspirations = []; // 用于搜索

window._fkFilterInsp = function() {
  var q = (document.getElementById('insp-search-input')?.value || '').trim().toLowerCase();
  var list = document.getElementById('insp-recent-list');
  if (!list) return;
  if (!q) {
    // 无关键词，显示全部
    list.innerHTML = renderInspList(_allInspirations);
    return;
  }
  var filtered = _allInspirations.filter(function(e) {
    var title = (e.title || '').toLowerCase();
    var content = (e.content || '').toLowerCase();
    var extra = (e.cbt_thought || '').toLowerCase();
    return title.indexOf(q) > -1 || content.indexOf(q) > -1 || extra.indexOf(q) > -1;
  });
  list.innerHTML = filtered.length > 0 ? renderInspList(filtered) : '<div class="text-center py-6 text-gray-400 text-xs"><i class="fas fa-search text-lg mb-1"></i><p>没有找到匹配的灵感</p></div>';
};

function renderInspList(entries) {
  return entries.slice(0, 20).map(function(e) {
    var title = e.title || '';
    var content = (e.content || '').substring(0, 80);
    var extra = e.cbt_thought || '';
    var time = new Date(e.created_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    var hasMore = (e.content || '').length > 80;
    var safeTitle = escapeHtml(title);
    var safeContent = escapeHtml(content);
    var safeExtra = escapeHtml(extra);
    // 用 base64 编码原始内容避免 HTML onclick 引号冲突
    var b64Title = btoa(unescape(encodeURIComponent(title)));
    var b64Content = btoa(unescape(encodeURIComponent(e.content || '')));

    return '<div class="insp-card p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 hover:border-yellow-300/50 transition-all">' +
      '<div class="flex items-start justify-between gap-1">' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-1.5 mb-0.5">' +
      '<i class="fas fa-lightbulb text-yellow-500" style="font-size:10px"></i>' +
      '<span class="text-xs font-medium text-gray-800 dark:text-white truncate">' + safeTitle + '</span>' +
      '</div>' +
      '<p class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">' + safeContent + (hasMore ? '...' : '') + '</p>' +
      (safeExtra ? '<p class="text-[10px] text-gray-400 mt-0.5">' + safeExtra + '</p>' : '') +
      '<p class="text-[10px] text-gray-400 mt-0.5">' + time + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:2px;flex-shrink:0;">' +
      '<button onclick="editInspiration(' + e.id + ',\'' + b64Title + '\',\'' + b64Content + '\')" class="text-gray-300 dark:text-gray-600 hover:text-yellow-500 p-1" title="编辑"><i class="fas fa-pen" style="font-size:10px"></i></button>' +
      '<button onclick="deleteInspiration(' + e.id + ',this)" class="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1" title="删除"><i class="fas fa-trash-alt" style="font-size:10px"></i></button>' +
      '</div>' +
      '</div></div>';
  }).join('');
}

async function loadInspirations() {
  try {
    var data = await api.get('/api/diary?template_type=inspiration&limit=50');
    var entries = data.entries || [];
    _allInspirations = entries;
    if (entries.length === 0) return null;
    var countBadge = document.getElementById('insp-count-badge');
    if (countBadge) countBadge.textContent = '共' + entries.length + '条';
    return renderInspList(entries);
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
