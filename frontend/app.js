
// ==================== 周迹前端 v2.0 - 全面优化版 ====================
// 新增：深色模式、番茄钟、数据导入、任务模板、键盘快捷键、计时器持久化


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
  
  // 3. 返回空，需要在登录页手动配置
  return '';
}
// 兼容旧代码的常量引用（指向函数调用结果，但关键路径使用 getApiBase()）
const API_BASE = getApiBase();
// 修复 FE-005: 如果未设置 API_BASE，显示配置提示
if (!API_BASE && window.location.hash !== '#/login') {
  console.warn('API_BASE 未设置，请在登录页面配置后端地址');
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
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Loading 控制
function showLoading() { $('#loading')?.classList.remove('hidden'); }
function hideLoading() { $('#loading')?.classList.add('hidden'); }

// API 封装（带 loading 和错误处理）
const api = {
  _offlineQueue: [],
  _isOnline: navigator.onLine,

  async request(method, endpoint, body, options) {
    if (body === void 0) { body = null; }
    if (options === void 0) { options = {}; }
    var retries = options.retries || 2;
    var timeout = options.timeout || 30000;
    showLoading();

    var token = safeStorage.get('token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    if (!this._isOnline && method !== 'GET') {
      this._offlineQueue.push({ method: method, endpoint: endpoint, body: body, timestamp: Date.now() });
      safeStorage.set('offline_queue', JSON.stringify(this._offlineQueue));
      hideLoading();
      throw new Error('当前处于离线模式，请求已加入队列，恢复后自动同步');
    }

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

        if (this._offlineQueue.length > 0 && navigator.onLine) {
          this._syncOfflineQueue();
        }

        hideLoading();
        return data;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          console.warn('请求超时，重试中...');
        } else if (err.message && err.message.includes('Failed to fetch')) {
          this._isOnline = false;
          if (method !== 'GET') {
            this._offlineQueue.push({ method: method, endpoint: endpoint, body: body, timestamp: Date.now() });
          }
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

  async _syncOfflineQueue() {
    if (this._offlineQueue.length === 0 || !navigator.onLine) return;
    var queue = this._offlineQueue.slice();
    this._offlineQueue = [];
    safeStorage.remove('offline_queue');
    var syncCount = 0;
    for (var i = 0; i < queue.length; i++) {
      try {
        await this.request(queue[i].method, queue[i].endpoint, queue[i].body, { retries: 1 });
        syncCount++;
      } catch (e) {
        console.error('离线同步失败:', e);
      }
    }
    if (syncCount > 0) showToast(syncCount + '条离线数据已同步', 'success');
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
  timer: null, timerSeconds: 0, timerTotal: 120, timerRunning: false,
  pomodoroTimer: null, pomodoroSeconds: 0, pomodoroRunning: false, pomodoroMode: 'work',
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
  'emotion': renderEmotion, 'tasks': renderTasks,
  'task-detail': renderTaskDetail, 'micro-start': renderMicroStart,
  'pomodoro': renderPomodoro, 'lab': renderLab,
  'commitments': renderCommitments, 'time-blocks': renderTimeBlocks,
  'settings': renderSettings
};

function navigate(page, params = {}) {
  state.currentPage = page;
  state.pageParams = params;
  // 修复 Bug3: 将参数写入URL hash，刷新后不丢失
  var hashPath = '#/' + page;
  if (params.id) hashPath += '/' + params.id;
  // 修复 Bug7: 防止 navigate 和 hashchange 双重触发 render
  _navigateHash = hashPath;
  window.location.hash = hashPath;
  window.scrollTo(0, 0);  // 修复 FE-020: 切换路由时滚动到顶部
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
  app.innerHTML = '';

  // 修复 Bug6: await 渲染结果，兼容 sync/async 渲染函数
  const content = await renderer();
  if (page !== 'login') {
    app.appendChild(renderNav());
    const main = el('main', 'pb-20 md:pb-0 md:ml-64 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors');
    main.appendChild(content);
    app.appendChild(main);
  } else {
    app.appendChild(content);
  }

  initPageInteractions(page);
}

// 导航栏
function renderNav() {
  const nav = el('nav', 'fixed bottom-0 left-0 right-0 md:fixed md:top-0 md:left-0 md:bottom-0 md:w-64 bg-white dark:bg-gray-800 md:border-r border-gray-200 dark:border-gray-700 z-50 shadow-lg md:shadow-none transition-colors');

  const items = [
    { id: 'dashboard', icon: 'fa-chart-line', label: '仪表盘' },
    { id: 'emotion', icon: 'fa-heart', label: '情绪舱' },
    { id: 'tasks', icon: 'fa-tasks', label: '任务台' },
    { id: 'micro-start', icon: 'fa-play-circle', label: '微启动' },
    { id: 'pomodoro', icon: 'fa-stopwatch', label: '番茄钟' },
    { id: 'lab', icon: 'fa-flask', label: '实验室' },
    { id: 'commitments', icon: 'fa-handshake', label: '承诺' },
    { id: 'time-blocks', icon: 'fa-clock', label: '时间块' },
  ];
  const current = state.currentPage;

  let html = `<div class="flex md:flex-col justify-around md:justify-start md:p-4 h-16 md:h-full items-center md:items-stretch">`;

  html += `
    <div class="hidden md:flex items-center gap-3 px-4 py-6 mb-4">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">周</div>
      <div><h1 class="font-bold text-gray-800 dark:text-white">周迹</h1><p class="text-xs text-gray-500 dark:text-gray-400">管理启动</p></div>
    </div>
  `;

  items.forEach(item => {
    const active = current === item.id ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50';
    html += `
      <button onclick="navigate('${item.id}')" class="touch-btn flex flex-col md:flex-row items-center md:gap-3 md:px-4 md:py-3 rounded-xl transition-all ${active}">
        <i class="fas ${item.icon} text-lg md:text-xl mb-1 md:mb-0"></i>
        <span class="text-xs md:text-sm font-medium">${item.label}</span>
      </button>
    `;
  });

  html += `
    <div class="hidden md:block mt-auto">
      <button onclick="toggleDarkMode()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all w-full">
        <i class="fas fa-${state.darkMode ? 'sun' : 'moon'} text-lg"></i>
        <span class="text-sm font-medium">${state.darkMode ? '浅色' : '深色'}</span>
      </button>
      <button onclick="navigate('settings')" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all w-full">
        <i class="fas fa-cog text-lg"></i><span class="text-sm font-medium">设置</span>
      </button>
      <button onclick="logout()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-all w-full">
        <i class="fas fa-sign-out-alt text-lg"></i><span class="text-sm font-medium">退出</span>
      </button>
    </div>
  </div>`;

  nav.innerHTML = html;
  return nav;
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  safeStorage.set('dark_mode', state.darkMode);
  document.documentElement.classList.toggle('dark', state.darkMode);
  render();
}

// ========== 登录页 ==========
function renderLogin() {
  const div = el('div', 'min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 p-4');
  div.innerHTML = `
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 fade-in border border-gray-100 dark:border-gray-700">
        <div class="text-center mb-8">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">周</div>
          <h1 class="text-2xl font-bold text-gray-800 dark:text-white">周迹</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">不是管理时间，是管理启动</p>
        </div>
        <div id="login-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
            <input type="text" id="login-username" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="请输入用户名" onkeydown="if(event.key==='Enter')handleLogin()">
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
            <input type="password" id="login-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="至少6位" onkeydown="if(event.key==='Enter')handleLogin()">
          </div>
          <button onclick="handleLogin()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 touch-btn">进入系统</button>
          <p class="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">还没有账号？<button onclick="toggleAuthMode()" class="text-primary font-medium">立即注册</button></p>
        </div>
        <div id="register-form" class="hidden">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
            <input type="text" id="reg-username" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="至少3位" onkeydown="if(event.key==='Enter')handleRegister()">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
            <input type="password" id="reg-password" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="至少6位" onkeydown="if(event.key==='Enter')handleRegister()">
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邮箱（可选）</label>
            <input type="email" id="reg-email" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="your@email.com">
          </div>
          <button onclick="handleRegister()" class="w-full bg-secondary text-white py-3 rounded-xl font-medium hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/25 touch-btn">创建账号</button>
          <p class="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">已有账号？<button onclick="toggleAuthMode()" class="text-primary font-medium">直接登录</button></p>
        </div>
        <div class="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          <p class="text-xs text-gray-400 text-center">API 地址</p>
          <input type="text" id="api-base-input" value="${getApiBase()}" class="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 text-gray-500 focus:border-primary outline-none" placeholder="https://your-api.workers.dev">
        </div>
      </div>
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

function showToast(message, type) {
  if (type === void 0) { type = 'success'; }
  var existing = document.querySelector('.toast-notification');
  if (existing) {
    if (existing.dataset.message === message && existing.dataset.type === type) {
      return;
    }
    existing.remove();
  }
  const colors = { success: 'bg-secondary text-white', error: 'bg-danger text-white', warning: 'bg-accent text-white', info: 'bg-calm text-white' };
  var toast = el('div', 'toast-notification fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg z-[100] ' + colors[type] + ' fade-in flex items-center gap-2');
  toast.dataset.message = message;
  toast.dataset.type = type;
  toast.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i><span class="font-medium">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(-50%) translateY(-10px)'; setTimeout(()=>toast.remove(),300); }, 3000);
}

// ========== 仪表盘 ==========
async function renderDashboard() {
  const div = el('div', 'p-4 md:p-8 max-w-6xl mx-auto fade-in');

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

    div.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">欢迎回来</h2>
        <p class="text-gray-500 dark:text-gray-400">${new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2"><span class="text-xs md:text-sm text-gray-500 dark:text-gray-400">今日任务</span><i class="fas fa-tasks text-primary/60"></i></div>
          <p class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">${stats.tasks_created || 0}</p>
          <p class="text-xs text-gray-400 mt-1">${stats.tasks_completed || 0} 已完成</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2"><span class="text-xs md:text-sm text-gray-500 dark:text-gray-400">微启动</span><i class="fas fa-play-circle text-secondary/60"></i></div>
          <p class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">${stats.micro_starts_count || 0}</p>
          <p class="text-xs text-gray-400 mt-1">2分钟契约</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2"><span class="text-xs md:text-sm text-gray-500 dark:text-gray-400">番茄钟</span><i class="fas fa-stopwatch text-danger/60"></i></div>
          <p class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">${todayPomo.count || 0}</p>
          <p class="text-xs text-gray-400 mt-1">${todayPomo.completed || 0} 完成</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2"><span class="text-xs md:text-sm text-gray-500 dark:text-gray-400">拖延记录</span><i class="fas fa-exclamation-triangle text-accent/60"></i></div>
          <p class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">${stats.procrastination_count || 0}</p>
          <p class="text-xs text-gray-400 mt-1">今日觉察</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700 col-span-2 md:col-span-1">
          <div class="flex items-center justify-between mb-2"><span class="text-xs md:text-sm text-gray-500 dark:text-gray-400">本周启动率</span><i class="fas fa-chart-line text-calm/60"></i></div>
          <p class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">${startRate}%</p>
          <p class="text-xs text-gray-400 mt-1">任务启动比例</p>
        </div>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <div class="md:col-span-2 space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-800 dark:text-white flex items-center gap-2"><i class="fas fa-mountain text-warm"></i> 今日时间地形</h3>
              <button onclick="navigate('time-blocks')" class="text-sm text-primary hover:underline">管理</button>
            </div>
            <div class="relative h-40 md:h-48 bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden">${renderTimeTerrain(blocks)}</div>
            <div class="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600"></span>已逝</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-primary/30"></span>计划</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-secondary/30"></span>完成</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-accent/30"></span>进行中</span>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-800 dark:text-white flex items-center gap-2"><i class="fas fa-clipboard-list text-primary"></i> 待启动任务</h3>
              <button onclick="navigate('tasks')" class="text-sm text-primary hover:underline">查看全部</button>
            </div>
            ${tasks.length === 0 ? `
              <div class="text-center py-8 text-gray-400 dark:text-gray-500">
                <i class="fas fa-seedling text-4xl mb-3 text-gray-300 dark:text-gray-600"></i>
                <p>还没有任务，去创建第一个吧</p>
                <button onclick="navigate('tasks')" class="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm touch-btn">创建任务</button>
              </div>
            ` : `<div class="space-y-3">${tasks.map(task => `
              <div class="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-pointer touch-btn" onclick="navigate('task-detail', {id: ${task.id}})">
                <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400"><i class="fas fa-${getCategoryIcon(task.category)}"></i></div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium text-gray-800 dark:text-gray-200 truncate">${task.title}</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${task.steps_count} 个原子步骤 · 难度 ${'★'.repeat(task.difficulty)}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(task.status)}">${getStatusLabel(task.status)}</span>
              </div>
            `).join('')}</div>`}
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-calm"></i> 近7天行动趋势</h3>
            <div class="h-40 flex items-end gap-1 md:gap-2">
              ${weekly.map((d, i) => {
                const max = Math.max(...weekly.map(x => Math.max(x.tasks_completed||0, x.micro_starts_count||0, x.procrastination_count||0, x.pomodoro_count||0))) || 1;
                const h1 = Math.round(((d.tasks_completed||0) / max) * 100);
                const h2 = Math.round(((d.micro_starts_count||0) / max) * 100);
                const h3 = Math.round(((d.procrastination_count||0) / max) * 100);
                const h4 = Math.round(((d.pomodoro_count||0) / max) * 100);
                return `<div class="flex-1 flex flex-col items-center gap-1">
                  <div class="w-full flex gap-px md:gap-0.5 h-32 items-end">
                    <div class="flex-1 bg-secondary/60 rounded-t" style="height:${Math.max(4,h1)}%"></div>
                    <div class="flex-1 bg-primary/60 rounded-t" style="height:${Math.max(4,h2)}%"></div>
                    <div class="flex-1 bg-accent/60 rounded-t" style="height:${Math.max(4,h3)}%"></div>
                    <div class="flex-1 bg-danger/60 rounded-t" style="height:${Math.max(4,h4)}%"></div>
                  </div>
                  <span class="text-xs text-gray-400">${d.stat_date?.slice(5) || ''}</span>
                </div>`;
              }).join('')}
            </div>
            <div class="flex gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400 justify-center flex-wrap">
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-secondary/60"></span>完成</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-primary/60"></span>启动</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-accent/60"></span>拖延</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-danger/60"></span>番茄</span>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6 border border-primary/10 dark:border-primary/20">
            <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><i class="fas fa-heart text-danger"></i> 情绪状态</h3>
            ${emotion ? `
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">${getEmotionEmoji(emotion.emotion_type)}</span>
                  <div><p class="font-medium text-gray-800 dark:text-white">${getEmotionLabel(emotion.emotion_type)}</p><p class="text-xs text-gray-500 dark:text-gray-400">${new Date(emotion.created_at).toLocaleString('zh-CN')}</p></div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">能量</span>
                  <div class="flex-1 h-2 bg-white/50 dark:bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-danger to-secondary rounded-full" style="width:${(emotion.energy_level/5)*100}%"></div>
                  </div>
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${emotion.energy_level}/5</span>
                </div>
              </div>
            ` : `<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">还没有记录情绪，开始第一次扫描吧</p>`}
            <button onclick="navigate('emotion')" class="w-full mt-4 bg-white/80 dark:bg-white/10 backdrop-blur text-primary py-2 rounded-xl text-sm font-medium hover:bg-white dark:hover:bg-white/20 transition-all touch-btn">${emotion ? '重新扫描' : '情绪扫描'}</button>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="font-bold text-gray-800 dark:text-white mb-4">快速行动</h3>
            <div class="space-y-3">
              <button onclick="navigate('micro-start')" class="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all text-left touch-btn">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><i class="fas fa-play"></i></div>
                <div><p class="font-medium">2分钟契约</p><p class="text-xs text-gray-500 dark:text-gray-400">只做2分钟，然后自由选择</p></div>
              </button>
              <button onclick="navigate('pomodoro')" class="w-full flex items-center gap-3 p-4 rounded-xl bg-danger/5 dark:bg-danger/10 text-danger hover:bg-danger/10 dark:hover:bg-danger/20 transition-all text-left touch-btn">
                <div class="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center"><i class="fas fa-stopwatch"></i></div>
                <div><p class="font-medium">番茄钟</p><p class="text-xs text-gray-500 dark:text-gray-400">25分钟专注 + 5分钟休息</p></div>
              </button>
              <button onclick="navigate('tasks')" class="w-full flex items-center gap-3 p-4 rounded-xl bg-secondary/5 dark:bg-secondary/10 text-secondary hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-all text-left touch-btn">
                <div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center"><i class="fas fa-cut"></i></div>
                <div><p class="font-medium">拆解任务</p><p class="text-xs text-gray-500 dark:text-gray-400">把模糊任务切成原子步骤</p></div>
              </button>
              <button onclick="navigate('lab')" class="w-full flex items-center gap-3 p-4 rounded-xl bg-accent/5 dark:bg-accent/10 text-accent hover:bg-accent/10 dark:hover:bg-accent/20 transition-all text-left touch-btn">
                <div class="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><i class="fas fa-microscope"></i></div>
                <div><p class="font-medium">拖延模式</p><p class="text-xs text-gray-500 dark:text-gray-400">看看你的拖延规律</p></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    div.innerHTML = `<div class="p-8 text-center text-danger">加载失败: ${err.message}</div>`;
  }
  return div;
}

function renderTimeTerrain(blocks) {
  if (blocks.length === 0) {
    return `<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
      <div class="text-center"><i class="fas fa-mountain text-3xl mb-2 text-gray-300 dark:text-gray-600"></i><p class="text-sm">还没有时间块</p><button onclick="navigate('time-blocks')" class="mt-2 text-xs text-primary">添加时间块</button></div>
    </div>`;
  }
  const hours = Array.from({length: 24}, (_, i) => i);
  const now = new Date(); const currentHour = now.getHours();
  let html = '<div class="absolute inset-0 flex">';
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
    html += `<div class="flex-1 ${color} border-r border-white/30 dark:border-gray-800/30 relative group"><div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">${hour}:00</div></div>`;
  });
  html += `</div><div class="absolute top-2 left-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 py-1 rounded text-xs font-medium dark:text-white">当前 ${currentHour}:${String(now.getMinutes()).padStart(2,'0')}</div>`;
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
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
const debouncedSearch = debounce(() => loadTasks(), 300);

async function loadTasks() {
  try {
    const search = $('#task-search')?.value?.trim();
    let params = currentTaskFilter !== 'all' ? `?status=${currentTaskFilter}` : '';
    if (search) params += (params ? '&' : '?') + `search=${encodeURIComponent(search)}`;
    const data = await api.get('/api/tasks' + params);
    state.tasks = data.tasks || [];
    const container = $('#tasks-list');
    if (!state.tasks.length) {
      container.innerHTML = `<div class="text-center py-12"><i class="fas fa-clipboard text-4xl text-gray-300 dark:text-gray-600 mb-4"></i><p class="text-gray-500 dark:text-gray-400">还没有任务</p><button onclick="showTaskModal()" class="mt-4 text-primary font-medium">创建第一个任务</button></div>`;
      return;
    }
    container.innerHTML = state.tasks.map(task => `
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30 transition-all">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400"><i class="fas fa-${getCategoryIcon(task.category)}"></i></div>
            <div><h4 class="font-medium text-gray-800 dark:text-gray-200">${task.title}</h4><p class="text-xs text-gray-500 dark:text-gray-400">${task.category} · 难度 ${'★'.repeat(task.difficulty)}${'☆'.repeat(5-task.difficulty)}</p></div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(task.status)}">${getStatusLabel(task.status)}</span>
        </div>
        ${task.description ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${task.description}</p>` : ''}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><i class="fas fa-shoe-prints mr-1"></i>${task.steps_count} 个步骤</span>
            ${task.due_date ? `<span><i class="fas fa-calendar mr-1"></i>${task.due_date}</span>` : ''}
          </div>
          <div class="flex gap-2">
            <button onclick="navigate('task-detail', {id: ${task.id}})" class="px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">拆解</button>
            ${task.status !== 'completed' ? `<button onclick="quickMicroStart(${task.id})" class="px-3 py-1.5 rounded-lg text-sm bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all touch-btn">启动</button>` : ''}
            <button onclick="deleteTask(${task.id})" class="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20 transition-all touch-btn"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    $('#tasks-list').innerHTML = `<div class="text-center py-12 text-danger">加载失败: ${err.message}</div>`;
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
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button>
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
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i class="fas fa-times text-xl"></i></button>
      </div>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">任务标题</label>
          <input type="text" id="new-task-title" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" placeholder="例如：写论文、整理房间" onkeydown="if(event.key==='Enter')createTask()"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述（可选）</label>
          <textarea id="new-task-desc" rows="2" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none resize-none" placeholder="补充说明..."></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <select id="new-task-category" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="general">一般</option><option value="work">工作</option><option value="study">学习</option><option value="health">健康</option><option value="life">生活</option><option value="social">社交</option>
            </select></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">难度</label>
            <select id="new-task-difficulty" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none">
              <option value="1">⭐ 非常简单</option><option value="2">⭐⭐ 简单</option><option value="3" selected>⭐⭐⭐ 中等</option><option value="4">⭐⭐⭐⭐ 困难</option><option value="5">⭐⭐⭐⭐⭐ 非常困难</option>
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
      due_date: $('#new-task-due').value || null
    });
    showToast('任务创建成功');
    $('.fixed').remove();
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('确定要删除这个任务吗？所有相关数据也会被删除。')) return;
  try { await api.del(`/api/tasks/${id}`); showToast('任务已删除'); loadTasks(); }
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
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${task.title}</h2>
        <p class="text-gray-500 dark:text-gray-400">${task.description || '无描述'}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div class="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700">${task.category}</span>
          <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700">难度 ${'★'.repeat(task.difficulty)}${'☆'.repeat(5-task.difficulty)}</span>
          <span class="px-3 py-1 rounded-full ${getStatusStyle(task.status)}">${getStatusLabel(task.status)}</span>
          ${task.due_date ? `<span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700"><i class="fas fa-calendar mr-1"></i>${task.due_date}</span>` : ''}
        </div>
        <div class="flex gap-2">
          ${task.status !== 'completed' ? `
            <button onclick="updateTaskStatus(${taskId}, 'completed')" class="flex-1 bg-secondary text-white py-2 rounded-xl font-medium hover:bg-secondary/90 transition-all touch-btn"><i class="fas fa-check mr-1"></i>标记完成</button>
            <button onclick="startStepMicro(${taskId})" class="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn"><i class="fas fa-play"></i></button>
          ` : `<button onclick="updateTaskStatus(${taskId}, 'pending')" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-undo mr-1"></i>重新打开</button>`}
          <button onclick="deleteTask(${taskId}); navigate('tasks')" class="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-danger hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
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
  } catch (err) { div.innerHTML = `<div class="text-center py-12 text-danger">加载失败: ${err.message}</div>`; }
  return div;
}

