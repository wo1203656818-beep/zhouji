// ========= 创作者工作室 v2 =========
// 样式使用 Tailwind 原生类（与 Dashboard 一致）
async function renderCreatorStudio() {
  const token = safeStorage.get('token');
  if (!token) { navigate('login'); return ''; }

  let scripts = [];
  try {
    const raw = localStorage.getItem('creator_scripts');
    scripts = raw ? JSON.parse(raw) : [];
  } catch(e) { scripts = []; }

  let html = '<div class="max-w-6xl mx-auto fade-in">';

  // 标题栏
  html += `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg md:text-xl font-bold gradient-text">创作者工作室</h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">写脚本 · 管拍摄 · 记发布</p>
      </div>
      <button onclick="showScriptEditor()" class="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 touch-btn">
        <i class="fas fa-plus mr-1"></i>新建脚本
      </button>
    </div>`;

  // 统计卡片（与 Dashboard 风格一致）
  html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2 mb-4">';
  html += `<div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-3 text-center shadow-sm">
    <div class="text-base md:text-lg font-bold text-indigo-500">${scripts.length}</div>
    <div class="text-[10px] md:text-xs text-gray-400 mt-0.5">脚本总数</div></div>`;
  html += `<div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-3 text-center shadow-sm">
    <div class="text-base md:text-lg font-bold text-green-500">${scripts.filter(function(s){return s.status==='done'}).length}</div>
    <div class="text-[10px] md:text-xs text-gray-400 mt-0.5">已完成</div></div>`;
  html += `<div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-3 text-center shadow-sm">
    <div class="text-base md:text-lg font-bold text-amber-500">${scripts.filter(function(s){return s.status==='draft'}).length}</div>
    <div class="text-[10px] md:text-xs text-gray-400 mt-0.5">草稿中</div></div>`;
  html += `<div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-3 text-center shadow-sm">
    <div class="text-base md:text-lg font-bold text-purple-500">${scripts.filter(function(s){return s.status==='published'}).length}</div>
    <div class="text-[10px] md:text-xs text-gray-400 mt-0.5">已发布</div></div>`;
  html += '</div>';

  // 脚本列表
  html += '<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">';
  html += '<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700"><h3 class="font-bold text-gray-800 dark:text-white text-sm">我的脚本</h3></div>';

  if (scripts.length === 0) {
    html += '<div class="text-center py-12 text-gray-400"><i class="fas fa-film text-3xl mb-2 block opacity-50"></i><p class="text-sm">还没有脚本，点右上角「新建脚本」开始创作吧！</p></div>';
  } else {
    html += '<div class="divide-y divide-gray-100 dark:divide-gray-700/50">';
    scripts.forEach(function(s) {
      const title = escapeHtml(s.title || '无标题');
      const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString('zh-CN') : '';
      const wc = s.word_count || 0;
      var statusLabel = '', statusClass = '';
      if (s.status === 'done') { statusLabel = '已完成'; statusClass = 'bg-green-50 text-green-600'; }
      else if (s.status === 'published') { statusLabel = '已发布'; statusClass = 'bg-purple-50 text-purple-600'; }
      else { statusLabel = '草稿'; statusClass = 'bg-gray-100 text-gray-500'; }
      html += `<div class="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-medium text-gray-800 dark:text-white text-sm truncate">${title}</h4>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${statusClass}">${statusLabel}</span>
          </div>
          <p class="text-[11px] text-gray-400 mt-0.5">${date} · 约${wc}字</p>
        </div>
        <div class="flex gap-1.5 ml-3">
          <button onclick="editScript('${s.id}')" class="px-2.5 py-1 text-[11px] rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all touch-btn">编辑</button>
          <button onclick="deleteScript('${s.id}')" class="px-2.5 py-1 text-[11px] rounded-md bg-red-50 text-red-500 hover:bg-red-100 transition-all touch-btn">删除</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div></div>';

  return el('div', 'max-w-6xl mx-auto fade-in', html);
}

// 脚本编辑器弹窗（样式与全局一致）
window.showScriptEditor = function(scriptId) {
  var overlayId = 'cs-editor-overlay';
  // 防止重复打开
  if (document.getElementById(overlayId)) return;

  const overlay = el('div', '');
  overlay.id = overlayId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;p-4;animation:fadeIn 0.15s ease;';
  const isEdit = !!scriptId;

  overlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl m-4" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 class="text-base font-bold text-gray-800 dark:text-white">${isEdit ? '编辑脚本' : '新建脚本'}</h3>
        <button id="cs-close-btn" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">标题 <span class="text-red-400">*</span></label>
          <input id="script-title" type="text" placeholder="视频标题 / 脚本名称" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm outline-none focus:border-primary transition-colors">
        </div>

        <!-- 分镜模板 -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">分镜模板</label>
          <div class="flex gap-2 flex-wrap">
            <button onclick="applyScriptTemplate('golden3')" type="button" class="px-2.5 py-1 text-[11px] rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all touch-btn border border-amber-200/50">黄金3秒</button>
            <button onclick="applyScriptTemplate('problem')" type="button" class="px-2.5 py-1 text-[11px] rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all touch-btn border border-blue-200/50">问题-方案</button>
            <button onclick="applyScriptTemplate('story')" type="button" class="px-2.5 py-1 text-[11px] rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-all touch-btn border border-green-200/50">故事叙述</button>
            <button onclick="applyScriptTemplate('blank')" type="button" class="px-2.5 py-1 text-[11px] rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all touch-btn">空白</button>
          </div>
        </div>

        <!-- 脚本内容 -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">脚本内容 <span class="text-gray-300 text-[10px]">支持 Markdown</span></label>
          <textarea id="script-content" rows="10" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm outline-none focus:border-primary transition-colors resize-none font-mono leading-relaxed" placeholder="在这里写脚本内容...&#10;&#10;支持 Markdown 格式：&#10;# 大标题&#10;## 分镜标题&#10;**重点内容**"></textarea>
        </div>

        <!-- 拍摄清单 -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">拍摄清单 <span class="text-gray-300 text-[10px]">拍摄前逐项勾选</span></label>
          <div id="shoot-checklist" class="space-y-1.5">
            <div class="flex items-center gap-2">
              <input type="checkbox" class="rounded border-gray-300 w-4 h-4">
              <input type="text" placeholder="添加拍摄准备项..." class="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-primary transition-colors">
              <button type="button" onclick="this.parentElement.remove()" class="text-gray-300 hover:text-red-500 transition-colors px-1">&times;</button>
            </div>
          </div>
          <button type="button" onclick="addChecklistItem()" class="mt-1.5 text-[11px] text-primary hover:text-primary-dark transition-colors">+ 添加拍摄项</button>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button onclick="saveScript('${scriptId||''}')" class="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all touch-btn shadow-sm shadow-primary/20">
            <i class="fas fa-save mr-1"></i>保存草稿
          </button>
          <button onclick="saveScript('${scriptId||''}', 'done')" class="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-all touch-btn shadow-sm">
            <i class="fas fa-check mr-1"></i>完成
          </button>
          <button onclick="exportScriptMarkdown()" class="py-2.5 px-3 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition-all touch-btn border border-purple-200/50">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // 关闭按钮
  document.getElementById('cs-close-btn').onclick = function() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    overlay.remove();
  };
  // 点击背景关闭
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      overlay.remove();
    }
  };

  // 编辑模式填充数据
  if (scriptId) {
    try {
      var allScripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]');
      var found = allScripts.find(function(x){return x.id===scriptId});
      if (found) {
        setTimeout(function(){
          var t = document.getElementById('script-title');
          var c = document.getElementById('script-content');
          if (t) t.value = found.title || '';
          if (c) c.value = found.content || '';
        }, 50);
      }
    } catch(e) {}
  }

  // 自动保存：输入后2秒自动存草稿
  var autoSaveTimer = null;
  var statusEl = document.createElement('span');
  statusEl.className = 'text-[10px] text-gray-400 ml-2';
  statusEl.textContent = '';
  var btnContainer = overlay.querySelector('.flex.gap-2');
  if (btnContainer) btnContainer.appendChild(statusEl);

  function onInputChange() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    statusEl.textContent = '未保存';
    statusEl.className = 'text-[10px] text-amber-500 ml-2';
    autoSaveTimer = setTimeout(function() {
      var t = document.getElementById('script-title');
      var c = document.getElementById('script-content');
      if (!t || !c) return;
      var title = t.value.trim();
      if (!title) { statusEl.textContent = ''; return; }
      var content = c.value;
      var now = new Date().toISOString();
      var allScripts = [];
      try { allScripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]'); } catch(e) {}
      if (scriptId) {
        var idx = allScripts.findIndex(function(s){return s.id===scriptId});
        if (idx !== -1) {
          allScripts[idx].title = title;
          allScripts[idx].content = content;
          allScripts[idx].word_count = content.replace(/\s/g, '').length;
          allScripts[idx].updated_at = now;
        }
      } else {
        scriptId = 'scr_auto_' + Date.now();
        allScripts.unshift({
          id: scriptId, title: title, content: content,
          word_count: content.replace(/\s/g, '').length,
          status: 'draft', created_at: now, updated_at: now
        });
      }
      localStorage.setItem('creator_scripts', JSON.stringify(allScripts));
      statusEl.textContent = '已自动保存';
      statusEl.className = 'text-[10px] text-emerald-500 ml-2';
    }, 2000);
  }

  var titleInput = document.getElementById('script-title');
  var contentInput = document.getElementById('script-content');
  if (titleInput) titleInput.addEventListener('input', onInputChange);
  if (contentInput) contentInput.addEventListener('input', onInputChange);
};

// 应用分镜模板
window.applyScriptTemplate = function(type) {
  const area = document.getElementById('script-content');
  if (!area) return;
  const templates = {
    golden3: '# 黄金3秒开场\n\n→ 用最冲击的画面/问题抓住注意力（前3秒决定去留）\n\n## 正文内容\n\n→ 分段讲述核心观点\n\n## 结尾引导\n\n→ 关注+点赞+评论+转发',
    problem: '# 痛点引入\n\n→ 描述观众遇到的问题（引发共鸣：\"你是不是也...\"）\n\n## 解决方案\n\n→ 给出具体可操作的方法（分步骤）\n\n## 效果展示 / 行动号召\n\n→ 前后对比 / 立即尝试',
    story: '# 故事开头\n\n→ 用一个具体场景/人物经历引入（\"昨天我遇到了...\"）\n\n## 转折点\n\n→ 发生了什么变化（意外/冲突）\n\n## 收获启发\n\n→ 观众能得到什么（ takeaway ）',
    blank: '# 标题\n\n## 开场（钩子）\n\n## 正文\n\n### 要点1\n### 要点2\n### 要点3\n\n## 结尾（CTA）'
  };
  area.value = templates[type] || '';
  showToast('已应用模板', 'success');
};

// 添加拍摄清单项
window.addChecklistItem = function() {
  const container = document.getElementById('shoot-checklist');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'flex items-center gap-2';
  div.innerHTML = '<input type="checkbox" class="rounded border-gray-300 w-4 h-4"><input type="text" placeholder="添加拍摄准备项..." class="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-primary transition-colors"><button type="button" onclick="this.parentElement.remove()" class="text-gray-300 hover:text-red-500 transition-colors px-1">&times;</button>';
  container.appendChild(div);
};

// 保存脚本
window.saveScript = function(scriptId, status) {
  const title = (document.getElementById('script-title')?.value || '').trim();
  const content = document.getElementById('script-content')?.value || '';
  if (!title) { showToast('请输入标题', 'error'); return; }

  let scripts = [];
  try { scripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]'); } catch(e) { scripts = []; }

  const now = new Date().toISOString();
  const wc = content.replace(/\s/g, '').length;

  if (scriptId) {
    const idx = scripts.findIndex(function(s){return s.id===scriptId});
    if (idx !== -1) {
      scripts[idx].title = title;
      scripts[idx].content = content;
      scripts[idx].word_count = wc;
      scripts[idx].status = status || scripts[idx].status;
      scripts[idx].updated_at = now;
    }
  } else {
    scripts.unshift({
      id: 'scr_' + Date.now(),
      title: title,
      content: content,
      word_count: wc,
      status: status || 'draft',
      created_at: now,
      updated_at: now
    });
  }

  localStorage.setItem('creator_scripts', JSON.stringify(scripts));
  showToast(status === 'done' ? '标记为完成！' : '保存成功！', 'success');

  // 关闭弹窗
  var editor = document.getElementById('cs-editor-overlay');
  if (editor) editor.remove();

  // 刷新页面
  renderCreatorStudio().then(function(el) {
    var main = document.querySelector('.main-content');
    if (main) {
      main.innerHTML = '';
      main.appendChild(el);
    }
  });
};

// 编辑脚本
window.editScript = function(id) {
  showScriptEditor(id);
};

// 删除脚本
window.deleteScript = async function(id) {
  var ok = await showConfirmModal('确定删除这个脚本吗？', '删除');
  if (!ok) return;
  let scripts = [];
  try { scripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]'); } catch(e) { scripts = []; }
  scripts = scripts.filter(function(s){return s.id!==id});
  localStorage.setItem('creator_scripts', JSON.stringify(scripts));
  showToast('已删除', 'success');
  renderCreatorStudio().then(function(el) {
    var main = document.querySelector('.main-content');
    if (main) { main.innerHTML = ''; main.appendChild(el); }
  });
};

// 导出脚本为 Markdown
window.exportScriptMarkdown = function() {
  const title = (document.getElementById('script-title')?.value || '').trim() || '未命名脚本';
  const content = document.getElementById('script-content')?.value || '';
  let md = '# ' + title + '\n\n';
  md += '> 导出时间：' + new Date().toLocaleString('zh-CN') + '\n\n---\n\n';
  md += content + '\n';
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = title + '.md';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Markdown 已导出！', 'success');
};

window.renderCreatorStudio = renderCreatorStudio;
