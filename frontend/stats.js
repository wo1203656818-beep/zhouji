// ==================== 数据可视化页面 ====================
// Chart.js 已在 index.html 中全局加载，无需重复加载

// ========== 渲染统计页面 ==========
async function renderStats() {
  const div = el('div', 'p-4 md:p-8 max-w-7xl mx-auto fade-in');
  
  div.innerHTML = `
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-800 dark:text-white mb-2">📊 数据可视化</h2>
      <p class="text-gray-500 dark:text-gray-400">洞察你的习惯养成和拖延模式</p>
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
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">📈 任务完成趋势</h3>
        <canvas id="taskTrendChart" style="max-height: 40vh;" class="md:max-h-[300px]"></canvas>
      </div>

      <!-- 情绪变化曲线 -->
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">😊 情绪变化曲线</h3>
        <canvas id="emotionTrendChart" style="max-height: 40vh;" class="md:max-h-[300px]"></canvas>
      </div>

      <!-- 习惯养成热力图 -->
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🔥 习惯养成热力图</h3>
        <div id="habitHeatmap" class="w-full"></div>
      </div>

      <!-- 拖延模式分析 -->
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🧠 拖延模式分析</h3>
        <canvas id="procrastinationChart" style="max-height: 40vh;" class="md:max-h-[300px]"></canvas>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="glass p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-primary" id="stat-total-tasks">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">总任务数</p>
      </div>
      <div class="glass p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-secondary" id="stat-completion-rate">0%</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">完成率</p>
      </div>
      <div class="glass p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-accent" id="stat-avg-energy">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">平均精力</p>
      </div>
      <div class="glass p-6 rounded-2xl text-center">
        <p class="text-3xl font-bold text-danger" id="stat-relapse-count">0</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">破戒次数</p>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="flex gap-4 justify-center">
      <button onclick="exportStats('pdf')" class="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all">
        <i class="fas fa-file-pdf mr-2"></i>导出PDF报告
      </button>
      <button onclick="exportStats('csv')" class="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
        <i class="fas fa-file-csv mr-2"></i>导出CSV数据
      </button>
    </div>
  `;

  // 加载数据
  setTimeout(() => loadStats('30'), 100);
  
  return div;
}

// ========== 加载统计数据 ==========
async function loadStats(days = '30') {
  try {
    // 修复: 更新按钮样式 — 从 setTimeout 调用时无 event 对象
    document.querySelectorAll('[onclick^="loadStats"]').forEach(btn => {
      btn.className = 'px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600';
    });
    // 修复: 从 inline onclick 调用时有 event，从 setTimeout 调用时没有
    if (typeof event !== 'undefined' && event && event.target) {
      event.target.className = 'px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium';
    }

    // 并行加载所有统计数据
    const [taskTrend, emotionTrend, heatmap, procrastination, dashboard] = await Promise.all([
      api.get('/api/stats/task-trend'),
      api.get('/api/stats/emotion-trend'),
      api.get('/api/stats/habit-heatmap'),
      api.get('/api/stats/procrastination-pattern'),
      api.get('/api/dashboard')
    ]);

    // 渲染图表
    renderTaskTrendChart(taskTrend.trend || []);
    renderEmotionTrendChart(emotionTrend.trend || []);
    renderHabitHeatmap(heatmap.heatmap || []);
    renderProcrastinationChart(procrastination.pattern || []);

    // 更新统计卡片
    updateStatCards(dashboard);

  } catch (err) {
    showToast('加载统计数据失败: ' + err.message, 'error');
  }
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
          tension: 0.4
        },
        {
          label: '已完成',
          data: completedData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
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
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: '平均精力',
        data: energyData,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: { beginAtZero: true, max: 5 }
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

  const labels = data.map(d => d.reason_type);
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
  if (dashboard.tasks) {
    document.getElementById('stat-total-tasks').textContent = dashboard.tasks.length || 0;
    
    const completed = dashboard.tasks.filter(t => t.status === 'completed').length;
    const rate = dashboard.tasks.length > 0 ? Math.round((completed / dashboard.tasks.length) * 100) : 0;
    document.getElementById('stat-completion-rate').textContent = rate + '%';
  }

  if (dashboard.emotions && dashboard.emotions.length > 0) {
    const avgEnergy = dashboard.emotions.reduce((sum, e) => sum + (e.energy_level || 0), 0) / dashboard.emotions.length;
    document.getElementById('stat-avg-energy').textContent = avgEnergy.toFixed(1);
  }

  if (dashboard.commitments) {
    const relapses = dashboard.commitments.reduce((sum, c) => sum + (c.relapse_count || 0), 0);
    document.getElementById('stat-relapse-count').textContent = relapses;
  }
}

