// ==================== 数据可视化页面 ====================
// Chart.js 已在 index.html 中全局加载，无需重复加载

// 本地的情绪/拖延原因中英文映射（不依赖 app.js 的全局函数——stats.js 先于 app.js 加载）
function getEmotionLabelLocal(code) {
  var map = {
    'vague': '任务太模糊', 'fear': '害怕失败', 'boring': '太无聊', 'too_boring': '太无聊',
    'distracted': '被其他事吸引', 'tired': '身体疲惫', 'anxious': '焦虑不安',
    'happy': '开心', 'calm': '平静', 'sad': '难过', 'angry': '生气',
    'excited': '兴奋', 'worried': '担忧', 'neutral': '中性',
    'confident': '自信', 'overwhelmed': '不堪重负', 'hopeful': '满怀希望',
    'frustrated': '沮丧', 'grateful': '感恩', 'lonely': '孤独',
    'perfectionism': '完美主义', 'low_motivation': '动机不足', 'lack_energy': '缺乏能量',
    'poor_planning': '计划不周', 'too_large': '任务太大',
    'manual': '手动', 'weekly_plan_sync': '周计划同步', 'template': '模板',
    'weekly_plan': '周计划'
  };
  return map[code] || code;
}

// ========== 渲染统计页面 ==========
async function renderStats() {
  const div = el('div', 'p-4 md:p-8 max-w-7xl mx-auto fade-in');
  
  div.innerHTML = `
    <div class="mb-6">
      <h2 class="text-xl md:text-2xl font-bold gradient-text">📊 数据可视化</h2>
      <p class="text-xs md:text-sm text-gray-400 dark:text-gray-500 mt-0.5">洞察你的习惯养成和拖延模式</p>
    </div>

    <!-- 个性化洞察面板 -->
    <div id="insights-panel" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <div class="flex items-center gap-2 mb-2"><i class="fas fa-lightbulb text-amber-500"></i><span class="text-xs font-medium text-gray-500">洞察加载中...</span></div>
        <p class="text-sm text-gray-400">请选择时间范围查看洞察</p>
      </div>
    </div>

    <!-- 时间范围选择 -->
    <div class="flex gap-2 mb-6">
      <button onclick="loadStats('7')" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">7天</button>
      <button onclick="loadStats('30')" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">30天</button>
      <button onclick="loadStats('90')" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">90天</button>
    </div>

    <!-- 图表网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- 任务完成趋势 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">📈 任务完成趋势</h3>
        <canvas id="taskTrendChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 情绪变化曲线 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">😊 情绪变化曲线</h3>
        <canvas id="emotionTrendChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 习惯养成热力图 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🔥 习惯养成热力图</h3>
        <div id="habitHeatmap" class="w-full"></div>
      </div>

      <!-- 拖延模式分析 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🧠 拖延模式分析</h3>
        <canvas id="procrastinationChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 日记趋势 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">📝 日记趋势</h3>
        <canvas id="diaryTrendChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 启动记录 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🚀 微启动记录</h3>
        <canvas id="microStartChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 灵感趋势 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">💡 灵感趋势</h3>
        <canvas id="inspirationTrendChart" style="max-height: 300px;"></canvas>
      </div>

      <!-- 番茄钟统计 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🍅 番茄钟统计</h3>
        <canvas id="pomodoroChart" style="max-height: 300px;"></canvas>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-primary" id="stat-total-tasks">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">总任务数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-secondary" id="stat-completion-rate">0%</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">完成率</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-accent" id="stat-avg-energy">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">平均精力</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-danger" id="stat-relapse-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">破戒次数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-indigo-500" id="stat-diary-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">日记数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-cyan-500" id="stat-micro-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">启动次数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-yellow-500" id="stat-inspiration-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">灵感数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-emerald-500" id="stat-commitment-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">承诺总数</p>
      </div>
      <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-amber-500" id="stat-pomodoro-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">番茄钟</p>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="flex gap-4 justify-center flex-wrap">
      <button onclick="exportStats('pdf')" class="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all">
        <i class="fas fa-file-pdf mr-2"></i>导出PDF报告
      </button>
      <button onclick="exportStats('xlsx')" class="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-all">
        <i class="fas fa-file-excel mr-2"></i>导出Excel报告
      </button>
      <button onclick="exportStats('csv')" class="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
        <i class="fas fa-file-csv mr-2"></i>导出CSV数据
      </button>
      <button onclick="exportStats('json')" class="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-all">
        <i class="fas fa-download mr-2"></i>导出JSON备份
      </button>
    </div>
  `;

  // 加载数据
  setTimeout(() => loadStats('30'), 100);
  
  return div;
}

