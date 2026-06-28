// ========= 创作者工作室 =========
async function renderCreatorStudio() {
  const token = safeStorage.get('token');
  if (!token) { navigate('login'); return ''; }

  let scripts = [];
  try {
    const raw = localStorage.getItem('creator_scripts');
    scripts = raw ? JSON.parse(raw) : [];
  } catch(e) { scripts = []; }

  let html = '<div class="max-w-7xl mx-auto px-4 md:px-8 py-6">';
  html += `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">🎬 创作者工作室</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">写脚本 · 管拍摄 · 记发布</p>
      </div>
      <button onclick="showScriptEditor()" class="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all touch-btn">
        <i class="fas fa-plus mr-1"></i>新建脚本
      </button>
    </div>`;

  // 统计卡片
  html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">';
  html += `<div class="glass p-4 rounded-2xl text-center"><div class="text-2xl font-bold text-indigo-500">${scripts.length}</div><div class="text-xs text-gray-500 mt-1">脚本总数</div></div>`;
  html += `<div class="glass p-4 rounded-2xl text-center"><div class="text-2xl font-bold text-green-500">${scripts.filter(function(s){return s.status==='done'}).length}</div><div class="text-xs text-gray-500 mt-1">已完成</div></div>`;
  html += `<div class="glass p-4 rounded-2xl text-center"><div class="text-2xl font-bold text-amber-500">${scripts.filter(function(s){return s.status==='draft'}).length}</div><div class="text-xs text-gray-500 mt-1">草稿</div></div>`;
  html += `<div class="glass p-4 rounded-2xl text-center"><div class="text-2xl font-bold text-purple-500">${scripts.filter(function(s){return s.status==='published'}).length}</div><div class="text-xs text-gray-500 mt-1">已发布</div></div>`;
  html += '</div>';

  // 脚本列表
  html += '<div class="glass p-6 rounded-2xl"><h3 class="font-bold text-gray-800 dark:text-white mb-4">我的脚本</h3>';
  if (scripts.length === 0) {
    html += '<div class="text-center py-12 text-gray-400"><i class="fas fa-film text-4xl mb-3"></i><p>还没有脚本，点右上角「新建脚本」开始创作吧！</p></div>';
  } else {
    html += '<div class="space-y-3">';
    scripts.forEach(function(s) {
      const title = escapeHtml(s.title || '无标题');
      const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString('zh-CN') : '';
      const wc = s.word_count || 0;
      html += `<div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-800 dark:text-white truncate">${title}</h4>
          <p class="text-xs text-gray-500 mt-1">${date} · ${wc} 字</p>
        </div>
        <div class="flex gap-2 ml-4">
          <button onclick="editScript('${s.id}')" class="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all touch-btn">编辑</button>
          <button onclick="deleteScript('${s.id}')" class="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all touch-btn">删除</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div></div>';

  return el('div', html);
}

// 脚本编辑器弹窗
window.showScriptEditor = function(scriptId) {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 fade-in');
  const isEdit = scriptId ? true : false;
  modal.innerHTML = `
    <div class="glass w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">${isEdit ? '编辑脚本' : '新建脚本'}</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
          <input id="script-title" type="text" placeholder="视频标题 / 脚本名称" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-primary">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分镜模板</label>
          <div class="flex gap-2 flex-wrap">
            <button onclick="applyScriptTemplate('golden3')" class="px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all touch-btn">黄金3秒</button>
            <button onclick="applyScriptTemplate('problem')" class="px-3 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all touch-btn">问题-方案</button>
            <button onclick="applyScriptTemplate('story')" class="px-3 py-1.5 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all touch-btn">故事叙述</button>
            <button onclick="applyScriptTemplate('blank')" class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all touch-btn">空白</button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">脚本内容 <span class="text-xs text-gray-400">（支持 Markdown）</span></label>
          <textarea id="script-content" rows="12" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-primary font-mono text-sm resize-none" placeholder="在这里写脚本内容...&#10;&#10;支持 Markdown 格式：&#10;# 大标题&#10;## 分镜标题&#10;**重点内容**"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">拍摄清单 <span class="text-xs text-gray-400">（拍摄前勾选准备项）</span></label>
          <div id="shoot-checklist" class="space-y-2">
            <div class="flex items-center gap-2">
              <input type="checkbox" class="rounded border-gray-300">
              <input type="text" placeholder="添加拍摄项..." class="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none">
              <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 text-sm">×</button>
            </div>
          </div>
          <button onclick="addChecklistItem()" class="mt-2 text-xs text-indigo-500 hover:text-indigo-600">+ 添加拍摄项</button>
        </div>
        <div class="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button onclick="saveScript('${scriptId||''}')" class="flex-1 py-3 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all touch-btn">
            <i class="fas fa-save mr-1"></i>保存草稿
          </button>
          <button onclick="saveScript('${scriptId||''}', 'done')" class="flex-1 py-3 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all touch-btn">
            <i class="fas fa-check mr-1"></i>完成
          </button>
          <button onclick="exportScriptMarkdown()" class="px-4 py-3 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 transition-all touch-btn">
            <i class="fas fa-download mr-1"></i>导出
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // 编辑模式：填充数据
  if (scriptId) {
    try {
      const scripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]');
      const s = scripts.find(function(x){return x.id===scriptId});
      if (s) {
        setTimeout(function(){
          var t = document.getElementById('script-title');
          var c = document.getElementById('script-content');
          if (t) t.value = s.title || '';
          if (c) c.value = s.content || '';
        }, 100);
      }
    } catch(e) {}
  }
};

// 应用分镜模板
window.applyScriptTemplate = function(type) {
  const area = document.getElementById('script-content');
  if (!area) return;
  const templates = {
    golden3: '# 黄金3秒开场\n\n→ 用最冲击的画面/问题抓住注意力\n\n## 正文内容\n\n## 结尾引导\n\n→ 关注+点赞+评论',
    problem: '# 痛点引入\n\n→ 描述观众遇到的问题（引发共鸣）\n\n## 解决方案\n\n→ 给出具体可操作的方法\n\n## 效果展示\n\n→ 前后对比/用户反馈',
    story: '# 故事开头\n\n→ 用一个具体场景/人物经历引入\n\n## 转折点\n\n→ 发生了什么变化\n\n## 收获启发\n\n→ 观众能得到什么',
    blank: '# 标题\n\n## 开场\n\n## 正文\n\n## 结尾'
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
  div.innerHTML = '<input type="checkbox" class="rounded border-gray-300"><input type="text" placeholder="添加拍摄项..." class="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none"><button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 text-sm">×</button>';
  container.appendChild(div);
};

// 保存脚本
window.saveScript = function(scriptId, status) {
  const title = document.getElementById('script-title')?.value?.trim();
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
  showToast('保存成功！', 'success');
  const modal = document.querySelector('.fixed.inset-0');
  if (modal) modal.remove();
  renderCreatorStudio();
};

// 编辑脚本
window.editScript = function(id) {
  showScriptEditor(id);
};

// 删除脚本
window.deleteScript = function(id) {
  if (!confirm('确定删除这个脚本吗？')) return;
  let scripts = [];
  try { scripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]'); } catch(e) { scripts = []; }
  scripts = scripts.filter(function(s){return s.id!==id});
  localStorage.setItem('creator_scripts', JSON.stringify(scripts));
  showToast('已删除', 'success');
  renderCreatorStudio();
};

// 导出脚本为 Markdown
window.exportScriptMarkdown = function() {
  const title = document.getElementById('script-title')?.value?.trim() || '未命名脚本';
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