async function updateTaskStatus(id, status) {
  try { await api.put(`/api/tasks/${id}`, { status }); showToast(status === 'completed' ? '任务已完成！' : '任务已重新打开'); navigate('task-detail', { id }); }
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

// ========== 微启动 ==========
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
        <div class="relative w-48 h-48 mx-auto mb-6">
          <svg class="w-full h-full transform -rotate-90"><circle cx="96" cy="96" r="88" stroke="currentColor" stroke-width="8" fill="none" class="text-gray-100 dark:text-gray-700"/>
            <circle id="timer-progress" cx="96" cy="96" r="88" stroke="url(#gradient)" stroke-width="8" fill="none" stroke-dasharray="553" stroke-dashoffset="0" stroke-linecap="round" class="timer-circle"/>
            <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#4F46E5"/><stop offset="100%" style="stop-color:#10B981"/></linearGradient></defs>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span id="timer-display" class="text-4xl font-bold text-gray-800 dark:text-white">02:00</span>
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
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 class="font-bold text-gray-800 dark:text-white mb-4">近期微启动记录</h3>
      <div id="micro-history" class="space-y-3"><p class="text-gray-400 dark:text-gray-500 text-center py-4">加载中...</p></div>
    </div>
  `;
  setTimeout(() => { loadMicroTaskOptions(); loadMicroHistory(); restoreTimerState(); if (state.timerRunning) resumeTimerUI(); }, 100);
  return div;
}

async function loadMicroTaskOptions() {
  try {
    const data = await api.get('/api/tasks?status=pending');
    const select = $('#micro-task-select');
    if (!select) return;
    data.tasks.forEach(task => {
      const opt = document.createElement('option'); opt.value = task.id; opt.textContent = task.title;
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
  }, 100);  // 每 100ms 检查一次，更精确
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
        <div class="flex-1 min-w-0"><p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">${ms.task_title || '自由启动'}</p><p class="text-xs text-gray-500 dark:text-gray-400">${ms.actual_duration}分钟 · ${new Date(ms.created_at).toLocaleString('zh-CN')}</p></div>
        ${ms.continued_after_contract ? '<span class="text-xs text-secondary font-medium">继续了</span>' : ''}
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// ========== 番茄钟 ==========
function renderPomodoro() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-white">番茄钟</h2>
      <p class="text-gray-500 dark:text-gray-400">25分钟专注 + 5分钟休息</p>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择任务（可选）</label>
        <select id="pomo-task-select" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none"><option value="">-- 自由番茄 --</option></select>
      </div>
      <div class="text-center py-8">
        <div class="relative w-56 h-56 mx-auto mb-6">
          <svg class="w-full h-full transform -rotate-90">
            <circle cx="112" cy="112" r="100" stroke="currentColor" stroke-width="10" fill="none" class="text-gray-100 dark:text-gray-700"/>
            <circle id="pomo-progress" cx="112" cy="112" r="100" stroke="url(#pomoGradient)" stroke-width="10" fill="none" stroke-dasharray="628" stroke-dashoffset="0" stroke-linecap="round" class="timer-circle"/>
            <defs><linearGradient id="pomoGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#EF4444"/><stop offset="100%" style="stop-color:#F97316"/></linearGradient></defs>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span id="pomo-display" class="text-5xl font-bold text-gray-800 dark:text-white">25:00</span>
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
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 class="font-bold text-gray-800 dark:text-white mb-4">近期番茄记录</h3>
      <div id="pomo-history" class="space-y-3"><p class="text-gray-400 dark:text-gray-500 text-center py-4">加载中...</p></div>
    </div>
  `;
  setTimeout(() => { loadPomoTaskOptions(); loadPomodoroHistory(); updatePomoStats(); }, 100);
  return div;
}