// ========== 加载统计数据 ==========
async function loadStats(days = '30') {
  console.log('[loadStats] 开始加载统计数据，days:', days);
  try {
    // 修复: 更新按钮样式 — 从 setTimeout 调用时无 event 对象
    document.querySelectorAll('[onclick^="loadStats"]').forEach(btn => {
      btn.className = 'px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600';
    });
    // 高亮当前选中的按钮 - 通过 onclick 属性判断
    document.querySelectorAll('[onclick^="loadStats"]').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/loadStats\('(\d+)'\)/);
      if (match && match[1] === String(days)) {
        btn.className = 'px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium';
      }
    });

    console.log('[loadStats] 正在调用 API...');
    // 并行加载所有统计数据（添加单个 API 错误处理）
    const [taskTrend, emotionTrend, heatmap, procrastination, dashboard, inspirationData] = await Promise.all([
      api.get('/api/stats/task-trend').catch(e => { console.error('[loadStats] task-trend API 失败:', e); return { trend: [] }; }),
      api.get('/api/stats/emotion-trend').catch(e => { console.error('[loadStats] emotion-trend API 失败:', e); return { trend: [] }; }),
      api.get('/api/stats/habit-heatmap').catch(e => { console.error('[loadStats] habit-heatmap API 失败:', e); return { heatmap: [] }; }),
      api.get('/api/stats/procrastination-pattern').catch(e => { console.error('[loadStats] procrastination-pattern API 失败:', e); return { pattern: [] }; }),
      api.get('/api/dashboard').catch(e => { console.error('[loadStats] dashboard API 失败:', e); return {}; }),
      api.get('/api/diary?template_type=inspiration&limit=999').catch(e => { console.error('[loadStats] inspiration API 失败:', e); return { entries: [] }; })
    ]);
    
    console.log('[loadStats] API 调用完成，开始渲染图表...', { taskTrend, emotionTrend, heatmap, procrastination, dashboard });

    // 渲染图表
    renderTaskTrendChart(taskTrend.trend || []);
    renderEmotionTrendChart(emotionTrend.trend || []);
    renderHabitHeatmap(heatmap.heatmap || []);
    renderProcrastinationChart(procrastination.pattern || []);

    // 更新统计卡片
    updateStatCards(dashboard);
    
    // 渲染新图表（使用 dashboard 数据）
    renderExtraCharts(dashboard, inspirationData);
    
    // 更新灵感统计
    var inspirations = inspirationData.entries || [];
    document.getElementById('stat-inspiration-count').textContent = inspirations.length;

    // 计算并显示个性化洞察
    renderInsights(taskTrend.trend || [], emotionTrend.trend || [], dashboard, heatmap.heatmap || []);
    console.log('[loadStats] 统计数据加载完成');
  } catch (err) {
    console.error('[loadStats] 加载统计数据失败:', err);
    showToast('加载统计数据失败: ' + err.message, 'error');
  }
}

