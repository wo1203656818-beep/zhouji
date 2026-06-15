// ==================== 周迹 - 日记功能 ====================

// ========== 全局变量 ==========
let diaryEntries = [];
let currentDiaryEntry = null;
let diaryMediaFiles = [];

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
            <h3 class="font-bold text-gray-800 dark:text-white text-lg">${entry.title}</h3>
            ${entry.template_type && entry.template_type !== 'free' ? `<span class="px-2 py-0.5 rounded text-xs font-medium ${entry.template_type === 'cbt' ? 'bg-primary/10 text-primary' : entry.template_type === 'gratitude' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}">${entry.template_type === 'cbt' ? 'CBT' : entry.template_type === 'gratitude' ? '感恩' : '反思'}</span>` : ''}
          </div>
          <span class="text-xs text-gray-400">${new Date(entry.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
        ${entry.content ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">${entry.content}</p>` : ''}
        ${entry.cbt_thought ? `<div class="mb-3 p-3 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20"><p class="text-xs text-gray-600 dark:text-gray-400"><strong>自动思维:</strong> ${entry.cbt_thought.substring(0, 100)}${entry.cbt_thought.length > 100 ? '...' : ''}</p></div>` : ''}
        ${entry.mood ? `
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm text-gray-500 dark:text-gray-400">心情:</span>
            <span class="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">${entry.mood}</span>
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
            ${currentDiaryEntry.mood ? `<span><i class="fas fa-smile mr-1"></i>${currentDiaryEntry.mood}</span>` : ''}
            ${currentDiaryEntry.weather ? `<span><i class="fas fa-cloud mr-1"></i>${currentDiaryEntry.weather}</span>` : ''}
            ${currentDiaryEntry.location ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${currentDiaryEntry.location}</span>` : ''}
            ${currentDiaryEntry.template_type && currentDiaryEntry.template_type !== 'free' ? `<span class="px-2 py-0.5 rounded text-xs font-medium ${currentDiaryEntry.template_type === 'cbt' ? 'bg-primary/10 text-primary' : currentDiaryEntry.template_type === 'gratitude' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}">${currentDiaryEntry.template_type === 'cbt' ? 'CBT 思维记录' : currentDiaryEntry.template_type === 'gratitude' ? '感恩日记' : '每日反思'}</span>` : ''}
          </div>
          ${currentDiaryEntry.content ? `
            <div class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${currentDiaryEntry.content}</div>
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
            <h4 class="font-medium text-gray-800 dark:text-white mb-3">媒体文件</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${currentDiaryEntry.media.map(m => `
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  ${m.media_type === 'image' ? `
                    <img src="${m.file_url}" alt="${m.file_name || '图片'}" class="w-full h-32 object-cover cursor-pointer" onclick="window.open('${m.file_url}', '_blank')">
                  ` : m.media_type === 'video' ? `
                    <video src="${m.file_url}" controls class="w-full h-32 object-cover"></video>
                  ` : `
                    <div class="h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                      <audio src="${m.file_url}" controls class="w-full px-4"></audio>
                    </div>
                  `}
                  <div class="p-2 text-xs text-gray-500 dark:text-gray-400">${m.file_name || m.media_type}</div>
                </div>
              `).join('')}
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
  
  diaryMediaFiles = [];
  
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
          <select id="diary-template" onchange="toggleCBTFields()" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all">
            <option value="free" ${(entry?.template_type || 'free') === 'free' ? 'selected' : ''}>自由记录</option>
            <option value="cbt" ${entry?.template_type === 'cbt' ? 'selected' : ''}>CBT 思维记录</option>
            <option value="gratitude" ${entry?.template_type === 'gratitude' ? 'selected' : ''}>感恩日记</option>
            <option value="reflection" ${entry?.template_type === 'reflection' ? 'selected' : ''}>每日反思</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
          <input type="text" id="diary-title" value="${entry?.title || ''}" 
                 class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" 
                 placeholder="今天想记录什么？">
        </div>
        
        <div id="diary-cbt-fields" style="display: ${(entry?.template_type || 'free') === 'cbt' ? 'block' : 'none'}">
          <div class="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-3">
            <h4 class="font-medium text-gray-800 dark:text-white mb-2"><i class="fas fa-brain text-primary mr-2"></i>CBT 思维记录</h4>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">自动思维（当时脑子里在想什么？）</label>
              <textarea id="diary-cbt-thought" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none text-sm">${entry?.cbt_thought || ''}</textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">情绪（感受到什么情绪？多强？1-10）</label>
              <textarea id="diary-cbt-emotion" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none text-sm">${entry?.cbt_emotion || ''}</textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">行为（你做了什么？或不做什么？）</label>
              <textarea id="diary-cbt-behavior" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none text-sm">${entry?.cbt_behavior || ''}</textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">思维重构（更平衡的想法是什么？）</label>
              <textarea id="diary-cbt-reframe" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none text-sm">${entry?.cbt_reframe || ''}</textarea>
            </div>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容</label>
          <textarea id="diary-content" rows="6" 
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all resize-none" 
                    placeholder="记录你的思考、感受、进展...">${entry?.content || ''}</textarea>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">心情</label>
            <select id="diary-mood" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all">
              <option value="neutral" ${entry?.mood === 'neutral' ? 'selected' : ''}>平静</option>
              <option value="happy" ${entry?.mood === 'happy' ? 'selected' : ''}>开心</option>
              <option value="excited" ${entry?.mood === 'excited' ? 'selected' : ''}>兴奋</option>
              <option value="calm" ${entry?.mood === 'calm' ? 'selected' : ''}>放松</option>
              <option value="anxious" ${entry?.mood === 'anxious' ? 'selected' : ''}>焦虑</option>
              <option value="sad" ${entry?.mood === 'sad' ? 'selected' : ''}>难过</option>
              <option value="angry" ${entry?.mood === 'angry' ? 'selected' : ''}>生气</option>
              <option value="tired" ${entry?.mood === 'tired' ? 'selected' : ''}>疲惫</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">天气</label>
            <input type="text" id="diary-weather" value="${entry?.weather || ''}" 
                   class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" 
                   placeholder="晴天、雨天...">
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">位置</label>
          <input type="text" id="diary-location" value="${entry?.location || ''}" 
                 class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" 
                 placeholder="在哪里写的这篇日记？">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">媒体文件（图片、视频、语音）</label>
          <div id="diary-media-preview" class="mb-3 space-y-2"></div>
          <div class="flex gap-2">
            <label class="flex-1">
              <input type="file" accept="image/*" multiple onchange="handleDiaryMediaUpload(this, 'image')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-image mr-1"></i>添加图片
              </div>
            </label>
            <label class="flex-1">
              <input type="file" accept="video/*" multiple onchange="handleDiaryMediaUpload(this, 'video')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-video mr-1"></i>添加视频
              </div>
            </label>
            <label class="flex-1">
              <input type="file" accept="audio/*" multiple onchange="handleDiaryMediaUpload(this, 'audio')" class="hidden">
              <div class="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary cursor-pointer transition-all">
                <i class="fas fa-music mr-1"></i>添加语音
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
}

// ========== 处理媒体文件上传 ==========
async function handleDiaryMediaUpload(input, mediaType) {
  const files = input.files;
  if (!files || !files.length) return;
  
  for (const file of files) {
    try {
      // 检查文件大小（限制 5MB）
      if (file.size > 5 * 1024 * 1024) {
        showToast(`文件 ${file.name} 超过 5MB 限制`, 'warning');
        continue;
      }
      
      // 转换为 base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      diaryMediaFiles.push({
        media_type: mediaType,
        file_name: file.name,
        file_url: base64,
        file_size: file.size
      });
      
      // 显示预览
      const preview = $('#diary-media-preview');
      const previewItem = el('div', 'flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50');
      previewItem.innerHTML = `
        <i class="fas fa-${mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'music'} text-primary"></i>
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

// ========== 切换 CBT 字段显示 ==========
function toggleCBTFields() {
  const templateType = $('#diary-template')?.value;
  const cbtFields = $('#diary-cbt-fields');
  if (cbtFields) {
    cbtFields.style.display = templateType === 'cbt' ? 'block' : 'none';
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
  const cbtThought = $('#diary-cbt-thought')?.value?.trim();
  const cbtEmotion = $('#diary-cbt-emotion')?.value?.trim();
  const cbtBehavior = $('#diary-cbt-behavior')?.value?.trim();
  const cbtReframe = $('#diary-cbt-reframe')?.value?.trim();
  
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
      template_type: templateType,
      media: diaryMediaFiles
    };
    
    if (templateType === 'cbt') {
      data.cbt_thought = cbtThought;
      data.cbt_emotion = cbtEmotion;
      data.cbt_behavior = cbtBehavior;
      data.cbt_reframe = cbtReframe;
    }
    
    if (entryId && entryId !== 'null') {
      await api.put('/api/diary/' + entryId, data);
      showToast('日记已更新');
    } else {
      await api.post('/api/diary', data);
      showToast('日记已发布');
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
  if (!confirm('确定要删除这篇日记吗？')) return;
  
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
window.saveDiaryEntry = saveDiaryEntry;
window.editDiaryEntry = editDiaryEntry;
window.deleteDiaryEntry = deleteDiaryEntry;
window.toggleCBTFields = toggleCBTFields;
