// ====== 周迹 Core: API 封装 ======
// 安全 localStorage 封装
window.safeStorage = {
  get: function(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set: function(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) {
      if (e.name === 'QuotaExceededError') { this._cleanup(); try { localStorage.setItem(key, value); return true; } catch (e2) {} }
      return false;
    }
  },
  remove: function(key) { try { localStorage.removeItem(key); } catch (e) {} },
  clear: function() { try { localStorage.clear(); } catch (e) {} },
  _cleanup: function() {
    var keys = Object.keys(localStorage);
    var items = keys.filter(function(k) { return !k.endsWith('_ts'); }).map(function(k) { return { key: k, time: parseInt(localStorage.getItem(k + '_ts') || '0') }; });
    items.sort(function(a, b) { return a.time - b.time; });
    for (var i = 0; i < Math.min(5, items.length); i++) { localStorage.removeItem(items[i].key); localStorage.removeItem(items[i].key + '_ts'); }
  }
};

// API 基础地址
window.getApiBase = function() {
  var saved = window.safeStorage.get('api_base');
  if (saved) return saved;
  if (window.__DEPLOY_CONFIG__ && window.__DEPLOY_CONFIG__.API_BASE_URL) {
    window.safeStorage.set('api_base', window.__DEPLOY_CONFIG__.API_BASE_URL);
    return window.__DEPLOY_CONFIG__.API_BASE_URL;
  }
  return 'https://zhouji-api.wo1203656818.workers.dev';
};

// Loading 控制
var loadingCounter = 0;
window.showLoading = function() { loadingCounter++; var el = document.getElementById('loading'); if (el) el.classList.remove('hidden'); };
window.hideLoading = function() { loadingCounter = Math.max(0, loadingCounter - 1); if (loadingCounter === 0) { var el = document.getElementById('loading'); if (el) el.classList.add('hidden'); } };

// API 封装
window.api = {
  async request(method, endpoint, body, options) {
    body = body || null; options = options || {};
    var retries = options.retries || 2, timeout = options.timeout || 30000;
    window.showLoading();
    var token = window.safeStorage.get('token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var lastError;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, timeout);
        var res = await fetch(window.getApiBase() + endpoint, { method: method, headers: headers, body: body ? JSON.stringify(body) : null, signal: controller.signal });
        clearTimeout(tid);
        if (res.status === 429) {
          var ra = parseInt(res.headers.get('X-RateLimit-Reset') || '5');
          window.showToast('请求过于频繁，' + ra + '秒后重试', 'warning');
          await new Promise(function(r) { setTimeout(r, ra * 1000); }); continue;
        }
        if (res.status === 401) {
          var d = await res.json();
          if (endpoint.includes('/api/auth/')) throw new Error(d.error || d.message || '用户名或密码错误');
          window.safeStorage.remove('token'); window.safeStorage.remove('userId'); window.safeStorage.remove('username');
          window.navigate('login'); return d;
        }
        if (!res.ok) { var ed = await res.json().catch(function() { return {}; }); throw new Error(ed.error || ed.message || '请求失败 (' + res.status + ')'); }
        var data = await res.json();
        window.hideLoading(); return data;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') { window.showToast('请求超时，正在重试...', 'warning'); continue; }
        if (attempt < retries) { await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); }); continue; }
      }
    }
    window.hideLoading();
    throw lastError || new Error('请求失败');
  },
  get: function(ep) { return window.api.request('GET', ep); },
  post: function(ep, body) { return window.api.request('POST', ep, body); },
  put: function(ep, body) { return window.api.request('PUT', ep, body); },
  del: function(ep) { return window.api.request('DELETE', ep); }
};