// ========= 计算并显示个性化洞察 =========
function renderInsights(taskTrend, emotionTrend, dashboard, heatmap) {
  const panel = document.getElementById('insights-panel');
  if (!panel) return;

  let insights = [];

  // 洞察1：完成率趋势（上升/下降/稳定）
  if (taskTrend.length >= 3) {
    const recent = taskTrend.slice(-7); // 最近7天
    const older = taskTrend.slice(-14, -7); // 前7天
    const recentRate = recent.length > 0 ? recent.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / recent.length : 0;
    const olderRate = older.length > 0 ? older.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / older.length : 0;
    const diff = Math.round((recentRate - olderRate) * 100);
    let trendText = '', trendIcon = '', trendColor = '';
    if (diff > 5) { trendText = '上升趋势 📈'; trendIcon = 'fa-arrow-up'; trendColor = 'text-green-500'; }
    else if (diff < -5) { trendText = '下降趋势 📉'; trendIcon = 'fa-arrow-down'; trendColor = 'text-red-500'; }
    else { trendText = '保持稳定 ➡️'; trendIcon = 'fa-minus'; trendColor = 'text-gray-500'; }
    insights.push({ icon: trendIcon, color: trendColor, title: '完成率趋势', desc: trendText + '（最近7天 vs 前7天）' });
  }

  // 洞察2：最高产的星期几
  if (taskTrend.length > 0) {
    const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayStats = [0, 0, 0, 0, 0, 0, 0];
    taskTrend.forEach(d => {
      const day = new Date(d.date).getDay();
      if (d.completed > 0) dayStats[day] += d.completed;
    });
    let maxDay = 0;
    dayStats.forEach((v, i) => { if (v > dayStats[maxDay]) maxDay = i; });
    insights.push({ icon: 'fa-calendar-day', color: 'text-indigo-500', title: '最高产日子', desc: dayMap[maxDay] + ' 完成任务最多' });
  }

  // 洞察3：连续完成任务天数
  if (taskTrend.length > 0) {
    let streak = 0;
    for (let i = taskTrend.length - 1; i >= 0; i--) {
      if (taskTrend[i].completed > 0) streak++;
      else break;
    }
    insights.push({ icon: 'fa-fire', color: 'text-orange-500', title: '连续完成任务', desc: streak + ' 天（截至最近一天）' });
  }

  // 洞察4：平均每天完成任务数
  if (taskTrend.length > 0) {
    const totalCompleted = taskTrend.reduce((s, d) => s + (d.completed || 0), 0);
    const avgTasks = (totalCompleted / taskTrend.length).toFixed(1);
    insights.push({ icon: 'fa-chart-line', color: 'text-cyan-500', title: '日均完成', desc: avgTasks + ' 个任务/天' });
  }

  // 渲染洞察面板
  let html = '';
  insights.forEach(ins => {
    html += `<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <div class="flex items-center gap-2 mb-1.5"><i class="fas ${ins.icon} ${ins.color}"></i><span class="text-xs font-medium text-gray-500">${ins.title}</span></div>
      <p class="text-sm text-gray-800 dark:text-white font-medium">${ins.desc}</p>
    </div>`;
  });
  panel.innerHTML = html;
}