async function loadPomoTaskOptions() {
  try {
    const data = await api.get('/api/tasks?status=pending');
    const select = $('#pomo-task-select');
    if (!select) return;
    data.tasks.forEach(task => { const opt = document.createElement('option'); opt.value = task.id; opt.textContent = task.title; select.appendChild(opt); });
  } catch (err) { console.error(err); }
}

// pomoInterval/pomoSeconds/pomoTotal/pomoRunning/pomoMode/pomoRound/pomoFocusCount 已在全局声明
const POMO_WORK = 1500, POMO_SHORT_BREAK = 300, POMO_LONG_BREAK = 900;

function startPomodoro() {
  pomoRunning = true;
  $('#pomo-btn-start').classList.add('hidden');
  $('#pomo-btn-pause').classList.remove('hidden');
  $('#pomo-btn-skip').classList.remove('hidden');
  $('#pomo-mode').textContent = pomoMode === 'work' ? '专注时间' : pomoMode === 'short_break' ? '短休息' : '长休息';
  $('#pomo-mode').className = `text-sm font-medium mt-2 ${pomoMode === 'work' ? 'text-danger' : 'text-secondary'}`;
  document.querySelector('.relative.w-56')?.classList.add(pomoMode === 'work' ? 'pomodoro-active' : 'pomodoro-break');

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
  }, 100);  // 每 100ms 检查一次，更精确
}

function pausePomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>继续';
  $('#pomo-btn-pause').classList.add('hidden');
  document.querySelector('.relative.w-56')?.classList.remove('pomodoro-active', 'pomodoro-break');
}

function skipPomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  completePomodoroRound(true);
}

function resetPomodoro() {
  clearInterval(pomoInterval); pomoRunning = false;
  pomoMode = 'work'; pomoSeconds = POMO_WORK; pomoTotal = POMO_WORK; pomoRound = 1;
  updatePomoDisplay();
  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = '<i class="fas fa-play mr-2"></i>开始专注';
  $('#pomo-btn-pause').classList.add('hidden'); $('#pomo-btn-skip').classList.add('hidden');
  $('#pomo-mode').textContent = '专注时间'; $('#pomo-mode').className = 'text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium';
  document.querySelector('.relative.w-56')?.classList.remove('pomodoro-active', 'pomodoro-break');
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
      updatePomoStats();
      loadPomodoroHistory();
    } catch (err) { console.error(err); }
  }

  // 切换模式
  if (pomoMode === 'work') {
    pomoMode = pomoRound % 4 === 0 ? 'long_break' : 'short_break';
    pomoSeconds = pomoMode === 'long_break' ? POMO_LONG_BREAK : POMO_SHORT_BREAK;
    showToast(pomoMode === 'long_break' ? '长休息时间（15分钟）' : '短休息时间（5分钟）');
  } else {
    pomoMode = 'work'; pomoSeconds = POMO_WORK; pomoRound++;
    showToast('休息结束，开始下一轮专注！');
  }
  pomoTotal = pomoSeconds;
  updatePomoDisplay();

  $('#pomo-btn-start').classList.remove('hidden'); $('#pomo-btn-start').innerHTML = `<i class="fas fa-play mr-2"></i>开始${pomoMode === 'work' ? '专注' : '休息'}`;
  $('#pomo-btn-pause').classList.add('hidden'); $('#pomo-btn-skip').classList.add('hidden');
  $('#pomo-mode').textContent = pomoMode === 'work' ? '专注时间' : pomoMode === 'short_break' ? '短休息' : '长休息';
  document.querySelector('.relative.w-56')?.classList.remove('pomodoro-active', 'pomodoro-break');
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
        <div class="flex-1 min-w-0"><p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">${s.task_title || '自由番茄'}</p><p class="text-xs text-gray-500 dark:text-gray-400">${s.duration}分钟 · ${new Date(s.created_at).toLocaleString('zh-CN')}</p></div>
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
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">任务完成率</p>
          <p class="text-xl md:text-2xl font-bold ${completionRate >= 50 ? 'text-secondary' : 'text-accent'}">${completionRate}%</p>
          <p class="text-xs text-gray-400">${taskRate?.completed || 0}/${taskRate?.total || 0}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">微启动次数</p>
          <p class="text-xl md:text-2xl font-bold text-primary">${microStats?.total || 0}</p>
          <p class="text-xs text-gray-400">累计契约</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">契约后继续率</p>
          <p class="text-xl md:text-2xl font-bold ${continueRate >= 30 ? 'text-secondary' : 'text-calm'}">${continueRate}%</p>
          <p class="text-xs text-gray-400">突破2分钟</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">番茄钟</p>
          <p class="text-xl md:text-2xl font-bold text-danger">${pomoStats?.total || 0}</p>
          <p class="text-xs text-gray-400">${pomoStats?.total_minutes || 0}分钟</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700 col-span-2 md:col-span-1">
          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">拖延觉察</p>
          <p class="text-xl md:text-2xl font-bold text-accent">${p.dailyTrend?.reduce((a,b) => a + (b.procrastination_count || 0), 0) || 0}</p>
          <p class="text-xs text-gray-400">自我观察</p>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-calendar-week text-warm"></i>按星期分布</h3>
          ${p.weekdayDistribution?.length > 0 ? `<div class="flex items-end gap-2 h-40">${p.weekdayDistribution.map(d => `
            <div class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full bg-primary/60 rounded-t transition-all hover:bg-primary" style="height:${Math.max(10, (d.count / Math.max(...p.weekdayDistribution.map(x => x.count))) * 100)}%"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">${d.weekday}</span>
            </div>
          `).join('')}</div>` : '<p class="text-gray-400 dark:text-gray-500 text-center py-4">暂无数据</p>'}
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
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
            <div><p class="font-medium text-gray-800 dark:text-gray-200 ${c.completed ? 'line-through' : ''}">${c.description}</p><p class="text-xs text-gray-500 dark:text-gray-400">${c.witness_type === 'self' ? '自我承诺' : '外部见证'} · ${c.task_title || '独立承诺'}</p></div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium ${c.completed ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}">${c.completed ? '已完成' : '进行中'}</span>
        </div>
        ${c.deadline ? `<p class="text-xs text-gray-500 dark:text-gray-400 mb-3"><i class="fas fa-clock mr-1"></i>截止 ${new Date(c.deadline).toLocaleString('zh-CN')}</p>` : ''}
        <div class="flex gap-2">
          ${!c.completed ? `<button onclick="completeCommitment(${c.id})" class="flex-1 bg-secondary/10 text-secondary py-2 rounded-xl text-sm font-medium hover:bg-secondary/20 transition-all touch-btn"><i class="fas fa-check mr-1"></i>标记完成</button>` : `<button onclick="completeCommitment(${c.id}, false)" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all touch-btn"><i class="fas fa-undo mr-1"></i>撤销</button>`}
          <button onclick="deleteCommitment(${c.id})" class="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-danger hover:bg-red-100 dark:hover:bg-red-900/30 transition-all touch-btn"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    $('#commitments-list').innerHTML = `<div class="text-center py-12 text-danger">加载失败: ${err.message}</div>`;
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
      </div>
      <div class="mt-6"><button onclick="createCommitment()" class="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-all touch-btn">创建承诺</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function createCommitment() {
  const desc = $('#commitment-desc').value.trim();
  if (!desc) { showToast('请输入承诺内容', 'error'); return; }
  try {
    await api.post('/api/commitments', { description: desc, witness_type: $('#commitment-witness').value, deadline: $('#commitment-deadline').value || null });
    showToast('承诺已创建'); $('.fixed').remove(); loadCommitments();
  } catch (err) { showToast(err.message, 'error'); }
}

