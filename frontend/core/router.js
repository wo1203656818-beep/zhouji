// ====== 周迹 Core: 路由增强（每日一言 + 键盘快捷键 + 错误边界） ======
(function() {
  // 每日一言
  var quotes = [
    '命是弱者的借口，运是强者的谦辞。',
    '你朋友说2028才知道要干什么？那就用2026的结果打他的脸。',
    '不是看到了希望才去坚持，而是坚持了才看到希望。',
    '种一棵树最好的时间是十年前，其次是现在。',
    '自由意志不是为所欲为，而是可以选择不认命。',
    '送外卖不丢人，30岁还不敢做梦才丢人。',
    '普通人用时间换钱，聪明人用内容换时间。',
    '每天早起1小时，一年就多出365小时——相当于多活15天。',
    '60天后的你会感谢今天开始行动的自己。',
    '运气是行动的影子，你跑得越快它跟得越紧。',
  ];
  window._dailyQuote = '"' + quotes[Math.floor(Math.random() * quotes.length)] + '"';

  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    var tag = (e.target || {}).tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch(e.key) {
      case 'd': case 'D': window.navigate('dashboard'); break;
      case 'w': case 'W': window.navigate('weekly'); break;
      case 't': case 'T': window.navigate('tasks'); break;
      case '1': window.navigate('micro-start'); break;
      case '2': window.navigate('diary'); break;
      case '3': window.navigate('fate-killer'); break;
      case '4': window.navigate('assistant'); break;
      case '5': window.navigate('stats'); break;
      case 'n': case 'N': if (window._quickAdd) window._quickAdd(); break;
    }
  });

  // ====== 全局错误边界 ======
  // 捕获未处理的 Promise 错误
  window.addEventListener('unhandledrejection', function(e) {
    console.warn('[error-boundary] 未处理的Promise错误:', e.reason?.message || e.reason);
    e.preventDefault();
  });

  // 给所有 window.render* 函数包装错误边界
  function wrapRenderer(fn, name) {
    return function() {
      try {
        var result = fn.apply(this, arguments);
        // 如果是 Promise，加 catch
        if (result && typeof result.then === 'function') {
          return result.catch(function(err) {
            console.error('[error-boundary] ' + name + ' 渲染失败:', err);
            var div = document.createElement('div');
            div.className = 'p-8 text-center';
            div.innerHTML = '<div class="max-w-sm mx-auto"><i class="fas fa-exclamation-triangle text-4xl text-amber-500 mb-4"></i><h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">页面加载失败</h3><p class="text-sm text-gray-500 mb-4">' + (window.escapeHtml ? window.escapeHtml(err.message || '未知错误') : err.message || '未知错误') + '</p><button onclick="window.navigate(\'dashboard\')" class="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-all"><i class="fas fa-home mr-1"></i>返回首页</button><br><br><button onclick="location.reload()" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"><i class="fas fa-redo mr-1"></i>重新加载</button></div>';
            return div;
          });
        }
        return result;
      } catch (err) {
        console.error('[error-boundary] ' + name + ' 同步渲染失败:', err);
        var div = document.createElement('div');
        div.className = 'p-8 text-center';
        div.innerHTML = '<div class="max-w-sm mx-auto"><i class="fas fa-exclamation-triangle text-4xl text-amber-500 mb-4"></i><h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">页面崩溃</h3><p class="text-sm text-gray-500 mb-4">' + (window.escapeHtml ? window.escapeHtml(err.message || '') : err.message || '') + '</p><button onclick="window.navigate(\'dashboard\')" class="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-all"><i class="fas fa-home mr-1"></i>返回首页</button></div>';
        return div;
      }
    };
  }

  // 延迟包装所有 render 函数（等 app.js 加载完）
  setTimeout(function() {
    var renderFuncs = ['renderDashboard','renderTasks','renderWeekly','renderDiary','renderStats','renderAssistant','renderFateKiller','renderPomodoro','renderEmotion','renderMicroStart','renderCommitments','renderTimeBlocks','renderLab','renderSettings','renderLogin'];
    renderFuncs.forEach(function(name) {
      if (typeof window[name] === 'function') {
        window[name] = wrapRenderer(window[name], name);
      }
    });
  }, 100);

  // ====== 移动端：滑动导航 + 下拉刷新 ======
  (function() {
    var touchStartX = 0, touchStartY = 0, touchTime = 0;
    var isScrolling = false;
    var SWIPE_THRESHOLD = 80;    // 滑动距离阈值
    var SWIPE_TIME_MAX = 300;    // 最大滑动时间(ms)

    // 页面导航顺序（用于左右滑动切换）
    var navOrder = ['dashboard', 'weekly', 'tasks', 'micro-start', 'diary', 'fate-killer', 'pomodoro', 'emotion', 'stats', 'commitments', 'time-blocks', 'lab', 'assistant'];

    document.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      var touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchTime = Date.now();
      isScrolling = false;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (touchStartX === 0) return;
      var touch = e.touches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;
      // 如果垂直滑动距离大于水平，标记为滚动
      if (Math.abs(dy) > Math.abs(dx) + 20) isScrolling = true;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (touchStartX === 0 || isScrolling) { touchStartX = 0; return; }
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dt = Date.now() - touchTime;
      touchStartX = 0;

      // 检查是否在输入区域内
      var target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;

      if (Math.abs(dx) > SWIPE_THRESHOLD && dt < SWIPE_TIME_MAX) {
        var current = window.location.hash.slice(2) || 'dashboard';
        var idx = navOrder.indexOf(current);
        if (idx < 0) return;

        if (dx < 0 && idx < navOrder.length - 1) {
          // 左滑 → 下一页
          window.navigate(navOrder[idx + 1]);
        } else if (dx > 0 && idx > 0) {
          // 右滑 → 上一页
          window.navigate(navOrder[idx - 1]);
        }
      }

      // 下拉刷新（在页面顶部时）
      if (dx === 0 && dt < 500 && window.scrollY < 10) {
        var dy = touchStartY - (e.changedTouches[0].clientY || 0);
        if (dy < -100) {
          // 下拉超过100px，触发刷新
          var cur = window.location.hash.slice(2) || 'dashboard';
          var refreshFn = window['refresh' + cur.charAt(0).toUpperCase() + cur.slice(1)];
          if (typeof refreshFn === 'function') {
            refreshFn();
          } else if (typeof window.loadStats === 'function' && cur === 'stats') {
            window.loadStats();
          } else if (typeof window.loadInspirations === 'function' && cur === 'assistant') {
            window.loadInspirations().then(function(html) {
              var list = document.getElementById('insp-recent-list');
              if (list && html) list.innerHTML = html;
            });
          } else {
            window.navigate(cur); // 重新加载当前页
          }
          // 震动反馈（如果支持）
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }
    }, { passive: true });
  })();
})();
