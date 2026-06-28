// ==================== 灵感记录 - 独立功能 ====================
// 数据来源：localStorage（新记录）+ 日记API（旧记录，template_type=inspiration）

// 获取本地灵感列表
function getLocalInspirations() {
  try {
    const data = localStorage.getItem('inspirations');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('获取灵感失败:', e);
    return [];
  }
}

// 保存本地灵感列表
function saveLocalInspirations(list) {
  try {
    localStorage.setItem('inspirations', JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('保存灵感失败:', e);
    return false;
  }
}

// 从API加载旧的灵感数据
async function loadApiInspirations() {
  try {
    const data = await api.get('/api/diary?template_type=inspiration&limit=100');
    return (data.entries || []).map(function(entry) {
      return {
        id: 'api_' + entry.id,
        text: entry.content || entry.title || '',
        tags: entry.tags || [],
        createdAt: entry.created_at || new Date().toISOString(),
        apiId: entry.id,  // 用于删除时调用API
        source: 'api'
      };
    });
  } catch (e) {
    console.error('从API加载灵感失败:', e);
    return [];
  }
}

// 渲染灵感页面（异步，需要加载API数据）
async function renderInspiration() {
  const container = el('div', 'fade-in');
  
  // 显示加载中
  container.innerHTML = '<div class="flex items-center justify-center py-12"><div class="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>';
  
  // 同时加载API和本地数据
  var [apiItems, localItems] = await Promise.all([
    loadApiInspirations(),
    Promise.resolve(getLocalInspirations())
  ]);
  
  // 合并去重（按时间排序）
  var allItems = apiItems.concat(localItems);
  allItems.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  let html = `
    <div class="max-w-4xl mx-auto px-4 py-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">💡 灵感记录</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">随时随地捕获灵感</p>
        </div>
        <div class="flex gap-2">
          <button onclick="exportInspirationsMarkdown()" class="btn-secondary text-sm" title="导出Markdown">
            <i class="fas fa-download"></i>
          </button>
          <button onclick="showInspirationEditor()" class="btn-primary text-sm">
            <i class="fas fa-plus mr-1"></i>记录
          </button>
        </div>
      </div>
      
      <!-- 灵感列表 -->
      <div id="inspiration-list" class="space-y-4">
  `;
  
  if (allItems.length === 0) {
    html += `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">💡</div>
        <p class="text-gray-400 dark:text-gray-500">还没有灵感记录</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">点击"记录"写下你的第一个灵感</p>
      </div>
    `;
  } else {
    allItems.forEach(function(item) {
      var date = new Date(item.createdAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      var sourceIcon = item.source === 'api' ? '<span class="text-xs text-primary/60 mr-1" title="云端">☁️</span>' : '<span class="text-xs text-green-500/60 mr-1" title="本地">📱</span>';
      
      html += `
        <div class="card p-4 hover:shadow-md transition-all">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm">${escapeHtml(item.text)}</p>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                ${sourceIcon}
                <span class="text-xs text-gray-400">${date}</span>
                ${item.tags && item.tags.length > 0 ? item.tags.map(function(tag) {
                  return '<span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">' + escapeHtml(tag) + '</span>';
                }).join('') : ''}
              </div>
            </div>
            <button onclick="deleteInspirationItem('${item.id}')" class="text-gray-400 hover:text-danger transition-colors ml-4">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
    });
  }
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  return container;
}

// 显示灵感编辑器
function showInspirationEditor() {
  var modal = el('div', 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
      <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-4">记录灵感</h3>
      <textarea id="inspiration-text" class="input-field w-full h-32 resize-none" placeholder="写下你的灵感..."></textarea>
      <input id="inspiration-tags" class="input-field w-full mt-3" placeholder="标签（用逗号分隔，可选）">
      <div class="flex gap-3 justify-end mt-4">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">取消</button>
        <button onclick="saveInspiration()" class="btn-primary">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(function() {
    var inp = document.getElementById('inspiration-text');
    if (inp) inp.focus();
  }, 100);
}

// 保存灵感（同时保存到本地和API）
async function saveInspiration() {
  var text = document.getElementById('inspiration-text').value.trim();
  if (!text) {
    showToast('请写下灵感内容', 'warning');
    return;
  }
  
  var tagsInput = document.getElementById('inspiration-tags').value.trim();
  var tags = tagsInput ? tagsInput.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];
  
  // 保存到本地
  addLocalInspiration(text, tags);
  
  // 同时保存到API（兼容旧的辅助工具页面）
  try {
    await api.post('/api/diary', {
      title: '灵感 ' + new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
      content: text,
      template_type: 'inspiration',
      is_private: true
    });
  } catch(e) {
    // API保存失败不影响本地保存
    console.warn('保存灵感到API失败:', e);
  }
  
  // 关闭弹窗
  var modal = document.querySelector('.fixed.inset-0');
  if (modal) modal.remove();
  
  // 刷新页面
  navigate('inspiration');
  showToast('灵感已保存 ✨', 'success');
}

// 添加灵感到本地
function addLocalInspiration(text, tags) {
  var list = getLocalInspirations();
  list.unshift({
    id: Date.now(),
    text: text,
    tags: tags || [],
    createdAt: new Date().toISOString()
  });
  saveLocalInspirations(list);
}

// 删除灵感
async function deleteInspirationItem(id) {
  var confirmed = await showConfirmModal('确定删除这条灵感吗？', '删除', '取消');
  if (!confirmed) return;
  
  // 如果是API数据，调用API删除
  if (typeof id === 'string' && id.startsWith('api_')) {
    var apiId = id.replace('api_', '');
    try {
      await api.del('/api/diary/' + apiId);
    } catch(e) {
      console.warn('删除API灵感失败:', e);
    }
  } else {
    // 本地数据
    var list = getLocalInspirations();
    list = list.filter(function(item) { return item.id != id; });
    saveLocalInspirations(list);
  }
  
  navigate('inspiration');
  showToast('已删除', 'success');
}

// 导出为 Markdown（合并API和本地数据）
async function exportInspirationsMarkdown() {
  var [apiItems, localItems] = await Promise.all([
    loadApiInspirations(),
    Promise.resolve(getLocalInspirations())
  ]);
  
  var allItems = apiItems.concat(localItems);
  allItems.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  if (allItems.length === 0) {
    showToast('没有灵感可以导出', 'warning');
    return;
  }
  
  var md = '# 灵感记录\n\n';
  md += '> 导出时间：' + new Date().toLocaleString('zh-CN') + '\n\n';
  md += '---\n\n';
  
  allItems.forEach(function(item, index) {
    var date = new Date(item.createdAt).toLocaleString('zh-CN');
    md += '## 灵感 ' + (index + 1) + '\n\n';
    md += '- **时间**：' + date + '\n';
    if (item.tags && item.tags.length > 0) {
      md += '- **标签**：' + item.tags.join(', ') + '\n';
    }
    md += '\n' + item.text + '\n\n';
    md += '---\n\n';
  });
  
  var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '灵感记录_' + new Date().toISOString().slice(0,10) + '.md';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 Markdown', 'success');
}

// 注册到全局
window.renderInspiration = renderInspiration;
window.showInspirationEditor = showInspirationEditor;
window.saveInspiration = saveInspiration;
window.deleteInspirationItem = deleteInspirationItem;
window.exportInspirationsMarkdown = exportInspirationsMarkdown;