async function completeCommitment(id, completed = true) {
  try { await api.put(`/api/commitments/${id}`, { completed }); showToast(completed ? '承诺已完成！' : '已撤销'); loadCommitments(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function deleteCommitment(id) {
  if (!confirm('确定删除这个承诺？')) return;
  try { await api.del(`/api/commitments/${id}`); showToast('已删除'); loadCommitments(); }
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
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
        <button onclick="deleteTimeBlock(${b.id})" class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all touch-btn"><i class="fas fa-trash text-sm"></i></button>
      </div>
    `).join('');
  } catch (err) {
    $('#timeblocks-timeline').innerHTML = `<div class="text-center py-8 text-danger">加载失败: ${err.message}</div>`;
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
  if (!confirm('确定删除这个时间块？')) return;
  try { await api.del(`/api/time-blocks/${id}`); showToast('已删除'); loadTimeBlocks(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ========== 设置 ==========
function renderSettings() {
  const div = el('div', 'p-4 md:p-8 max-w-2xl mx-auto fade-in');
  div.innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800 dark:text-white">设置</h2><p class="text-gray-500 dark:text-gray-400">系统配置与数据管理</p></div>
    <div class="space-y-6">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-server text-primary"></i>API 配置</h3>
        <div class="mb-4"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">后端 API 地址</label>
          <input type="text" id="settings-api-base" value="${getApiBase()}" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary outline-none" placeholder="https://your-api.workers.dev"></div>
        <button onclick="saveApiBase()" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all touch-btn">保存配置</button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-moon text-calm"></i>外观</h3>
        <div class="flex items-center justify-between">
          <div><p class="font-medium text-gray-800 dark:text-white">深色模式</p><p class="text-sm text-gray-500 dark:text-gray-400">切换浅色/深色主题</p></div>
          <button onclick="toggleDarkMode()" class="w-14 h-8 rounded-full ${state.darkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} transition-colors relative touch-btn">
            <div class="absolute top-1 ${state.darkMode ? 'left-7' : 'left-1'} w-6 h-6 rounded-full bg-white shadow transition-all flex items-center justify-center"><i class="fas fa-${state.darkMode ? 'moon' : 'sun'} text-xs text-gray-600"></i></div>
          </button>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-download text-secondary"></i>数据管理</h3>
        <div class="space-y-3">
          <button onclick="exportData()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-secondary/5 dark:bg-secondary/10 text-secondary hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center"><i class="fas fa-file-export"></i></div>
            <div><p class="font-medium">导出数据</p><p class="text-xs text-gray-500 dark:text-gray-400">导出所有数据为 JSON</p></div>
          </button>
          <button onclick="showImportModal()" class="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all text-left touch-btn">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><i class="fas fa-file-import"></i></div>
            <div><p class="font-medium">导入数据</p><p class="text-xs text-gray-500 dark:text-gray-400">从 JSON 文件恢复数据</p></div>
          </button>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-exclamation-triangle text-accent"></i>快速记录拖延</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">如果你此刻正在拖延，记录下来，不要批判自己。</p>
        <button onclick="showProcrastinationModal()" class="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all touch-btn"><i class="fas fa-pen mr-1"></i>记录拖延日志</button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><i class="fas fa-keyboard text-calm"></i>快捷键</h3>
        <div class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">/</kbd> 搜索任务</p>
          <p><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd> 关闭弹窗</p>
          <p><kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> 提交表单</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
  // 修复 Bug5: 保存后立即生效（无需刷新）
  safeStorage.set('api_base', base);
  showToast('API 地址已保存并生效');
}

async function exportData() {
  try {
    const data = await api.get('/api/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `zhouji-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('数据导出成功');
  } catch (err) { showToast(err.message, 'error'); }
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
    const navMap = { '1': 'dashboard', '2': 'emotion', '3': 'tasks', '4': 'micro-start', '5': 'pomodoro', '6': 'lab', '7': 'commitments', '8': 'time-blocks' };
    if (navMap[e.key]) { e.preventDefault(); navigate(navMap[e.key]); }
  }
});

