// 渲染成就页面（返回 DOM 节点，由 app.js 的 render() 调用）
function renderAchievements() {
  const div = document.createElement('div');
  div.className = 'p-4 md:p-8 max-w-6xl mx-auto fade-in';

  div.innerHTML = `
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-2">🏆 成就殿堂</h2>
      <p class="text-gray-500 dark:text-gray-400">记录你的每一个里程碑</p>
    </div>

    <!-- 总览统计 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="glass-card p-6 text-center">
        <div class="text-3xl font-bold text-yellow-400 mb-1" id="total-points">0</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">总积分</div>
      </div>
      <div class="glass-card p-6 text-center">
        <div class="text-3xl font-bold text-primary mb-1" id="unlocked-count">0/0</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">已解锁</div>
      </div>
      <div class="glass-card p-6 text-center">
        <div class="text-3xl font-bold text-secondary mb-1" id="completion-rate">0%</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">完成率</div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex justify-between items-center mb-6">
      <div class="flex gap-2" id="category-tabs">
        <button class="category-tab px-4 py-2 rounded-lg text-sm font-medium transition-all active bg-primary text-white" data-category="all" onclick="filterAchievements('all')">全部</button>
        <button class="category-tab px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" data-category="task" onclick="filterAchievements('task')">任务</button>
        <button class="category-tab px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" data-category="emotion" onclick="filterAchievements('emotion')">情绪</button>
        <button class="category-tab px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" data-category="pomodoro" onclick="filterAchievements('pomodoro')">番茄钟</button>
        <button class="category-tab px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" data-category="streak" onclick="filterAchievements('streak')">连续</button>
      </div>
      <button onclick="checkAchievements()" class="btn-primary">
        <i class="fas fa-sync-alt mr-2"></i>检查成就
      </button>
    </div>

    <!-- 成就列表 -->
    <div id="achievements-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <div class="glass-card p-6 text-center">
        <div class="text-gray-400">加载中...</div>
      </div>
    </div>

    <!-- 最近解锁 -->
    <div class="mb-4">
      <h3 class="text-lg font-bold mb-4">🎉 最近解锁</h3>
      <div id="recent-achievements" class="space-y-3">
        <div class="text-gray-400 text-sm">加载中...</div>
      </div>
    </div>
  `;

  // DOM 挂载后异步加载数据（不阻塞渲染）
  setTimeout(function() { loadAchievements(); }, 100);

  return div;
}

