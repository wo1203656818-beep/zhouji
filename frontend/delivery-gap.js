// ========= 外卖间隙利用 =========
// 帮助外卖员在间隙时间快速做内容创作任务

let gapTimerInterval = null;
let gapStartTime = null;
let gapSeconds = 0;
let gapActive = false;

// 间隙快速任务模板
const GAP_TASKS = [
  { id: 'idea', icon: 'fa-lightbulb', label: '记录灵感', desc: '快速记下视频想法', time: '2-5分钟' },
  { id: 'script', icon: 'fa-pen', label: '写脚本片段', desc: '写脚本的某一部分', time: '10-15分钟' },
  { id: 'shot', icon: 'fa-camera', label: '规划拍摄', desc: '列出今天要拍的镜头', time: '5-10分钟' },
  { id: 'review', icon: 'fa-eye', label: '回顾进度', desc: '看看创作者工作室进度', time: '3-5分钟' },
  { id: 'read', icon: 'fa-book', label: '学习充电', desc: '看创作技巧文章', time: '10-20分钟' },
  { id: 'rest', icon: 'fa-couch', label: '战略休息', desc: '闭眼休息，恢复精力', time: '5-15分钟' },
];

async function renderDeliveryGap() {
  const token = safeStorage.get('token');
  if (!token) { navigate('login'); return ''; }

  // 从 localStorage 加载历史记录
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('gap_history') || '[]');
  } catch(e) { history = []; }

  let html = '<div class="max-w-6xl mx-auto fade-in">';

  // 标题
  html += `
    <div class="mb-4">
      <h2 class="text-lg md:text-xl font-bold gradient-text">外卖间隙利用</h2>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">送外卖的间隙，也能为创作积累一点</p>
    </div>`;

  // 间隙计时器
  html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">';

  // 左侧：计时器
  html += '<div class="md:col-span-1">';
  html += '<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4 text-center">';
  html += '<h3 class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">间隙计时</h3>';
  html += '<div class="text-3xl font-bold text-primary mb-1" id="gap-timer-display">00:00</div>';
  html += '<p class="text-[11px] text-gray-400 mb-3" id="gap-timer-status">点击"开始间隙"记录空闲时间</p>';
  html += '<div class="flex gap-2 justify-center">';
  html += '<button id="gap-start-btn" onclick="startGapTimer()" class="px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-play mr-1"></i>开始间隙</button>';
  html += '<button id="gap-stop-btn" onclick="stopGapTimer()" class="hidden px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-stop mr-1"></i>结束</button>';
  html += '</div></div></div>';

  // 中间：今日统计
  html += '<div class="md:col-span-2">';
  html += '<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4">';
  html += '<h3 class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">今日利用</h3>';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayGaps = history.filter(g => (g.end_at || '').slice(0, 10) === todayStr);
  const totalMinutes = todayGaps.reduce((sum, g) => sum + (g.duration || 0), 0);
  html += '<div class="grid grid-cols-3 gap-2 text-center">';
  html += `<div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><div class="text-lg font-bold text-indigo-500">${todayGaps.length}</div><div class="text-[10px] text-gray-400">间隙次数</div></div>`;
  html += `<div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"><div class="text-lg font-bold text-green-500">${totalMinutes}</div><div class="text-[10px] text-gray-400">总分钟</div></div>`;
  html += `<div class="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><div class="text-lg font-bold text-amber-500">${todayGaps.filter(g=>g.task_type).length}</div><div class="text-[10px] text-gray-400">完成任务</div></div>`;
  html += '</div></div></div>';

  html += '</div>'; // end grid

  // 快速任务选择
  html += '<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-4">';
  html += '<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700"><h3 class="font-bold text-gray-800 dark:text-white text-sm">选择要做的任务</h3></div>';
  html += '<div class="p-4"><div class="grid grid-cols-2 sm:grid-cols-3 gap-2">';
  GAP_TASKS.forEach(function(task) {
    html += `<div onclick="selectGapTask('${task.id}')" id="gap-task-${task.id}" class="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all touch-btn">
      <div class="flex items-center gap-2 mb-1.5"><i class="fas ${task.icon} text-primary"></i><span class="font-medium text-sm text-gray-800 dark:text-white">${task.label}</span></div>
      <p class="text-[11px] text-gray-400">${task.desc}</p>
      <p class="text-[10px] text-gray-300 mt-1">⏱ ${task.time}</p>
    </div>`;
  });
  html += '</div></div></div>';

  // 任务记录区域（选择任务后显示）
  html += '<div id="gap-task-action" class="hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-4">';
  html += '<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between"><h3 class="font-bold text-gray-800 dark:text-white text-sm" id="gap-task-title">记录任务</h3><button onclick="closeGapTask()" class="text-gray-400 hover:text-gray-600 text-sm">&times;</button></div>';
  html += '<div class="p-4" id="gap-task-content"></div>';
  html += '</div>';

  // 历史记录
  html += '<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">';
  html += '<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700"><h3 class="font-bold text-gray-800 dark:text-white text-sm">近期间隙记录</h3></div>';
  if (history.length === 0) {
    html += '<div class="text-center py-8 text-gray-400"><i class="fas fa-clock text-2xl mb-2 opacity-30"></i><p class="text-sm">还没有记录，开始你的第一个间隙吧！</p></div>';
  } else {
    html += '<div class="divide-y divide-gray-100 dark:divide-gray-700/50">';
    history.slice(0, 10).forEach(function(g) {
      const time = (g.end_at || g.start_at || '').slice(11, 16);
      const date = (g.end_at || g.start_at || '').slice(5, 10);
      const taskLabel = GAP_TASKS.find(t => t.id === g.task_type);
      html += `<div class="px-4 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-gray-400 w-12">${date}</span>
          <span class="text-[11px] text-gray-500">${time}</span>
          <span class="text-sm text-gray-700 dark:text-gray-200">${taskLabel ? taskLabel.label : g.task_type || '间隙'}</span>
        </div>
        <span class="text-[11px] text-gray-400">${g.duration || '?'}分钟</span>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  html += '</div>';
  return el('div', 'max-w-6xl mx-auto fade-in', html);
}

// 开始间隙计时
window.startGapTimer = function() {
  if (gapActive) { showToast('已有计时器在进行中', 'info'); return; }
  gapActive = true;
  gapStartTime = Date.now();
  gapSeconds = 0;

  document.getElementById('gap-start-btn').classList.add('hidden');
  document.getElementById('gap-stop-btn').classList.remove('hidden');
  document.getElementById('gap-timer-status').textContent = '间隙进行中...';
  document.getElementById('gap-timer-status').className = 'text-[11px] text-primary mb-3';

  gapTimerInterval = setInterval(function() {
    gapSeconds = Math.floor((Date.now() - gapStartTime) / 1000);
    const min = String(Math.floor(gapSeconds / 60)).padStart(2, '0');
    const sec = String(gapSeconds % 60).padStart(2, '0');
    var display = document.getElementById('gap-timer-display');
    if (display) display.textContent = min + ':' + sec;
  }, 1000);
  showToast('开始记录间隙时间', 'success');
};

// 结束间隙计时
window.stopGapTimer = function() {
  if (!gapActive) return;
  gapActive = false;
  clearInterval(gapTimerInterval);
  gapTimerInterval = null;

  const duration = Math.floor((Date.now() - gapStartTime) / 60000); // 分钟

  document.getElementById('gap-start-btn').classList.remove('hidden');
  document.getElementById('gap-stop-btn').classList.add('hidden');
  document.getElementById('gap-timer-status').textContent = '间隙结束，用时 ' + duration + ' 分钟';
  document.getElementById('gap-timer-status').className = 'text-[11px] text-green-500 mb-3';

  // 保存到历史
  let history = [];
  try { history = JSON.parse(localStorage.getItem('gap_history') || '[]'); } catch(e) {}
  history.unshift({
    start_at: new Date(gapStartTime).toISOString(),
    end_at: new Date().toISOString(),
    duration: duration
  });
  // 只保留最近50条
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('gap_history', JSON.stringify(history));

  showToast('间隙记录已保存：' + duration + '分钟', 'success');

  // 刷新页面
  renderDeliveryGap().then(function(el) {
    var main = document.querySelector('.main-content');
    if (main) { main.innerHTML = ''; main.appendChild(el); }
  });
};

// 选择任务
window.selectGapTask = function(taskId) {
  // 高亮选中
  GAP_TASKS.forEach(function(t) {
    var el2 = document.getElementById('gap-task-' + t.id);
    if (el2) el2.classList.remove('border-primary', 'bg-primary/5');
  });
  var selected = document.getElementById('gap-task-' + taskId);
  if (selected) selected.classList.add('border-primary', 'bg-primary/5');

  var task = GAP_TASKS.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('gap-task-action').classList.remove('hidden');
  document.getElementById('gap-task-title').textContent = task.label;

  // 根据任务类型显示不同内容
  let content = '';
  if (taskId === 'idea') {
    content = '<div class="space-y-3">';
    content += '<textarea id="gap-idea-input" rows="4" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm outline-none focus:border-primary transition-colors resize-none" placeholder="快速记下你的灵感..."></textarea>';
    content += '<button onclick="saveGapIdea()" class="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all touch-btn">保存灵感</button>';
    content += '</div>';
  } else if (taskId === 'review') {
    // 显示创作者工作室的脚本数量
    let scripts = [];
    try { scripts = JSON.parse(localStorage.getItem('creator_scripts') || '[]'); } catch(e) {}
    content = '<div class="text-center py-4">';
    content += '<div class="text-2xl font-bold text-indigo-500 mb-1">' + scripts.length + '</div>';
    content += '<p class="text-sm text-gray-500 mb-3">个脚本</p>';
    content += '<button onclick="navigate(\'creator-studio\')" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 transition-all touch-btn">打开创作者工作室</button>';
    content += '</div>';
  } else {
    content = '<div class="text-center py-4">';
    content += '<p class="text-sm text-gray-500 mb-3">' + task.desc + '</p>';
    content += '<button onclick="saveGapTask(\'' + taskId + '\')" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all touch-btn">标记完成</button>';
    content += '</div>';
  }

  document.getElementById('gap-task-content').innerHTML = content;
};

// 关闭任务面板
window.closeGapTask = function() {
  document.getElementById('gap-task-action').classList.add('hidden');
  GAP_TASKS.forEach(function(t) {
    var el2 = document.getElementById('gap-task-' + t.id);
    if (el2) el2.classList.remove('border-primary', 'bg-primary/5');
  });
};

// 保存灵感
window.saveGapIdea = async function() {
  const text = (document.getElementById('gap-idea-input')?.value || '').trim();
  if (!text) { showToast('请输入灵感内容', 'error'); return; }

  try {
    await api.post('/api/diary', {
      title: '间隙灵感 ' + new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
      content: text,
      template_type: 'inspiration',
      is_private: true
    });
    showToast('灵感已保存！可在灵感记录中查看 ✨', 'success');
    document.getElementById('gap-idea-input').value = '';
    // 标记这个间隙完成了任务
    markGapTaskDone('idea');
  } catch(e) {
    showToast('保存失败: ' + (e.message || '网络错误'), 'error');
  }
};

// 标记任务完成
window.saveGapTask = function(taskId) {
  markGapTaskDone(taskId);
  showToast('任务已完成！', 'success');
  closeGapTask();
};

// 记录完成的任务到历史
function markGapTaskDone(taskId) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('gap_history') || '[]'); } catch(e) {}
  if (history.length > 0 && !history[0].task_type) {
    history[0].task_type = taskId;
  }
  localStorage.setItem('gap_history', JSON.stringify(history));
}

window.renderDeliveryGap = renderDeliveryGap;
