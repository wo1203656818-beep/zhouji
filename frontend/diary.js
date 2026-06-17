// ==================== 周迹 - 日记功能 ====================

// ========== 全局变量 ==========
let diaryEntries = [];
let currentDiaryEntry = null;
let diaryMediaFiles = [];
let cbtTemplates = []; // 缓存CBT模板列表
let currentTemplateFields = []; // 当前模板的字段

// ========== 心情/天气映射 ==========
function getMoodLabel(mood) {
  const map = {
    'neutral': '😐 平静',
    'happy': '😊 开心',
    'excited': '🎉 兴奋',
    'calm': '😌 放松',
    'anxious': '😰 焦虑',
    'sad': '😢 难过',
    'angry': '😠 生气',
    'tired': '😴 疲惫'
  };
  return map[mood] || mood || '';
}

function getWeatherLabel(weather) {
  const map = {
    'sunny': '☀️ 晴天',
    'cloudy': '☁️ 多云',
    'overcast': '🌥️ 阴天',
    'rainy': '🌧️ 雨天',
    'snowy': '❄️ 雪天',
    'foggy': '🌫️ 雾天',
    'windy': '💨 大风',
    'stormy': '⛈️ 暴雨'
  };
  return map[weather] || weather || '';
}

// ========== 日记列表页 ==========
async function renderDiary() {
  const div = el('div', 'p-4 md:p-8 max-w-4xl mx-auto fade-in');
  
  div.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">日记</h2>
        <p class="text-gray-500 dark:text-gray-400">记录你的思考与成长</p>
      </div>
      <div class="flex gap-2">
        <div class="relative">
          <input type="text" id="diary-search" placeholder="搜索日记..." 
                 class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all text-sm"
                 oninput="loadDiaryEntries()">
          <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
        </div>
        <button onclick="showDiaryModal()" class="bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn">
          <i class="fas fa-plus mr-1"></i>写日记
        </button>
      </div>
    </div>
    <div id="diary-list" class="space-y-4">
      <div class="text-center py-12">
        <div class="skeleton h-32 rounded-2xl mb-3"></div>
        <div class="skeleton h-32 rounded-2xl"></div>
      </div>
    </div>
  `;
  
  setTimeout(() => loadDiaryEntries(), 100);
  return div;
}

// ========== 加载日记列表 ==========
async function loadDiaryEntries() {
  try {
    const search = $('#diary-search')?.value?.trim();
    let url = '/api/diary?limit=50';
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    
    const data = await api.get(url);
    diaryEntries = data.entries || [];
    const container = $('#diary-list');
    
    if (!diaryEntries.length) {
      container.innerHTML = `
        <div class="text-center py-12">
          <i class="fas fa-book text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <p class="text-gray-500 dark:text-gray-400">${search ? '没有找到匹配的日记' : '还没有日记'}</p>
          <button onclick="showDiaryModal()" class="mt-4 text-primary font-medium">写第一篇日记</button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = diaryEntries.map(entry => `
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30 transition-all cursor-pointer" onclick="viewDiaryEntry(${entry.id})">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-gray-800 dark:text-white text-lg">${window.escapeHtml(entry.title)}</h3>
            ${entry.template_type && entry.template_type !== 'free' ? `<span class="px-2 py-0.5 rounded text-xs font-medium ${entry.template_type === 'cbt' ? 'bg-primary/10 text-primary' : entry.template_type === 'gratitude' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : entry.template_type === 'reflection' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : entry.template_type === 'procrastination' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : entry.template_type === 'anxiety' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}">${entry.template_type === 'cbt' ? 'CBT' : entry.template_type === 'gratitude' ? '感恩' : entry.template_type === 'reflection' ? '反思' : entry.template_type === 'procrastination' ? '拖延分析' : entry.template_type === 'anxiety' ? '焦虑缓解' : entry.template_type}</span>` : ''}
          </div>
          <span class="text-xs text-gray-400">${new Date(entry.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
        ${entry.content ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">${window.escapeHtml(entry.content)}</p>` : ''}
        ${entry.cbt_thought ? `<div class="mb-3 p-3 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20"><p class="text-xs text-gray-600 dark:text-gray-400"><strong>自动思维:</strong> ${window.escapeHtml(entry.cbt_thought.substring(0, 100))}${entry.cbt_thought.length > 100 ? '...' : ''}</p></div>` : ''}
        ${entry.mood ? `
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm text-gray-500 dark:text-gray-400">心情:</span>
            <span class="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">${getMoodLabel(entry.mood)}</span>
          </div>
        ` : ''}
        ${entry.weather ? `
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm text-gray-500 dark:text-gray-400">天气:</span>
            <span class="px-2 py-1 rounded-full text-xs bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">${getWeatherLabel(entry.weather)}</span>
          </div>
        ` : ''}
        ${entry.media && entry.media.length > 0 ? `
          <div class="flex gap-2 flex-wrap">
            ${entry.media.slice(0, 3).map(m => `
              <div class="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <i class="fas fa-${m.media_type === 'image' ? 'image' : m.media_type === 'video' ? 'video' : 'music'} text-gray-400"></i>
              </div>
            `).join('')}
            ${entry.media.length > 3 ? `<div class="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">+${entry.media.length - 3}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('加载日记失败:', err);
    $('#diary-list').innerHTML = '<div class="text-center py-12 text-danger">加载失败，请重试</div>';
  }
}