// 加载成就数据
async function loadAchievements() {
  try {
    const data = await api.get('/api/achievements');

    if (data.success) {
      // 更新总览
      const totalPoints = document.getElementById('total-points');
      const unlockedCount = document.getElementById('unlocked-count');
      const completionRate = document.getElementById('completion-rate');
      if (totalPoints) totalPoints.textContent = data.summary.totalPoints;
      if (unlockedCount) unlockedCount.textContent = `${data.summary.unlockedCount}/${data.summary.totalCount}`;
      if (completionRate) completionRate.textContent = `${data.summary.completionRate}%`;

      // 渲染成就列表
      renderAchievementsList(data.achievements);

      // 加载最近解锁的成就（传入已获取的成就数据，避免重复请求）
      await loadRecentAchievements(data.achievements);
    } else {
      showToast(data.error || '加载成就失败', 'error');
    }
  } catch (error) {
    console.error('Load achievements error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 渲染成就列表
function renderAchievementsList(achievements) {
  const container = document.getElementById('achievements-list');
  if (!container) return;

  container.innerHTML = achievements.map(ach => {
    const unlocked = ach.unlocked;
    const progress = ach.progress;

    return `
      <div class="glass-card p-6 ${unlocked ? 'border-yellow-400/50' : 'opacity-75'}" 
           data-category="${ach.category}">
        <div class="flex items-start justify-between mb-4">
          <div class="text-4xl">${ach.icon}</div>
          <div class="text-right">
            <span class="text-xs px-2 py-1 rounded ${unlocked ? 'bg-yellow-400/20 text-yellow-400' : 'bg-gray-600 text-gray-400'}">
              ${unlocked ? '已解锁' : `${progress.current}/${progress.required}`}
            </span>
          </div>
        </div>

        <h4 class="font-bold text-lg mb-2 ${unlocked ? 'text-white' : 'text-gray-400'}">${ach.display_name}</h4>
        <p class="text-sm text-gray-400 mb-4">${ach.description}</p>

        <!-- 进度条 -->
        <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
          <div class="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full transition-all duration-500" 
               style="width: ${progress.percentage}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-400">
          <span>进度: ${progress.current}/${progress.required}</span>
          <span>${progress.percentage}%</span>
        </div>

        <!-- 积分 -->
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs text-yellow-400">🏆 ${ach.points} 积分</span>
          <div class="flex items-center gap-2">
            ${unlocked ? `<button onclick="showSharePanel('achievement', {icon:'${ach.icon}',display_name:'${ach.display_name}',name:'${ach.name}',description:'${ach.description}',points:${ach.points}})" class="text-xs text-primary hover:underline touch-btn"><i class="fas fa-share-alt mr-1"></i>分享</button>` : ''}
            ${unlocked ? '<span class="text-xs text-green-400">✅ 已获得</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 分类筛选
function filterAchievements(category) {
  // 更新标签样式
  document.querySelectorAll('.category-tab').forEach(tab => {
    if (tab.dataset.category === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // 筛选成就卡片（使用 CSS class 避免强制重排）
  document.querySelectorAll('#achievements-list > div').forEach(card => {
    card.classList.toggle('hidden', category !== 'all' && card.dataset.category !== category);
  });
}

// 检查成就（手动触发）
async function checkAchievements() {
  try {
    showToast('正在检查成就...', 'info');
    
    const data = await api.post('/api/achievements/check');

    if (data.success) {
      if (data.unlocked && data.unlocked.length > 0) {
        // 显示新解锁的成就
        showUnlockedAchievements(data.unlocked);
        // 重新加载成就列表
        await loadAchievements();
      } else {
        showToast('暂无新成就解锁', 'info');
      }
    } else {
      showToast(data.error || '检查成就失败', 'error');
    }
  } catch (error) {
    console.error('Check achievements error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 显示新解锁的成就（弹窗）
function showUnlockedAchievements(achievements) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="glass-card p-8 max-w-md w-full mx-4 animate-scale-in">
      <div class="text-center mb-6">
        <div class="text-6xl mb-4">🎉</div>
        <h3 class="text-2xl font-bold text-yellow-400">恭喜！解锁新成就</h3>
      </div>

      <div class="space-y-4 mb-6">
        ${achievements.map(ach => `
          <div class="glass-card p-4 flex items-center space-x-4">
            <div class="text-4xl">${ach.icon}</div>
            <div class="flex-1">
              <h4 class="font-bold">${ach.name}</h4>
              <p class="text-sm text-gray-400">${ach.description}</p>
            </div>
            <div class="text-yellow-400 font-bold">+${ach.points}</div>
          </div>
        `).join('')}
      </div>

      <button onclick="this.closest('.fixed').remove()" class="btn-primary w-full">
        太棒了！
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // 自动关闭
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 5000);
}

// 加载最近解锁的成就（接受已缓存的成就数据，避免重复请求）
async function loadRecentAchievements(cachedAchievements) {
  try {
    const data = await api.get('/api/achievements/stats');

    if (data.success && data.stats.lastUnlock) {
      const container = document.getElementById('recent-achievements');
      if (container) {
        // 使用缓存的成就数据，避免重复请求
        const achievementsData = cachedAchievements || (await api.get('/api/achievements'));

        if (achievementsData.success) {
          const recentAchievements = achievementsData.achievements
            .filter(ach => ach.unlocked)
            .sort((a, b) => b.unlocked_at - a.unlocked_at)
            .slice(0, 5);

          container.innerHTML = recentAchievements.map(ach => `
            <div class="glass-card p-4 flex items-center space-x-4">
              <div class="text-3xl">${ach.icon}</div>
              <div class="flex-1">
                <h4 class="font-bold">${ach.display_name}</h4>
                <p class="text-sm text-gray-400">${ach.description}</p>
              </div>
              <div class="text-right">
                <div class="text-yellow-400 font-bold">+${ach.points}</div>
                <div class="text-xs text-gray-400">${formatDate(ach.unlocked_at)}</div>
              </div>
            </div>
          `).join('');
        }
      }
    }
  } catch (error) {
    console.error('Load recent achievements error:', error);
  }
}

// 在完成任务、记录日记等操作后，自动检查成就
async function autoCheckAchievements() {
  try {
    const data = await api.post('/api/achievements/check');

    if (data.success && data.unlocked && data.unlocked.length > 0) {
      // 静默检查，只在有新成就时提示
      showUnlockedAchievements(data.unlocked);
    }
  } catch (error) {
    // 静默失败，不影响主流程
    console.error('Auto check achievements error:', error);
  }
}

// 辅助函数：格式化日期
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 导出函数
window.renderAchievements = renderAchievements;
window.checkAchievements = checkAchievements;
window.filterAchievements = filterAchievements;
window.autoCheckAchievements = autoCheckAchievements;
