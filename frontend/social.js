// ==================== 周迹 - 社交分享功能（P3）====================

// ========== 生成成就分享图片 ==========
async function generateAchievementShare(achievement) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);

  // 装饰圆圈
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(500, 80, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, 350, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 图标
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText(achievement.icon || '🏆', 300, 140);

  // 成就名称
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(achievement.display_name || achievement.name, 300, 200);

  // 描述
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(achievement.description || '', 300, 240);

  // 积分
  if (achievement.points) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`+${achievement.points} 积分`, 300, 280);
  }

  // 底部品牌
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('周迹 · CBT拖延症干预系统', 300, 370);

  return canvas.toDataURL('image/png');
}

// ========== 生成周报 ==========
async function generateWeeklyReport() {
  try {
    const data = await api.get('/api/stats/task-trend?days=7');
    const emotionData = await api.get('/api/stats/emotion-trend?days=7');
    const achievementStats = await api.get('/api/achievements/stats');

    const report = {
      period: getLastWeekRange(),
      tasks: data || {},
      emotions: emotionData || {},
      achievements: achievementStats?.stats || {},
      generatedAt: new Date().toLocaleString('zh-CN')
    };

    return report;
  } catch (err) {
    console.error('生成周报失败:', err);
    return null;
  }
}

function getLastWeekRange() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return `${weekAgo.toLocaleDateString('zh-CN')} - ${now.toLocaleDateString('zh-CN')}`;
}

// ========== 显示分享面板 ==========
async function showSharePanel(type, data) {
  const modal = el('div', 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop');
  
  let content = '';
  
  if (type === 'achievement') {
    const imageUrl = await generateAchievementShare(data);
    content = `
      <div class="text-center space-y-4">
        <h4 class="font-bold text-gray-800 dark:text-white text-lg">分享成就</h4>
        <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 inline-block">
          <img src="${imageUrl}" alt="成就分享" class="max-w-full">
        </div>
        <div class="flex gap-2 justify-center">
          <button onclick="downloadShareImage('${imageUrl}', 'achievement')" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all touch-btn">
            <i class="fas fa-download mr-1"></i>保存图片
          </button>
          <button onclick="copyShareText('achievement', ${JSON.stringify(data).replace(/"/g, '&quot;')})" class="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-all touch-btn">
            <i class="fas fa-copy mr-1"></i>复制文字
          </button>
        </div>
      </div>
    `;
  } else if (type === 'weekly') {
    const report = await generateWeeklyReport();
    if (!report) {
      content = '<div class="text-center py-8 text-gray-500">生成周报失败，请稍后再试</div>';
    } else {
      const stats = report.achievements;
      content = `
        <div class="space-y-4">
          <div class="text-center">
            <h4 class="font-bold text-gray-800 dark:text-white text-lg">📊 本周周报</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">${report.period}</p>
          </div>
          
          <div class="grid grid-cols-3 gap-3">
            <div class="text-center p-3 rounded-xl bg-primary/5 dark:bg-primary/10">
              <p class="text-2xl font-bold text-primary">${stats.unlockedCount || 0}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">解锁成就</p>
            </div>
            <div class="text-center p-3 rounded-xl bg-secondary/5 dark:bg-secondary/10">
              <p class="text-2xl font-bold text-secondary">${stats.totalPoints || 0}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">总积分</p>
            </div>
            <div class="text-center p-3 rounded-xl bg-accent/5 dark:bg-accent/10">
              <p class="text-2xl font-bold text-accent">${stats.completionRate || 0}%</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">完成率</p>
            </div>
          </div>
          
          <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap" id="weekly-report-text">${formatWeeklyReportText(report)}</p>
          </div>
          
          <div class="flex gap-2 justify-center">
            <button onclick="copyShareText('weekly')" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all touch-btn">
              <i class="fas fa-copy mr-1"></i>复制周报
            </button>
          </div>
        </div>
      `;
    }
  }

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto modal-content">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white"><i class="fas fa-share-alt text-primary mr-2"></i>分享</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      ${content}
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ========== 格式化周报文字 ==========
function formatWeeklyReportText(report) {
  const stats = report.achievements || {};
  return `📊 周迹 · 本周周报
📅 ${report.period}

🏆 成就: ${stats.unlockedCount || 0} 个解锁
⭐ 积分: ${stats.totalPoints || 0} 分
📈 完成率: ${stats.completionRate || 0}%

—— 周迹 · CBT拖延症干预系统`;
}

// ========== 下载分享图片 ==========
function downloadShareImage(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `zhouji-${filename}-${Date.now()}.png`;
  a.click();
  showToast('图片已保存');
}

// ========== 复制分享文字 ==========
function copyShareText(type, data) {
  let text = '';
  
  if (type === 'achievement') {
    text = `🏆 成就解锁！\n${data.icon || ''} ${data.display_name || data.name}\n${data.description || ''}\n+${data.points || 0} 积分\n\n—— 周迹 · CBT拖延症干预系统`;
  } else if (type === 'weekly') {
    const reportText = document.getElementById('weekly-report-text');
    text = reportText ? reportText.textContent : '';
  }
  
  if (navigator.clipboard && text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else if (text) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('已复制到剪贴板');
  } catch (e) {
    showToast('复制失败，请手动复制', 'error');
  }
  document.body.removeChild(textarea);
}

// ========== 在成就页面添加分享按钮（集成到achievement.js）==========
function addShareButtonToAchievement(achievement) {
  return `<button onclick="showSharePanel('achievement', ${JSON.stringify(achievement).replace(/"/g, '&quot;').replace(/'/g, "\\'")})" class="px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">
    <i class="fas fa-share-alt mr-1"></i>分享
  </button>`;
}

// ========== 全局函数挂载 ==========
window.showSharePanel = showSharePanel;
window.generateAchievementShare = generateAchievementShare;
window.generateWeeklyReport = generateWeeklyReport;
window.downloadShareImage = downloadShareImage;
window.copyShareText = copyShareText;
window.addShareButtonToAchievement = addShareButtonToAchievement;