// ========== 导出功能 ==========
async function exportStats(format) {
  if (format === 'pdf') {
    // 生成PDF报告
    await generatePDFReport();
  } else if (format === 'csv') {
    // 导出CSV数据
    await exportCSVData();
  }
}

// ========== 生成PDF报告 ==========
async function generatePDFReport() {
  showToast('正在生成PDF报告...', 'info');
  
  try {
    // 加载jsPDF库
    if (!window.jspdf) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 标题
    doc.setFontSize(20);
    doc.text('ZhouJi - Weekly Report', 20, 20);
    
    // 日期
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString('zh-CN')}`, 20, 30);
    
    // 加载统计数据
    const dashboard = await api.get('/api/dashboard');
    
    let yPos = 50;
    
    // 任务统计
    doc.setFontSize(16);
    doc.text('Task Statistics', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    const totalTasks = dashboard.tasks ? dashboard.tasks.length : 0;
    const completedTasks = dashboard.tasks ? dashboard.tasks.filter(t => t.status === 'completed').length : 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    doc.text(`Total Tasks: ${totalTasks}`, 30, yPos);
    yPos += 7;
    doc.text(`Completed: ${completedTasks}`, 30, yPos);
    yPos += 7;
    doc.text(`Completion Rate: ${completionRate}%`, 30, yPos);
    yPos += 15;
    
    // 情绪统计
    doc.setFontSize(16);
    doc.text('Emotion Statistics', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    const totalEmotions = dashboard.emotions ? dashboard.emotions.length : 0;
    const avgEnergy = totalEmotions > 0 
      ? (dashboard.emotions.reduce((sum, e) => sum + (e.energy_level || 0), 0) / totalEmotions).toFixed(1)
      : 0;
    
    doc.text(`Total Records: ${totalEmotions}`, 30, yPos);
    yPos += 7;
    doc.text(`Average Energy: ${avgEnergy}/5`, 30, yPos);
    yPos += 15;
    
    // 承诺统计
    doc.setFontSize(16);
    doc.text('Commitment Statistics', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    const totalCommitments = dashboard.commitments ? dashboard.commitments.length : 0;
    const totalRelapses = dashboard.commitments 
      ? dashboard.commitments.reduce((sum, c) => sum + (c.relapse_count || 0), 0)
      : 0;
    
    doc.text(`Total Commitments: ${totalCommitments}`, 30, yPos);
    yPos += 7;
    doc.text(`Total Relapses: ${totalRelapses}`, 30, yPos);
    yPos += 15;
    
    // 保存PDF
    doc.save(`zhouji-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF报告已生成', 'success');
    
  } catch (err) {
    showToast('PDF生成失败: ' + err.message, 'error');
  }
}

// ========== 导出CSV数据 ==========
async function exportCSVData() {
  try {
    const data = await api.get('/api/export');
    let csv = '\ufeff'; // BOM for Chinese encoding
    
    for (const [tableName, rows] of Object.entries(data.data)) {
      if (!rows || rows.length === 0) continue;
      
      csv += `\n=== ${tableName} ===\n`;
      const headers = Object.keys(rows[0]);
      csv += headers.join(',') + '\n';
      
      rows.forEach(row => {
        const values = headers.map(h => {
          let val = row[h];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val || '';
        });
        csv += values.join(',') + '\n';
      });
    }
    
    downloadFile(csv, `zhouji-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    showToast('CSV数据已导出', 'success');
    
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
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

// 暴露函数到全局
window.renderStats = renderStats;
window.loadStats = loadStats;
window.exportStats = exportStats;
