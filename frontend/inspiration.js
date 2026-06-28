// ==================== 灵感记录 - 独立功能 ====================
// 数据存在 localStorage，不依赖日记 API

// 获取灵感列表
function getInspirations() {
  try {
    const data = localStorage.getItem('inspirations');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('获取灵感失败:', e);
    return [];
  }
}

// 保存灵感列表
function saveInspirations(list) {
  try {
    localStorage.setItem('inspirations', JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('保存灵感失败:', e);
    return false;
  }
}

// 添加灵感
function addInspiration(text, tags) {
  const list = getInspirations();
  const item = {
    id: Date.now(),
    text: text,
    tags: tags || [],
    createdAt: new Date().toISOString()
  };
  list.unshift(item);
  saveInspirations(list);
  return item;
}

// 删除灵感
function deleteInspiration(id) {
  const list = getInspirations();
  const newList = list.filter(item => item.id !== id);
  saveInspirations(newList);
}

// 渲染灵感页面
function renderInspiration() {
  const container = el('div', 'fade-in');
  
  const inspirations = getInspirations();
  
  let html = `
    <div class="max-w-4xl mx-auto px-4 py-6">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">💡 灵感记录</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">随时记录你的创意和点子</p>
        </div>
        <button onclick="showInspirationEditor()" class="btn-primary">
          <i class="fas fa-plus mr-2"></i>记录灵感
        </button>
      </div>
      
      <!-- 灵感列表 -->
      <div id="inspiration-list" class="space-y-4">
  `;
  
  if (inspirations.length === 0) {
    html += `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">💡</div>
        <p class="text-gray-400 dark:text-gray-500">还没有灵感记录</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">点击右上角"记录灵感"开始</p>
      </div>
    `;
  } else {
    inspirations.forEach(item => {
      const date = new Date(item.createdAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      html += `
        <div class="card p-4 hover:shadow-md transition-all">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(item.text)}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs text-gray-400">${date}</span>
                ${item.tags && item.tags.length > 0 ? item.tags.map(tag => `
                  <span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">${escapeHtml(tag)}</span>
                `).join('') : ''}
              </div>
            </div>
            <button onclick="deleteInspirationItem(${item.id})" class="text-gray-400 hover:text-danger transition-colors ml-4">
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
  const modal = el('div', 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4');
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
  
  // 自动聚焦
  setTimeout(() => {
    document.getElementById('inspiration-text').focus();
  }, 100);
}

// 保存灵感
function saveInspiration() {
  const text = document.getElementById('inspiration-text').value.trim();
  if (!text) {
    showToast('请写下灵感内容', 'warning');
    return;
  }
  
  const tagsInput = document.getElementById('inspiration-tags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
  
  addInspiration(text, tags);
  
  // 关闭弹窗
  document.querySelector('.fixed.inset-0')?.remove();
  
  // 刷新页面
  navigate('inspiration');
  
  showToast('灵感已保存', 'success');
}

// 删除灵感
function deleteInspirationItem(id) {
  showConfirmModal('确定删除这条灵感吗？', '删除', '取消').then(confirm => {
    if (confirm) {
      deleteInspiration(id);
      navigate('inspiration');
      showToast('已删除', 'success');
    }
  });
}

// 导出为 Markdown
function exportInspirationsMarkdown() {
  const inspirations = getInspirations();
  if (inspirations.length === 0) {
    showToast('没有灵感可以导出', 'warning');
    return;
  }
  
  let md = '# 灵感记录\n\n';
  md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  md += '---\n\n';
  
  inspirations.forEach((item, index) => {
    const date = new Date(item.createdAt).toLocaleString('zh-CN');
    md += `## 灵感 ${index + 1}\n\n`;
    md += `- **时间**：${date}\n`;
    if (item.tags && item.tags.length > 0) {
      md += `- **标签**：${item.tags.join(', ')}\n`;
    }
    md += `\n${item.text}\n\n`;
    md += '---\n\n';
  });
  
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `灵感记录_${new Date().toISOString().slice(0,10)}.md`;
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