// ========== 任务完成趋势图 ==========
function renderTaskTrendChart(data) {
  const ctx = document.getElementById('taskTrendChart');
  if (!ctx) return;

  if (window.taskTrendChartInstance) window.taskTrendChartInstance.destroy();

  const labels = data.map(d => d.date);
  const totalData = data.map(d => d.total);
  const completedData = data.map(d => d.completed);

  window.taskTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '总任务',
          data: totalData,
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#4F46E5',
          borderWidth: 2
        },
        {
          label: '已完成',
          data: completedData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#10B981',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 12 } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ========== 情绪变化曲线 ==========
function renderEmotionTrendChart(data) {
  const ctx = document.getElementById('emotionTrendChart');
  if (!ctx) return;

  if (window.emotionTrendChartInstance) window.emotionTrendChartInstance.destroy();

  const labels = data.map(d => d.date);
  const energyData = data.map(d => d.avg_energy);

  window.emotionTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '平均精力',
        data: energyData,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#F59E0B',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 12 } }
      },
      scales: {
        y: { beginAtZero: true, max: 5, grid: { color: 'rgba(0,0,0,0.06)' }, title: { display: true, text: '精力 (1-5)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ========== 习惯养成热力图 ==========
function renderHabitHeatmap(data) {
  const container = document.getElementById('habitHeatmap');
  if (!container) return;

  // 创建热力图（简化版：用颜色块表示）
  const maxActivities = Math.max(...data.map(d => d.activities));
  
  let html = '<div class="grid grid-cols-7 gap-1 text-xs">';
  
  // 添加星期标题
  ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
    html += `<div class="text-center font-medium text-gray-500 p-1">${day}</div>`;
  });
  
  // 填充热力块
  data.forEach(d => {
    const date = new Date(d.date);
    const dayOfWeek = date.getDay();
    const intensity = maxActivities > 0 ? d.activities / maxActivities : 0;
    const opacity = 0.1 + intensity * 0.9;
    
    html += `<div class="aspect-square rounded bg-primary" style="opacity: ${opacity};" title="${d.date}: ${d.activities}个活动"></div>`;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// ========== 拖延模式分析 ==========
function renderProcrastinationChart(data) {
  const ctx = document.getElementById('procrastinationChart');
  if (!ctx) return;

  if (window.procrastinationChartInstance) window.procrastinationChartInstance.destroy();

  const labels = data.map(d => getEmotionLabelLocal(d.reason_type));
  const countData = data.map(d => d.count);

  window.procrastinationChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: countData,
        backgroundColor: [
          '#EF4444', '#F59E0B', '#10B981', '#4F46E5', '#8B5CF6'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

// ========== 更新统计卡片 ==========
function updateStatCards(dashboard) {
  // 任务统计
  if (dashboard.tasks) {
    document.getElementById('stat-total-tasks').textContent = dashboard.tasks.length || 0;
    const completed = dashboard.tasks.filter(t => t.status === 'completed').length;
    const rate = dashboard.tasks.length > 0 ? Math.round((completed / dashboard.tasks.length) * 100) : 0;
    document.getElementById('stat-completion-rate').textContent = rate + '%';
  }
  // 情绪统计
  if (dashboard.emotions && dashboard.emotions.length > 0) {
    const avgEnergy = dashboard.emotions.reduce((sum, e) => sum + (e.energy_level || 0), 0) / dashboard.emotions.length;
    document.getElementById('stat-avg-energy').textContent = avgEnergy.toFixed(1);
  }
  // 破戒统计
  if (dashboard.commitments) {
    const relapses = dashboard.commitments.reduce((sum, c) => sum + (c.relapse_count || 0), 0);
    document.getElementById('stat-relapse-count').textContent = relapses;
    document.getElementById('stat-commitment-count').textContent = dashboard.commitments.length || 0;
  }
  // 日记统计
  document.getElementById('stat-diary-count').textContent = (dashboard.diary && dashboard.diary.length) || 0;
  // 微启动次数
  document.getElementById('stat-micro-count').textContent = (dashboard.microStarts && dashboard.microStarts.length) || 0;
  // 番茄钟
  document.getElementById('stat-pomodoro-count').textContent = (dashboard.pomodoro && dashboard.pomodoro.length) || 0;
}

// ========== 渲染额外图表 ==========
function renderExtraCharts(dashboard, inspirationData) {
  // 日记趋势（按日期分组）
  const diaryData = dashboard.diary || [];
  const diaryTrend = [];
  const diaryMap = {};
  diaryData.forEach(d => {
    const date = (d.created_at || '').split('T')[0];
    if (date) { diaryMap[date] = (diaryMap[date] || 0) + 1; }
  });
  Object.entries(diaryMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, count]) => {
    diaryTrend.push({ date, count });
  });
  renderDiaryTrendChart(diaryTrend);

  // 微启动数据
  const microData = dashboard.microStarts || [];
  const microMap = {};
  microData.forEach(d => {
    const date = (d.created_at || '').split('T')[0];
    if (date) { microMap[date] = (microMap[date] || 0) + 1; }
  });
  const microTrend = Object.entries(microMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  renderMicroStartChart(microTrend);

  // 番茄钟数据
  renderPomodoroChart(dashboard.pomodoro || []);
  
  // 灵感趋势
  var inspEntries = (inspirationData && inspirationData.entries) || [];
  var inspMap = {};
  inspEntries.forEach(function(d) {
    var date = (d.created_at || '').split('T')[0];
    if (date) inspMap[date] = (inspMap[date] || 0) + 1;
  });
  var inspTrend = Object.entries(inspMap).sort(function(a,b){return a[0].localeCompare(b[0])}).map(function(e){return {date:e[0], count:e[1]};});
  renderInspirationTrendChart(inspTrend);
}

// ========== 日记趋势图 ==========
function renderDiaryTrendChart(data) {
  const ctx = document.getElementById('diaryTrendChart');
  if (!ctx) return;
  if (window.diaryTrendChartInstance) window.diaryTrendChartInstance.destroy();
  const labels = data.map(d => d.date);
  const counts = data.map(d => d.count);
  if (!labels.length) { ctx.parentElement.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">暂无日记数据</div>'; return; }
  window.diaryTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '日记数', data: counts, borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false } } } }
  });
}

// ========== 微启动统计图 ==========
function renderMicroStartChart(data) {
  const ctx = document.getElementById('microStartChart');
  if (!ctx) return;
  if (window.microStartChartInstance) window.microStartChartInstance.destroy();
  if (!data || !data.length) { ctx.parentElement.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">暂无微启动数据</div>'; return; }
  const labels = data.map(d => d.date || d);
  const counts = data.map(d => d.count || 1);
  window.microStartChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: '启动次数', data: counts, backgroundColor: '#06B6D4', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false } } } }
  });
}

