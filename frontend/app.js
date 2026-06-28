
// ==================== 周迹前端 v3.0 - 增量改进版 ====================
// 基于 v2.4 稳定版增量开发
// 版本：2026-06-28-2305


// ========== 全局变量声明（修复隐式全局问题）==========
var timerSeconds = 120, timerTotal = 120, timerRunning = false, timerInterval = null;
var pomoSeconds = 1500, pomoTotal = 1500, pomoRunning = false, pomoInterval = null;
var pomoMode = 'work', pomoRound = 1, pomoFocusCount = 0;
var selectedEnergy = 3, selectedBlockEnergy = 3;

// 安全的localStorage封装 - 防止QuotaExceededError和隐私模式错误
const safeStorage = {
  get: function(key) {
    try { return localStorage.getItem(key); }
    catch (e) { console.warn('Storage get error:', e); return null; }
  },
  set: function(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      if (e.name === 'QuotaExceededError') {
        this._cleanup();
        try { localStorage.setItem(key, value); return true; }
        catch (e2) { console.error('Storage full:', e2); }
      }
      console.warn('Storage set error:', e);
      return false;
    }
  },
  remove: function(key) {
    try { localStorage.removeItem(key); }
    catch (e) { console.warn('Storage remove error:', e); }
  },
  clear: function() {
    try { localStorage.clear(); }  // 修复 FE-001: 改为 localStorage.clear()
    catch (e) { console.warn('Storage clear error:', e); }
  },
  _cleanup: function() {
    var keys = Object.keys(localStorage);
    var items = keys.filter(function(k) { return !k.endsWith('_ts'); }).map(function(k) {
      return { key: k, time: parseInt(localStorage.getItem(k + '_ts') || '0') };
    });
    items.sort(function(a, b) { return a.time - b.time; });
    for (var i = 0; i < Math.min(5, items.length); i++) {
      localStorage.removeItem(items[i].key);
      localStorage.removeItem(items[i].key + '_ts');
    }
  }
};

// 修复 Bug1: API_BASE 改为动态读取函数，保存后立即生效
// 优先级：localStorage > 部署配置 > 空字符串
function getApiBase() {
  // 1. 优先使用用户手动配置（localStorage）
  const saved = safeStorage.get('api_base');
  if (saved) return saved;
  
  // 2. 使用部署时配置的值
  if (window.__DEPLOY_CONFIG__ && window.__DEPLOY_CONFIG__.API_BASE_URL) {
    const deployUrl = window.__DEPLOY_CONFIG__.API_BASE_URL;
    // 自动保存到 localStorage，下次直接使用
    safeStorage.set('api_base', deployUrl);
    return deployUrl;
  }
  
  // 3. 默认使用已知的 API 地址
  return 'https://zhouji-api.wo1203656818.workers.dev';
}
const DARK_MODE = safeStorage.get('dark_mode') === 'true';

// 初始化深色模式
if (DARK_MODE) document.documentElement.classList.add('dark');

// 工具函数
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const el = (tag, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

// 防抖
function debounce(fn, ms = 300) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

// 安全 HTML 转义（修复 XSS: 用户内容渲染）
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

// 自定义确认弹窗（替换 confirm()，支持键盘操作和焦点管理）
function showConfirmModal(msg, confirmText, cancelText) {
  return new Promise(function(resolve) {
    var previousActive = document.activeElement;
    var backdrop = el('div', 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 modal-backdrop');
    backdrop.setAttribute('role', 'alertdialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = '<div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl modal-content">' +
      '<p class="text-gray-800 dark:text-gray-200 mb-6">' + escapeHtml(msg) + '</p>' +
      '<div class="flex gap-3 justify-end">' +
      '<button id="modal-cancel-btn" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium touch-btn">' + escapeHtml(cancelText || '取消') + '</button>' +
      '<button id="modal-confirm-btn" class="px-4 py-2 rounded-xl bg-danger text-white hover:bg-danger/90 transition-all font-medium touch-btn">' + escapeHtml(confirmText || '确定') + '</button>' +
      '</div></div>';
    document.body.appendChild(backdrop);
    // 焦点自动到确认按钮
    setTimeout(function() { document.getElementById('modal-confirm-btn').focus(); }, 50);
    function close(result) {
      backdrop.remove();
      if (previousActive && previousActive.focus) previousActive.focus();
      resolve(result);
    }
    document.getElementById('modal-confirm-btn').onclick = function() { close(true); };
    document.getElementById('modal-cancel-btn').onclick = function() { close(false); };
    backdrop.onclick = function(e) { if (e.target === backdrop) close(false); };
    // Escape 关闭
    var keyHandler = function(e) { if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', keyHandler); } };
    document.addEventListener('keydown', keyHandler);
    // Tab 焦点循环
    backdrop.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        var focusable = backdrop.querySelectorAll('button');
        if (focusable.length < 2) return;
        if (e.shiftKey && document.activeElement === focusable[0]) {
          e.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    });
  });
}

// 删除操作带撤销提示
function showDeleteUndo(msg, undoFn) {
  var toast = el('div', 'toast-notification fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl shadow-lg z-[100] bg-gray-800 text-white fade-in flex items-center gap-3');
  toast.setAttribute('role', 'alert');
  toast.innerHTML = '<span class="text-sm">' + escapeHtml(msg || '已删除') + '</span>' +
    '<button class="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all touch-btn">撤销</button>';
  document.body.appendChild(toast);
  toast.querySelector('button').onclick = function() {
    undoFn();
    toast.remove();
  };
  setTimeout(function() { if (toast.parentNode) { toast.style.opacity = '0'; setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300); } }, 5000);
}

// 模态框焦点管理（在所有模态框创建后调用）
function setupModalFocusTrap(modal, onClose) {
  if (!modal) return;
  var previousActive = document.activeElement;
  var focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) setTimeout(function() { focusable[0].focus(); }, 50);
  // Escape 关闭
  var keyHandler = function(e) {
    if (e.key === 'Escape') { closeModal(); }
    // Tab 循环
    if (e.key === 'Tab' && focusable.length > 1) {
      if (e.shiftKey && document.activeElement === focusable[0]) {
        e.preventDefault(); focusable[focusable.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        e.preventDefault(); focusable[0].focus();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);
  function closeModal() {
    document.removeEventListener('keydown', keyHandler);
    if (previousActive && previousActive.focus) previousActive.focus();
    if (onClose) onClose();
  }
  // 拦截 backdrop 点击关闭
  modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
  return closeModal;
}

// 加载失败时显示内联重试按钮
function showErrorWithRetry(containerId, retryFn, msg) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-gray-500">' +
    '<i class="fas fa-exclamation-triangle text-3xl mb-3 text-danger/60"></i>' +
    '<p class="mb-3">' + escapeHtml(msg || '加载失败') + '</p>' +
    '<button onclick="' + retryFn + '()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn">' +
    '<i class="fas fa-redo mr-1"></i>重试</button></div>';
}

// Loading 控制（引用计数，防止快速切换时闪烁）
let loadingCounter = 0;
function showLoading() { loadingCounter++; $('#loading')?.classList.remove('hidden'); }
function hideLoading() { loadingCounter = Math.max(0, loadingCounter - 1); if (loadingCounter === 0) $('#loading')?.classList.add('hidden'); }

// API 封装（带 loading 和错误处理）
const api = {
  async request(method, endpoint, body, options) {
    if (body === void 0) { body = null; }
    if (options === void 0) { options = {}; }
    var retries = options.retries || 2;
    var timeout = options.timeout || 30000;
    showLoading();

    var token = safeStorage.get('token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    // 已移除离线模式功能

    var lastError;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, timeout);

        var res = await fetch(getApiBase() + endpoint, {
          method: method, headers: headers,
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          var retryAfter = parseInt(res.headers.get('X-RateLimit-Reset') || '5');
          showToast('请求过于频繁，' + retryAfter + '秒后重试', 'warning');
          await new Promise(function(r) { setTimeout(r, retryAfter * 1000); });
          continue;
        }

        if (res.status === 401) {
          var data = await res.json();
          var isAuthEndpoint = endpoint.includes('/api/auth/');
          if (isAuthEndpoint) {
            // 登录/注册接口的401是用户名或密码错误，显示后端返回的实际错误
            throw new Error(data.error || data.message || '用户名或密码错误');
          }
          // 其他接口的401才是token过期
          safeStorage.remove('token');
          safeStorage.remove('userId');
          safeStorage.remove('username');
          showToast('登录已过期，请重新登录', 'error');
          setTimeout(function() { navigate('login'); }, 1500);
          throw new Error('认证已过期');
        }

        var data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'HTTP ' + res.status);

        // 请求成功

        hideLoading();
        return data;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          console.warn('请求超时，重试中...');
        } else if (err.message && err.message.includes('Failed to fetch')) {
          hideLoading();
          throw new Error('无法连接到服务器，请检查 API 地址或网络连接');
        } else if (attempt < retries && !err.message.includes('认证')) {
          await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); });
          continue;
        }
        break;
      }
    }
    hideLoading();
    throw lastError;
  },


  get: (e) => api.request('GET', e),
  post: (e, b) => api.request('POST', e, b),
  put: (e, b) => api.request('PUT', e, b),
  del: (e) => api.request('DELETE', e)
};



// 状态
const state = {
  user: null, currentPage: 'dashboard', pageParams: {},
  tasks: [], emotions: [], microStarts: [], logs: [],
  commitments: [], timeBlocks: [], pomodoro: [],
  timer: null, pomodoroTimer: null, pomodoroMode: 'work',
  activeTask: null, activeStep: null,
  darkMode: DARK_MODE
};

// 恢复计时器状态
function restoreTimerState() {
  const saved = safeStorage.get('timer_state');
  if (saved) {
    try {
      const ts = JSON.parse(saved);
      if (ts.running && ts.endTime > Date.now()) {
        state.timerSeconds = Math.ceil((ts.endTime - Date.now()) / 1000);
        state.timerTotal = ts.total;
        state.timerRunning = true;
        state.activeTask = ts.taskId;
        state.activeStep = ts.stepId;
      }
    } catch (e) {}
  }
}

// 保存计时器状态
function saveTimerState() {
  if (state.timerRunning) {
    safeStorage.set('timer_state', JSON.stringify({
      running: true,
      endTime: Date.now() + state.timerSeconds * 1000,
      total: state.timerTotal,
      taskId: state.activeTask,
      stepId: state.activeStep
    }));
  } else {
    safeStorage.remove('timer_state');
  }
}

// 路由
const routes = {
  'login': renderLogin, 'dashboard': renderDashboard,
  'weekly': function() { return (window.renderWeekly || function(){return el('div','<p class="text-center py-12">周视图加载中...</p>');}).apply(this, arguments); },
  'tasks': renderTasks, 'task-detail': renderTaskDetail,
  'micro-start': renderMicroStart,
  'diary': function() { return (window.renderDiary || renderDiary).apply(this, arguments); },
  'pomodoro': renderPomodoro,
  'emotion': renderEmotion,
  'stats': function() { return (window.renderStats || renderStats).apply(this, arguments); },
  'commitments': renderCommitments, 'commitment-detail': renderCommitmentDetail,
  'time-blocks': renderTimeBlocks, 'lab': renderLab,
  'assistant': function() { return window.renderAssistant.apply(this, arguments); },
  'fate-killer': function() { return (window.renderFateKiller || function(){ return el('div','<p class="text-center py-12">计划加载中...</p>');}).apply(this, arguments); },
  'settings': renderSettings,
  'creator-studio': function() { return (window.renderCreatorStudio || function(){return el('div','<p class="text-center py-12 text-gray-400">创作者工作室加载中...</p>');}).apply(this, arguments); },
  'inspiration': function() { return (window.renderInspiration || renderInspiration).apply(this, arguments); }
};

// 修复 Bug7: 防止 navigate 和 hashchange 双重触发 render
var _navigateHash = '';

function navigate(page, params = {}) {
  state.currentPage = page;
  state.pageParams = params;
  var hashPath = '#/' + page;
  if (params.id) hashPath += '/' + params.id;
  
  // 修复: 先保存当前 hash，设置新 hash 后立即调用 render，不用 setTimeout
  _navigateHash = hashPath;
  window.location.hash = hashPath;
  
  // 修复: 导航时平滑滚动到顶部，不影响浏览器前进/后退
  if (!window._isBackForward) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window._isBackForward = false;
  render();
}

// 修复 Bug6: render 改为 async，正确 await 异步渲染函数
async function render() {
  const app = $('#app');
  const token = safeStorage.get('token');
  const hash = window.location.hash.slice(2) || 'dashboard';
  const parts = hash.split('/');
  const page = parts[0];
  // 修复 Bug3: 从URL hash中恢复参数
  if (parts[1] && !state.pageParams?.id) {
    state.pageParams = { id: parts[1] };
  }

  if (!token && page !== 'login') { navigate('login'); return; }
  if (token && page === 'login') { navigate('dashboard'); return; }

  const renderer = routes[page] || renderDashboard;
  
  // 修复: 页面过渡动画 — 先淡出再渲染（延迟清空让淡出可见）
  if (state.currentPage && state.currentPage !== page && app.children.length > 0) {
    app.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
    app.style.opacity = '0';
    app.style.transform = 'translateY(6px)';
    // 等待淡出完成后再清空
    await new Promise(r => setTimeout(r, 130));
  }

  // 修复 Bug6: await 渲染结果，兼容 sync/async 渲染函数
  let content;
  try {
    content = await renderer();
  } catch (err) {
    console.error('页面渲染失败:', err);
    content = el('div', 'flex items-center justify-center min-h-[50vh]');
    content.innerHTML = `<div class="text-center p-8"><i class="fas fa-exclamation-triangle text-4xl text-danger mb-4"></i><h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">页面加载失败</h3><p class="text-sm text-gray-500 mb-4">${escapeHtml(err.message || '未知错误')}</p><button onclick="navigate('dashboard')" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"><i class="fas fa-home mr-1"></i>返回首页</button></div>`;
  }
  
  // 修复: 清除旧内容并用淡入显示新内容
  app.innerHTML = '';
  // 淡入新页面（移除过渡让瞬时切换无动画残留）
  setTimeout(function() {
    app.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    app.style.opacity = '1';
    app.style.transform = 'translateY(0)';
  }, 15);
  
  if (page !== 'login') {
    app.appendChild(renderNav());
    // 移动端导航挂到 body 上，避免 #app 的 transform 影响 fixed 定位
    renderMobileNav();
    const main = el('main', 'main-content p-4 md:p-6 lg:p-8 transition-colors');
    main.appendChild(content);
    app.appendChild(main);
  } else {
    // 登录页隐藏移动端导航
    const mobileNav = document.querySelector('.bottom-nav');
    if (mobileNav) mobileNav.style.display = 'none';
    app.appendChild(content);
  }

  initPageInteractions(page);
  
  // 窗口大小变化时重新渲染，适配移动端/桌面端（仅首次绑定）
  // ⚠️ 关键修复：移动端键盘弹出只改变高度不改变宽度，不需要重渲染
  // 重渲染会导致 input 失去焦点，键盘关闭 → 用户无法输入
  if (!window._resizeHandlerAttached) {
    window._resizeHandlerAttached = true;
    var lastWidth = window.innerWidth;
    window.addEventListener('resize', function() {
      var newWidth = window.innerWidth;
      // 仅当宽度变化（横屏/竖屏切换）时才重渲染，键盘弹出（仅高度变化）不触发
      if (newWidth === lastWidth) return;
      lastWidth = newWidth;
      clearTimeout(window.resizeTimer);
      window.resizeTimer = setTimeout(function() {
        render();
      }, 200);
    });
  }
}

// 导航栏 - 商业级现代设计
function renderNav() {
  const nav = el('nav', 'sidebar');
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    nav.classList.add('sidebar-mobile');
    nav.style.transform = 'translateX(-260px)';
  }

  const desktopItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '仪表盘' },
    { id: 'weekly', icon: 'fa-calendar-week', label: '周视图' },
    { id: 'tasks', icon: 'fa-tasks', label: '任务台' },
    { id: 'micro-start', icon: 'fa-play-circle', label: '微启动' },
    { id: 'diary', icon: 'fa-book', label: '日记' },
    { id: 'fate-killer', icon: 'fa-bolt', label: '反命计划' },
    { id: 'pomodoro', icon: 'fa-stopwatch', label: '番茄钟' },
    { id: 'emotion', icon: 'fa-heart', label: '情绪舱' },
    { id: 'stats', icon: 'fa-chart-bar', label: '数据' },
    { id: 'commitments', icon: 'fa-handshake', label: '承诺' },
    { id: 'time-blocks', icon: 'fa-clock', label: '时间块' },
    { id: 'lab', icon: 'fa-flask', label: '实验室' },
    { id: 'assistant', icon: 'fa-headphones', label: '辅助工具' },
    { id: 'inspiration', icon: 'fa-lightbulb', label: '灵感' },
  ];
  
  const mobileItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '仪表' },
    { id: 'weekly', icon: 'fa-calendar-week', label: '周视图' },
    { id: 'tasks', icon: 'fa-tasks', label: '任务' },
    { id: 'micro-start', icon: 'fa-play', label: '启动' },
    { id: 'assistant', icon: 'fa-headphones', label: '辅助' },
    { id: 'inspiration', icon: 'fa-lightbulb', label: '灵感' },
  ];
  
  const current = state.currentPage;

  let html = `<div class="flex flex-col h-full">`;

  // Logo 区域
  html += `
    <div class="sidebar-brand">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white font-bold text-lg shadow-md">周</div>
        <div>
          <h1 class="font-bold text-base text-gray-800 dark:text-white tracking-tight">周迹</h1>
          <p class="text-xs text-gray-400 dark:text-gray-500">管理启动</p>
        </div>
      </div>
    </div>
  `;

  // 导航项
  html += `<div class="sidebar-nav">`;
  desktopItems.forEach(item => {
    const active = current === item.id ? 'active' : '';
    html += `
      <button onclick="navigate('${item.id}')" class="nav-item ${active}">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
      </button>
    `;
  });
  html += `</div>`;

  // 底部操作
  html += `
    <div class="mt-auto px-3 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700/50 mx-3">
      <button onclick="toggleDarkMode()" class="nav-item w-full justify-start">
        <i class="fas fa-${state.darkMode ? 'sun' : 'moon'}"></i>
        <span>${state.darkMode ? '浅色模式' : '深色模式'}</span>
      </button>
      <button onclick="navigate('settings')" class="nav-item w-full justify-start">
        <i class="fas fa-cog"></i>
        <span>设置</span>
      </button>
      <button onclick="logout()" class="nav-item w-full justify-start text-danger hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600">
        <i class="fas fa-sign-out-alt"></i>
        <span>退出登录</span>
      </button>
      <div class="px-3 py-2 text-center">
        <span class="text-xs text-gray-400 dark:text-gray-600">v2026.06.28-2305</span>
      </div>
    </div>
  </div>`;

  nav.innerHTML = html;
  return nav;
}

// 渲染移动端底部导航 - 单例模式，挂到 body 上避免 transform 影响 fixed 定位
function renderMobileNav() {
  // 单例：复用已存在的 bottom-nav
  let nav = document.querySelector('.bottom-nav');
  const isMobile = window.innerWidth <= 768;
  const current = state.currentPage;

  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    document.body.appendChild(nav);
  }

  nav.style.display = isMobile ? 'flex' : 'none';

  // 移动端只显示 5 个核心 tab + "更多" 弹出面板
  const mobileItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '仪表' },
    { id: 'weekly', icon: 'fa-calendar-week', label: '周视图' },
    { id: 'tasks', icon: 'fa-tasks', label: '任务' },
    { id: 'micro-start', icon: 'fa-play', label: '启动' },
    { id: 'pomodoro', icon: 'fa-stopwatch', label: '番茄' },
  ];

  let html = '';
  mobileItems.forEach(item => {
    const isActive = current === item.id;
    const activeClass = isActive ? 'bottom-nav-active' : '';
    html += `
      <button onclick="navigate('${item.id}')" class="bottom-nav-item ${activeClass}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:4px 2px;cursor:pointer;color:${isActive ? '#10b981' : '#6b7280'};font-size:11px;-webkit-tap-highlight-color:transparent;">
        <i class="fas ${item.icon}" style="font-size:18px;"></i>
        <span>${item.label}</span>
      </button>
    `;
  });

  // "更多" 按钮：点击弹出额外选项面板
  html += `
    <button onclick="toggleMobileMorePanel()" class="bottom-nav-item" id="mobile-more-btn" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:4px 2px;cursor:pointer;color:#6b7280;font-size:11px;-webkit-tap-highlight-color:transparent;">
      <i class="fas fa-ellipsis-h" style="font-size:18px;"></i>
      <span>更多</span>
    </button>
  `;

  nav.innerHTML = html;
  return nav;
}