// 监听 hash 变化
// 修复 Bug7: 防止 navigate 和 hashchange 双重触发 render
var _navigateHash = '';
window.addEventListener('hashchange', () => {
  if (window.location.hash === _navigateHash) return;
  render();
});

// 网络状态监听
window.addEventListener('online', function() {
  api._isOnline = true;
  showToast('网络已恢复', 'success');
  api._syncOfflineQueue();
});
window.addEventListener('offline', function() {
  api._isOnline = false;
  showToast('进入离线模式，数据将在恢复后同步', 'warning');
});

// 首次加载
window.addEventListener('DOMContentLoaded', function() {
  var queue = safeStorage.get('offline_queue');
  if (queue) {
    try { api._offlineQueue = JSON.parse(queue); } catch (e) {}
  }
  restoreTimerState();
  render();

  // 修复 FE-016: 注册 Service Worker 实现 PWA 离线功能
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      console.log('SW registered:', reg.scope);
    }).catch(function(err) {
      console.warn('SW registration failed:', err);
    });
  }

  // 修复 FE-007: 登录后自动同步离线队列
  if (navigator.onLine && api._offlineQueue.length > 0) {
    api._syncOfflineQueue();
  }
});

// 页面可见性变化（后台计时器处理）
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.timerRunning) {
    // 恢复计时器显示
    updateTimerDisplay();
  }
});

// 防止意外关闭时的计时器丢失
window.addEventListener('beforeunload', (event) => {
  if (state.timerRunning && timerSeconds > 0) {
    saveTimerState();
    // 修复 FE-004: 阻止默认关闭行为，提示用户
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
window.deleteTask = deleteTask;
window.deleteTimeBlock = deleteTimeBlock;
window.exportData = exportData;
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
window.navigate = navigate;
window.updateTaskStatus = updateTaskStatus;
window.useTemplate = useTemplate;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
})();