// ========== 灵感趋势图 ==========
function renderInspirationTrendChart(data) {
  var ctx = document.getElementById('inspirationTrendChart');
  if (!ctx) return;
  if (window.inspChartInstance) window.inspChartInstance.destroy();
  if (!data || !data.length) { ctx.parentElement.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">暂无灵感数据</div>'; return; }
  window.inspChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(function(d){return d.date}),
      datasets: [{
        label: '灵感数',
        data: data.map(function(d){return d.count}),
        borderColor: '#d97706',
        backgroundColor: 'rgba(217,119,6,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#d97706',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 7, font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }
      }
    }
  });
}

// ========== 番茄钟统计图 ==========
function renderPomodoroChart(data) {
  const ctx = document.getElementById('pomodoroChart');
  if (!ctx) return;
  if (window.pomodoroChartInstance) window.pomodoroChartInstance.destroy();
  if (!data || !data.length) { ctx.parentElement.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">暂无番茄钟数据</div>'; return; }
  const completed = data.filter(d => d.completed).length;
  const incomplete = data.length - completed;
  window.pomodoroChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['已完成', '未完成'], datasets: [{ data: [completed, incomplete], backgroundColor: ['#10B981', '#F59E0B'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

// ========== 导出功能 ==========
async function exportStats(format) {
  if (format === 'pdf') {
    await generatePDFReport();
  } else if (format === 'xlsx') {
    await exportStatsToExcel();
  } else if (format === 'csv') {
    await exportCSVData();
  } else if (format === 'json') {
    await exportJSONBackup();
  } else {
    showToast('不支持的导出格式', 'error');
  }
}

// ========== 生成PDF报告（中文支持） ==========
async function generatePDFReport() {
  showToast('正在生成 PDF 报告...', 'info');
  
  try {
    // 加载 html2canvas + jsPDF
    if (!window.html2canvas) {
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    }
    if (!window.jspdf) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 获取统计数据
    const dashboard = await api.get('/api/dashboard').catch(() => ({}));
    
    // 创建临时 HTML 内容（中文直接渲染）
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'padding:30px; background:white; font-family: "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif; width:375px;';
    
    let html = '<div style="text-align:center;margin-bottom:20px;">';
    html += '<h1 style="color:#6366F1;font-size:24px;margin:0;">周迹 - 数据报告</h1>';
    html += `<p style="color:#999;font-size:12px;margin-top:5px;">生成日期: ${new Date().toLocaleDateString('zh-CN')}</p>`;
    html += '</div>';
    
    // 任务统计
    if (dashboard.tasks) {
      const total = dashboard.tasks.length;
      const completed = dashboard.tasks.filter(t => t.status === 'completed').length;
      const rate = total > 0 ? Math.round(completed / total * 100) : 0;
      html += '<div style="margin:15px 0;padding:12px;background:#f5f3ff;border-radius:8px;">';
      html += '<h3 style="color:#333;font-size:16px;margin:0 0 8px 0;">📋 任务统计</h3>';
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">总任务数: ${total}</p>`;
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">已完成: ${completed}</p>`;
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">完成率: ${rate}%</p>`;
      html += '</div>';
    }
    
    // 情绪统计
    if (dashboard.emotions) {
      const totalEmotions = dashboard.emotions.length;
      const avgEnergy = totalEmotions > 0 ? (dashboard.emotions.reduce((s, e) => s + (e.energy_level || 0), 0) / totalEmotions).toFixed(1) : 0;
      html += '<div style="margin:15px 0;padding:12px;background:#fef3c7;border-radius:8px;">';
      html += '<h3 style="color:#333;font-size:16px;margin:0 0 8px 0;">😊 情绪统计</h3>';
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">记录总数: ${totalEmotions}</p>`;
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">平均精力: ${avgEnergy}/5</p>`;
      html += '</div>';
    }
    
    // 承诺统计
    if (dashboard.commitments) {
      const totalCommitments = dashboard.commitments.length;
      const totalRelapses = dashboard.commitments.reduce((s, c) => s + (c.relapse_count || 0), 0) || 0;
      html += '<div style="margin:15px 0;padding:12px;background:#ecfdf5;border-radius:8px;">';
      html += '<h3 style="color:#333;font-size:16px;margin:0 0 8px 0;">🎯 承诺统计</h3>';
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">承诺总数: ${totalCommitments}</p>`;
      html += `<p style="color:#555;font-size:13px;margin:3px 0;">破戒次数: ${totalRelapses}</p>`;
      html += '</div>';
    }
    
    tempDiv.innerHTML = html;
    document.body.appendChild(tempDiv);
    
    // 截图（中文通过浏览器渲染，完美支持）
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });
    document.body.removeChild(tempDiv);
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    doc.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    doc.save(`周迹数据报告_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF 报告已生成！', 'success');
    
  } catch (err) {
    console.error('PDF 生成失败:', err);
    showToast('PDF 生成失败: ' + (err.message || err), 'error');
  }
}

// ========== 导出 Excel 报告（多 Sheet 中文）==========
async function exportStatsToExcel() {
  showToast('正在生成 Excel 报告...', 'info');
  try {
    // 加载 SheetJS
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: 任务统计
    const taskTrend = await api.get('/api/stats/task-trend').catch(() => ({ trend: [] }));
    if (taskTrend.trend && taskTrend.trend.length) {
      const wsData = [['日期', '总任务', '已完成', '完成率']];
      taskTrend.trend.forEach(d => {
        const rate = d.total > 0 ? Math.round((d.completed || 0) / d.total * 100) + '%' : '0%';
        wsData.push([d.date, d.total || 0, d.completed || 0, rate]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), '任务统计');
    }

    // Sheet 2: 情绪统计
    const emotionTrend = await api.get('/api/stats/emotion-trend').catch(() => ({ trend: [] }));
    if (emotionTrend.trend && emotionTrend.trend.length) {
      const wsData = [['日期', '平均精力', '记录数']];
      emotionTrend.trend.forEach(d => {
        wsData.push([d.date, d.avg_energy || 0, d.count || 0]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), '情绪统计');
    }

    // Sheet 3: 全部数据导出（中文列名）
    const exportData = await api.get('/api/export').catch(() => ({ data: {} }));
    const zhMap = { 
      id: 'ID', title: '标题', content: '内容', status: '状态', 
      created_at: '创建时间', updated_at: '更新时间', user_id: '用户ID',
      mood: '心情', weather: '天气', energy_level: '精力', note: '备注',
      category: '分类', priority: '优先级', due_date: '截止日期', completed_at: '完成时间',
      description: '描述', difficulty: '难度', task_id: '任务ID', step_id: '步骤ID',
      duration: '时长', planned_duration: '计划时长', actual_duration: '实际时长',
      reason_type: '原因类型', relapse_count: '破戒次数', completed: '是否完成',
      emotion_type: '情绪类型', trigger_task: '触发任务', order_index: '排序',
      continued_after_contract: '超时继续', file_url: '文件链接', file_name: '文件名',
      start_time: '开始时间', end_time: '结束时间', block_date: '日期',
      stat_date: '统计日期', tasks_created: '创建任务', tasks_completed: '完成任务',
      micro_starts_count: '启动次数', procrastination_count: '拖延次数', pomodoro_count: '番茄次数',
      username: '用户名', email: '邮箱', is_system: '系统模板', use_count: '使用次数',
      template_type: '模板类型', template_name: '模板名', fields: '字段',
      day_of_week: '星期', week_start: '周起始', source: '来源', sync_token: '同步标记'
    };
    const sheetNameMap = { 
      tasks: '任务', diary: '日记', emotions: '情绪记录', commitments: '承诺',
      taskSteps: '步骤', microStarts: '启动记录', procrastination: '拖延日志',
      timeBlocks: '时间块', dailyStats: '日报统计', pomodoro: '番茄钟',
      weeklyPlans: '周计划'
    };
    
    if (exportData.data) {
      for (const [tableName, rows] of Object.entries(exportData.data)) {
        if (!rows || !rows.length) continue;
        const headers = Object.keys(rows[0]);
        const wsData = [headers.map(h => zhMap[h] || h)];
        rows.forEach(row => {
          wsData.push(headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            return val;
          }));
        });
        const sn = sheetNameMap[tableName] || tableName;
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), sn.slice(0, 31));
      }
    }

    if (!wb.SheetNames.length) {
      showToast('暂无数据可导出', 'warning');
      return;
    }

    XLSX.writeFile(wb, '周迹数据报告_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showToast('Excel 报告导出成功！', 'success');
  } catch (err) {
    console.error('Excel 导出失败:', err);
    showToast('导出失败：' + (err.message || err), 'error');
  }
}

// ========== 导出CSV数据（中文 + 多表） ==========
async function exportCSVData() {
  try {
    const data = await api.get('/api/export');
    const tableNames = {
      tasks: { name: '任务', headers: ['ID', '标题', '描述', '分类', '难度', '状态', '截止日期', '创建时间'] },
      diary: { name: '日记', headers: ['ID', '标题', '内容', '心情', '天气', '创建时间'] },
      taskSteps: { name: '步骤', headers: ['ID', '任务ID', '标题', '时长', '状态'] },
      emotions: { name: '情绪记录', headers: ['ID', '情绪类型', '精力值', '触发任务', '创建时间'] },
      microStarts: { name: '启动记录', headers: ['ID', '任务ID', '步骤ID', '计划时长', '实际时长'] },
      commitments: { name: '承诺', headers: ['ID', '内容', '破戒次数', '创建时间'] },
      procrastination: { name: '拖延日志', headers: ['ID', '原因类型', '创建时间'] },
      pomodoro: { name: '番茄钟', headers: ['ID', '是否完成', '创建时间'] },
      weeklyPlans: { name: '周计划', headers: ['ID', '标题', '星期', '开始时间', '结束时间', '状态', '创建时间'] }
    };
    
    let csv = '\ufeff'; // BOM for Chinese encoding
    
    for (const [tableKey, rows] of Object.entries(data.data)) {
      if (!rows || rows.length === 0) continue;
      
      const tableInfo = tableNames[tableKey] || { name: tableKey, headers: Object.keys(rows[0]) };
      csv += `\n=== ${tableInfo.name} ===\n`;
      csv += tableInfo.headers.join(',') + '\n';
      
      rows.forEach(row => {
        const values = tableInfo.headers.map(h => {
          let val = row[h] ?? '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        });
        csv += values.join(',') + '\n';
      });
    }
    
    downloadFile(csv, `周迹数据_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
    showToast('CSV 数据已导出！', 'success');
    
  } catch (err) {
    showToast('导出失败: ' + (err.message || err), 'error');
  }
}

// ========== 辅助函数：加载脚本 ==========
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ========== 辅助函数：下载文件 ==========
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========== JSON 全量备份导出 ==========
async function exportJSONBackup() {
  showToast('正在打包数据...', 'info');
  try {
    var [tasks, diary, emotions, microStarts, commitments, pomodoro, inspirations, planData] = await Promise.all([
      api.get('/api/tasks').catch(function(){return {tasks:[]}}),
      api.get('/api/diary?limit=999').catch(function(){return {entries:[]}}),
      api.get('/api/emotions?limit=999').catch(function(){return []}),
      api.get('/api/micro-starts?limit=999').catch(function(){return []}),
      api.get('/api/commitments').catch(function(){return []}),
      api.get('/api/pomodoro?limit=999').catch(function(){return []}),
      api.get('/api/diary?template_type=inspiration&limit=999').catch(function(){return {entries:[]}}),
      api.get('/api/user-data?key=fate_killer_plan').catch(function(){return {data:null}})
    ]);
    var backup = {
      exportedAt: new Date().toISOString(),
      version: '2.4',
      stats: {
        tasks: (tasks.tasks||[]).length,
        diary: (diary.entries||[]).length,
        emotions: (emotions.length||Array.isArray(emotions)?emotions.length:0),
        inspirations: (inspirations.entries||[]).length,
        commitments: (commitments.length||0),
        pomodoro: (pomodoro.length||0)
      },
      data: {
        tasks: tasks.tasks||[],
        diary: diary.entries||[],
        emotions: Array.isArray(emotions)?emotions:[],
        microStarts: Array.isArray(microStarts)?microStarts:[],
        commitments: Array.isArray(commitments)?commitments:[],
        pomodoro: Array.isArray(pomodoro)?pomodoro:[],
        inspirations: inspirations.entries||[],
        planProgress: planData.data ? JSON.parse(planData.data) : null
      }
    };
    var blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'zhouji-backup-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('备份完成！共 ' + backup.stats.tasks + ' 个任务, ' + backup.stats.inspirations + ' 条灵感', 'success');
  } catch(e) {
    showToast('导出失败: ' + e.message, 'error');
  }
}

// 暴露函数到全局
window.renderStats = renderStats;
window.loadStats = loadStats;
window.exportStats = exportStats;
window.exportStatsToExcel = exportStatsToExcel;
window.exportCSVData = exportCSVData;
window.exportJSONBackup = exportJSONBackup;