// 移动端"更多"弹出面板
function toggleMobileMorePanel() {
  let panel = document.querySelector('.mobile-more-panel');
  if (panel) { panel.remove(); return; }

  panel = document.createElement('div');
  panel.className = 'mobile-more-panel';
  const isDark = state.darkMode;
  panel.style.cssText = `
    position: fixed !important;
    bottom: 70px !important;
    left: 12px !important;
    right: 12px !important;
    z-index: 100000 !important;
    background: ${isDark ? '#1f2937' : '#ffffff'};
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  `;

  const moreItems = [
    { id: 'diary', icon: 'fa-book', label: '日记' },
    { id: 'stats', icon: 'fa-chart-bar', label: '数据' },
    { id: 'assistant', icon: 'fa-robot', label: '助手' },
    { id: 'fate-killer', icon: 'fa-bolt', label: '反命计划' },
    { id: 'settings', icon: 'fa-cog', label: '设置' },
    { id: 'lab', icon: 'fa-flask', label: '实验室' },
    { id: 'share', icon: 'fa-share-alt', label: '分享' },
    { action: 'darkMode', icon: isDark ? 'fa-sun' : 'fa-moon', label: isDark ? '亮色' : '暗色' },
  ];

  moreItems.forEach(item => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;padding:10px 4px;cursor:pointer;color:' + (isDark ? '#d1d5db' : '#374151') + ';font-size:12px;border-radius:12px;transition:background 0.15s;-webkit-tap-highlight-color:transparent;';
    btn.innerHTML = '<i class="fas ' + item.icon + '" style="font-size:22px;color:#10b981;"></i><span>' + item.label + '</span>';
    btn.onclick = function() {
      panel.remove();
      if (item.action === 'darkMode') {
        toggleDarkMode();
      } else if (item.id) {
        navigate(item.id);
      }
    };
    btn.ontouchstart = function() { this.style.background = isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)'; };
    btn.ontouchend = function() { this.style.background = 'none'; };
    panel.appendChild(btn);
  });

  // 点击面板外关闭
  setTimeout(function() {
    const closePanel = function(e) {
      if (!panel.contains(e.target) && e.target.id !== 'mobile-more-btn') {
        panel.remove();
        document.removeEventListener('click', closePanel);
      }
    };
    document.addEventListener('click', closePanel);
  }, 10);

  document.body.appendChild(panel);
}

// 移动端切换侧边栏 - 用transform，100%可靠！
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  let overlay = document.querySelector('.sidebar-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleMobileSidebar;
    document.body.appendChild(overlay);
  }
  
  if (sidebar) {
    // 用 transform 动画，100%可靠！
    const transform = sidebar.style.transform;
    const isOpen = transform === 'translateX(0px)' || transform === 'translateX(0)';
    
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.bottom = '0';
    sidebar.style.width = '280px';
    sidebar.style.zIndex = '99999';
    sidebar.style.transition = 'transform 0.3s ease';
    
    if (isOpen) {
      // 关闭：移到屏幕外
      sidebar.style.transform = 'translateX(-280px)';
      overlay.classList.remove('show');
    } else {
      // 打开：移到屏幕内
      sidebar.style.transform = 'translateX(0)';
      overlay.classList.add('show');
    }
  }
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  safeStorage.set('dark_mode', state.darkMode);
  document.documentElement.classList.toggle('dark', state.darkMode);
  render();
}

// ========== 登录页 - 商业级设计 ==========
function renderLogin() {
  const div = el('div', 'login-container');
  div.innerHTML = `
    <div class="login-card fade-in">
      <div class="login-brand">
        <div class="login-brand-icon">周</div>
        <h1>周迹</h1>
        <p>不是管理时间，是管理启动</p>
      </div>
      <div id="login-form">
        <div class="mb-4">
          <input type="text" id="login-username" class="input-modern" placeholder="用户名" onkeydown="if(event.key==='Enter')handleLogin()" autocomplete="username">
        </div>
        <div class="mb-6">
          <input type="password" id="login-password" class="input-modern" placeholder="密码（至少6位）" onkeydown="if(event.key==='Enter')handleLogin()" autocomplete="current-password">
        </div>
        <button onclick="handleLogin()" class="btn-modern w-full text-base py-3">进入系统</button>
        <p class="text-center mt-5 text-sm text-gray-500 dark:text-gray-400">还没有账号？<button onclick="toggleAuthMode()" class="text-primary font-semibold hover:text-primary-dark">立即注册</button></p>
      </div>
      <div id="register-form" class="hidden">
        <div class="mb-4">
          <input type="text" id="reg-username" class="input-modern" placeholder="用户名（至少3位）" onkeydown="if(event.key==='Enter')handleRegister()" autocomplete="username">
        </div>
        <div class="mb-4">
          <input type="password" id="reg-password" class="input-modern" placeholder="密码（至少6位）" onkeydown="if(event.key==='Enter')handleRegister()" autocomplete="new-password">
        </div>
        <div class="mb-6">
          <input type="email" id="reg-email" class="input-modern" placeholder="邮箱（可选）" autocomplete="email">
        </div>
        <button onclick="handleRegister()" class="btn-modern w-full text-base py-3">创建账号</button>
        <p class="text-center mt-5 text-sm text-gray-500 dark:text-gray-400">已有账号？<button onclick="toggleAuthMode()" class="text-primary font-semibold hover:text-primary-dark">直接登录</button></p>
      </div>
      <details class="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
        <summary class="text-xs text-gray-400 text-center cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 list-none select-none">
          <span class="inline-flex items-center gap-1"><i class="fas fa-cog"></i> 高级设置 <i class="fas fa-chevron-down text-2xs"></i></span>
        </summary>
        <div class="mt-3">
          <p class="text-xs text-gray-400 text-center mb-1">API 地址</p>
          <input type="text" id="api-base-input" value="${getApiBase()}" class="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 text-gray-500 focus:border-primary outline-none" placeholder="https://your-api.workers.dev">
        </div>
      </details>
    </div>
  `;
  return div;
}