// ========== 查看日记详情 ==========
async function viewDiaryEntry(id) {
  try {
    const data = await api.get('/api/diary/' + id);
    currentDiaryEntry = data.entry;
    
    const modal = el('div', 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop');
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">${currentDiaryEntry.title}</h3>
          <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div class="mb-4">
          <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
            <span><i class="fas fa-calendar mr-1"></i>${new Date(currentDiaryEntry.created_at).toLocaleString('zh-CN')}</span>
            ${currentDiaryEntry.mood ? `<span><i class="fas fa-smile mr-1"></i>${getMoodLabel(currentDiaryEntry.mood)}</span>` : ''}
            ${currentDiaryEntry.weather ? `<span><i class="fas fa-cloud mr-1"></i>${getWeatherLabel(currentDiaryEntry.weather)}</span>` : ''}
            ${currentDiaryEntry.location ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${currentDiaryEntry.location}</span>` : ''}
            ${currentDiaryEntry.template_type && currentDiaryEntry.template_type !== 'free' ? `<span class="px-2 py-0.5 rounded text-xs font-medium ${currentDiaryEntry.template_type === 'cbt' ? 'bg-primary/10 text-primary' : currentDiaryEntry.template_type === 'gratitude' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : currentDiaryEntry.template_type === 'reflection' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : currentDiaryEntry.template_type === 'procrastination' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : currentDiaryEntry.template_type === 'anxiety' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}">${currentDiaryEntry.template_type === 'cbt' ? 'CBT 思维记录' : currentDiaryEntry.template_type === 'gratitude' ? '感恩日记' : currentDiaryEntry.template_type === 'reflection' ? '每日反思' : currentDiaryEntry.template_type === 'procrastination' ? '拖延分析' : currentDiaryEntry.template_type === 'anxiety' ? '焦虑缓解' : currentDiaryEntry.template_type}</span>` : ''}
          </div>
          ${currentDiaryEntry.content ? `
            <div class="text-gray-700 dark:text-gray-300 leading-relaxed diary-content">${currentDiaryEntry.content}</div>
          ` : ''}
        </div>
        
        ${currentDiaryEntry.template_type === 'cbt' ? `
        <div class="mb-4 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-3">
          <h4 class="font-medium text-gray-800 dark:text-white mb-2"><i class="fas fa-brain text-primary mr-2"></i>CBT 思维记录</h4>
          ${currentDiaryEntry.cbt_thought ? `
            <div>
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">自动思维</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg">${currentDiaryEntry.cbt_thought}</p>
            </div>
          ` : ''}
          ${currentDiaryEntry.cbt_emotion ? `
            <div>
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">情绪</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg">${currentDiaryEntry.cbt_emotion}</p>
            </div>
          ` : ''}
          ${currentDiaryEntry.cbt_behavior ? `
            <div>
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">行为</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg">${currentDiaryEntry.cbt_behavior}</p>
            </div>
          ` : ''}
          ${currentDiaryEntry.cbt_reframe ? `
            <div>
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">思维重构</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg">${currentDiaryEntry.cbt_reframe}</p>
            </div>
          ` : ''}
        </div>
        ` : ''}
        
        ${currentDiaryEntry.media && currentDiaryEntry.media.length > 0 ? `
          <div class="mb-4">
            <h4 class="font-medium text-gray-800 dark:text-white mb-3">附件</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${currentDiaryEntry.media.map(m => {
                  // 根据文件扩展名判断类型
                  const fileName = (m.file_name || '').toLowerCase();
                  let displayType = m.media_type || 'file';
                  if (fileName.endsWith('.pdf')) displayType = 'pdf';
                  else if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.log')) displayType = 'text';
                  else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) displayType = 'doc';
                  else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) displayType = 'xls';
                  else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) displayType = 'ppt';
                  else if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z')) displayType = 'archive';

                  const isPreviewable = displayType === 'image' || displayType === 'pdf' || displayType === 'text';

                  return `
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 flex flex-col">
                  ${displayType === 'image' ? `
                    <img src="${m.file_url}" alt="${m.file_name || '图片'}" class="w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-all" onclick="showImageLightbox('${m.file_url}')">
                  ` : displayType === 'pdf' ? `
                    <div class="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <iframe src="${m.file_url}" class="w-full h-full" frameborder="0"></iframe>
                    </div>
                  ` : displayType === 'video' ? `
                    <video src="${m.file_url}" controls class="w-full h-40 object-cover"></video>
                  ` : displayType === 'audio' ? `
                    <div class="h-20 flex items-center justify-center p-4">
                      <audio src="${m.file_url}" controls class="w-full"></audio>
                    </div>
                  ` : displayType === 'text' ? `
                    <div class="h-40 flex items-center justify-center bg-yellow-50 dark:bg-yellow-900/20">
                      <i class="fas fa-file-alt text-4xl text-yellow-500"></i>
                    </div>
                  ` : displayType === 'doc' ? `
                    <div class="h-40 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
                      <i class="fas fa-file-word text-4xl text-blue-500"></i>
                    </div>
                  ` : displayType === 'archive' ? `
                    <div class="h-40 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
                      <i class="fas fa-file-archive text-4xl text-purple-500"></i>
                    </div>
                  ` : `
                    <div class="h-40 flex items-center justify-center">
                      <i class="fas fa-file text-4xl text-gray-400"></i>
                    </div>
                  `}
                  <div class="p-3 flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${m.file_name || '附件'}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">${displayType}</p>
                    </div>
                    <div class="flex gap-1 ml-2">
                      ${isPreviewable && displayType !== 'image' ? `
                        <button onclick="previewFile('${m.file_url}', '${displayType}', '${m.file_name || '文件'}')" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-primary" title="预览">
                          <i class="fas fa-eye"></i>
                        </button>
                      ` : ''}
                      <a href="${m.file_url}" download="${m.file_name || 'download'}" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-primary" title="下载">
                        <i class="fas fa-download"></i>
                      </a>
                    </div>
                  </div>
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="flex gap-2 justify-end">
          <button onclick="editDiaryEntry(${id})" class="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">
            <i class="fas fa-edit mr-1"></i>编辑
          </button>
          <button onclick="deleteDiaryEntry(${id})" class="px-4 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-all touch-btn">
            <i class="fas fa-trash mr-1"></i>删除
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (err) {
    showToast('加载日记详情失败', 'error');
  }
}

// ========== 显示日记编辑模态框 ==========
function showDiaryModal(entryId = null) {
  const isEdit = entryId !== null;
  let entry = null;
  
  if (isEdit) {
    entry = diaryEntries.find(e => e.id === entryId) || currentDiaryEntry;
  }
  
  // 编辑时保留已有附件，新建时清空
  if (isEdit && entry?.media && Array.isArray(entry.media)) {
    diaryMediaFiles = entry.media.map(m => ({ ...m, _existing: true }));
  } else {
    diaryMediaFiles = [];
  }
  
  const modal = el('div', 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white">${isEdit ? '编辑日记' : '写日记'}</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模板类型</label>
          <div class="flex gap-2">
            <select id="diary-template" onchange="onTemplateChange()" class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all">
              <option value="free" ${(entry?.template_type || 'free') === 'free' ? 'selected' : ''}>自由记录</option>
              <option value="" disabled>── 系统模板 ──</option>
              <option value="cbt" ${entry?.template_type === 'cbt' ? 'selected' : ''}>CBT 思维记录</option>
              <option value="gratitude" ${entry?.template_type === 'gratitude' ? 'selected' : ''}>感恩日记</option>
              <option value="reflection" ${entry?.template_type === 'reflection' ? 'selected' : ''}>每日反思</option>
              <option value="procrastination" ${entry?.template_type === 'procrastination' ? 'selected' : ''}>拖延分析</option>
              <option value="anxiety" ${entry?.template_type === 'anxiety' ? 'selected' : ''}>焦虑缓解</option>
              <option value="" disabled id="custom-template-divider" style="display:none">── 我的模板 ──</option>
            </select>
            <button onclick="showTemplateManager()" class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary transition-all" title="管理模板">
              <i class="fas fa-cog"></i>
            </button>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
          <input type="text" id="diary-title" value="${entry?.title || ''}" 
                 class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" 
                 placeholder="今天想记录什么？">
        </div>
        
        <div id="diary-template-fields" style="display: none">
          <!-- 动态模板字段将在这里渲染 -->
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容 <span class="text-xs text-gray-400 font-normal">（支持基础格式）</span></label>
          <!-- 简化工具栏 -->
          <div class="flex flex-wrap gap-1 p-2 border border-gray-200 dark:border-gray-600 rounded-t-xl bg-gray-50 dark:bg-gray-700">
            <button type="button" onclick="formatText('bold')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="加粗（Ctrl+B）">
              <b class="text-sm">B</b>
            </button>
            <button type="button" onclick="formatText('italic')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="斜体（Ctrl+I）">
              <i class="text-sm" style="font-style:italic;">I</i>
            </button>
            <button type="button" onclick="formatText('underline')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="下划线（Ctrl+U）">
              <u class="text-sm">U</u>
            </button>
            <span class="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1 self-center"></span>
            <button type="button" onclick="formatText('insertUnorderedList')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="无序列表">
              <i class="fas fa-list-ul text-sm"></i>
            </button>
            <button type="button" onclick="formatText('insertOrderedList')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="有序列表">
              <i class="fas fa-list-ol text-sm"></i>
            </button>
            <span class="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1 self-center"></span>
            <button type="button" onclick="formatText('justifyLeft')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="左对齐">
              <i class="fas fa-align-left text-sm"></i>
            </button>
            <button type="button" onclick="formatText('justifyCenter')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="居中">
              <i class="fas fa-align-center text-sm"></i>
            </button>
            <button type="button" onclick="formatText('justifyRight')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="右对齐">
              <i class="fas fa-align-right text-sm"></i>
            </button>
            <span class="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1 self-center"></span>
            <button type="button" onclick="insertLink()" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="插入链接">
              <i class="fas fa-link text-sm"></i>
            </button>
            <button type="button" onclick="formatText('removeFormat')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all" title="清除格式">
              <i class="fas fa-eraser text-sm"></i>
            </button>
          </div>
          <!-- 富文本编辑区域 -->
          <div id="diary-content-editor" contenteditable="true" 
               class="w-full px-4 py-3 rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all min-h-[200px] max-h-[400px] overflow-y-auto text-left"
               style="white-space: pre-wrap; word-wrap: break-word;"
               data-placeholder="记录你的思考、感受、进展...">${entry?.content || ''}</div>
          <!-- 隐藏的 textarea 用于表单提交 -->
          <textarea id="diary-content" style="display:none">${entry?.content || ''}</textarea>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">心情</label>
            <select id="diary-mood" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all">
              <option value="neutral" ${entry?.mood === 'neutral' ? 'selected' : ''}>😐 平静</option>
              <option value="happy" ${entry?.mood === 'happy' ? 'selected' : ''}>😊 开心</option>
              <option value="excited" ${entry?.mood === 'excited' ? 'selected' : ''}>🎉 兴奋</option>
              <option value="calm" ${entry?.mood === 'calm' ? 'selected' : ''}>😌 放松</option>
              <option value="anxious" ${entry?.mood === 'anxious' ? 'selected' : ''}>😰 焦虑</option>
              <option value="sad" ${entry?.mood === 'sad' ? 'selected' : ''}>😢 难过</option>
              <option value="angry" ${entry?.mood === 'angry' ? 'selected' : ''}>😠 生气</option>
              <option value="tired" ${entry?.mood === 'tired' ? 'selected' : ''}>😴 疲惫</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">天气（可选）</label>
            <select id="diary-weather" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all">
              <option value="">不选择</option>
              <option value="sunny" ${entry?.weather === 'sunny' ? 'selected' : ''}>☀️ 晴天</option>
              <option value="cloudy" ${entry?.weather === 'cloudy' ? 'selected' : ''}>☁️ 多云</option>
              <option value="overcast" ${entry?.weather === 'overcast' ? 'selected' : ''}>🌥️ 阴天</option>
              <option value="rainy" ${entry?.weather === 'rainy' ? 'selected' : ''}>🌧️ 雨天</option>
              <option value="snowy" ${entry?.weather === 'snowy' ? 'selected' : ''}>❄️ 雪天</option>
              <option value="foggy" ${entry?.weather === 'foggy' ? 'selected' : ''}>🌫️ 雾天</option>
              <option value="windy" ${entry?.weather === 'windy' ? 'selected' : ''}>💨 大风</option>
              <option value="stormy" ${entry?.weather === 'stormy' ? 'selected' : ''}>⛈️ 暴雨</option>
            </select>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">位置</label>
          <input type="text" id="diary-location" value="${entry?.location || ''}" 
                 class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" 
                 placeholder="在哪里写的这篇日记？">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">附件</label>
          <div id="diary-media-preview" class="mb-3 space-y-2"></div>
          <div class="flex gap-2 flex-wrap">
            <label class="flex-1">
              <input type="file" multiple onchange="handleDiaryMediaUpload(this)" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-paperclip mr-1"></i>添加附件
              </div>
            </label>
            <label class="flex-1">
              <input type="file" accept="image/*" multiple onchange="handleDiaryMediaUpload(this, 'image')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-image mr-1"></i>图片
              </div>
            </label>
            <label class="flex-1">
              <input type="file" accept="video/*" multiple onchange="handleDiaryMediaUpload(this, 'video')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-video mr-1"></i>视频
              </div>
            </label>
            <label class="flex-1">
              <input type="file" accept="audio/*" multiple onchange="handleDiaryMediaUpload(this, 'audio')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-music mr-1"></i>音频
              </div>
            </label>
          </div>
        </div>
      </div>
      
      <div class="flex gap-2 justify-end mt-6">
        <button onclick="this.closest('.modal-backdrop').remove()" 
                class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all touch-btn">
          取消
        </button>
        <button onclick="saveDiaryEntry(${entryId || 'null'})" 
                class="px-6 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn">
          ${isEdit ? '保存修改' : '发布日记'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 异步加载自定义模板选项
  loadCustomTemplates();
  
  // 如果有编辑时的模板类型，触发字段显示
  if (entry?.template_type && entry.template_type !== 'free') {
    setTimeout(() => onTemplateChange(), 200);
  }

  // 编辑模式：渲染已有附件预览
  if (diaryMediaFiles.length > 0) {
    setTimeout(() => {
      const preview = $('#diary-media-preview');
      if (!preview) return;
      diaryMediaFiles.forEach((m, i) => {
        const previewItem = el('div', 'flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50');
        const icon = m.media_type === 'image' ? 'image' : m.media_type === 'video' ? 'video' : 'music';
        const thumb = m.media_type === 'image' && m.file_url
          ? `<img src="${m.file_url}" class="w-10 h-10 object-cover rounded">`
          : `<i class="fas fa-${icon} text-primary"></i>`;
        previewItem.innerHTML = `
          ${thumb}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${m.file_name || '附件'}</p>
          </div>
          <button onclick="removeDiaryMediaByIndex(${i})" class="text-danger hover:text-danger/80">
            <i class="fas fa-times"></i>
          </button>
        `;
        preview.appendChild(previewItem);
      });
    }, 150);
  }
  
  // 初始化富文本编辑器
  setTimeout(() => initDiaryEditor(), 100);
}
async function handleDiaryMediaUpload(input, mediaType) {
  const files = input.files;
  if (!files || !files.length) return;
  
  for (const file of files) {
    try {
      // 自动检测文件类型（如果未提供 mediaType）
      if (!mediaType) {
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';
        else mediaType = 'file'; // 其他文件类型
      }
      
      // 检查文件大小（限制 10MB）
      if (file.size > 10 * 1024 * 1024) {
        showToast(`文件 ${file.name} 超过 10MB 限制`, 'warning');
        continue;
      }
      
      // 上传到 R2 获取 URL
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // data:image/png;base64,iVBOR...
          const b64 = reader.result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      showToast(`正在上传 ${file.name}...`, 'info');
      const uploadRes = await api.post('/api/upload', {
        filename: file.name,
        content_type: file.type,
        data: base64Data
      });
      if (!uploadRes.url) throw new Error('上传失败：未返回URL');

      diaryMediaFiles.push({
        media_type: mediaType,
        file_name: file.name,
        file_url: uploadRes.url,
        file_size: file.size
      });
      showToast(`已上传 ${file.name}`, 'success');
      
      // 显示预览
      const preview = $('#diary-media-preview');
      const previewItem = el('div', 'flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50');
      const icon = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'music' : 'paperclip';
      previewItem.innerHTML = `
        <i class="fas fa-${icon} text-primary"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${file.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button onclick="removeDiaryMedia(this)" class="text-danger hover:text-danger/80">
          <i class="fas fa-times"></i>
        </button>
      `;
      preview.appendChild(previewItem);
    } catch (err) {
      console.error('文件上传失败:', err);
      showToast('文件上传失败', 'error');
    }
  }
  
  input.value = '';
}

// ========== 移除媒体文件 ==========
function removeDiaryMedia(btn) {
  const previewItem = btn.closest('div');
  const index = Array.from($('#diary-media-preview').children).indexOf(previewItem);
  if (index >= 0) {
    diaryMediaFiles.splice(index, 1);
  }
  previewItem.remove();
}

// ========== 按索引移除媒体文件（用于编辑时移除已有附件）==========
function removeDiaryMediaByIndex(index) {
  if (index >= 0 && index < diaryMediaFiles.length) {
    diaryMediaFiles.splice(index, 1);
    // 重新渲染预览区域
    const preview = $('#diary-media-preview');
    if (preview) {
      preview.innerHTML = '';
      diaryMediaFiles.forEach((m, i) => {
        const previewItem = el('div', 'flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50');
        const icon = m.media_type === 'image' ? 'image' : m.media_type === 'video' ? 'video' : 'music';
        const thumb = m.media_type === 'image' && m.file_url
          ? `<img src="${m.file_url}" class="w-10 h-10 object-cover rounded">`
          : `<i class="fas fa-${icon} text-primary"></i>`;
        previewItem.innerHTML = `
          ${thumb}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${m.file_name || '附件'}</p>
          </div>
          <button onclick="removeDiaryMediaByIndex(${i})" class="text-danger hover:text-danger/80">
            <i class="fas fa-times"></i>
          </button>
        `;
        preview.appendChild(previewItem);
      });
    }
  }
}

// ========== 图片灯箱（点击图片查看大图）==========
function showImageLightbox(url) {
  // 移除可能已存在的灯箱
  const existingLightbox = document.querySelector('.image-lightbox-backdrop');
  if (existingLightbox) existingLightbox.remove();

  const backdrop = el('div', 'image-lightbox-backdrop fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 fade-in');
  backdrop.style.cssText = 'animation: fadeIn 0.2s ease;';
  
  // 添加淡入动画样式（如果尚未添加）
  if (!document.getElementById('lightbox-style')) {
    const style = document.createElement('style');
    style.id = 'lightbox-style';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  backdrop.innerHTML = `
    <div class="relative max-w-[90vw] max-h-[90vh]">
      <img src="${url}" alt="图片预览" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl">
      <button onclick="this.closest('.image-lightbox-backdrop').remove()" 
              class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all text-xl font-bold z-10">
        ✕
      </button>
    </div>
  `;

  // 点击背景关闭
  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) {
      backdrop.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => backdrop.remove(), 200);
    }
  });

  // ESC 关闭
  const escHandler = function(e) {
    if (e.key === 'Escape') {
      backdrop.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => backdrop.remove(), 200);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(backdrop);
}

// ========== 模板定义（系统预设） ==========
const SYSTEM_TEMPLATES = {
  cbt: {
    name: 'CBT 思维记录',
    icon: 'fa-brain',
    color: 'primary',
    fields: [
      { key: 'cbt_thought', label: '自动思维', placeholder: '当时脑子里在想什么？', icon: 'fa-lightbulb' },
      { key: 'cbt_emotion', label: '情绪感受', placeholder: '感受到什么情绪？多强？1-10', icon: 'fa-heart' },
      { key: 'cbt_behavior', label: '行为反应', placeholder: '你做了什么？或不做什么？', icon: 'fa-running' },
      { key: 'cbt_reframe', label: '思维重构', placeholder: '更平衡的想法是什么？', icon: 'fa-sync' }
    ]
  },
  gratitude: {
    name: '感恩日记',
    icon: 'fa-star',
    color: 'green',
    fields: [
      { key: 'gratitude_1', label: '今天最感恩的一件事', placeholder: '描述今天让你感到感恩的事情...', icon: 'fa-star' },
      { key: 'gratitude_2', label: '感恩的人', placeholder: '今天谁让你感到温暖？', icon: 'fa-user-friends' },
      { key: 'gratitude_3', label: '对自己的感恩', placeholder: '今天有什么值得肯定自己的？', icon: 'fa-hand-holding-heart' },
      { key: 'gratitude_reflection', label: '感恩感悟', placeholder: '这些感恩让你意识到了什么？', icon: 'fa-feather' }
    ]
  },
  reflection: {
    name: '每日反思',
    icon: 'fa-compass',
    color: 'blue',
    fields: [
      { key: 'reflection_good', label: '今天做得好的', placeholder: '今天有什么事做得不错？', icon: 'fa-check-circle' },
      { key: 'reflection_bad', label: '可以改进的', placeholder: '哪些地方可以做得更好？', icon: 'fa-exclamation-circle' },
      { key: 'reflection_learn', label: '今天学到的', placeholder: '今天有什么新发现或领悟？', icon: 'fa-graduation-cap' },
      { key: 'reflection_tomorrow', label: '明天的计划', placeholder: '明天想怎样改进？', icon: 'fa-calendar-check' }
    ]
  },
  procrastination: {
    name: '拖延分析',
    icon: 'fa-clock',
    color: 'orange',
    fields: [
      { key: 'proc_task', label: '拖延的任务', placeholder: '你在拖延什么任务？', icon: 'fa-clock' },
      { key: 'proc_reason', label: '拖延原因', placeholder: '为什么不想做？害怕什么？', icon: 'fa-search' },
      { key: 'proc_feeling', label: '拖延时的感受', placeholder: '拖延时你有什么感觉？', icon: 'fa-frown' },
      { key: 'proc_smallest', label: '最小第一步', placeholder: '你能做的最小一步是什么？', icon: 'fa-shoe-prints' },
      { key: 'proc_commitment', label: '行动承诺', placeholder: '我承诺在___分钟内完成这第一步', icon: 'fa-handshake' }
    ]
  },
  anxiety: {
    name: '焦虑缓解',
    icon: 'fa-shield-alt',
    color: 'purple',
    fields: [
      { key: 'anxiety_trigger', label: '焦虑触发点', placeholder: '什么让你感到焦虑？', icon: 'fa-bolt' },
      { key: 'anxiety_worst', label: '最坏的情况', placeholder: '你担心最坏会怎样？', icon: 'fa-cloud-showers-heavy' },
      { key: 'anxiety_probability', label: '实际可能性', placeholder: '这种情况真正发生的概率有多大？', icon: 'fa-percentage' },
      { key: 'anxiety_cope', label: '应对策略', placeholder: '如果真的发生了，你能怎样应对？', icon: 'fa-shield-alt' },
      { key: 'anxiety_action', label: '当下行动', placeholder: '现在你能做的一件有用的事是什么？', icon: 'fa-play' }
    ]
  }
};

// ========== 加载自定义模板到选择器 ==========
async function loadCustomTemplates() {
  try {
    const data = await api.get('/api/cbt-templates');
    cbtTemplates = data.templates || [];
    
    const select = $('#diary-template');
    if (!select) return;
    
    // 移除旧的自定义选项
    select.querySelectorAll('option[data-custom]').forEach(opt => opt.remove());
    
    // 获取自定义模板分组标记
    const divider = select.querySelector('#custom-template-divider');
    
    // 添加用户自定义模板
    const userTemplates = cbtTemplates.filter(t => !t.is_system);
    if (userTemplates.length > 0 && divider) {
      divider.style.display = '';
      userTemplates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = 'custom_' + t.id;
        opt.textContent = '📝 ' + t.name;
        opt.dataset.custom = 'true';
        opt.dataset.templateId = t.id;
        select.insertBefore(opt, divider.nextSibling);
      });
    }
  } catch (err) {
    console.error('加载自定义模板失败:', err);
  }
}

// ========== 模板切换事件 ==========
async function onTemplateChange() {
  try {
    const templateType = $('#diary-template')?.value;
    console.log('[template] 选择模板:', templateType);
    const fieldsContainer = $('#diary-template-fields');
    if (!fieldsContainer) return;

    if (templateType === 'free' || !templateType) {
      fieldsContainer.style.display = 'none';
      fieldsContainer.innerHTML = '';
      currentTemplateFields = [];
      return;
    }

    let template = null;
    let fields = [];
    let templateName = '';
    let templateIcon = '';
    let templateColor = 'primary';

    // 检查是否是自定义模板
    if (templateType.startsWith('custom_')) {
      const templateId = parseInt(templateType.replace('custom_', ''));
      const customTemplate = cbtTemplates.find(t => t.id === templateId);
      if (customTemplate) {
        templateName = customTemplate.name;
        templateIcon = 'fa-puzzle-piece';
        templateColor = 'indigo';
        // 安全解析字段（兼容各种格式）
        let rawFields = [];
        try {
          if (typeof customTemplate.fields === 'string' && customTemplate.fields.trim()) {
            rawFields = JSON.parse(customTemplate.fields);
          } else if (Array.isArray(customTemplate.fields)) {
            rawFields = customTemplate.fields;
          } else {
            rawFields = [];
          }
        } catch (e) {
          console.error('解析模板字段失败:', e);
          rawFields = [];
        }
        
        // 兼容：字段可能用 title 而不是 label，确保每個字段都有 label 和 key
        fields = rawFields.map((f, idx) => {
          if (!f || typeof f !== 'object') {
            return { 
              label: '字段 ' + (idx + 1), 
              key: 'field_' + Date.now() + '_' + idx, 
              placeholder: '',
              icon: 'fa-pen'
            };
          }
          // 兼容 title -> label
          const label = f.label || f.title || ('字段 ' + (idx + 1));
          const key = f.key || ('field_' + Date.now() + '_' + idx);
          return {
            ...f,
            label: label,
            key: key,
            placeholder: f.placeholder || '',
            icon: f.icon || 'fa-pen'
          };
        }).filter(f => f.label); // 过滤掉 label 为空的字段
        // 增加使用次数
        try { await api.post('/api/cbt-templates/' + templateId + '/use'); } catch(e) {}
      } else {
        console.warn('[template] 未找到自定义模板:', templateId);
      }
    } else if (SYSTEM_TEMPLATES[templateType]) {
      template = SYSTEM_TEMPLATES[templateType];
      templateName = template.name;
      templateIcon = template.icon;
      templateColor = template.color;
      fields = template.fields;
      console.log('[template] 使用系统模板:', templateName, '字段数:', fields ? fields.length : 0);
    } else {
      console.warn('[template] 未知模板类型:', templateType);
    }

    if (!fields || !fields.length) {
      fieldsContainer.style.display = 'none';
      fieldsContainer.innerHTML = '';
      currentTemplateFields = [];
      return;
    }

    currentTemplateFields = fields;

  // 获取编辑时的已有数据
  const existingData = {};
  if (currentDiaryEntry) {
    fields.forEach(f => {
      if (currentDiaryEntry[f.key]) existingData[f.key] = currentDiaryEntry[f.key];
    });
  }

  // 渲染动态字段
  const colorMap = {
    primary: 'bg-primary/5 dark:bg-primary/10 border-primary/20',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
  };
  const iconColorMap = {
    primary: 'text-primary',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    orange: 'text-orange-600 dark:text-orange-400',
    purple: 'text-purple-600 dark:text-purple-400',
    indigo: 'text-indigo-600 dark:text-indigo-400'
  };

  fieldsContainer.innerHTML = `
    <div class="p-4 rounded-xl ${colorMap[templateColor] || colorMap.primary} border ${templateColor === 'primary' ? 'border-primary/20' : ''} space-y-3">
      <h4 class="font-medium text-gray-800 dark:text-white mb-2"><i class="fas ${templateIcon} ${iconColorMap[templateColor] || iconColorMap.primary} mr-2"></i>${templateName}</h4>
      ${fields.map(f => `
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">${f.icon ? '<i class="fas ' + f.icon + ' mr-1"></i>' : ''}${f.label}</label>
          <textarea id="diary-field-${f.key}" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none text-sm" placeholder="${f.placeholder || ''}">${existingData[f.key] || ''}</textarea>
        </div>
      `).join('')}
    </div>
  `;
  fieldsContainer.style.display = 'block';
  } catch (err) {
    console.error('[template] onTemplateChange 错误:', err);
    showToast('模板切换失败: ' + (err.message || err), 'error');
  }
}

// ========== 显示模板管理器 ==========
async function showTemplateManager() {
  // 先加载模板
  try {
    const data = await api.get('/api/cbt-templates');
    cbtTemplates = data.templates || [];
  } catch(e) {
    cbtTemplates = [];
  }

  const modal = el('div', 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white"><i class="fas fa-puzzle-piece text-primary mr-2"></i>模板管理</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <!-- 系统预设模板 -->
      <div class="mb-6">
        <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">系统预设模板</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${Object.entries(SYSTEM_TEMPLATES).map(([key, t]) => `
            <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50 transition-all cursor-pointer" onclick="useTemplate('${key}')">
              <div class="flex items-center gap-2 mb-1">
                <i class="fas ${t.icon} text-primary"></i>
                <span class="font-medium text-gray-800 dark:text-white">${t.name}</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">${t.fields.length} 个字段</p>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 用户自定义模板 -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">我的自定义模板</h4>
          <button onclick="showCreateTemplateForm()" class="text-sm text-primary font-medium hover:underline">
            <i class="fas fa-plus mr-1"></i>创建模板
          </button>
        </div>
        <div id="custom-templates-list">
          ${cbtTemplates.filter(t => !t.is_system).length === 0 ? `
            <div class="text-center py-6 text-gray-400 dark:text-gray-500">
              <i class="fas fa-file-alt text-2xl mb-2"></i>
              <p class="text-sm">还没有自定义模板</p>
            </div>
          ` : cbtTemplates.filter(t => !t.is_system).map(t => `
            <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-2 hover:border-primary/50 transition-all">
              <i class="fas fa-puzzle-piece text-indigo-500"></i>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-800 dark:text-white text-sm">${t.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${t.description || '自定义模板'} · 使用 ${t.use_count || 0} 次</p>
              </div>
              <div class="flex gap-1">
                <button onclick="useTemplate('custom_${t.id}')" class="px-2 py-1 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">使用</button>
                <button onclick="deleteCustomTemplate(${t.id})" class="px-2 py-1 rounded-lg text-xs bg-danger/10 text-danger hover:bg-danger/20 transition-all touch-btn">删除</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 创建模板表单 -->
      <div id="create-template-form" style="display: none" class="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-4">
        <h4 class="font-medium text-gray-800 dark:text-white"><i class="fas fa-plus-circle text-primary mr-2"></i>创建自定义模板</h4>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模板名称</label>
          <input type="text" id="new-template-name" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm" placeholder="例如：情绪急救">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模板描述</label>
          <input type="text" id="new-template-desc" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm" placeholder="简短描述模板用途">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">模板字段 <span class="text-xs text-gray-400 font-normal">（至少一个，字段名将作为日记中的段落标题）</span></label>
          <div class="mb-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p class="text-xs text-blue-700 dark:text-blue-400">💡 字段规则说明：</p>
            <ul class="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-4 list-disc space-y-0.5">
              <li>字段名：必填，将作为日记中该段落的标题（如"自动思维"、"情绪感受"）</li>
              <li>提示文字：选填，将作为输入框的占位提示文字</li>
              <li>保存后字段不可修改，请仔细填写</li>
            </ul>
          </div>
          <div id="new-template-fields" class="space-y-2">
            <div class="flex gap-2 items-center">
              <input type="text" placeholder="字段名（如：自动思维）" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm tpl-field-label">
              <input type="text" placeholder="提示文字（选填）" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm tpl-field-placeholder">
              <button onclick="this.closest('div').remove()" class="px-2 py-1 text-danger hover:bg-danger/10 rounded-lg transition-all"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <button onclick="addTemplateField()" class="mt-2 text-sm text-primary font-medium hover:underline">
            <i class="fas fa-plus mr-1"></i>添加字段
          </button>
        </div>
        <div class="flex gap-2 justify-end">
          <button onclick="document.getElementById('create-template-form').style.display='none'" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm touch-btn">取消</button>
          <button onclick="saveNewTemplate()" class="px-4 py-2 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all touch-btn">保存模板</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ========== 使用模板（从模板管理器） ==========
function useTemplate(templateKey) {
  try {
    console.log('[useTemplate] 使用模板:', templateKey);
    // 关闭模板管理器
    document.querySelector('.modal-backdrop')?.remove();
    
    // 设置选择器并触发切换
    const select = document.getElementById('diary-template');
    if (select) {
      // 检查模板值是否存在于选项中
      let found = false;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === templateKey) {
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn('[useTemplate] 模板值不在选项中:', templateKey);
        showToast('模板选项不存在', 'warning');
        return;
      }
      select.value = templateKey;
      onTemplateChange();
    } else {
      console.warn('[useTemplate] 未找到模板选择器');
    }
  } catch (err) {
    console.error('[useTemplate] 错误:', err);
    showToast('使用模板失败', 'error');
  }
}

// ========== 添加模板字段 ==========
function addTemplateField() {
  const container = document.getElementById('new-template-fields');
  if (!container) return;
  
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'flex gap-2 items-center';
  fieldDiv.innerHTML = `
    <input type="text" placeholder="字段名" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm tpl-field-label">
    <input type="text" placeholder="提示文字" class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm tpl-field-placeholder">
    <button onclick="this.closest('div').remove()" class="px-2 py-1 text-danger hover:bg-danger/10 rounded-lg transition-all"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(fieldDiv);
}

// ========== 显示创建模板表单 ==========
function showCreateTemplateForm() {
  const form = document.getElementById('create-template-form');
  if (form) form.style.display = 'block';
}

// ========== 保存新模板 ==========
async function saveNewTemplate() {
  const name = document.getElementById('new-template-name')?.value?.trim();
  const desc = document.getElementById('new-template-desc')?.value?.trim();
  
  if (!name) {
    showToast('请输入模板名称', 'error');
    return;
  }
  
  // 收集字段
  const fields = [];
  const labels = document.querySelectorAll('.tpl-field-label');
  const placeholders = document.querySelectorAll('.tpl-field-placeholder');
  
  labels.forEach((labelInput, i) => {
    const label = labelInput.value?.trim();
    if (label) {
      fields.push({
        key: 'custom_' + Date.now() + '_' + i,
        label: label,
        placeholder: placeholders[i]?.value?.trim() || '',
        icon: 'fa-pen'
      });
    }
  });
  
  if (fields.length === 0) {
    showToast('请至少添加一个字段', 'error');
    return;
  }
  
  try {
    await api.post('/api/cbt-templates', {
      name,
      description: desc,
      template_type: 'custom',
      fields
    });
    
    showToast('模板创建成功');
    
    // 重新加载模板列表
    await loadCustomTemplates();
    
    // 关闭模板管理器并重新打开
    document.querySelector('.modal-backdrop')?.remove();
    showTemplateManager();
  } catch (err) {
    showToast(err.message || '创建失败', 'error');
  }
}

// ========== 删除自定义模板 ==========
async function deleteCustomTemplate(id) {
  var confirmed = window.showConfirmModal ? await window.showConfirmModal('确定要删除这个自定义模板吗？', '删除') : confirm('确定要删除这个自定义模板吗？');
  if (!confirmed) return;
  
  try {
    await api.del('/api/cbt-templates/' + id);
    showToast('模板已删除');
    
    // 重新加载
    await loadCustomTemplates();
    
    // 刷新模板管理器
    document.querySelector('.modal-backdrop')?.remove();
    showTemplateManager();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

// ========== 保存日记 ==========
async function saveDiaryEntry(entryId = null) {
  const title = $('#diary-title')?.value?.trim();
  const content = $('#diary-content')?.value?.trim();
  const mood = $('#diary-mood')?.value;
  const weather = $('#diary-weather')?.value?.trim();
  const location = $('#diary-location')?.value?.trim();
  const templateType = $('#diary-template')?.value || 'free';
  
  if (!title) {
    showToast('请输入标题', 'error');
    return;
  }
  
  try {
    const data = {
      title,
      content,
      mood,
      weather,
      location,
      template_type: templateType === 'free' ? 'free' : templateType,
      media: diaryMediaFiles
    };
    
    // 收集模板字段数据
    if (templateType !== 'free') {
      currentTemplateFields.forEach(f => {
        const fieldEl = document.getElementById('diary-field-' + f.key);
        if (fieldEl) {
          data[f.key] = fieldEl.value?.trim() || '';
        }
      });
      // <- 向后兼容注释删除
    }
    
    if (entryId && entryId !== 'null') {
      await api.put('/api/diary/' + entryId, data);
      showToast('日记已更新');
    } else {
      await api.post('/api/diary', data);
      showToast('日记已发布');
    }
    
    // 自动检查成就
    if (typeof autoCheckAchievements === 'function') {
      autoCheckAchievements();
    }
    
    diaryMediaFiles = [];
    document.querySelector('.modal-backdrop')?.remove();
    await loadDiaryEntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ========== 编辑日记 ==========
async function editDiaryEntry(id) {
  document.querySelector('.modal-backdrop')?.remove();
  showDiaryModal(id);
}

// ========== 删除日记 ==========
async function deleteDiaryEntry(id) {
  var confirmed = window.showConfirmModal ? await window.showConfirmModal('确定要删除这篇日记吗？', '删除') : confirm('确定要删除这篇日记吗？');
  if (!confirmed) return;
  
  try {
    await api.del('/api/diary/' + id);
    showToast('日记已删除');
    document.querySelector('.modal-backdrop')?.remove();
    await loadDiaryEntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ========== 全局函数挂载 ==========
window.renderDiary = renderDiary;
window.viewDiaryEntry = viewDiaryEntry;
window.showDiaryModal = showDiaryModal;
window.handleDiaryMediaUpload = handleDiaryMediaUpload;
window.removeDiaryMedia = removeDiaryMedia;
window.removeDiaryMediaByIndex = removeDiaryMediaByIndex;
window.showImageLightbox = showImageLightbox;
window.saveDiaryEntry = saveDiaryEntry;
window.editDiaryEntry = editDiaryEntry;
window.deleteDiaryEntry = deleteDiaryEntry;
window.onTemplateChange = onTemplateChange;
window.loadCustomTemplates = loadCustomTemplates;
window.showTemplateManager = showTemplateManager;
window.useTemplate = useTemplate;
window.addTemplateField = addTemplateField;
window.showCreateTemplateForm = showCreateTemplateForm;
window.saveNewTemplate = saveNewTemplate;
window.deleteCustomTemplate = deleteCustomTemplate;

// ========== 富文本编辑器辅助函数 ==========
// 插入链接
window.insertLink = function() {
  const url = prompt('请输入链接地址：', 'https://');
  if (url) {
    document.execCommand('createLink', false, url);
  }
};

// 同步富文本编辑器内容到 textarea
function syncDiaryContent() {
  const editor = document.getElementById('diary-content-editor');
  const textarea = document.getElementById('diary-content');
  if (editor && textarea) {
    textarea.value = editor.innerHTML;
  }
}

// 在 showDiaryModal 函数中调用此函数
function initDiaryEditor() {
  const editor = document.getElementById('diary-content-editor');
  if (editor) {
    editor.addEventListener('input', syncDiaryContent);
    editor.addEventListener('blur', syncDiaryContent);
    
    // 动态注入编辑器样式（确保列表、引用、标题正确显示）
    if (!document.getElementById('diary-editor-styles')) {
      const style = document.createElement('style');
      style.id = 'diary-editor-styles';
      style.textContent = `
        #diary-content-editor ol { list-style-type: decimal; margin-left: 1.5em; padding-left: 0.5em; }
        #diary-content-editor ul { list-style-type: disc; margin-left: 1.5em; padding-left: 0.5em; }
        #diary-content-editor ol li, #diary-content-editor ul li { display: list-item; }
        #diary-content-editor blockquote { border-left: 3px solid #6366F1; margin: 0.5em 0; padding: 0.3em 0.8em; color: #555; background: rgba(99,102,241,0.05); border-radius: 0 0.5em 0.5em 0; }
        #diary-content-editor h1 { font-size: 1.4em; font-weight: 700; margin: 0.5em 0 0.3em 0; }
        #diary-content-editor h2 { font-size: 1.2em; font-weight: 600; margin: 0.4em 0 0.2em 0; }
        #diary-content-editor a { color: #6366F1; text-decoration: underline; }
      `;
      document.head.appendChild(style);
    }
  }
}

window.initDiaryEditor = initDiaryEditor;

// ========== 富文本编辑辅助函数 ==========
function formatText(command) {
  const editor = document.getElementById('diary-content-editor');
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false, null);
}

function insertLink() {
  const editor = document.getElementById('diary-content-editor');
  if (!editor) return;
  const url = prompt('请输入链接地址（如：https://...）', 'https://');
  if (url && url !== 'https://') {
    editor.focus();
    document.execCommand('createLink', false, url);
  }
}

// ========== 预览文件 ==========
function previewFile(url, type, name) {
  console.log('[previewFile] 预览文件:', { url, type, name });
  if (!url) {
    showToast('文件 URL 无效', 'error');
    return;
  }
  
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  
  let iframeHtml = '';
  // 统一处理类型
  const fileType = type === 'pdf' ? 'pdf' : (type === 'text' ? 'text' : 'other');
  
  if (fileType === 'pdf') {
    iframeHtml = `<iframe src="${url}" class="w-full h-[75vh] rounded-b-2xl" frameborder="0"></iframe>`;
  } else if (fileType === 'text') {
    iframeHtml = `<div class="p-8 text-center text-gray-500">正在加载文本内容...</div>`;
    // fetch 加载文本
    fetch(url).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(txt => {
      const pre = modal.querySelector('#preview-text-content');
      if (pre) pre.textContent = txt;
    }).catch(() => {
      const pre = modal.querySelector('#preview-text-content');
      if (pre) pre.textContent = '无法加载文件内容';
    });
    iframeHtml = `<pre id="preview-text-content" class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 p-8 overflow-y-auto max-h-[75vh]"></pre>`;
  } else {
    // 其他类型：直接显示下载链接
    iframeHtml = `
      <div class="p-8 text-center">
        <i class="fas fa-file text-4xl text-gray-400 mb-4"></i>
        <p class="text-gray-600 dark:text-gray-400 mb-4">该文件类型无法直接预览</p>
        <a href="${url}" download="${name || 'download'}" class="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all">下载文件</a>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden modal-content shadow-2xl">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="font-bold text-lg text-gray-800 dark:text-white truncate">${name || '文件预览'}</h3>
        <div class="flex gap-2">
          <a href="${url}" download="${name || 'download'}" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-primary" title="下载">
            <i class="fas fa-download"></i>
          </a>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>
      ${iframeHtml}
    </div>
  `;
  document.body.appendChild(modal);
}

window.previewFile = previewFile;

window.formatText = formatText;
window.insertLink = insertLink;