async function handleLogin() {
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const apiBase = $('#api-base-input').value.trim();
  if (!username || !password) { showToast('请输入用户名和密码', 'error'); return; }
  // 修复 Bug4: 登录前验证 API 地址是否已设置
  if (!apiBase) { showToast('请先填写后端 API 地址', 'error'); $('#api-base-input').focus(); return; }
  // 修复 Bug1: 保存后立即生效
  safeStorage.set('api_base', apiBase);
  try {
    const data = await api.post('/api/auth/login', { username, password });
    safeStorage.set('token', data.token);
    safeStorage.set('userId', data.userId);
    safeStorage.set('username', data.username);
    showToast('登录成功');
    navigate('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleRegister() {
  const username = $('#reg-username').value.trim();
  const password = $('#reg-password').value;
  const email = $('#reg-email').value.trim();
  const apiBase = $('#api-base-input').value.trim();
  if (!username || !password) { showToast('请输入用户名和密码', 'error'); return; }
  if (username.length < 3) { showToast('用户名至少3位', 'error'); return; }
  if (password.length < 6) { showToast('密码至少6位', 'error'); return; }
  // 修复 Bug4: 注册前验证 API 地址是否已设置
  if (!apiBase) { showToast('请先填写后端 API 地址', 'error'); $('#api-base-input').focus(); return; }
  // 修复 Bug1: 保存后立即生效
  safeStorage.set('api_base', apiBase);
  try {
    const data = await api.post('/api/auth/register', { username, password, email });
    safeStorage.set('token', data.token);
    safeStorage.set('userId', data.userId);
    safeStorage.set('username', data.username);
    showToast('注册成功，欢迎加入周迹');
    navigate('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}

function toggleAuthMode() {
  const lf = $('#login-form'), rf = $('#register-form');
  if (lf.classList.contains('hidden')) { lf.classList.remove('hidden'); rf.classList.add('hidden'); }
  else { lf.classList.add('hidden'); rf.classList.remove('hidden'); }
}

function logout() {
  safeStorage.remove('token'); safeStorage.remove('userId'); safeStorage.remove('username');
  safeStorage.remove('timer_state');
  state.user = null; state.timerRunning = false;
  showToast('已退出登录');
  navigate('login');
}

// ========== 辅助函数 ==========
function getCategoryIcon(cat) {
  const map = { work: 'briefcase', study: 'book', health: 'heartbeat', life: 'home', social: 'users', general: 'circle' };
  return map[cat] || 'circle';
}
function getStatusStyle(status) {
  const map = { pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', 'in_progress': 'bg-primary/10 text-primary dark:bg-primary/20', completed: 'bg-secondary/10 text-secondary dark:bg-secondary/20', archived: 'bg-gray-100 text-gray-400 dark:bg-gray-700' };
  return map[status] || 'bg-gray-100 text-gray-600';
}
function getStatusLabel(status) {
  const map = { pending: '待启动', 'in_progress': '进行中', completed: '已完成', archived: '已归档' };
  return map[status] || status;
}
function getEmotionEmoji(type) {
  const map = { vague: '🌫️', fear: '😰', boring: '😴', distracted: '📱', tired: '😫', anxious: '😣', confident: '💪', calm: '😌' };
  return map[type] || '😐';
}
function getEmotionLabel(type) {
  const map = { vague: '任务太模糊', fear: '害怕失败', boring: '太无聊', distracted: '被其他事吸引', tired: '身体疲惫', anxious: '焦虑不安', confident: '充满信心', calm: '平静' };
  return map[type] || type;
}
function getEmotionCBT(type) {
  const map = {
    vague: '你不需要想清楚全部，只需要想清楚下一步。',
    fear: '开始10分钟的价值，是打破"我不行"的预言。',
    boring: '给它一个2分钟的尝试，无聊感常在启动后消失。',
    distracted: '诱惑是信号，不是命令。先完成2分钟契约。',
    tired: '低能量时做低难度步骤，也是胜利。',
    anxious: '焦虑是未开始的信号，不是停止的理由。',
    confident: '保持这个能量，选择一个任务启动吧！',
    calm: '平静是行动的最佳土壤，选一个任务开始。'
  };
  return map[type] || '开始行动，哪怕只有2分钟。';
}

function getPriorityLabel(priority) {
  const map = { 1: '🔴 紧急重要', 2: '🟠 紧急不重要', 3: '🟡 重要不紧急', 4: '🟢 不紧急不重要', 5: '⚪ 可延期' };
  return map[priority] || '未设置';
}
function getPriorityStyle(priority) {
  const map = { 1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', 2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', 3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', 4: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', 5: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' };
  return map[priority] || 'bg-gray-100 text-gray-700';
}

function showToast(message, type = 'success') {
  // 同一条消息不重复显示
  var existing = document.querySelector('.toast-notification[data-message="' + escapeHtml(message) + '"][data-type="' + escapeHtml(type) + '"]');
  if (existing) return;

  const colors = { success: 'bg-secondary text-white', error: 'bg-danger text-white', warning: 'bg-accent text-white', info: 'bg-calm text-white' };
  // 移动端：小屏、居中顶部；桌面端：正常尺寸
  var toast = el('div', 'toast-notification fixed top-3 left-1/2 -translate-x-1/2 z-[100] ' + colors[type] + ' fade-in flex items-center gap-2 touch-btn');
  toast.style.cssText = 'max-width:90vw;padding:8px 14px;border-radius:10px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,0.12);';
  if (window.innerWidth >= 768) {
    toast.style.cssText = 'max-width:420px;padding:10px 20px;border-radius:12px;font-size:14px;box-shadow:0 4px 24px rgba(0,0,0,0.15);';
  }
  toast.dataset.message = message;
  toast.dataset.type = type;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  var icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
  toast.innerHTML = '<i class="fas fa-' + icon + ' flex-shrink-0"></i><span class="font-medium whitespace-nowrap">' + escapeHtml(message) + '</span>';
  document.body.appendChild(toast);
  // 3秒后自动移除
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ========== 仪表盘 ==========
async function renderDashboard() {
  const div = el('div', 'p-4 md:p-8 max-w-6xl mx-auto fade-in');
  const d = getPomoDurations();
  
  try {
    const data = await api.get('/api/dashboard');
    const stats = data.todayStats || {};
    const tasks = data.pendingTasks || [];
    const blocks = data.todayBlocks || [];
    const weekly = data.weeklyStats || [];
    const emotion = data.recentEmotion;
    const todayPomo = data.todayPomodoro || { count: 0, completed: 0 };

    let totalTasks = 0, totalStarted = 0;
    weekly.forEach(d => { totalTasks += d.tasks_created || 0; totalStarted += d.tasks_started || 0; });
    const startRate = totalTasks > 0 ? Math.round((totalStarted / totalTasks) * 100) : 0;

    // 计算一些额外指标
    var todayTasksCompleted = stats.tasks_completed || 0;
    var todayTasksTotal = stats.tasks_created || 0;
    var totalPomo = todayPomo.count || 0;
    var streakDays = 0;
    // 从周统计中计算最长连续完成天数
    if (weekly.length > 0) {
      var rev = [...weekly].reverse();
      for (var si = 0; si < rev.length; si++) {
        if ((rev[si].tasks_completed || 0) > 0) streakDays++;
        else break;
      }
    }

    div.innerHTML = `
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-lg md:text-xl font-bold gradient-text">欢迎回来，${safeStorage.get('username') || '朋友'}</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500">${new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class="flex items-center gap-1"><i class="fas fa-bolt text-green-500"></i>${streakDays}天连胜</span>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 md:gap-2 mb-3 max-w-full overflow-hidden">
        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-2.5 text-center shadow-sm">
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 block">今日任务</span>
          <span class="block text-base md:text-lg font-bold text-gray-800 dark:text-white">${todayTasksTotal}</span>
          <span class="text-[10px] md:text-xs text-gray-400">完成 ${todayTasksCompleted}</span>
        </div>
        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-2.5 text-center shadow-sm">
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 block">微启动</span>
          <span class="block text-base md:text-lg font-bold text-gray-800 dark:text-white">${stats.micro_starts_count || 0}</span>
          <span class="text-[10px] md:text-xs text-gray-400">2分钟</span>
        </div>
        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-2.5 text-center shadow-sm">
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 block">番茄钟</span>
          <span class="block text-base md:text-lg font-bold text-gray-800 dark:text-white">${totalPomo}</span>
          <span class="text-[10px] md:text-xs text-gray-400">${todayPomo.completed || 0} 完成</span>
        </div>
        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-2.5 text-center shadow-sm">
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 block">拖延</span>
          <span class="block text-base md:text-lg font-bold text-gray-800 dark:text-white">${stats.procrastination_count || 0}</span>
          <span class="text-[10px] md:text-xs text-gray-400">今日觉察</span>
        </div>
        <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 md:p-2.5 text-center shadow-sm">
          <span class="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 block">启动率</span>
          <span class="block text-base md:text-lg font-bold text-gray-800 dark:text-white">${startRate}%</span>
          <span class="text-[10px] md:text-xs text-gray-400">本周</span>
        </div>
      </div>

      <!-- 每日一言 -->
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;flex-shrink:0;">💬</span>
        <p style="color:rgba(255,255,255,0.95);font-size:14px;font-weight:500;margin:0;line-height:1.5;">${window._dailyQuote || '"自由意志不是为所欲为，而是可以选择不认命。"'}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div class="lg:col-span-2 space-y-3">
          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <i class="fas fa-clipboard-list text-indigo-500" style="font-size:11px"></i> 待启动
              </h3>
              <button onclick="navigate('tasks')" class="text-xs text-indigo-500 hover:text-indigo-600">全部</button>
            </div>
            ${tasks.length === 0 ? '<p class="text-xs text-gray-400 text-center py-8">还没有任务</p>' :
              tasks.slice(0, 4).map(task => `
                <div class="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-gray-700/30 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded px-1" onclick="navigate('task-detail', {id: ${task.id}})">
                  <i class="fas fa-${getCategoryIcon(task.category)}" style="font-size:9px;color:#6366f1;width:16px;text-align:center"></i>
                  <span class="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">${task.title}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded-full ${getStatusStyle(task.status)}">${getStatusLabel(task.status)}</span>
                </div>
              `).join('')}
          </div>

          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <i class="fas fa-chart-bar text-blue-500" style="font-size:11px"></i> 近7天趋势
            </h3>
            <div class="h-20 flex items-end gap-1">
              ${weekly.map((d, i) => {
                const max = Math.max(...weekly.map(x => Math.max(x.tasks_completed||0, x.micro_starts_count||0, x.procrastination_count||0, x.pomodoro_count||0))) || 1;
                return `<div class="flex-1 flex flex-col items-center gap-0.5">
                  <div class="w-full flex gap-px h-16 items-end">
                    <div class="flex-1 bg-secondary/60 rounded-t" style="height:${Math.max(4,Math.round(((d.tasks_completed||0)/max)*100))}%"></div>
                    <div class="flex-1 bg-primary/60 rounded-t" style="height:${Math.max(4,Math.round(((d.micro_starts_count||0)/max)*100))}%"></div>
                    <div class="flex-1 bg-accent/60 rounded-t" style="height:${Math.max(4,Math.round(((d.procrastination_count||0)/max)*100))}%"></div>
                    <div class="flex-1 bg-danger/60 rounded-t" style="height:${Math.max(4,Math.round(((d.pomodoro_count||0)/max)*100))}%"></div>
                  </div>
                  <span class="text-[9px] text-gray-400">${d.stat_date?.slice(5) || ''}</span>
                </div>`;
              }).join('')}
            </div>
            <div class="flex gap-2 mt-1 text-[10px] text-gray-400 dark:text-gray-500 justify-center">
              <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded bg-secondary/60"></span>完成</span>
              <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded bg-primary/60"></span>启动</span>
              <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded bg-accent/60"></span>拖延</span>
              <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded bg-danger/60"></span>番茄</span>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1 space-y-3">
          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <i class="fas fa-heart text-rose-500" style="font-size:11px"></i> 情绪
            </h3>
            ${emotion ? `
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xl">${getEmotionEmoji(emotion.emotion_type)}</span>
                <div>
                  <p class="text-xs font-semibold text-gray-700 dark:text-gray-300">${getEmotionLabel(emotion.emotion_type)}</p>
                  <p class="text-[10px] text-gray-400">${new Date(emotion.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-400">能量</span>
                <div class="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-rose-400 to-green-400 rounded-full" style="width:${(emotion.energy_level/5)*100}%"></div>
                </div>
                <span class="text-[10px] font-semibold text-gray-600 dark:text-gray-400">${emotion.energy_level}/5</span>
              </div>
            ` : '<p class="text-xs text-gray-400 py-2">暂无记录</p>'}
            <button onclick="navigate('emotion')" class="mt-2 w-full py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-all">${emotion ? '扫描' : '情绪扫描'}</button>
          </div>

          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><i class="fas fa-bolt text-amber-500" style="font-size:11px"></i> 快捷</h3>
            <div class="grid grid-cols-2 gap-1.5">
              <button onclick="navigate('micro-start')" class="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all text-left text-[11px] font-medium"><i class="fas fa-play" style="font-size:10px"></i> 启动</button>
              <button onclick="navigate('pomodoro')" class="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all text-left text-[11px] font-medium"><i class="fas fa-stopwatch" style="font-size:10px"></i> 番茄</button>
              <button onclick="navigate('tasks')" class="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 transition-all text-left text-[11px] font-medium"><i class="fas fa-cut" style="font-size:10px"></i> 拆解</button>
              <button onclick="navigate('lab')" class="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-all text-left text-[11px] font-medium"><i class="fas fa-microscope" style="font-size:10px"></i> 拖延</button>
            </div>
          </div>

          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <i class="fas fa-fire text-orange-500" style="font-size:11px"></i> 今日概况
            </h3>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">已完成任务</span>
                <span class="font-semibold text-gray-700 dark:text-gray-300">${todayTasksCompleted} / ${todayTasksTotal}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">番茄专注</span>
                <span class="font-semibold text-gray-700 dark:text-gray-300">${totalPomo} 轮</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">本周连胜</span>
                <span class="font-semibold text-green-600">${streakDays} 天</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">启动率</span>
                <span class="font-semibold text-gray-700 dark:text-gray-300">${startRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1 space-y-3">
          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <i class="fas fa-mountain text-orange-500" style="font-size:11px"></i> 时间
              </h3>
              <button onclick="navigate('time-blocks')" class="text-[10px] text-indigo-500 hover:text-indigo-600">管理</button>
            </div>
            <div class="h-16 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden relative">${renderTimeTerrain(blocks)}</div>
          </div>

          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <i class="fas fa-exclamation-circle text-amber-500" style="font-size:11px"></i> 到期
            </h3>
            ${data.upcomingTasks && data.upcomingTasks.length > 0 ? data.upcomingTasks.slice(0, 4).map(task => {
              var isOverdue = new Date(task.due_date + 'T23:59:59') < new Date();
              return `<div class="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-gray-700/30 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded px-1" onclick="navigate('task-detail', {id: ${task.id}})">
                <span class="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">${task.title}</span>
                <span class="text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}">${isOverdue ? '已过期' : task.due_date}</span>
              </div>`;
            }).join('') : '<p class="text-xs text-gray-400 text-center py-6">无到期任务</p>'}
          </div>

          <div class="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <i class="fas fa-tasks text-green-500" style="font-size:11px"></i> 任务池
            </h3>
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span class="text-gray-500">待完成</span>
                <span class="ml-auto font-semibold text-gray-700 dark:text-gray-300">${(data.tasks||[]).filter(t=>t.status==='pending').length}</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                <span class="text-gray-500">进行中</span>
                <span class="ml-auto font-semibold text-gray-700 dark:text-gray-300">${(data.tasks||[]).filter(t=>t.status==='in_progress').length}</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full bg-green-400"></span>
                <span class="text-gray-500">已完成</span>
                <span class="ml-auto font-semibold text-gray-700 dark:text-gray-300">${(data.tasks||[]).filter(t=>t.status==='completed').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    div.innerHTML = '<div class="p-8 text-center text-danger">' +
      '<i class="fas fa-exclamation-triangle text-3xl mb-3"></i>' +
      '<p class="mb-2">加载失败</p>' +
      '<button onclick="renderDashboard()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn mt-2">' +
      '<i class="fas fa-redo mr-1"></i>重试</button></div>';
  }
  return div;
}

function renderTimeTerrain(blocks) {
  if (blocks.length === 0) {
    return `<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
      <div class="text-center"><i class="fas fa-mountain text-lg mb-1 text-gray-300 dark:text-gray-600"></i><p class="text-xs">无</p></div>
    </div>`;
  }
  const hours = Array.from({length: 24}, (_, i) => i);
  const now = new Date(); const currentHour = now.getHours();
  let html = `<div class="flex overflow-x-auto sm:overflow-visible gap-0 rounded-lg h-14 border border-gray-200 dark:border-gray-700 relative scrollbar-hide"><div class="absolute top-0.5 left-0.5 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-1 py-0.5 rounded text-[9px] font-medium dark:text-white shadow-sm">${currentHour}:${String(now.getMinutes()).padStart(2,'0')}</div>`;
  hours.forEach(hour => {
    const block = blocks.find(b => {
      const start = parseInt(b.start_time?.split(':')[0] || 0);
      const end = parseInt(b.end_time?.split(':')[0] || 0);
      return hour >= start && hour < end;
    });
    let color = 'bg-gray-100 dark:bg-gray-700';
    if (hour < currentHour) color = 'bg-gray-300 dark:bg-gray-600';
    if (block) {
      if (block.block_type === 'work') color = 'bg-primary/30';
      else if (block.block_type === 'rest') color = 'bg-secondary/30';
      else color = 'bg-accent/30';
    }
    if (hour === currentHour) color = 'bg-warm/40';
    html += `<div class="flex-shrink-0 w-6 sm:flex-1 ${color} border-r border-white/30 dark:border-gray-800/30 relative flex flex-col items-center justify-end pb-0.5"><div class="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400">${hour}</div></div>`;
  });
  html += `</div>`;
  return html;
}

// ========== 情绪缓冲舱 ==========
function renderEmotion() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-white">情绪缓冲舱</h2>
      <p class="text-gray-500 dark:text-gray-400">先处理情绪，再处理任务</p>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
      <h3 class="font-bold text-gray-800 dark:text-white mb-6 text-center">此刻是什么在阻挡你？</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        ${[{type:'vague',emoji:'🌫️',label:'任务太模糊'},{type:'fear',emoji:'😰',label:'害怕失败'},{type:'boring',emoji:'😴',label:'太无聊'},{type:'distracted',emoji:'📱',label:'被其他事吸引'},{type:'tired',emoji:'😫',label:'身体疲惫'},{type:'anxious',emoji:'😣',label:'焦虑不安'},{type:'confident',emoji:'💪',label:'充满信心'},{type:'calm',emoji:'😌',label:'平静'}].map(e=>`
          <button onclick="selectEmotion('${e.type}')" class="emotion-btn flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all touch-btn" data-emotion="${e.type}">
            <span class="text-3xl">${e.emoji}</span><span class="text-sm font-medium text-gray-700 dark:text-gray-300">${e.label}</span>
          </button>
        `).join('')}
      </div>
      <div id="emotion-energy" class="hidden mb-6">
        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">此刻的能量水平</h4>
        <div class="flex gap-2">
          ${[1,2,3,4,5].map(i=>`<button onclick="selectEnergy(${i})" class="flex-1 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary transition-all energy-btn touch-btn" data-energy="${i}"><span class="text-lg">${'⚡'.repeat(i)}</span></button>`).join('')}
        </div>
      </div>
      <div id="emotion-cbt" class="hidden mb-6">
        <div class="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-xl p-5 border border-primary/10 dark:border-primary/20">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">💡 认知干预</p>
          <p id="cbt-text" class="text-gray-800 dark:text-gray-200 font-medium text-lg"></p>
        </div>
      </div>
      <div id="emotion-action" class="hidden">
        <button onclick="saveEmotion()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">记录并继续</button>
      </div>
    </div>
    <div class="card-modern p-6">
      <h3 class="font-bold text-gray-800 dark:text-white mb-4">近期情绪记录</h3>
      <div id="emotion-history" class="space-y-3"><p class="text-gray-400 text-center py-4">加载中...</p></div>
    </div>
  `;
  setTimeout(() => loadEmotionHistory(), 100);
  return div;
}

let selectedEmotion = null; selectedEnergy = 3;
function selectEmotion(type) {
  selectedEmotion = type;
  $$('.emotion-btn').forEach(btn => {
    if (btn.dataset.emotion === type) { btn.classList.add('selected', 'border-primary', 'bg-primary/10', 'dark:bg-primary/20'); btn.classList.remove('border-gray-100', 'dark:border-gray-700'); }
    else { btn.classList.remove('selected', 'border-primary', 'bg-primary/10', 'dark:bg-primary/20'); btn.classList.add('border-gray-100', 'dark:border-gray-700'); }
  });
  $('#emotion-energy').classList.remove('hidden');
  $('#emotion-cbt').classList.remove('hidden');
  $('#cbt-text').textContent = getEmotionCBT(type);
}
function selectEnergy(level) {
  selectedEnergy = level;
  $$('.energy-btn').forEach(btn => {
    const bl = parseInt(btn.dataset.energy);
    if (bl <= level) { btn.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.remove('border-gray-200', 'dark:border-gray-600'); }
    else { btn.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.add('border-gray-200', 'dark:border-gray-600'); }
  });
  $('#emotion-action').classList.remove('hidden');
}
async function saveEmotion() {
  if (!selectedEmotion) return;
  try {
    await api.post('/api/emotions', { emotion_type: selectedEmotion, energy_level: selectedEnergy, trigger_task: '', cbt_response: getEmotionCBT(selectedEmotion) });
    showToast('情绪已记录，去启动一个任务吧！');
    // 自动检查成就
    if (typeof autoCheckAchievements === 'function') {
      autoCheckAchievements();
    }
    navigate('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}
async function loadEmotionHistory() {
  try {
    const data = await api.get('/api/emotions');
    const container = $('#emotion-history');
    if (!data.emotions?.length) { container.innerHTML = '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无记录</p>'; return; }
    container.innerHTML = data.emotions.slice(0, 10).map(e => `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
        <span class="text-2xl">${getEmotionEmoji(e.emotion_type)}</span>
        <div class="flex-1"><p class="font-medium text-sm text-gray-800 dark:text-gray-200">${getEmotionLabel(e.emotion_type)} · 能量 ${e.energy_level}/5</p><p class="text-xs text-gray-400">${new Date(e.created_at).toLocaleString('zh-CN')}</p></div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// ========== 任务管理 ==========
function renderTasks() {
  const div = el('div', 'p-4 md:p-8 max-w-4xl mx-auto fade-in');
  div.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div><h2 class="text-2xl font-bold text-gray-800 dark:text-white">任务解剖台</h2><p class="text-gray-500 dark:text-gray-400">把模糊任务切成原子步骤</p></div>
      <div class="flex gap-2">
        <button onclick="showTaskTemplates()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm touch-btn"><i class="fas fa-magic mr-1"></i>模板</button>
        <button onclick="showTaskModal()" class="bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn"><i class="fas fa-plus mr-1"></i>新建</button>
      </div>
    </div>
    <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button onclick="filterTasks('all')" class="task-filter px-4 py-2 rounded-full text-sm font-medium bg-primary text-white whitespace-nowrap touch-btn" data-filter="all">全部</button>
      <button onclick="filterTasks('pending')" class="task-filter px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap touch-btn" data-filter="pending">待启动</button>
      <button onclick="filterTasks('in_progress')" class="task-filter px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap touch-btn" data-filter="in_progress">进行中</button>
      <button onclick="filterTasks('completed')" class="task-filter px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap touch-btn" data-filter="completed">已完成</button>
    </div>
    <!-- 排序工具栏 -->
    <div class="flex items-center gap-2 mb-4 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto pb-1">
      <span class="font-medium whitespace-nowrap"><i class="fas fa-sort mr-1"></i>排序：</span>
      <button onclick="setTaskSort('manual')" class="sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap" data-sort="manual">手动</button>
      <button onclick="setTaskSort('priority')" class="sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap" data-sort="priority">优先级</button>
      <button onclick="setTaskSort('due_date')" class="sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap" data-sort="due_date">截止日期</button>
      <button onclick="setTaskSort('status')" class="sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap" data-sort="status">状态</button>
      <button onclick="setTaskSort('created')" class="sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap" data-sort="created">创建时间</button>
    </div>
    <div class="mb-4">
      <input type="text" id="task-search" placeholder="搜索任务..." class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none transition-all" oninput="debouncedSearch()">
    </div>
    <div id="tasks-list" class="space-y-4">
      <div class="text-center py-12"><div class="skeleton h-20 rounded-2xl mb-3"></div><div class="skeleton h-20 rounded-2xl mb-3"></div><div class="skeleton h-20 rounded-2xl"></div></div>
    </div>
  `;
  setTimeout(() => loadTasks(), 100);
  return div;
}

let currentTaskFilter = 'all';
let taskSortBy = 'manual'; // manual | priority | due_date | status | created
const debouncedSearch = debounce(() => loadTasks(), 300);

async function loadTasks() {
  try {
    const search = $('#task-search')?.value?.trim();
    let params = currentTaskFilter !== 'all' ? `?status=${currentTaskFilter}` : '';
    if (search) params += (params ? '&' : '?') + `search=${encodeURIComponent(search)}`;
    const data = await api.get('/api/tasks' + params);
    var tasks = data.tasks || [];
    
    // 客户端排序
    if (taskSortBy === 'priority') {
      tasks.sort(function(a,b) { return (a.priority||99) - (b.priority||99); });
    } else if (taskSortBy === 'due_date') {
      tasks.sort(function(a,b) {
        if (!a.due_date) return 1; if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      });
    } else if (taskSortBy === 'status') {
      var st = { 'pending': 0, 'in_progress': 1, 'completed': 2 };
      tasks.sort(function(a,b) { return (st[a.status]||0) - (st[b.status]||0); });
    } else if (taskSortBy === 'created') {
      tasks.sort(function(a,b) { return a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0; });
    } else {
      // manual: 置顶优先, 然后按 sort_order
      tasks.sort(function(a,b) {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return (a.sort_order||0) - (b.sort_order||0);
      });
    }
    
    state.tasks = tasks;
    const container = $('#tasks-list');
    if (!tasks.length) {
      container.innerHTML = `<div class="text-center py-12"><i class="fas fa-clipboard text-4xl text-gray-300 dark:text-gray-600 mb-4"></i><p class="text-gray-500 dark:text-gray-400">还没有任务</p><button onclick="showTaskModal()" class="mt-4 text-primary font-medium">创建第一个任务</button></div>`;
      return;
    }
    container.innerHTML = tasks.map(function(task) {
      var isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
      return '<div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ' + (isOverdue ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30') + ' transition-all" draggable="true" data-task-id="' + task.id + '" ondragstart="onTaskDragStart(event)" ondragend="onTaskDragEnd(event)" ondrop="onTaskDrop(event)" ondragover="onTaskDragOver(event)">' +
        '<div class="flex items-start gap-3">' +
          // 左侧：拖拽手柄 + 图钉
          '<div class="flex flex-col items-center gap-1 pt-1">' +
            '<span class="drag-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400" title="拖拽排序"><i class="fas fa-grip-vertical" style="font-size:10px"></i></span>' +
            '<span onclick="togglePin(' + task.id + ',this)" class="cursor-pointer ' + (task.is_pinned ? 'text-indigo-500' : 'text-gray-300 hover:text-indigo-400 dark:text-gray-600 dark:hover:text-indigo-400') + '" title="' + (task.is_pinned ? '取消置顶' : '置顶') + '"><i class="fas fa-thumbtack" style="font-size:10px"></i></span>' +
          '</div>' +
          // 中间：内容
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2 mb-1">' +
              '<span class="w-2 h-2 rounded-full shrink-0 ' + ({1:'bg-red-500',2:'bg-orange-500',3:'bg-yellow-500',4:'bg-green-500',5:'bg-gray-400'}[task.priority] || 'bg-gray-300') + '"></span>' +
              '<h4 class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">' + escapeHtml(task.title) + '</h4>' +
              (task.priority ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-medium ' + getPriorityStyle(task.priority) + '">P' + task.priority + '</span>' : '') +
              '<span class="px-2 py-0.5 rounded-full text-[10px] font-medium ' + getStatusStyle(task.status) + ' shrink-0">' + getStatusLabel(task.status) + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-3 text-[11px] text-gray-400">' +
              '<span><i class="fas fa-tag mr-0.5" style="font-size:8px"></i>' + (task.category||'general') + '</span>' +
              '<span><i class="fas fa-shoe-prints mr-0.5" style="font-size:8px"></i>' + (task.steps_count||0) + '步</span>' +
              (task.due_date ? '<span class="' + (isOverdue ? 'text-red-500 font-medium' : '') + '"><i class="fas fa-calendar mr-0.5" style="font-size:8px"></i>' + task.due_date + (isOverdue ? ' ⚠️' : '') + '</span>' : '') +
            '</div>' +
            (task.description ? '<p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 truncate">' + escapeHtml(task.description) + '</p>' : '') +
          '</div>' +
          // 右侧：操作
          '<div class="flex flex-col gap-1 shrink-0">' +
            '<button onclick="navigate(\'task-detail\', {id: ' + task.id + '})" class="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-all touch-btn whitespace-nowrap">拆解</button>' +
            (task.status !== 'completed' ? '<button onclick="quickMicroStart(' + task.id + ')" class="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-all touch-btn whitespace-nowrap">启动</button>' : '') +
            '<button onclick="deleteTask(' + task.id + ')" class="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/20 transition-all touch-btn"><i class="fas fa-trash" style="font-size:9px"></i></button>' +
          '</div>' +
        '</div></div>';
    }).join('');
  } catch (err) {
    $('#tasks-list').innerHTML = '<div class="text-center py-12 text-danger"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p class="mb-2">加载失败</p><button onclick="loadTasks()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重试</button></div>';
  }
}

function setTaskSort(sort) {
  taskSortBy = sort;
  // 高亮当前排序按钮
  document.querySelectorAll('.sort-btn').forEach(function(btn) {
    if (btn.dataset.sort === sort) {
      btn.className = 'sort-btn px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium whitespace-nowrap';
    } else {
      btn.className = 'sort-btn px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap';
    }
  });
  loadTasks();
}

// 置顶切换
async function togglePin(taskId, el) {
  var task = state.tasks.find(function(t) { return t.id === taskId; });
  if (!task) return;
  var newVal = task.is_pinned ? 0 : 1;
  try {
    await api.put('/api/tasks/' + taskId, { is_pinned: newVal });
    task.is_pinned = newVal;
    el.className = 'cursor-pointer ' + (newVal ? 'text-indigo-500' : 'text-gray-300 hover:text-indigo-400 dark:text-gray-600 dark:hover:text-indigo-400');
    el.title = newVal ? '取消置顶' : '置顶';
    loadTasks();
  } catch(e) { showToast('操作失败', 'error'); }
}

// 拖拽排序
var dragTaskId = null;

function onTaskDragStart(e) {
  dragTaskId = e.target.closest('[data-task-id]')?.dataset?.taskId;
  e.target.closest('[data-task-id]')?.classList.add('opacity-40');
  e.dataTransfer.effectAllowed = 'move';
}

function onTaskDragEnd(e) {
  e.target.closest('[data-task-id]')?.classList.remove('opacity-40');
  if (!dragTaskId) return;
  // 获取新排序
  var items = document.querySelectorAll('[data-task-id]');
  var orders = [];
  items.forEach(function(el, idx) {
    var id = parseInt(el.dataset.taskId);
    if (id) orders.push({ id: id, sort_order: idx });
  });
  api.post('/api/tasks/reorder', { orders: orders }).catch(function() {});
  dragTaskId = null;
}

function onTaskDragOver(e) {
  e.preventDefault();
  var target = e.target.closest('[data-task-id]');
  if (!target || target.dataset.taskId === dragTaskId) return;
  var rect = target.getBoundingClientRect();
  var mid = rect.top + rect.height / 2;
  if (e.clientY < mid) {
    target.parentNode.insertBefore(document.querySelector('[data-task-id="' + dragTaskId + '"]'), target);
  } else {
    target.parentNode.insertBefore(document.querySelector('[data-task-id="' + dragTaskId + '"]'), target.nextSibling);
  }
}

function filterTasks(filter) {
  currentTaskFilter = filter;
  $$('.task-filter').forEach(btn => {
    if (btn.dataset.filter === filter) { btn.classList.add('bg-primary', 'text-white'); btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-600', 'dark:text-gray-300'); }
    else { btn.classList.remove('bg-primary', 'text-white'); btn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-600', 'dark:text-gray-300'); }
  });
  loadTasks();
}

// 任务模板
const taskTemplates = [
  { title: '写一篇文章', category: 'work', difficulty: 4, steps: ['打开编辑器，写下标题', '列出3个要点', '写第一段（100字）', '完成剩余段落'] },
  { title: '整理房间', category: 'life', difficulty: 2, steps: ['把床上的衣服叠好', '清理桌面', '把地板上的物品归位', '倒垃圾'] },
  { title: '学习新技能', category: 'study', difficulty: 3, steps: ['打开学习网站', '观看第一个视频（10分钟）', '做第一个练习', '记录笔记'] },
  { title: '健身运动', category: 'health', difficulty: 3, steps: ['穿上运动鞋', '做5分钟热身', '完成一组训练', '做拉伸'] },
  { title: '回复邮件', category: 'work', difficulty: 2, steps: ['打开邮箱', '标记最重要的3封', '回复第一封', '回复剩余邮件'] }
];

function showTaskTemplates() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-xl text-gray-800 dark:text-white">任务模板</h3>
        <button onclick="this.closest('.fixed').remove()" aria-label="关闭" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button>
      </div>
      <div class="space-y-3 max-h-96 overflow-y-auto">
        ${taskTemplates.map((t, i) => `
          <div class="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-pointer" onclick="useTemplate(${i})">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><i class="fas fa-${getCategoryIcon(t.category)}"></i></div>
              <div><p class="font-medium text-gray-800 dark:text-white">${t.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${t.steps.length} 个步骤 · 难度 ${'★'.repeat(t.difficulty)}</p></div>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              ${t.steps.slice(0, 3).map(s => `<p>• ${s}</p>`).join('')}
              ${t.steps.length > 3 ? `<p class="text-gray-400">... 还有 ${t.steps.length - 3} 个步骤</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function useTemplate(idx) {
  const t = taskTemplates[idx];
  try {
    const res = await api.post('/api/tasks', { title: t.title, category: t.category, difficulty: t.difficulty });
    const taskId = res.taskId;
    for (const step of t.steps) {
      await api.post(`/api/tasks/${taskId}/steps`, { title: step, duration: 2 });
    }
    showToast('模板任务已创建');
    $('.fixed').remove();
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

function showTaskModal() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-xl text-gray-800 dark:text-white">新建任务</h3>
        <button onclick="this.closest('.fixed').remove()" aria-label="关闭" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button>
      </div>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">任务标题</label>
          <input type="text" id="new-task-title" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" placeholder="例如：写论文、整理房间" onkeydown="if(event.key==='Enter')createTask()"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述（可选）</label>
          <textarea id="new-task-desc" rows="2" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none" placeholder="补充说明..."></textarea></div>
        <div class="grid grid-cols-3 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <select id="new-task-category" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="general">一般</option><option value="work">工作</option><option value="study">学习</option><option value="health">健康</option><option value="life">生活</option><option value="social">社交</option>
            </select></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">难度</label>
            <select id="new-task-difficulty" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="1">⭐ 非常简单</option><option value="2">⭐⭐ 简单</option><option value="3" selected>⭐⭐⭐ 中等</option><option value="4">⭐⭐⭐⭐ 困难</option><option value="5">⭐⭐⭐⭐⭐ 非常困难</option>
            </select></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
            <select id="new-task-priority" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="1">🔴 紧急重要</option><option value="2">🟠 紧急不重要</option><option value="3" selected>🟡 重要不紧急</option><option value="4">🟢 不紧急不重要</option><option value="5">⚪ 可延期</option>
            </select></div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">截止日期（可选）</label>
          <input type="date" id="new-task-due" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"></div>
      </div>
      <div class="mt-6"><button onclick="createTask()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">创建任务</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function createTask() {
  const title = $('#new-task-title').value.trim();
  if (!title) { showToast('请输入任务标题', 'error'); return; }
  try {
    await api.post('/api/tasks', {
      title, description: $('#new-task-desc').value,
      category: $('#new-task-category').value,
      difficulty: parseInt($('#new-task-difficulty').value),
      priority: parseInt($('#new-task-priority').value),
      due_date: $('#new-task-due').value || null
    });
    showToast('任务创建成功');
    $('.fixed').remove();
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteTask(id) {
  var confirmed = await showConfirmModal('确定要删除这个任务吗？所有相关数据也会被删除。', '删除');
  if (!confirmed) return;
  try { await api.del(`/api/tasks/${id}`); showDeleteUndo('任务已删除', function() { /* 无后端撤销，至少 UI 提醒 */ }); loadTasks(); }
  catch (err) { showToast(err.message, 'error'); }
}

function quickMicroStart(taskId) {
  state.activeTask = taskId;
  navigate('micro-start');
}

// ========== 任务详情 ==========
async function renderTaskDetail() {
  const taskId = state.pageParams?.id;
  if (!taskId) { navigate('tasks'); return; }
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  try {
    const taskData = await api.get('/api/tasks');
    const task = taskData.tasks.find(t => t.id == taskId);
    if (!task) { navigate('tasks'); return; }
    const stepsData = await api.get(`/api/tasks/${taskId}/steps`);
    const steps = stepsData.steps || [];

    div.innerHTML = `
      <div class="mb-6">
        <button onclick="navigate('tasks')" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2 flex items-center gap-1"><i class="fas fa-arrow-left"></i>返回</button>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${escapeHtml(task.title)}</h2>
        <p class="text-gray-500 dark:text-gray-400">${escapeHtml(task.description || '无描述')}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div class="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700">${task.category}</span>
          <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700">难度 ${'★'.repeat(task.difficulty)}${'☆'.repeat(5-task.difficulty)}</span>
          ${task.priority ? `<span class="px-3 py-1 rounded-full ${getPriorityStyle(task.priority)} cursor-pointer hover:opacity-80" onclick="showPriorityModal(${task.id}, ${task.priority})">${getPriorityLabel(task.priority)} · 点击编辑</span>` : '<span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onclick="showPriorityModal('+task.id+', 3)">设置优先级</span>'}
          <span class="px-3 py-1 rounded-full ${getStatusStyle(task.status)}">${getStatusLabel(task.status)}</span>
          ${task.due_date ? `<span class="px-3 py-1 rounded-full ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700'}"><i class="fas fa-calendar mr-1"></i>${task.due_date}${new Date(task.due_date) < new Date() && task.status !== 'completed' ? ' ⚠️' : ''}</span>` : ''}
        </div>
        <div class="flex gap-2">
          ${task.status !== 'completed' ? `
            <button onclick="updateTaskStatus(${taskId}, 'completed')" class="flex-1 bg-secondary text-white py-2 rounded-xl font-medium hover:bg-secondary/90 transition-all touch-btn"><i class="fas fa-check mr-1"></i>标记完成</button>
            <button onclick="startStepMicro(${taskId})" class="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn"><i class="fas fa-play"></i></button>
          ` : `<button onclick="updateTaskStatus(${taskId}, 'pending')" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-undo mr-1"></i>重新打开</button>`}
          <button onclick="deleteTask(${taskId}); navigate('tasks')" aria-label="删除任务" class="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-danger hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="card-modern p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-800 dark:text-white flex items-center gap-2"><i class="fas fa-shoe-prints text-primary"></i>原子步骤</h3>
          <button onclick="showStepModal(${taskId})" class="text-sm text-primary hover:underline"><i class="fas fa-plus mr-1"></i>添加</button>
        </div>
        ${steps.length === 0 ? `
          <div class="text-center py-8">
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-4">
              <p class="text-gray-600 dark:text-gray-300 font-medium mb-2">🤔 这个任务看起来有点模糊？</p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">试着问自己："这个任务里，有没有一个2分钟就能完成的子动作？"</p>
              <div class="text-left space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>❌ "写论文" → ✅ "打开文档，写下论文标题"</p>
                <p>❌ "健身" → ✅ "穿上运动鞋，走到小区门口"</p>
                <p>❌ "整理房间" → ✅ "把床上的衣服叠好"</p>
              </div>
            </div>
            <button onclick="showStepModal(${taskId})" class="px-4 py-2 bg-primary text-white rounded-lg touch-btn">添加第一个步骤</button>
          </div>
        ` : `
          <div class="space-y-3">
            ${steps.map((step, i) => `
              <div class="step-card flex items-center gap-3 p-4 rounded-xl border ${step.status === 'completed' ? 'border-secondary/30 bg-secondary/5 dark:bg-secondary/10' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}">
                <button onclick="toggleStep(${step.id}, '${step.status}')" class="w-8 h-8 rounded-full flex items-center justify-center transition-all ${step.status === 'completed' ? 'bg-secondary text-white' : 'border-2 border-gray-300 dark:border-gray-600 text-transparent hover:border-primary'} touch-btn">
                  <i class="fas fa-check text-sm"></i>
                </button>
                <div class="flex-1">
                  <p class="font-medium ${step.status === 'completed' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}">${step.title}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${step.duration}分钟 · 步骤 ${i+1}</p>
                </div>
                <button onclick="startStepMicro(${taskId}, ${step.id})" class="px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">启动</button>
              </div>
            `).join('')}
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1"><span>完成进度</span><span>${steps.filter(s => s.status === 'completed').length}/${steps.length}</span></div>
            <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all" style="width:${(steps.filter(s => s.status === 'completed').length / steps.length * 100)}%"></div>
            </div>
          </div>
        `}
      </div>
      <div class="bg-gradient-to-r from-accent/10 to-warm/10 dark:from-accent/20 dark:to-warm/20 rounded-2xl p-6 border border-accent/10 dark:border-accent/20">
        <h4 class="font-medium text-gray-800 dark:text-white mb-2 flex items-center gap-2"><i class="fas fa-lightbulb text-accent"></i>拆解建议</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">如果任务让你感到抗拒，试着把它拆成更小的步骤。每个步骤应该能在2分钟内开始。</p>
      </div>
    `;
  } catch (err) { div.innerHTML = '<div class="text-center py-12 text-danger"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p class="mb-2">加载失败</p><button onclick="renderTaskDetail()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重试</button></div>'; }
  return div;
}

async function updateTaskStatus(id, status) {
  try { 
    await api.put(`/api/tasks/${id}`, { status }); 
    showToast(status === 'completed' ? '任务已完成！' : '任务已重新打开'); 
    // 自动检查成就
    if (typeof autoCheckAchievements === 'function') {
      autoCheckAchievements();
    }
    navigate('task-detail', { id }); 
  }
  catch (err) { showToast(err.message, 'error'); }
}
async function updateTaskPriority(taskId, priority) {
  try { await api.put(`/api/tasks/${taskId}`, { priority }); showToast('优先级已更新'); navigate('task-detail', { id: taskId }); }
  catch (err) { showToast(err.message, 'error'); }
}
async function toggleStep(stepId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  try { await api.put(`/api/steps/${stepId}`, { status: newStatus }); navigate('task-detail', { id: state.pageParams.id }); }
  catch (err) { showToast(err.message, 'error'); }
}
function showStepModal(taskId) {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6"><h3 class="font-bold text-xl text-gray-800 dark:text-white">添加原子步骤</h3><button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button></div>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">步骤描述</label>
          <input type="text" id="new-step-title" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" placeholder="例如：打开文档，写下标题" onkeydown="if(event.key==='Enter')createStep(${taskId})"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">预计时长</label>
          <div class="flex gap-2">${[2,5,10,15,25].map(m=>`<button onclick="selectStepDuration(${m})" class="step-dur-btn flex-1 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary transition-all text-sm touch-btn" data-duration="${m}">${m}分</button>`).join('')}</div></div>
      </div>
      <div class="mt-6"><button onclick="createStep(${taskId})" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">添加步骤</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  selectStepDuration(2);
}
let selectedStepDuration = 2;
function selectStepDuration(mins) {
  selectedStepDuration = mins;
  $$('.step-dur-btn').forEach(btn => {
    if (parseInt(btn.dataset.duration) === mins) { btn.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.remove('border-gray-200', 'dark:border-gray-600'); }
    else { btn.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.add('border-gray-200', 'dark:border-gray-600'); }
  });
}
async function createStep(taskId) {
  const title = $('#new-step-title').value.trim();
  if (!title) { showToast('请输入步骤描述', 'error'); return; }
  try { await api.post(`/api/tasks/${taskId}/steps`, { title, duration: selectedStepDuration, order_index: 0 }); showToast('步骤添加成功'); $('.fixed').remove(); navigate('task-detail', { id: taskId }); }
  catch (err) { showToast(err.message, 'error'); }
}
function startStepMicro(taskId, stepId) {
  state.activeTask = taskId; state.activeStep = stepId;
  navigate('micro-start');
}

function showPriorityModal(taskId, currentPriority) {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-xl text-gray-800 dark:text-white">设置优先级</h3>
        <button onclick="this.closest('.fixed').remove()" aria-label="关闭" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button>
      </div>
      <div class="space-y-3">
        ${[1,2,3,4,5].map(p => `
          <button onclick="updateTaskPriority(${taskId}, ${p}); this.closest('.fixed').remove();" class="w-full p-4 rounded-xl border-2 transition-all text-left touch-btn ${p == currentPriority ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-100 dark:border-gray-700 hover:border-primary/30'}">
            <div class="flex items-center justify-between">
              <span class="font-medium text-gray-800 dark:text-white">${getPriorityLabel(p)}</span>
              ${p == currentPriority ? '<i class="fas fa-check text-primary"></i>' : ''}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${p === 1 ? '必须立即处理' : p === 2 ? '需要快速处理' : p === 3 ? '重要但不急' : p === 4 ? '可以稍后处理' : '可以无限延期'}</p>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ========== 微启动 ==========

// 从周视图同步任务的描述中提取短标签（如 "周一 06:30-07:30"）
function getTaskShortLabel(desc) {
  if (!desc || desc.indexOf('[周视图导入]') !== 0) return '';
  var parts = desc.replace('[周视图导入] ', '').split(' | ');
  return parts[0] || '';
}

function renderMicroStart() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800 dark:text-white">2分钟契约</h2><p class="text-gray-500 dark:text-gray-400">只做2分钟，然后自由选择</p></div>
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择任务</label>
        <select id="micro-task-select" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" onchange="onMicroTaskChange()"><option value="">-- 选择任务 --</option></select>
      </div>
      <div id="micro-step-select-container" class="mb-6 hidden">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择步骤（可选）</label>
        <select id="micro-step-select" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"><option value="">-- 整个任务 --</option></select>
      </div>
      <div class="text-center py-8">
        <div class="relative w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-6">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 192 192"><circle cx="96" cy="96" r="88" stroke="currentColor" stroke-width="8" fill="none" class="text-gray-100 dark:text-gray-700"/>
            <circle id="timer-progress" cx="96" cy="96" r="88" stroke="url(#gradient)" stroke-width="8" fill="none" stroke-dasharray="553" stroke-dashoffset="0" stroke-linecap="round" class="timer-circle"/>
            <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#4F46E5"/><stop offset="100%" style="stop-color:#10B981"/></linearGradient></defs>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span id="timer-display" class="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white">02:00</span>
            <span id="timer-status" class="text-sm text-gray-500 dark:text-gray-400 mt-1">准备开始</span>
          </div>
        </div>
        <div class="flex gap-3 justify-center flex-wrap">
          <button id="timer-btn-start" onclick="startTimer()" class="px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn"><i class="fas fa-play mr-2"></i>开始契约</button>
          <button id="timer-btn-stop" onclick="stopTimer()" class="hidden px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-pause mr-2"></i>暂停</button>
          <button id="timer-btn-done" onclick="finishTimer(true)" class="hidden px-8 py-3 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/25 touch-btn"><i class="fas fa-check mr-2"></i>完成契约</button>
        </div>
      </div>
      <div class="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 border border-primary/10 dark:border-primary/20">
        <p class="text-sm text-gray-600 dark:text-gray-400 text-center"><i class="fas fa-handshake text-primary mr-1"></i>你与自己的契约：只做2分钟，2分钟后你可以自由选择停止或继续。</p>
      </div>
    </div>
    <div class="card-modern p-6">
      <h3 class="font-bold text-gray-800 dark:text-white mb-4">近期微启动记录</h3>
      <div id="micro-history" class="space-y-3"><p class="text-gray-400 dark:text-gray-500 text-center py-4">加载中...</p></div>
    </div>
  `;
  setTimeout(() => { loadMicroTaskOptions(); loadMicroHistory(); restoreTimerState(); if (state.timerRunning) resumeTimerUI(); }, 100);
  return div;
}

async function loadMicroTaskOptions() {
  try {
    const data = await api.get('/api/tasks');
    const select = $('#micro-task-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- 选择任务 --</option>';
    data.tasks.filter(t => t.status !== 'completed').forEach(task => {
      const opt = document.createElement('option'); opt.value = task.id;
      var label = task.title;
      if (task.due_date) label += ' (' + task.due_date;
      var tl = getTaskShortLabel(task.description);
      if (tl) label += ' ' + tl;
      if (task.due_date) label += ')';
      opt.textContent = label;
      if (state.activeTask == task.id) opt.selected = true;
      select.appendChild(opt);
    });
    if (state.activeTask) onMicroTaskChange();
  } catch (err) { console.error(err); }
}
async function onMicroTaskChange() {
  const taskId = $('#micro-task-select').value;
  const container = $('#micro-step-select-container');
  const select = $('#micro-step-select');
  if (!taskId) { container.classList.add('hidden'); return; }
  try {
    const data = await api.get(`/api/tasks/${taskId}/steps`);
    select.innerHTML = '<option value="">-- 整个任务 --</option>';
    data.steps.forEach(step => { const opt = document.createElement('option'); opt.value = step.id; opt.textContent = step.title; if (state.activeStep == step.id) opt.selected = true; select.appendChild(opt); });
    container.classList.remove('hidden');
  } catch (err) { console.error(err); }
}

timerStartTime = null; // timerInterval/timerSeconds/timerTotal/timerRunning 已在全局声明
function resumeTimerUI() {
  // 修复: 恢复前先清除可能残留的旧 interval
  if (timerInterval) clearInterval(timerInterval);
  $('#timer-btn-start').classList.add('hidden');
  $('#timer-btn-stop').classList.remove('hidden');
  $('#timer-btn-done').classList.remove('hidden');
  $('#timer-status').textContent = '契约进行中...';
  $('#timer-status').classList.add('text-primary', 'font-medium');

  // 修复 FE-009: 使用 Date.now() 差值计算，避免 setInterval 漂移
  // 使用全局 timerStartTime 以便 finishTimer 可以访问
  window.timerStartTime = Date.now();
  const timerDuration = timerSeconds * 1000;

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - window.timerStartTime;
    timerSeconds = Math.max(0, Math.ceil((timerDuration - elapsed) / 1000));
    updateTimerDisplay();
    saveTimerState();
    if (timerSeconds <= 0) { 
      clearInterval(timerInterval); 
      timerRunning = false; 
      $('#timer-status').textContent = '契约完成！你可以选择继续或停止'; 
      $('#timer-status').classList.add('text-secondary'); 
      showToast('2分钟契约已完成！🎉'); 
      safeStorage.remove('timer_state'); 
    }
  }, 1000);  // 优化: 秒级精度, 每秒更新一次
}
function startTimer() {
  const taskId = $('#micro-task-select').value;
  if (!taskId) { showToast('请先选择一个任务', 'error'); return; }
  timerRunning = true; window.timerStartTime = Date.now(); timerSeconds = timerTotal;
  resumeTimerUI();
}
function stopTimer() {
  clearInterval(timerInterval); timerRunning = false;
  $('#timer-btn-start').classList.remove('hidden');
  $('#timer-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>继续';
  $('#timer-btn-stop').classList.add('hidden');
  $('#timer-status').textContent = '已暂停';
  saveTimerState();
}
function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60), secs = timerSeconds % 60;
  $('#timer-display').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  const progress = (timerSeconds / timerTotal) * 553;
  $('#timer-progress').style.strokeDashoffset = 553 - progress;
}
async function finishTimer(continued) {
  clearInterval(timerInterval); timerRunning = false;
  const taskId = $('#micro-task-select').value;
  const stepId = $('#micro-step-select').value || null;
  const actualDuration = Math.round((Date.now() - window.timerStartTime) / 1000 / 60);
  try {
    await api.post('/api/micro-starts', { task_id: taskId ? parseInt(taskId) : null, step_id: stepId ? parseInt(stepId) : null, planned_duration: 2, actual_duration: actualDuration, continued_after_contract: continued });
    showToast(continued ? '太棒了！你选择了继续！' : '很好，你完成了契约！');
    // 自动检查成就
    if (typeof autoCheckAchievements === 'function') {
      autoCheckAchievements();
    }
    timerSeconds = timerTotal; updateTimerDisplay();
    $('#timer-btn-start').classList.remove('hidden'); $('#timer-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>开始契约';
    $('#timer-btn-stop').classList.add('hidden'); $('#timer-btn-done').classList.add('hidden');
    $('#timer-status').textContent = '准备开始'; $('#timer-status').classList.remove('text-primary', 'text-secondary', 'font-medium');
    state.activeTask = null; state.activeStep = null; safeStorage.remove('timer_state');
    loadMicroHistory();
  } catch (err) { showToast(err.message, 'error'); }
}
async function loadMicroHistory() {
  try {
    const data = await api.get('/api/micro-starts');
    const container = $('#micro-history');
    if (!container) return;
    if (!data.microStarts?.length) { container.innerHTML = '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无记录</p>'; return; }
    container.innerHTML = data.microStarts.slice(0, 10).map(ms => `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
        <div class="w-10 h-10 rounded-full ${ms.continued_after_contract ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'} flex items-center justify-center"><i class="fas fa-${ms.continued_after_contract ? 'check-double' : 'check'}"></i></div>
        <div class="flex-1 min-w-0"><p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">${ms.task_title || '自由启动'}${ms.task_due_date ? `<span class="text-gray-400 dark:text-gray-500 font-normal"> (${ms.task_due_date})</span>` : ''}</p>${(function(){var tl=ms.task_desc?getTaskShortLabel(ms.task_desc):'';return tl?'<p class="text-xs text-gray-400 dark:text-gray-500 truncate">'+tl+'</p>':''})()}${ms.step_title ? `<p class="text-xs text-primary truncate mt-0.5"><i class="fas fa-list-ol mr-1"></i>${ms.step_title}</p>` : ''}<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${ms.actual_duration}分钟 · ${new Date(ms.created_at).toLocaleString('zh-CN')}</p></div>
        ${ms.continued_after_contract ? '<span class="text-xs text-secondary font-medium">继续了</span>' : ''}
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// ========== 番茄钟 ==========
function renderPomodoro() {
  const d = getPomoDurations();
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-white">番茄钟</h2>
      <p class="text-gray-500 dark:text-gray-400">${d.work/60}分钟专注 + ${d.shortBreak/60}分钟休息</p>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择任务（可选）</label>
        <select id="pomo-task-select" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"><option value="">-- 自由番茄 --</option></select>
      </div>
      <div class="text-center py-8">
        <div id="pomo-timer-container" class="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto mb-6">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 224 224">
            <circle cx="112" cy="112" r="100" stroke="currentColor" stroke-width="10" fill="none" class="text-gray-100 dark:text-gray-700"/>
            <circle id="pomo-progress" cx="112" cy="112" r="100" stroke="url(#pomoGradient)" stroke-width="10" fill="none" stroke-dasharray="628" stroke-dashoffset="0" stroke-linecap="round" class="timer-circle"/>
            <defs><linearGradient id="pomoGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#EF4444"/><stop offset="100%" style="stop-color:#F97316"/></linearGradient></defs>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span id="pomo-display" class="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white">${getPomoDurations().work / 60}:00</span>
            <span id="pomo-mode" class="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">专注时间</span>
            <span id="pomo-round" class="text-xs text-gray-400 dark:text-gray-500 mt-1">第 1 轮</span>
          </div>
        </div>
        <div class="flex gap-3 justify-center flex-wrap">
          <button id="pomo-btn-start" onclick="startPomodoro()" class="px-8 py-3 bg-danger text-white rounded-xl font-medium hover:bg-danger/90 transition-all shadow-lg shadow-danger/25 touch-btn"><i class="fas fa-play mr-2"></i>开始专注</button>
          <button id="pomo-btn-pause" onclick="pausePomodoro()" class="hidden px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-pause mr-2"></i>暂停</button>
          <button id="pomo-btn-skip" onclick="skipPomodoro()" class="hidden px-6 py-3 bg-accent/10 text-accent rounded-xl font-medium hover:bg-accent/20 transition-all touch-btn"><i class="fas fa-forward mr-1"></i>跳过</button>
          <button id="pomo-btn-reset" onclick="resetPomodoro()" class="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重置</button>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-2xl font-bold text-danger" id="pomo-total-focus">0</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">专注次数</p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-2xl font-bold text-secondary" id="pomo-total-min">0</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">专注分钟</p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-2xl font-bold text-primary" id="pomo-current-streak">0</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">当前轮次</p>
        </div>
      </div>
    </div>
    <div class="card-modern p-6">
      <h3 class="font-bold text-gray-800 dark:text-white mb-4">近期番茄记录</h3>
      <div id="pomo-history" class="space-y-3"><p class="text-gray-400 dark:text-gray-500 text-center py-4">加载中...</p></div>
    </div>
  `;
  setTimeout(() => { loadPomoTaskOptions(); loadPomodoroHistory(); updatePomoStats(); }, 100);
  return div;
}

async function loadPomoTaskOptions() {
  try {
    const data = await api.get('/api/tasks');
    const select = $('#pomo-task-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- 自由番茄 --</option>';
    data.tasks.filter(t => t.status !== 'completed').forEach(task => { const opt = document.createElement('option'); opt.value = task.id; var lbl = task.title; if (task.due_date) lbl += ' (' + task.due_date; var tl = getTaskShortLabel(task.description); if (tl) lbl += ' ' + tl; if (task.due_date) lbl += ')'; opt.textContent = lbl; select.appendChild(opt); });
  } catch (err) { console.error(err); }
}

// pomoInterval/pomoSeconds/pomoTotal/pomoRunning/pomoMode/pomoRound/pomoFocusCount 已在全局声明
function getPomoDurations() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  return {
    work: (prefs.pomodoroWork || 25) * 60,
    shortBreak: (prefs.pomodoroBreak || 5) * 60,
    longBreak: 15 * 60
  };
}

function startPomodoro() {
  pomoRunning = true;
  $('#pomo-btn-start').classList.add('hidden');
  $('#pomo-btn-pause').classList.remove('hidden');
  $('#pomo-btn-skip').classList.remove('hidden');
  $('#pomo-mode').textContent = pomoMode === 'work' ? '专注时间' : pomoMode === 'short_break' ? '短休息' : '长休息';
  $('#pomo-mode').className = `text-sm font-medium mt-2 ${pomoMode === 'work' ? 'text-danger' : 'text-secondary'}`;
  document.querySelector('#pomo-timer-container')?.classList.add(pomoMode === 'work' ? 'pomodoro-active' : 'pomodoro-break');

  // 修复 FE-009: 使用 Date.now() 差值计算，避免 setInterval 漂移
  // 使用全局 pomoStartTime 以便 completePomodoroRound 可以访问
  window.pomoStartTime = Date.now();
  const pomoDuration = pomoSeconds * 1000;

  pomoInterval = setInterval(() => {
    const elapsed = Date.now() - window.pomoStartTime;
    pomoSeconds = Math.max(0, Math.ceil((pomoDuration - elapsed) / 1000));
    updatePomoDisplay();
    if (pomoSeconds <= 0) {
      clearInterval(pomoInterval);
      pomoRunning = false;
      completePomodoroRound();
    }
  }, 1000);  // 优化: 秒级精度, 每秒更新一次
}

function pausePomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>继续';
  $('#pomo-btn-pause').classList.add('hidden');
  document.querySelector('#pomo-timer-container')?.classList.remove('pomodoro-active', 'pomodoro-break');
}

function skipPomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  completePomodoroRound(true);
}

function resetPomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  const d = getPomoDurations();
  pomoMode = 'work'; pomoSeconds = d.work; pomoTotal = d.work; pomoRound = 1;
  updatePomoDisplay();
  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>开始专注';
  $('#pomo-btn-pause').classList.add('hidden'); $('#pomo-btn-skip').classList.add('hidden');
  $('#pomo-mode').textContent = '专注时间'; $('#pomo-mode').className = 'text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium';
  document.querySelector('.relative.w-48')?.classList.remove('pomodoro-active', 'pomodoro-break');
}

function updatePomoDisplay() {
  const mins = Math.floor(pomoSeconds / 60), secs = pomoSeconds % 60;
  $('#pomo-display').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  const progress = (pomoSeconds / pomoTotal) * 628;
  $('#pomo-progress').style.strokeDashoffset = 628 - progress;
  $('#pomo-round').textContent = `第 ${pomoRound} 轮`;
}

async function completePomodoroRound(skipped = false) {
  const taskId = $('#pomo-task-select')?.value || null;
  const duration = Math.round((pomoTotal - pomoSeconds) / 60);

  if (pomoMode === 'work' && !skipped) {
    pomoFocusCount++;
    try {
      await api.post('/api/pomodoro', { task_id: taskId ? parseInt(taskId) : null, duration: Math.max(1, duration), completed: 1 });
      showToast('🍅 番茄完成！休息一下吧');
      // 自动检查成就
      if (typeof autoCheckAchievements === 'function') {
        autoCheckAchievements();
      }
      updatePomoStats();
      loadPomodoroHistory();
    } catch (err) { console.error(err); }
  }

  // 切换模式
  const d = getPomoDurations();
  if (pomoMode === 'work') {
    pomoMode = pomoRound % 4 === 0 ? 'long_break' : 'short_break';
    pomoSeconds = pomoMode === 'long_break' ? d.longBreak : d.shortBreak;
    showToast(pomoMode === 'long_break' ? '长休息时间（15分钟）' : '短休息时间（' + (d.shortBreak/60) + '分钟）');
  } else {
    pomoMode = 'work'; pomoSeconds = d.work; pomoRound++;
    showToast('休息结束，开始下一轮专注！');
  }
  pomoTotal = pomoSeconds;
  updatePomoDisplay();

  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = `<i class="fas fa-play mr-2"></i>开始${pomoMode === 'work' ? '专注' : '休息'}`;
  $('#pomo-btn-pause').classList.add('hidden'); $('#pomo-btn-skip').classList.add('hidden');
  $('#pomo-mode').textContent = pomoMode === 'work' ? '专注时间' : pomoMode === 'short_break' ? '短休息' : '长休息';
  document.querySelector('.relative.w-48')?.classList.remove('pomodoro-active', 'pomodoro-break');
}

async function updatePomoStats() {
  try {
    const data = await api.get('/api/pomodoro');
    const sessions = data.sessions || [];
    const completed = sessions.filter(s => s.completed);
    $('#pomo-total-focus').textContent = completed.length;
    $('#pomo-total-min').textContent = completed.reduce((a, s) => a + (s.duration || 25), 0);
    $('#pomo-current-streak').textContent = pomoRound;
  } catch (err) { console.error(err); }
}

async function loadPomodoroHistory() {
  try {
    const data = await api.get('/api/pomodoro');
    const container = $('#pomo-history');
    if (!container) return;
    if (!data.sessions?.length) { container.innerHTML = '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无记录</p>'; return; }
    container.innerHTML = data.sessions.slice(0, 10).map(s => `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
        <div class="w-10 h-10 rounded-full ${s.completed ? 'bg-danger/10 text-danger' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'} flex items-center justify-center"><i class="fas fa-${s.completed ? 'check' : 'times'}"></i></div>
        <div class="flex-1 min-w-0"><p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">${s.task_title || '自由番茄'}${s.task_due_date ? `<span class="text-gray-400 dark:text-gray-500 font-normal"> (${s.task_due_date})</span>` : ''}</p>${(function(){var tl=s.task_desc?getTaskShortLabel(s.task_desc):'';return tl?'<p class="text-xs text-gray-400 dark:text-gray-500 truncate">'+tl+'</p>':''})()}<p class="text-xs text-gray-500 dark:text-gray-400">${s.duration}分钟 · ${new Date(s.created_at).toLocaleString('zh-CN')}</p></div>
        ${s.completed ? '<span class="text-xs text-danger font-medium">已完成</span>' : '<span class="text-xs text-gray-400">未完成</span>'}
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// ========== 拖延实验室 ==========
async function renderLab() {
  const div = el('div', 'p-4 md:p-8 max-w-4xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800 dark:text-white">拖延模式实验室</h2><p class="text-gray-500 dark:text-gray-400">从自我批判转向数据化自我观察</p></div>
    <div id="lab-content"><div class="text-center py-12"><i class="fas fa-spinner fa-spin text-2xl text-primary"></i><p class="mt-2 text-gray-500 dark:text-gray-400">分析你的拖延模式...</p></div></div>
  `;
  setTimeout(() => loadLabData(), 100);
  return div;
}

async function loadLabData() {
  try {
    const data = await api.get('/api/analytics/patterns');
    const p = data.patterns;
    const taskRate = p.taskCompletionRate;
    const completionRate = taskRate?.total > 0 ? Math.round((taskRate.completed / taskRate.total) * 100) : 0;
    const microStats = p.microStartSuccess;
    const continueRate = microStats?.total > 0 ? Math.round((microStats.continued_count / microStats.total) * 100) : 0;
    const pomoStats = p.pomodoroStats;

    $('#lab-content').innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div class="card-modern p-5">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">任务完成率</p>
          <p class="text-xl md:text-2xl font-bold ${completionRate >= 50 ? 'text-secondary' : 'text-accent'}">${completionRate}%</p>
          <p class="text-xs text-gray-400">${taskRate?.completed || 0}/${taskRate?.total || 0}</p>
        </div>
        <div class="card-modern p-5">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">微启动次数</p>
          <p class="text-xl md:text-2xl font-bold text-primary">${microStats?.total || 0}</p>
          <p class="text-xs text-gray-400">累计契约</p>
        </div>
        <div class="card-modern p-5">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">契约后继续率</p>
          <p class="text-xl md:text-2xl font-bold ${continueRate >= 30 ? 'text-secondary' : 'text-calm'}">${continueRate}%</p>
          <p class="text-xs text-gray-400">突破2分钟</p>
        </div>
        <div class="card-modern p-5">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">番茄钟</p>
          <p class="text-xl md:text-2xl font-bold text-danger">${pomoStats?.total || 0}</p>
          <p class="text-xs text-gray-400">${pomoStats?.total_minutes || 0}分钟</p>
        </div>
        <div class="card-modern p-5 col-span-2 md:col-span-1">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">拖延觉察</p>
          <p class="text-xl md:text-2xl font-bold text-accent">${p.dailyTrend?.reduce((a,b) => a + (b.procrastination_count || 0), 0) || 0}</p>
          <p class="text-xs text-gray-400">自我观察</p>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-6">
        <div class="card-modern p-6">
          <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-search text-primary"></i>最常见的拖延原因</h3>
          ${p.reasonDistribution?.length > 0 ? `<div class="space-y-3">${p.reasonDistribution.map((r, i) => `
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium w-24 text-gray-600 dark:text-gray-400">${getEmotionLabel(r.reason_type)}</span>
              <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full ${i === 0 ? 'bg-danger' : i === 1 ? 'bg-accent' : 'bg-calm'} rounded-full flex items-center justify-end px-2" style="width:${Math.min(100, (r.count / p.reasonDistribution[0].count) * 100)}%"><span class="text-xs text-white font-medium">${r.count}</span></div>
              </div>
            </div>
          `).join('')}</div>` : '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无数据</p>'}
        </div>
        <div class="card-modern p-6">
          <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-calendar-week text-warm"></i>按星期分布</h3>
          ${p.weekdayDistribution?.length > 0 ? `<div class="flex items-end gap-2 h-40">${p.weekdayDistribution.map(d => `
            <div class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full bg-primary/60 rounded-t transition-all hover:bg-primary" style="height:${Math.max(10, (d.count / Math.max(...p.weekdayDistribution.map(x => x.count))) * 100)}%"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">${d.weekday}</span>
            </div>
          `).join('')}</div>` : '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无数据</p>'}
        </div>
      </div>

      <div class="card-modern p-6 mb-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-mobile-alt text-danger"></i>最常见的干扰源</h3>
        ${p.distractionDistribution?.length > 0 ? `<div class="flex flex-wrap gap-2">${p.distractionDistribution.map(d => `<span class="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">${d.distraction_source} <span class="text-primary font-medium">${d.count}</span></span>`).join('')}</div>` : '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无数据</p>'}
      </div>

      <div class="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><i class="fas fa-lightbulb text-accent"></i>基于数据的策略建议</h3>
        <div class="space-y-2 text-sm text-gray-700 dark:text-gray-300">${generateStrategies(p)}</div>
      </div>
    `;
  } catch (err) {
    $('#lab-content').innerHTML = `<div class="text-center py-12 text-danger">分析失败: ${err.message}</div>`;
  }
}

function generateStrategies(patterns) {
  const suggestions = [];
  const p = patterns;
  if (p.reasonDistribution?.length > 0) {
    const topReason = p.reasonDistribution[0].reason_type;
    if (topReason === 'vague') suggestions.push('• 你的主要拖延原因是"任务太模糊"——每次创建任务时，强制添加至少2个原子步骤。');
    if (topReason === 'fear') suggestions.push('• 你经常因"害怕失败"而拖延——试试"降级完成"策略：允许自己产出60分版本。');
    if (topReason === 'distracted') suggestions.push('• 你容易被其他事情吸引——启动任务前开启手机勿扰模式。');
    if (topReason === 'tired') suggestions.push('• 你常在疲惫时拖延——把最难任务安排在精力最好的时段（通常是上午）。');
  }
  if (p.weekdayDistribution?.length > 0) {
    const maxDay = p.weekdayDistribution.reduce((a, b) => a.count > b.count ? a : b);
    suggestions.push(`• 你在${maxDay.weekday}最容易拖延——提前在前一天晚上准备好"下一个动作"。`);
  }
  const taskRate = p.taskCompletionRate;
  const completionRate = taskRate?.total > 0 ? (taskRate.completed / taskRate.total) : 0;
  if (completionRate < 0.3) suggestions.push('• 你的任务完成率较低——不要创建超过3个待办任务，减少选择负担。');
  const microStats = p.microStartSuccess;
  if (microStats?.total > 0 && (microStats.continued_count / microStats.total) < 0.2) {
    suggestions.push('• 你很少在2分钟后继续——这很正常！2分钟本身就是胜利，不要给自己压力。');
  }
  const pomoStats = p.pomodoroStats;
  if (pomoStats?.total > 0 && (pomoStats.completed / pomoStats.total) < 0.5) {
    suggestions.push('• 番茄钟完成率较低——试试从15分钟开始，逐步增加专注时长。');
  }
  if (!suggestions.length) suggestions.push('• 继续记录你的情绪和拖延日志，数据越多，建议越精准。');
  return suggestions.map(s => `<p>${s}</p>`).join('');
}

// ========== 承诺/问责 ==========
function renderCommitments() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div><h2 class="text-2xl font-bold text-gray-800 dark:text-white">温和问责</h2><p class="text-gray-500 dark:text-gray-400">社会承诺 + 自我契约</p></div>
      <button onclick="showCommitmentModal()" class="bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn"><i class="fas fa-plus mr-1"></i>新建</button>
    </div>
    <div id="commitments-list" class="space-y-4">
      <div class="text-center py-12"><div class="skeleton h-24 rounded-2xl mb-3"></div><div class="skeleton h-24 rounded-2xl"></div></div>
    </div>
  `;
  setTimeout(() => loadCommitments(), 100);
  return div;
}

async function loadCommitments() {
  try {
    const data = await api.get('/api/commitments');
    const container = $('#commitments-list');
    if (!data.commitments?.length) {
      container.innerHTML = `<div class="text-center py-12"><i class="fas fa-handshake text-4xl text-gray-300 dark:text-gray-600 mb-4"></i><p class="text-gray-500 dark:text-gray-400">还没有承诺</p><p class="text-sm text-gray-400 dark:text-gray-500 mt-1">向自己或朋友承诺一个"2分钟启动"</p></div>`;
      return;
    }
    container.innerHTML = data.commitments.map(c => `
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 ${c.completed ? 'opacity-60' : ''}">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${c.completed ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'} flex items-center justify-center"><i class="fas fa-${c.completed ? 'check' : 'handshake'}"></i></div>
            <div><p class="font-medium text-gray-800 dark:text-gray-200 ${c.completed ? 'line-through' : ''}">${c.description}</p><p class="text-xs text-gray-500 dark:text-gray-400">${c.witness_type === 'self' ? '自我承诺' : '外部见证'} · ${c.task_title || '独立承诺'}${c.relapse_count > 0 ? ` · 破戒 ${c.relapse_count} 次` : ''}</p></div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium ${c.completed ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}">${c.completed ? '已完成' : '进行中'}</span>
        </div>
        ${c.deadline ? `<p class="text-xs text-gray-500 dark:text-gray-400 mb-3"><i class="fas fa-clock mr-1"></i>截止 ${new Date(c.deadline).toLocaleString('zh-CN')}</p>` : ''}
        ${c.relapse_count > 0 ? `<p class="text-xs text-red-500 dark:text-red-400 mb-3"><i class="fas fa-exclamation-triangle mr-1"></i>已破戒 ${c.relapse_count} 次${c.last_relapse_date ? `，最近一次：${new Date(c.last_relapse_date).toLocaleDateString('zh-CN')}` : ''}</p>` : ''}
        <div class="flex gap-2">
          ${!c.completed ? `<button onclick="recordRelapse(${c.id})" class="flex-1 bg-red-50 dark:bg-red-900/20 text-danger py-2 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-times-circle mr-1"></i>记录破戒</button>` : ''}
          ${!c.completed ? `<button onclick="completeCommitment(${c.id})" class="flex-1 bg-secondary/10 text-secondary py-2 rounded-xl text-sm font-medium hover:bg-secondary/20 transition-all touch-btn"><i class="fas fa-check mr-1"></i>标记完成</button>` : `<button onclick="completeCommitment(${c.id}, false)" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-undo mr-1"></i>撤销</button>`}
          <button onclick="deleteCommitment(${c.id})" aria-label="删除承诺" class="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-danger hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    $('#commitments-list').innerHTML = '<div class="text-center py-12 text-danger"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p class="mb-2">加载失败</p><button onclick="loadCommitments()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重试</button></div>';
  }
}

function showCommitmentModal() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6"><h3 class="font-bold text-xl text-gray-800 dark:text-white">新建承诺</h3><button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button></div>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">承诺内容</label>
          <textarea id="commitment-desc" rows="2" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none" placeholder="例如：今天启动写论文的2分钟契约" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();createCommitment()}"></textarea></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">见证类型</label>
          <select id="commitment-witness" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
            <option value="self">自我承诺（对系统承诺）</option><option value="friend">朋友见证</option>
          </select></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">截止日期（可选）</label>
          <input type="datetime-local" id="commitment-deadline" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"></div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="commitment-reminder" class="rounded border-gray-300 text-primary focus:ring-primary">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">启用提醒</span>
          </label>
          <div id="reminder-time-container" class="mt-2" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">提醒时间</label>
            <input type="time" id="commitment-reminder-time" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
          </div>
        </div>
      </div>
      <div class="mt-6"><button onclick="createCommitment()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">创建承诺</button></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 监听提醒复选框
  $('#commitment-reminder').addEventListener('change', function() {
    $('#reminder-time-container').style.display = this.checked ? 'block' : 'none';
  });
}

async function createCommitment() {
  const desc = $('#commitment-desc').value.trim();
  if (!desc) { showToast('请输入承诺内容', 'error'); return; }
  try {
    const reminderEnabled = $('#commitment-reminder')?.checked || false;
    const reminderTime = $('#commitment-reminder-time')?.value || null;
    
    await api.post('/api/commitments', { 
      description: desc, 
      witness_type: $('#commitment-witness').value, 
      deadline: $('#commitment-deadline').value || null,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? reminderTime : null
    });
    showToast('承诺已创建'); $('.fixed').remove(); loadCommitments();
  } catch (err) { showToast(err.message, 'error'); }
}

async function completeCommitment(id, completed = true) {
  try { await api.put(`/api/commitments/${id}`, { completed }); showToast(completed ? '承诺已完成！' : '已撤销'); loadCommitments(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ========== 承诺详情 ==========
async function renderCommitmentDetail() {
  const id = state.pageParams?.id;
  if (!id) { navigate('commitments'); return; }
  
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  try {
    const data = await api.get('/api/commitments');
    const c = data.commitments?.find(item => item.id == id);
    if (!c) { showToast('承诺不存在', 'error'); navigate('commitments'); return; }
    
    div.innerHTML = `
      <div class="mb-6">
        <button onclick="navigate('commitments')" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2 flex items-center gap-1"><i class="fas fa-arrow-left"></i>返回</button>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">承诺详情</h2>
      </div>
      <div class="card-modern p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <p class="font-bold text-lg text-gray-800 dark:text-white ${c.completed ? 'line-through opacity-60' : ''}">${c.description}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${c.witness_type === 'self' ? '🤚 自我承诺' : '👥 外部见证'} · ${c.task_title || '独立承诺'}</p>
          </div>
          ${c.completed ? `<span class="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">已完成</span>` : ''}
        </div>
        
        ${c.relapse_count > 0 ? `<div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4"><p class="text-sm text-red-600 dark:text-red-400"><i class="fas fa-exclamation-triangle mr-1"></i>已破戒 ${c.relapse_count} 次${c.last_relapse_date ? `，最近一次：${new Date(c.last_relapse_date).toLocaleDateString('zh-CN')}` : ''}</p></div>` : ''}
        
        ${c.reminder_enabled ? `<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4"><p class="text-sm text-blue-600 dark:text-blue-400"><i class="fas fa-bell mr-1"></i>提醒已开启${c.reminder_time ? `（${c.reminder_time}）` : ''}</p></div>` : ''}
        
        <div class="flex gap-2 mt-6">
          ${!c.completed ? `
            <button onclick="recordRelapse(${c.id})" class="flex-1 bg-red-50 dark:bg-red-900/20 text-danger py-2 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-times-circle mr-1"></i>记录破戒</button>
            <button onclick="completeCommitment(${c.id})" class="flex-1 bg-secondary text-white py-2 rounded-xl text-sm font-medium hover:bg-secondary/90 transition-all touch-btn"><i class="fas fa-check mr-1"></i>标记完成</button>
          ` : `
            <button onclick="completeCommitment(${c.id}, false)" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-undo mr-1"></i>重新打开</button>
          `}
          <button onclick="deleteCommitment(${c.id})" aria-label="删除承诺" class="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-danger hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  } catch (err) {
    div.innerHTML = '<div class="p-8 text-center text-danger"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p class="mb-2">加载失败</p><button onclick="renderCommitmentDetail()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重试</button></div>';
  }
  return div;
}

async function recordRelapse(id) {
  var confirmed = await showConfirmModal('确定要记录一次破戒吗？', '记录破戒');
  if (!confirmed) return;
  try {
    await api.post(`/api/commitments/${id}/relapse`);
    showToast('已记录破戒');
    loadCommitments();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCommitment(id) {
  var confirmed = await showConfirmModal('确定删除这个承诺？', '删除');
  if (!confirmed) return;
  try { await api.del(`/api/commitments/${id}`); showDeleteUndo('承诺已删除'); loadCommitments(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ========== 时间块 ==========
function renderTimeBlocks() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  const today = new Date().toISOString().split('T')[0];
  div.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div><h2 class="text-2xl font-bold text-gray-800 dark:text-white">时间地形</h2><p class="text-gray-500 dark:text-gray-400">规划你的今日地形</p></div>
      <button onclick="showTimeBlockModal()" class="bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn"><i class="fas fa-plus mr-1"></i>添加</button>
    </div>
    <div class="mb-6"><input type="date" id="timeblock-date" value="${today}" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" onchange="loadTimeBlocks()"></div>
    <div class="card-modern p-6">
      <div id="timeblocks-timeline" class="space-y-3"><p class="text-gray-400 dark:text-gray-500 text-center py-8">加载中...</p></div>
    </div>
  `;
  setTimeout(() => loadTimeBlocks(), 100);
  return div;
}

async function loadTimeBlocks() {
  try {
    const date = $('#timeblock-date').value;
    const data = await api.get(`/api/time-blocks?date=${date}`);
    const container = $('#timeblocks-timeline');
    const blocks = data.timeBlocks || [];
    if (!blocks.length) {
      container.innerHTML = `<div class="text-center py-8"><i class="fas fa-clock text-4xl text-gray-300 dark:text-gray-600 mb-4"></i><p class="text-gray-500 dark:text-gray-400">这一天还没有时间块</p><p class="text-sm text-gray-400 dark:text-gray-500 mt-1">添加工作、休息或运动时段</p></div>`;
      return;
    }
    const typeColors = { work: 'bg-primary/10 text-primary border-primary/20', rest: 'bg-secondary/10 text-secondary border-secondary/20', exercise: 'bg-warm/10 text-warm border-warm/20', social: 'bg-calm/10 text-calm border-calm/20' };
    const typeLabels = { work: '工作', rest: '休息', exercise: '运动', social: '社交' };
    container.innerHTML = blocks.map(b => `
      <div class="flex items-center gap-4 p-4 rounded-xl border ${typeColors[b.block_type] || 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}">
        <div class="text-center min-w-[60px]"><p class="font-bold text-sm">${b.start_time?.slice(0,5) || ''}</p><p class="text-xs opacity-70">${b.end_time?.slice(0,5) || ''}</p></div>
        <div class="flex-1"><p class="font-medium">${b.task_title || typeLabels[b.block_type] || '时间块'}</p><p class="text-xs opacity-70">能量 ${b.energy_level}/5</p></div>
        <button onclick="deleteTimeBlock(${b.id})" aria-label="删除时间块" class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all touch-btn"><i class="fas fa-trash text-sm"></i></button>
      </div>
    `).join('');
  } catch (err) {
    $('#timeblocks-timeline').innerHTML = '<div class="text-center py-8 text-danger"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p class="mb-2">加载失败</p><button onclick="loadTimeBlocks()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-redo mr-1"></i>重试</button></div>';
  }
}

function showTimeBlockModal() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6"><h3 class="font-bold text-xl text-gray-800 dark:text-white">添加时间块</h3><button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button></div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开始时间</label><input type="time" id="tb-start" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">结束时间</label><input type="time" id="tb-end" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"></div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">类型</label>
          <div class="grid grid-cols-4 gap-2">${[{type:'work',label:'工作',color:'bg-primary/10 text-primary'},{type:'rest',label:'休息',color:'bg-secondary/10 text-secondary'},{type:'exercise',label:'运动',color:'bg-warm/10 text-warm'},{type:'social',label:'社交',color:'bg-calm/10 text-calm'}].map(t=>`<button onclick="selectBlockType('${t.type}')" class="tb-type-btn py-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 ${t.color} transition-all touch-btn" data-type="${t.type}">${t.label}</button>`).join('')}</div></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">预计能量水平</label>
          <div class="flex gap-2">${[1,2,3,4,5].map(i=>`<button onclick="selectBlockEnergy(${i})" class="tb-energy-btn flex-1 h-10 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary transition-all touch-btn" data-energy="${i}">${i}</button>`).join('')}</div></div>
      </div>
      <div class="mt-6"><button onclick="createTimeBlock()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">添加时间块</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  selectBlockType('work'); selectBlockEnergy(3);
}

let selectedBlockType = 'work'; selectedBlockEnergy = 3;
function selectBlockType(type) {
  selectedBlockType = type;
  $$('.tb-type-btn').forEach(btn => {
    if (btn.dataset.type === type) btn.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'dark:ring-offset-gray-800');
    else btn.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'dark:ring-offset-gray-800');
  });
}
function selectBlockEnergy(level) {
  selectedBlockEnergy = level;
  $$('.tb-energy-btn').forEach(btn => {
    const bl = parseInt(btn.dataset.energy);
    if (bl <= level) { btn.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.remove('border-gray-200', 'dark:border-gray-600'); }
    else { btn.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.add('border-gray-200', 'dark:border-gray-600'); }
  });
}
async function createTimeBlock() {
  const start = $('#tb-start').value, end = $('#tb-end').value, date = $('#timeblock-date').value;
  if (!start || !end) { showToast('请选择开始和结束时间', 'error'); return; }
  try {
    await api.post('/api/time-blocks', { block_date: date, start_time: start, end_time: end, block_type: selectedBlockType, energy_level: selectedBlockEnergy });
    showToast('时间块已添加'); $('.fixed').remove(); loadTimeBlocks();
  } catch (err) { showToast(err.message, 'error'); }
}
async function deleteTimeBlock(id) {
  var confirmed = await showConfirmModal('确定删除这个时间块？', '删除');
  if (!confirmed) return;
  try { await api.del(`/api/time-blocks/${id}`); showToast('已删除'); loadTimeBlocks(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ========== 设置 ==========
function renderSettings() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  
  // 加载用户偏好
  const userPrefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const pomodoroWork = userPrefs.pomodoroWork || 25;
  const pomodoroBreak = userPrefs.pomodoroBreak || 5;
  const reminderEnabled = userPrefs.reminderEnabled !== false;
  const reminderInterval = userPrefs.reminderInterval || 30;
  const defaultEnergy = userPrefs.defaultEnergy || 5;
  
  div.innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800 dark:text-white">设置</h2><p class="text-gray-500 dark:text-gray-400">系统配置与数据管理</p></div>
    <div class="space-y-6">
      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-server text-primary"></i>API 配置</h3>
        <div class="mb-4"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">后端 API 地址</label>
          <input type="text" id="settings-api-base" value="${getApiBase()}" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" placeholder="https://your-api.workers.dev"></div>
        <button onclick="saveApiBase()" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all touch-btn">保存配置</button>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-palette text-primary"></i>外观与主题</h3>
        <div class="space-y-4">
          <!-- 深色模式 -->
          <div class="flex items-center justify-between">
            <div><p class="font-medium text-gray-800 dark:text-white">深色模式</p><p class="text-sm text-gray-500 dark:text-gray-400">切换浅色/深色主题</p></div>
            <button onclick="toggleDarkMode()" class="w-14 h-8 rounded-full ${state.darkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} transition-colors relative touch-btn">
              <div class="absolute top-1 ${state.darkMode ? 'left-7' : 'left-1'} w-6 h-6 rounded-full bg-white shadow transition-all flex items-center justify-center"><i class="fas fa-${state.darkMode ? 'moon' : 'sun'} text-xs text-gray-600"></i></div>
            </button>
          </div>
          
          <!-- 字体大小 -->
          <div>
            <p class="font-medium text-gray-800 dark:text-white mb-2">字体大小</p>
            <div class="flex gap-2">
              ${[
                { size: 'small', label: '小', class: 'text-sm' },
                { size: 'medium', label: '中', class: 'text-base' },
                { size: 'large', label: '大', class: 'text-lg' }
              ].map(s => `
                <button onclick="setFontSize('${s.size}')" class="px-4 py-2 rounded-xl border ${userPrefs.fontSize === s.size || (!userPrefs.fontSize && s.size === 'medium') ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'} transition-all touch-btn ${s.class}">${s.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-stopwatch text-secondary"></i>番茄钟设置</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">专注时长（分钟）</label>
              <input type="number" id="settings-pomo-work" value="${pomodoroWork}" min="1" max="90" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">休息时长（分钟）</label>
              <input type="number" id="settings-pomo-break" value="${pomodoroBreak}" min="1" max="30" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">默认精力水平</label>
            <div class="flex items-center gap-3">
              <input type="range" id="settings-default-energy" min="1" max="10" value="${defaultEnergy}" class="flex-1" oninput="document.getElementById('energy-value').textContent=this.value">
              <span id="energy-value" class="text-sm font-medium text-primary w-6 text-center">${defaultEnergy}</span>
            </div>
          </div>
          <button onclick="savePomodoroSettings()" class="px-4 py-2 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-all touch-btn">保存番茄钟设置</button>
        </div>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-bell text-accent"></i>提醒与通知</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div><p class="font-medium text-gray-800 dark:text-white">休息提醒</p><p class="text-sm text-gray-500 dark:text-gray-400">定时提醒你休息和活动</p></div>
            <button onclick="toggleReminder()" class="w-14 h-8 rounded-full ${reminderEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} transition-colors relative touch-btn">
              <div class="absolute top-1 ${reminderEnabled ? 'left-7' : 'left-1'} w-6 h-6 rounded-full bg-white shadow transition-all flex items-center justify-center"><i class="fas fa-${reminderEnabled ? 'check' : 'times'} text-xs text-gray-600"></i></div>
            </button>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">提醒间隔（分钟）</label>
            <select id="settings-reminder-interval" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="15" ${reminderInterval === 15 ? 'selected' : ''}>每 15 分钟</option>
              <option value="30" ${reminderInterval === 30 ? 'selected' : ''}>每 30 分钟</option>
              <option value="45" ${reminderInterval === 45 ? 'selected' : ''}>每 45 分钟</option>
              <option value="60" ${reminderInterval === 60 ? 'selected' : ''}>每 60 分钟</option>
            </select>
          </div>
          <button onclick="saveReminderSettings()" class="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all touch-btn">保存提醒设置</button>
        </div>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-download text-secondary"></i>数据管理</h3>
        <div class="space-y-3">
          <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <p class="font-medium text-gray-800 dark:text-white mb-2">允许上传的文件类型</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">配置日记中允许上传的文件类型。留空表示不限制（不推荐）。多个类型用逗号分隔，例如：image/*, .pdf, .doc</p>
            <input type="text" id="settings-upload-types" value="${userPrefs.allowedUploadTypes || ''}" autocomplete="off"
                   class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none text-sm" 
                   placeholder="例如：image/*, video/*, .pdf, .doc, .zip">
            <button onclick="saveUploadTypes()" class="mt-3 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-all touch-btn">保存上传类型配置</button>
          </div>
          <button onclick="exportData()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-secondary/5 dark:bg-secondary/10 text-secondary hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center"><i class="fas fa-file-export"></i></div>
            <div><p class="font-medium">导出数据</p><p class="text-xs text-gray-500 dark:text-gray-400">导出所有数据为 JSON/Excel</p></div>
          </button>
          <button onclick="backupToCloud()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><i class="fas fa-download"></i></div>
            <div><p class="font-medium">下载备份 ZIP</p><p class="text-xs text-gray-500 dark:text-gray-400">含数据+附件，可存到任何地方</p></div>
          </button>
          <button onclick="showBackupConfig()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><i class="fas fa-cloud-upload-alt"></i></div>
            <div><p class="font-medium">配置自动备份</p><p class="text-xs text-gray-500 dark:text-gray-400">设置备份到 GitHub/Webhook</p></div>
          </button>
          <button onclick="showImportModal()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><i class="fas fa-file-import"></i></div>
            <div><p class="font-medium">导入数据</p><p class="text-xs text-gray-500 dark:text-gray-400">从 JSON 文件恢复数据</p></div>
          </button>
          <button onclick="showClearDataConfirm()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-danger/5 dark:bg-danger/10 text-danger hover:bg-danger/10 dark:hover:bg-danger/20 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center"><i class="fas fa-trash-alt"></i></div>
            <div><p class="font-medium">清除数据</p><p class="text-xs text-gray-500 dark:text-gray-400">清除所有本地缓存数据</p></div>
          </button>
        </div>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-exclamation-triangle text-accent"></i>快速记录拖延</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">如果你此刻正在拖延，记录下来，不要批判自己。</p>
        <button onclick="showProcrastinationModal()" class="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all touch-btn"><i class="fas fa-pen mr-1"></i>记录拖延日志</button>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-key text-calm"></i>修改密码</h3>
        <div class="space-y-3">
          <input type="password" id="settings-old-pwd" placeholder="当前密码" autocomplete="new-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
          <input type="password" id="settings-new-pwd" placeholder="新密码（至少6位）" autocomplete="new-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
          <input type="password" id="settings-confirm-pwd" placeholder="确认新密码" autocomplete="new-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
          <button onclick="changePassword()" class="w-full px-4 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all touch-btn"><i class="fas fa-check mr-1"></i>确认修改</button>
        </div>
      </div>

      <div class="card-modern p-6">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-user text-calm"></i>账号</h3>
        <button onclick="logout()" class="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-danger rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-sign-out-alt mr-1"></i>退出登录</button>
      </div>
    </div>
  `;
  return div;
}

function saveApiBase() {
  const base = $('#settings-api-base').value.trim();
  if (!base) { showToast('请输入 API 地址', 'error'); return; }
  safeStorage.set('api_base', base);
  showToast('API 地址已保存并生效');
}

// 保存上传类型配置
function saveUploadTypes() {
  const types = $('#settings-upload-types').value.trim();
  saveUserPrefs({ allowedUploadTypes: types });
  showToast('上传类型配置已保存');
}

async function changePassword() {
  const oldP = $('#settings-old-pwd').value;
  const newP = $('#settings-new-pwd').value;
  const confirmP = $('#settings-confirm-pwd').value;
  if (!oldP || !newP) { showToast('请填写所有密码字段', 'error'); return; }
  if (newP.length < 6) { showToast('新密码至少6位', 'error'); return; }
  if (newP !== confirmP) { showToast('两次新密码不一致', 'error'); return; }
  try {
    await api.post('/api/auth/change-password', { oldPassword: oldP, newPassword: newP });
    showToast('密码已修改，即将重新登录');
    setTimeout(() => { logout(); }, 1500);
  } catch (err) { showToast(err.message, 'error'); }
}

// ========== 高级定制功能（P3）==========

// 保存用户偏好
function saveUserPrefs(prefs) {
  const existing = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const merged = { ...existing, ...prefs };
  safeStorage.set('user_prefs', JSON.stringify(merged));
  return merged;
}

function getUserPrefs() {
  return JSON.parse(safeStorage.get('user_prefs') || '{}');
}

// 设置主题颜色
// 设置字体大小
function setFontSize(size) {
  saveUserPrefs({ fontSize: size });
  
  const sizeMap = { small: '14px', medium: '16px', large: '18px' };
  document.documentElement.style.fontSize = sizeMap[size] || '16px';
  
  showToast('字体大小已更新');
  navigate('settings');
}

// 保存番茄钟设置
function savePomodoroSettings() {
  const work = parseInt($('#settings-pomo-work')?.value) || 25;
  const break_ = parseInt($('#settings-pomo-break')?.value) || 5;
  const energy = parseInt($('#settings-default-energy')?.value) || 5;
  
  saveUserPrefs({ 
    pomodoroWork: Math.max(1, Math.min(90, work)),
    pomodoroBreak: Math.max(1, Math.min(30, break_)),
    defaultEnergy: Math.max(1, Math.min(10, energy))
  });
  
  showToast('番茄钟设置已保存');
}

// 切换提醒
function toggleReminder() {
  const prefs = getUserPrefs();
  prefs.reminderEnabled = !prefs.reminderEnabled;
  saveUserPrefs(prefs);
  
  if (prefs.reminderEnabled) {
    startReminderTimer();
    showToast('休息提醒已开启');
  } else {
    stopReminderTimer();
    showToast('休息提醒已关闭');
  }
  
  navigate('settings');
}

// 保存提醒设置
function saveReminderSettings() {
  const interval = parseInt($('#settings-reminder-interval')?.value) || 30;
  saveUserPrefs({ reminderInterval: interval, reminderEnabled: true });
  startReminderTimer();
  showToast('提醒设置已保存');
}

// 提醒定时器
let reminderTimerId = null;

function startReminderTimer() {
  stopReminderTimer();
  const prefs = getUserPrefs();
  if (!prefs.reminderEnabled) return;
  
  const interval = (prefs.reminderInterval || 30) * 60 * 1000;
  reminderTimerId = setInterval(() => {
    if (Notification.permission === 'granted') {
      new Notification('周迹 - 休息提醒', {
        body: '该休息一下了！站起来活动活动吧 🧘',
        icon: '/icon-192.png'
      });
    } else {
      showToast('🧘 该休息一下了！站起来活动活动吧', 'info');
    }
  }, interval);
}

function stopReminderTimer() {
  if (reminderTimerId) {
    clearInterval(reminderTimerId);
    reminderTimerId = null;
  }
}

// 清除数据确认
function showClearDataConfirm() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-xl text-danger"><i class="fas fa-exclamation-triangle mr-2"></i>清除数据</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-danger/5 dark:bg-danger/10 border border-danger/20">
          <p class="text-sm text-danger font-medium mb-2">⚠️ 此操作不可恢复！</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">请选择要清除的数据类型：</p>
        </div>
        
        <div class="space-y-2">
          <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-primary/50 transition-all">
            <input type="checkbox" id="clear-cache" class="w-5 h-5 rounded text-primary" checked>
            <div>
              <p class="font-medium text-gray-800 dark:text-white">本地缓存</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">清除本地存储的临时数据</p>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-primary/50 transition-all">
            <input type="checkbox" id="clear-preferences" class="w-5 h-5 rounded text-primary">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">个人偏好</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">主题、番茄钟、提醒等设置</p>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-xl border border-danger/30 dark:border-danger/30 cursor-pointer hover:border-danger/50 transition-all">
            <input type="checkbox" id="clear-server" class="w-5 h-5 rounded text-danger">
            <div>
              <p class="font-medium text-danger">服务器数据</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">⚠️ 删除服务器上的所有用户数据</p>
            </div>
          </label>
        </div>
        
        <div class="flex gap-2 justify-end">
          <button onclick="this.closest('.modal-backdrop').remove()" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm touch-btn">取消</button>
          <button onclick="executeClearData()" class="px-4 py-2 rounded-xl bg-danger text-white font-medium text-sm hover:bg-danger/90 transition-all touch-btn">确认清除</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function executeClearData() {
  const clearCache = $('#clear-cache')?.checked;
  const clearPrefs = $('#clear-preferences')?.checked;
  const clearServer = $('#clear-server')?.checked;
  
  if (clearCache) {
    localStorage.removeItem('token');
    localStorage.removeItem('timer_state');
    localStorage.removeItem('pomo_state');
  }
  
  if (clearPrefs) {
    localStorage.removeItem('user_prefs');
    localStorage.removeItem('dark_mode');
    localStorage.removeItem('api_base');
  }
  
  if (clearServer) {
    var confirmed = await showConfirmModal('确定要删除服务器上的所有数据吗？此操作不可恢复！', '删除全部数据');
    if (!confirmed) return;
    try {
      await api.delete('/api/user/data');
      showToast('服务器数据已清除');
    } catch (err) {
      showToast('清除服务器数据失败: ' + err.message, 'error');
    }
  }
  
  document.querySelector('.modal-backdrop')?.remove();
  showToast('数据清除完成');
  
  if (clearCache || clearPrefs) {
    setTimeout(() => location.reload(), 1000);
  }
}

async function exportData() {
  // 显示导出选项弹窗
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-xl text-gray-800 dark:text-white">导出数据</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开始日期</label>
          <input type="date" id="export-start" value="${lastMonth}" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">结束日期</label>
          <input type="date" id="export-end" value="${today}" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">导出格式</label>
          <div class="flex gap-2">
            <button onclick="doExport('xlsx')" class="flex-1 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all text-sm font-medium touch-btn">
              <i class="fas fa-file-excel mr-1"></i>Excel (.xlsx)
            </button>
            <button onclick="doExport('json')" class="flex-1 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all text-sm font-medium touch-btn">
              <i class="fas fa-file-code mr-1"></i>JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ========== 执行导出 ==========
async function doExport(format) {
  const start = $('#export-start')?.value;
  const end = $('#export-end')?.value;
  if (!start || !end) { showToast('请选择日期范围', 'error'); return; }
  
  try {
    showToast('正在导出数据...', 'info');
    const params = `?start=${start}&end=${end}`;
    const data = await api.get('/api/export' + params);
    const exportData = data.data || data; // 兼容包装格式
    
    if (format === 'xlsx') {
      exportToExcel(exportData, start, end);
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `周迹导出_${start}_${end}.json`);
    }
    
    $('.modal-backdrop')?.remove();
    showToast('数据导出成功');
  } catch (err) { showToast(err.message, 'error'); }
}

// 导出为 Excel（多Sheet）
function exportToExcel(data, start, end) {
  if (typeof XLSX === 'undefined') {
    showToast('Excel 导出库加载失败，请检查网络', 'error');
    return;
  }
  
  const wb = XLSX.utils.book_new();
  
  // Sheet1: 任务
  if (data.tasks && data.tasks.length) {
    const rows = data.tasks.map(t => ({
      '任务ID': t.id,
      '标题': t.title,
      '描述': t.description || '',
      '分类': t.category || '',
      '优先级': t.priority || '',
      '状态': t.status || '',
      '难度': t.difficulty || '',
      '创建时间': t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '',
      '完成时间': t.completed_at ? new Date(t.completed_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 6 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '任务');
  }
  
  // Sheet2: 日记
  if (data.diary && data.diary.length) {
    const rows = data.diary.map(d => ({
      '日记ID': d.id,
      '标题': d.title || '',
      '内容': d.content || '',
      '心情': d.mood || '',
      '天气': d.weather || '',
      '模板类型': d.template_type || '',
      '创建时间': d.created_at ? new Date(d.created_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 60 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '日记');
  }
  
  // Sheet3: 番茄钟记录
  if (data.pomodoro && data.pomodoro.length) {
    const rows = data.pomodoro.map(p => ({
      '记录ID': p.id,
      '任务ID': p.task_id || '',
      '类型': p.type || '',
      '持续时间(分钟)': p.duration || '',
      '完成时间': p.completed_at ? new Date(p.completed_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '番茄钟');
  }
  
  // Sheet4: 情绪记录
  if (data.emotions && data.emotions.length) {
    const rows = data.emotions.map(e => ({
      '记录ID': e.id,
      '情绪类型': e.emotion_type || '',
      '强度': e.intensity || '',
      '备注': e.notes || '',
      '记录时间': e.created_at ? new Date(e.created_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '情绪记录');
  }
  
  // Sheet5: 拖延日志
  if (data.procrastination && data.procrastination.length) {
    const rows = data.procrastination.map(p => ({
      '日志ID': p.id,
      '原因类型': p.reason_type || '',
      '详细说明': p.reason_detail || '',
      '干扰源': p.distraction_source || '',
      '记录时间': p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '拖延日志');
  }
  
  // Sheet6: 周计划
  if (data.weeklyPlans && data.weeklyPlans.length) {
    const WD = ['周日','周一','周二','周三','周四','周五','周六'];
    const rows = data.weeklyPlans.map(w => ({
      '计划ID': w.id,
      '标题': w.title || '',
      '描述': w.description || '',
      '分类': w.category || '',
      '星期': w.day_of_week !== null && w.day_of_week !== undefined ? (WD[w.day_of_week] || w.day_of_week) : '任务池',
      '开始时间': w.start_time || '',
      '结束时间': w.end_time || '',
      '状态': w.status === 'completed' ? '已完成' : '待完成',
      '周起始': w.week_start || '',
      '来源': w.source || '',
      '创建时间': w.created_at ? new Date(w.created_at).toLocaleString('zh-CN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '周计划');
  }
  
  // 检查是否有数据
  if (wb.SheetNames.length === 0) {
    showToast('没有数据可导出，请先创建一些内容', 'warning');
    return;
  }
  
  try {
    XLSX.writeFile(wb, `周迹导出_${start}_${end}.xlsx`);
    showToast('Excel 导出成功！', 'success');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// 下载 Blob 文件
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showImportModal() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6"><h3 class="font-bold text-xl text-gray-800 dark:text-white">导入数据</h3><button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button></div>
      <div class="space-y-4">
        <div class="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-8 text-center">
          <i class="fas fa-cloud-upload-alt text-3xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">选择之前导出的 JSON 文件</p>
          <input type="file" id="import-file" accept=".json" class="hidden" onchange="handleImportFile(event)">
          <button onclick="$('#import-file').click()" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all touch-btn">选择文件</button>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500">⚠️ 导入的数据会追加到现有数据中，不会覆盖。</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ========== 一键备份/导出 ==========
async function backupToCloud() {
  showToast('正在打包备份数据...', 'info');
  try {
    // 加载 JSZip
    if (!window.JSZip) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    
    const zip = new JSZip();
    const data = await api.get('/api/export');
    if (!data || !data.data) { showToast('没有可备份的数据', 'warning'); return; }
    
    // 添加数据 JSON
    zip.file('数据.json', JSON.stringify(data.data, null, 2));
    
    // 添加附件（从 diary 和 tasks 中提取附件 URL）
    let attachmentCount = 0;
    const attachmentUrls = new Set();
    
    // 从日记中提取附件
    if (data.data.diary) {
      data.data.diary.forEach(d => {
        // 检查是否有关联的媒体文件字段
        if (d.file_url) attachmentUrls.add(d.file_url);
        // 也检查 content 中的图片链接
        if (d.content && d.content.includes('file_url')) {
          try { const c = JSON.parse(d.content); if (c.file_url) attachmentUrls.add(c.file_url); } catch(e) {}
        }
      });
    }
    
    // 从日记媒体表中提取
    if (data.data.diaryMedia) {
      data.data.diaryMedia.forEach(m => {
        if (m.file_url) attachmentUrls.add(m.file_url);
      });
    }
    
    // 下载附件并添加到 ZIP
    const urls = [...attachmentUrls].slice(0, 50); // 限制最多 50 个附件
    for (let i = 0; i < urls.length; i++) {
      try {
        showToast(`正在下载附件 (${i+1}/${urls.length})...`, 'info');
        const resp = await fetch(urls[i], { mode: 'cors' });
        if (resp.ok) {
          const blob = await resp.blob();
          const fileName = urls[i].split('/').pop() || `attachment_${i+1}`;
          zip.file(`attachments/${fileName}`, blob);
          attachmentCount++;
        }
      } catch (e) {
        console.warn('附件下载失败:', urls[i], e.message);
      }
    }
    
    // 生成 ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `周迹完整备份_${dateStr}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`备份完成！包含 ${Object.keys(data.data).length} 类数据${attachmentCount > 0 ? ` + ${attachmentCount} 个附件` : ''}`, 'success');
  } catch (err) {
    console.error('备份失败:', err);
    showToast('备份失败: ' + (err.message || err), 'error');
  }
}

// ========== 备份配置弹窗 ==========
function showBackupConfig() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-8 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 modal-content shadow-2xl">
      <div class="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 pb-2">
        <h3 class="font-bold text-xl text-gray-800 dark:text-white"><i class="fas fa-cloud-upload-alt text-primary mr-2"></i>自动备份配置</h3>
        <button onclick="this.closest('.modal-backdrop').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <div class="space-y-6">
        <!-- 百度网盘备份 -->
        <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <h4 class="font-medium text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <i class="fab fa-baidu text-blue-500"></i>备份到百度网盘
          </h4>
          <p class="text-xs text-gray-500 mb-3">通过百度 OAuth 授权后，一键备份到你的百度网盘。需要 basic（用户信息）+ netdisk（文件上传）权限。</p>
          <div class="space-y-3">
            <!-- 全局配置提示 -->
            <div id="baidu-global-badge" class="mb-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p class="text-xs text-green-700 dark:text-green-400">
                <i class="fas fa-check-circle mr-1"></i>已启用全局配置，无需输入密钥
              </p>
            </div>
            
            <div id="baidu-config-form">
              <div id="baidu-user-inputs" style="display:none">
                <input type="text" id="baidu-app-key" value="${prefs.baiduAppKey || ''}" placeholder="百度 App Key（API Key）" autocomplete="off" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm mb-2 focus:border-primary outline-none">
                <input type="text" id="baidu-secret-key" value="${prefs.baiduSecretKey || ''}" placeholder="百度 Secret Key" autocomplete="off" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm mb-2 focus:border-primary outline-none">
                <p class="text-xs text-gray-400 mb-2">在 <a href="https://pan.baidu.com/union/home" target="_blank" class="text-primary hover:underline">百度开放平台</a> 创建应用后获取，需勾选 basic + netdisk 权限</p>
              </div>
              <div class="flex gap-2">
                <button id="baidu-save-btn" onclick="saveBaiduConfig()" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">保存配置</button>
                <button onclick="connectBaiduDrive()" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                  <i class="fas fa-link mr-1"></i>授权百度网盘
                </button>
              </div>
            </div>
            <div id="baidu-connected-info" style="display:none" class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p class="text-sm text-green-700 dark:text-green-400"><i class="fas fa-check-circle mr-1"></i>已连接百度网盘</p>
              
              <!-- 日期选择 -->
              <div class="mt-3 mb-3 p-2 rounded-lg bg-white/50 dark:bg-gray-800/50">
                <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">📅 数据范围（留空=全量备份）</p>
                <div class="flex gap-2 items-center">
                  <input type="date" id="baidu-backup-from" class="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
                  <span class="text-xs text-gray-400">至</span>
                  <input type="date" id="baidu-backup-to" class="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
                </div>
                <p class="text-xs text-gray-400 mt-1">不选日期则备份全部数据</p>
              </div>
              
              <div class="flex gap-2 mt-2">
                <button onclick="backupToBaiduDrive()" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                  <i class="fas fa-upload mr-1"></i>立即备份到百度网盘
                </button>
                <button onclick="disconnectBaiduDrive()" class="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">断开连接</button>
              </div>
              <p id="baidu-backup-status" class="text-xs text-gray-400 mt-1"></p>
              <div id="baidu-backup-result" style="display:none" class="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400"></div>
            </div>
          </div>
        </div>
        <!-- GitHub 备份 -->
        <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <h4 class="font-medium text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <i class="fab fa-github text-gray-800 dark:text-white"></i>备份到 GitHub
          </h4>
          <p class="text-xs text-gray-500 mb-3">数据会提交到你的私有仓库，可恢复/迁移</p>
          <div class="space-y-3">
            <input type="password" id="gh-token" value="${prefs.ghToken || ''}" placeholder="GitHub Personal Access Token（需 repo 权限）" autocomplete="off" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-primary outline-none">
            <input type="text" id="gh-repo" value="${prefs.ghRepo || ''}" placeholder="仓库名：用户名/仓库名" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-primary outline-none">
            <div class="flex gap-2">
              <button onclick="saveBackupConfig(this)" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">保存配置</button>
              <button onclick="backupToGitHub()" class="flex-1 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-300 transition-all">
                <i class="fab fa-github mr-1"></i>立即备份到 GitHub
              </button>
            </div>
            <p id="gh-backup-status" class="text-xs text-gray-400"></p>
          </div>
        </div>
        <!-- Webhook 备份 -->
        <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <h4 class="font-medium text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <i class="fas fa-link text-blue-500"></i>备份到 Webhook（自定义 URL）
          </h4>
          <p class="text-xs text-gray-500 mb-3">数据会 POST 到你的自定义服务地址</p>
          <div class="space-y-3">
            <input type="url" id="webhook-url" value="${prefs.webhookUrl || ''}" placeholder="例如：https://your-server.com/backup" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-primary outline-none">
            <div class="flex gap-2">
              <button onclick="saveBackupConfig(this)" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">保存配置</button>
              <button onclick="backupToWebhook()" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all">
                <i class="fas fa-paper-plane mr-1"></i>立即备份到 Webhook
              </button>
            </div>
            <p id="webhook-backup-status" class="text-xs text-gray-400"></p>
          </div>
        </div>
        <p class="text-xs text-gray-400 text-center pb-2">备份数据为 JSON 格式，包含所有任务、日记、情绪、附件记录等。<br>可在「导入数据」功能中恢复。</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(checkBaiduStatus, 500);
}

// 保存备份配置（保存后关闭弹窗）
window.saveBackupConfig = function(btn) {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  prefs.ghToken = document.getElementById('gh-token')?.value?.trim() || '';
  prefs.ghRepo = document.getElementById('gh-repo')?.value?.trim() || '';
  prefs.webhookUrl = document.getElementById('webhook-url')?.value?.trim() || '';
  safeStorage.set('user_prefs', JSON.stringify(prefs));
  showToast('备份配置已保存', 'success');
  if (btn) btn.closest('.modal-backdrop')?.remove();
};

// 备份到 GitHub
window.backupToGitHub = async function() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const token = prefs.ghToken;
  const repo = prefs.ghRepo;
  const statusEl = document.getElementById('gh-backup-status');
  
  if (!token || !repo) { statusEl.textContent = '请先填写 Token 和仓库名'; return; }
  
  try {
    statusEl.textContent = '正在获取数据...';
    const data = await api.get('/api/export');
    if (!data || !data.data) { statusEl.textContent = '没有数据可备份'; return; }
    
    const jsonContent = JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), data: data.data }, null, 2);
    const fileName = `backup_${new Date().toISOString().split('T')[0]}.json`;
    const encoded = btoa(unescape(encodeURIComponent(jsonContent)));
    
    statusEl.textContent = '正在上传到 GitHub...';
    
    // 检查文件是否存在，如果存在就更新
    const getResp = await fetch(`https://api.github.com/repos/${repo}/contents/${fileName}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    
    let sha = null;
    if (getResp.ok) {
      const existing = await getResp.json();
      sha = existing.sha;
    }
    
    const putResp = await fetch(`https://api.github.com/repos/${repo}/contents/${fileName}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
      body: JSON.stringify({
        message: `备份 ${new Date().toLocaleString('zh-CN')}`,
        content: encoded,
        sha: sha || undefined
      })
    });
    
    if (putResp.ok) {
      statusEl.textContent = `✅ 备份成功！文件: ${fileName}`;
      prefs.lastGhBackup = new Date().toISOString();
      safeStorage.set('user_prefs', JSON.stringify(prefs));
      showToast('GitHub 备份成功！', 'success');
    } else {
      const err = await putResp.json();
      statusEl.textContent = `❌ 备份失败: ${err.message}`;
    }
  } catch (err) {
    statusEl.textContent = '❌ 备份失败: ' + (err.message || err);
  }
};

// 备份到 Webhook
window.backupToWebhook = async function() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const url = prefs.webhookUrl;
  const statusEl = document.getElementById('webhook-backup-status');
  
  if (!url) { statusEl.textContent = '请先填写 Webhook URL'; return; }
  
  try {
    statusEl.textContent = '正在获取数据...';
    const data = await api.get('/api/export');
    if (!data || !data.data) { statusEl.textContent = '没有数据可备份'; return; }
    
    const payload = { version: '1.0', exportedAt: new Date().toISOString(), data: data.data };
    
    statusEl.textContent = '正在发送到 Webhook...';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (resp.ok) {
      statusEl.textContent = '✅ Webhook 备份成功！';
      showToast('Webhook 备份成功！', 'success');
    } else {
      statusEl.textContent = `❌ Webhook 返回 ${resp.status}`;
    }
  } catch (err) {
    statusEl.textContent = '❌ 备份失败: ' + (err.message || err);
  }
};

// ========== 百度网盘备份 ==========
function saveBaiduConfig() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  prefs.baiduAppKey = document.getElementById('baidu-app-key')?.value?.trim() || '';
  prefs.baiduSecretKey = document.getElementById('baidu-secret-key')?.value?.trim() || '';
  safeStorage.set('user_prefs', JSON.stringify(prefs));
  showToast('百度配置已保存', 'success');
}

async function connectBaiduDrive() {
  const prefs = JSON.parse(safeStorage.get('user_prefs') || '{}');
  const userId = safeStorage.get('userId');
  if (!userId) { showToast('请先登录', 'error'); return; }
  
  try {
    // 构建参数（优先使用全局配置，后端会自动读取环境变量）
    let url = `/api/cloud-drive/baidu/auth-url?frontend=${encodeURIComponent(window.location.origin)}`;
    
    // 如果用户有自己的配置，带上参数
    if (prefs.baiduAppKey && prefs.baiduSecretKey) {
      url += `&app_key=${prefs.baiduAppKey}&secret_key=${prefs.baiduSecretKey}`;
    }
    
    // 后端生成完整 OAuth URL（含 state）
    const resp = await api.get(url);
    if (!resp.url) { showToast('获取授权地址失败', 'error'); return; }
    
    // 跳转到百度授权
    window.location.href = resp.url;
  } catch (err) {
    showToast('连接失败: ' + (err.message || err), 'error');
  }
}

async function backupToBaiduDrive() {
  const statusEl = document.getElementById('baidu-backup-status');
  const resultEl = document.getElementById('baidu-backup-result');
  if (!statusEl) return;
  
  // 读取日期选择
  const dateFrom = document.getElementById('baidu-backup-from')?.value || '';
  const dateTo = document.getElementById('baidu-backup-to')?.value || '';
  const hasDate = dateFrom && dateTo;
  
  statusEl.textContent = hasDate ? '正在获取数据...' : '正在全量备份所有数据...';
  if (resultEl) resultEl.style.display = 'none';
  
  try {
    statusEl.textContent = '正在上传到百度网盘...';
    const resp = await api.post('/api/cloud-drive/baidu/backup', { 
      dateFrom, dateTo 
    });
    
    if (resp.success) {
      statusEl.textContent = '';
      const s = resp.summary || {};
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <div class="space-y-1">
            <p><i class="fas fa-check-circle text-green-500 mr-1"></i>✅ 备份成功！</p>
            <p>📁 ${s.date || '全量'} 备份</p>
            <p>📊 ${s.dataItems || 0} 条数据 / ${s.dataFiles || 0} 个数据文件</p>
            <p>📎 ${s.attachments || 0}/${s.attachmentTotal || 0} 个附件</p>
            <p class="text-xs text-gray-400 mt-1">百度网盘路径：<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">${s.folder || resp.folder || ''}</code></p>
          </div>
        `;
      }
      showToast('百度网盘备份成功！', 'success');
    } else {
      statusEl.textContent = '❌ 备份失败: ' + (resp.error || '未知错误');
    }
  } catch (err) {
    statusEl.textContent = '❌ 备份失败: ' + (err.message || err);
  }
}

async function disconnectBaiduDrive() {
  try {
    await api.post('/api/cloud-drive/baidu/disconnect', {});
    showToast('已断开百度网盘连接', 'success');
    // 刷新页面更新 UI
    document.querySelector('.modal-backdrop')?.remove();
    showBackupConfig();
  } catch (err) {
    showToast('断开失败: ' + (err.message || err), 'error');
  }
}

// 检查百度网盘配置状态（全局+连接）
async function checkBaiduStatus() {
  try {
    // 1. 检查全局配置状态
    const configResp = await api.get('/api/cloud-drive/baidu/config-status');
    const badge = document.getElementById('baidu-global-badge');
    const inputs = document.getElementById('baidu-user-inputs');
    const saveBtn = document.getElementById('baidu-save-btn');
    
    if (badge && inputs && saveBtn) {
      if (configResp.hasGlobalConfig && !configResp.hasUserConfig) {
        // 使用全局配置：显示提示，隐藏输入框
        badge.style.display = 'block';
        inputs.style.display = 'none';
        saveBtn.style.display = 'none';
      } else {
        // 用户自定义配置：显示输入框，隐藏提示
        badge.style.display = 'none';
        inputs.style.display = 'block';
        saveBtn.style.display = 'inline-block';
      }
    }
    
    // 2. 检查连接状态
    const resp = await api.get('/api/cloud-drive/baidu/status');
    const form = document.getElementById('baidu-config-form');
    const info = document.getElementById('baidu-connected-info');
    if (form && info) {
      if (resp.connected) {
        form.style.display = 'none';
        info.style.display = 'block';
      } else {
        form.style.display = 'block';
        info.style.display = 'none';
      }
    }
  } catch(e) {}
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if (!json.data) { showToast('无效的数据文件', 'error'); return; }
    const result = await api.post('/api/import', { data: json.data });
    showToast(`导入完成：${Object.entries(result.imported).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    $('.fixed').remove();
  } catch (err) { showToast(err.message, 'error'); }
}

function showProcrastinationModal() {
  const modal = el('div', 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop');
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 modal-content shadow-2xl border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-6"><h3 class="font-bold text-xl text-gray-800 dark:text-white">记录拖延</h3><button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button></div>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">拖延原因</label>
          <div class="grid grid-cols-2 gap-2">${[{type:'vague',label:'任务太模糊'},{type:'fear',label:'害怕失败'},{type:'boring',label:'太无聊'},{type:'distracted',label:'被其他事吸引'},{type:'tired',label:'身体疲惫'},{type:'anxious',label:'焦虑不安'}].map(r=>`<button onclick="selectProcrastinationReason('${r.type}')" class="proc-reason-btn p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary transition-all text-sm text-center touch-btn" data-reason="${r.type}">${r.label}</button>`).join('')}</div></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">干扰源（可选）</label><input type="text" id="proc-distraction" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" placeholder="例如：短视频、社交媒体、游戏"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">详细说明（可选）</label><textarea id="proc-detail" rows="2" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none" placeholder="当时发生了什么..."></textarea></div>
      </div>
      <div class="mt-6"><button onclick="saveProcrastinationLog()" class="w-full bg-accent text-white py-3 rounded-xl font-medium hover:bg-accent/90 transition-all touch-btn">记录</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

let selectedProcReason = null;
function selectProcrastinationReason(type) {
  selectedProcReason = type;
  $$('.proc-reason-btn').forEach(btn => {
    if (btn.dataset.reason === type) { btn.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.remove('border-gray-200', 'dark:border-gray-600'); }
    else { btn.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20'); btn.classList.add('border-gray-200', 'dark:border-gray-600'); }
  });
}
async function saveProcrastinationLog() {
  if (!selectedProcReason) { showToast('请选择拖延原因', 'error'); return; }
  try {
    await api.post('/api/procrastination-logs', { reason_type: selectedProcReason, reason_detail: $('#proc-detail').value, distraction_source: $('#proc-distraction').value });
    showToast('已记录，不要批判自己，这是数据'); $('.fixed').remove();
  } catch (err) { showToast(err.message, 'error'); }
}

// ========== 全局初始化 ==========

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  // Esc 关闭弹窗
  if (e.key === 'Escape') {
    const modal = document.querySelector('.modal-backdrop');
    if (modal) modal.remove();
  }
  // / 搜索任务
  if (e.key === '/' && state.currentPage === 'tasks' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    $('#task-search')?.focus();
  }
  // 导航快捷键
  if (e.altKey) {
    const navMap = { '1': 'dashboard', '2': 'diary', '3': 'emotion', '4': 'tasks', '5': 'micro-start', '6': 'pomodoro', '7': 'lab', '8': 'commitments', '9': 'time-blocks' };
    if (navMap[e.key]) { e.preventDefault(); navigate(navMap[e.key]); }
  }
});

// 监听 hash 变化
// 修复 Bug7: 防止 navigate 和 hashchange 双重触发 render
var _navigateHash = '';
window.addEventListener('hashchange', () => {
  if (window.location.hash === _navigateHash) return;
  // 修复: 浏览器前进/后退触发的不需要滚动到顶部
  window._isBackForward = true;
  render();
});

// 首次加载 - 统一初始化入口
window.addEventListener('DOMContentLoaded', function() {
  restoreTimerState();
  const token = safeStorage.get('token');
  const hash = window.location.hash.slice(2) || 'dashboard';
  if (token && hash !== 'login') {
    // 有 token 且 hash 指向非登录页，导航到对应的页面
    navigate(hash);
  } else if (token && hash === 'login') {
    navigate('dashboard');
  } else {
    navigate('login');
  }
});

// 页面可见性变化（后台计时器处理）
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (typeof timerRunning !== 'undefined' && timerRunning || typeof pomoRunning !== 'undefined' && pomoRunning)) {
    updateTimerDisplay();
  }
});

// 防止意外关闭时的计时器丢失
window.addEventListener('beforeunload', (event) => {
  if ((typeof timerRunning !== 'undefined' && timerRunning || typeof pomoRunning !== 'undefined' && pomoRunning) && 
      ((typeof timerSeconds !== 'undefined' && timerSeconds > 0) || (typeof pomoSeconds !== 'undefined' && pomoSeconds > 0))) {
    saveTimerState();
    event.preventDefault();
    event.returnValue = '';
  }
});

// 修复 FE-010: 事件监听器引用，用于清理
const eventListeners = [];

function addTrackedEventListener(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  eventListeners.push({ target, type, handler });
}

function cleanupEventListeners() {
  eventListeners.forEach(({ target, type, handler }) => {
    target.removeEventListener(type, handler);
  });
  eventListeners.length = 0;
}

function initPageInteractions(page) {
  // 页面特定初始化
  cleanupEventListeners(); // 清理上一个页面的监听器

  // 修复: 离开 stats 页面时销毁 Chart.js 实例
  if (page !== 'stats') {
    ['taskTrendChartInstance', 'emotionTrendChartInstance', 'procrastinationChartInstance'].forEach(function(key) {
      if (window[key]) { try { window[key].destroy(); } catch(e) {} window[key] = null; }
    });
  }
  
  // 修复: 离开 assistant 页面时清理后台计时器
  if (page !== 'assistant' && window.cleanupReminders) {
    window.cleanupReminders();
  }

  if (page === 'micro-start') {
    // 计时器状态已在 restoreTimerState 中处理
  }
}


// ========== 全局函数挂载（修复模块作用域问题）==========
// 将所有通过 HTML 内联事件调用的函数挂载到 window 对象
(function() {
  window.$ = $;
  window.$$ = $$;
  window.el = el;
window.completeCommitment = completeCommitment;
window.createCommitment = createCommitment;
window.createStep = createStep;
window.createTask = createTask;
window.createTimeBlock = createTimeBlock;
window.debouncedSearch = debouncedSearch;
window.deleteCommitment = deleteCommitment;
window.recordRelapse = recordRelapse;
window.deleteTask = deleteTask;
window.deleteTimeBlock = deleteTimeBlock;
window.exportData = exportData;
window.backupToCloud = backupToCloud;
window.showBackupConfig = showBackupConfig;
window.saveBaiduConfig = saveBaiduConfig;
window.connectBaiduDrive = connectBaiduDrive;
window.backupToBaiduDrive = backupToBaiduDrive;
window.disconnectBaiduDrive = disconnectBaiduDrive;
window.filterTasks = filterTasks;
window.finishTimer = finishTimer;
window.handleImportFile = handleImportFile;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.loadTimeBlocks = loadTimeBlocks;
window.logout = logout;
window.navigate = navigate;
window.onMicroTaskChange = onMicroTaskChange;
window.pausePomodoro = pausePomodoro;
window.quickMicroStart = quickMicroStart;
window.resetPomodoro = resetPomodoro;
window.saveApiBase = saveApiBase;
window.changePassword = changePassword;
window.saveEmotion = saveEmotion;
window.saveProcrastinationLog = saveProcrastinationLog;
window.selectBlockEnergy = selectBlockEnergy;
window.selectBlockType = selectBlockType;
window.selectEmotion = selectEmotion;
window.selectEnergy = selectEnergy;
window.selectProcrastinationReason = selectProcrastinationReason;
window.selectStepDuration = selectStepDuration;
window.showCommitmentModal = showCommitmentModal;
window.showImportModal = showImportModal;
window.showProcrastinationModal = showProcrastinationModal;
window.showStepModal = showStepModal;
window.showTaskModal = showTaskModal;
window.showTaskTemplates = showTaskTemplates;
window.showTimeBlockModal = showTimeBlockModal;
window.skipPomodoro = skipPomodoro;
window.startPomodoro = startPomodoro;
window.startStepMicro = startStepMicro;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.toggleAuthMode = toggleAuthMode;
window.toggleDarkMode = toggleDarkMode;
window.toggleStep = toggleStep;
window.toggleReminder = toggleReminder;
window.navigate = navigate;
window.updateTaskStatus = updateTaskStatus;
window.useTemplate = useTemplate;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.setFontSize = setFontSize;
window.savePomodoroSettings = savePomodoroSettings;
window.saveReminderSettings = saveReminderSettings;
window.showClearDataConfirm = showClearDataConfirm;
window.executeClearData = executeClearData;
window.showConfirmModal = showConfirmModal;
window.setupModalFocusTrap = setupModalFocusTrap;
window.escapeHtml = window.escapeHtml || escapeHtml;

// ========== IIFE 结束 ==========
})();

// ========== 每日一言 ==========
var dailyQuotes = [
  '"命是弱者的借口，运是强者的谦辞。"',
  '"你朋友说2028才知道要干什么？那就用2026的结果打他的脸。"',
  '"不是看到了希望才去坚持，而是坚持了才看到希望。"',
  '"种一棵树最好的时间是十年前，其次是现在。"',
  '"自由意志不是为所欲为，而是可以选择不认命。"',
  '"送外卖不丢人，30岁还不敢做梦才丢人。"',
  '"普通人用时间换钱，聪明人用内容换时间。"',
  '"你的对手不是那个算命的，是昨天那个什么都没做的自己。"',
  '"每天早起1小时，一年就多出365小时——相当于多活15天。"',
  '"做你没做过的事叫成长，做你不愿做的事叫改变，做你不敢做的事叫突破。"',
  '"60天后的你会感谢今天开始行动的自己。"',
  '"运气是行动的影子，你跑得越快它跟得越紧。"',
];
window._dailyQuote = dailyQuotes[Math.floor(Math.random() * dailyQuotes.length)];

// ========== 全局键盘快捷键 ==========
document.addEventListener('keydown', function(e) {
  // 不在输入框中才生效
  var tag = (e.target || {}).tagName || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch(e.key) {
    case 'd': case 'D': navigate('dashboard'); break;
    case 'w': case 'W': navigate('weekly'); break;
    case 't': case 'T': navigate('tasks'); break;
    case '1': navigate('micro-start'); break;
    case '2': navigate('diary'); break;
    case '3': navigate('fate-killer'); break;
    case '4': navigate('assistant'); break;
    case '5': navigate('stats'); break;
    case 'n': case 'N': window._quickAdd(); break;
  }
});

// ========== Quick Add 浮动按钮 ==========
window._quickAdd = function() {
  var overlay = document.getElementById('fk-quick-add-overlay');
  if (overlay) { overlay.remove(); return; }
  
  overlay = document.createElement('div');
  overlay.id = 'fk-quick-add-overlay';
  overlay.style.cssText = 'position:fixed;bottom:90px;right:20px;z-index:9998;background:var(--color-background-primary,#fff);border:1px solid var(--color-border-tertiary,#e2e8f0);border-radius:16px;padding:16px;width:300px;max-width:90vw;box-shadow:0 8px 30px rgba(0,0,0,0.15);animation:fkSlideUp 0.2s ease;';
  overlay.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
    '<span style="font-weight:600;font-size:14px;">' + icon('bolt') + ' 快速记录</span>' +
    '<button onclick="document.getElementById(\'fk-quick-add-overlay\').remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;">' + '×' + '</button></div>' +
    '<textarea id="fk-quick-input" placeholder="记下灵感、想法、待办..." style="width:100%;min-height:70px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:none;outline:none;box-sizing:border-box;margin-bottom:10px;"></textarea>' +
    '<div style="display:flex;gap:6px;">' +
    '<button onclick="window._quickSave(\'inspiration\')" style="flex:1;padding:7px;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;">' + icon('lightbulb') + ' 存为灵感</button>' +
    '<button onclick="document.getElementById(\'fk-quick-add-overlay\').remove()" style="padding:7px 12px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:12px;cursor:pointer;">' + '取消' + '</button></div>';
  document.body.appendChild(overlay);
  setTimeout(function() {
    var inp = document.getElementById('fk-quick-input');
    if (inp) inp.focus();
  }, 100);
};

window._quickSave = async function(type) {
  var content = document.getElementById('fk-quick-input')?.value?.trim();
  if (!content) return;
  try {
    if (type === 'inspiration') {
      await api.post('/api/diary', {
        title: '快速灵感 ' + new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
        content: content,
        template_type: 'inspiration',
        is_private: true
      });
      // 同时保存到本地 localStorage，新灵感页面能实时看到
      try {
        var localList = JSON.parse(localStorage.getItem('inspirations') || '[]');
        localList.unshift({
          id: Date.now(),
          text: content,
          tags: ['快速'],
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('inspirations', JSON.stringify(localList));
      } catch(e) {}
    }
    showToast('已保存 ✅', 'success');
    document.getElementById('fk-quick-add-overlay')?.remove();
  } catch(e) {
    showToast('保存失败', 'error');
  }
};

// 添加Quick Add浮动球
(function() {
  var fab = document.createElement('div');
  fab.id = 'fk-fab';
  fab.title = '快速记录 (N)';
  fab.style.cssText = 'position:fixed;bottom:76px;right:16px;z-index:9997;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 15px rgba(99,102,241,0.4);font-size:18px;transition:transform 0.2s,bottom 0.3s;border:none;';
  fab.innerHTML = '<i class="fas fa-plus"></i>';
  fab.onmouseenter = function() { this.style.transform = 'scale(1.1)'; };
  fab.onmouseleave = function() { this.style.transform = 'scale(1)'; };
  fab.onclick = function() { window._quickAdd(); };
  document.body.appendChild(fab);

  // 监听底部导航栏的显示状态，调整FAB位置
  var observer = new MutationObserver(function() {
    var nav = document.querySelector('.bottom-nav');
    if (nav && nav.style.display !== 'none') {
      fab.style.bottom = '76px';
    } else {
      fab.style.bottom = '20px';
    }
  });
  setTimeout(function() {
    var nav = document.querySelector('.bottom-nav');
    if (nav) observer.observe(nav, { attributes: true, attributeFilter: ['style'] });
  }, 1000);
})();
