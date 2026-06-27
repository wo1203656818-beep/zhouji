// ====== 周迹 Core: 离线优先存储（基于行业最佳实践）======
// 模式: Network First（读） + Write-Through Cache（写）+ 离线队列
// 参考: PWA离线方案深度解析(2025), Google Workbox 策略

(function() {
  var DB_NAME = 'zhouji-v3';
  var DB_VERSION = 2;
  var _db = null;
  var _queue = [];     // 离线操作队列
  var _syncing = false;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          // 数据缓存: key=URL, value=响应数据
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('queue')) {
          // 离线操作队列: 存储失败的写请求
          var store = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  }

  // ====== 内部工具 ======
  function tx(name, mode) {
    return _db.transaction(name, mode).objectStore(name);
  }

  // ====== 网络状态 ======
  window._isOnline = navigator.onLine;
  window.addEventListener('online', function() { window._isOnline = true; updateOnlineIndicator(); processQueue(); });
  window.addEventListener('offline', function() { window._isOnline = false; updateOnlineIndicator(); });

  // 离线指示器
  function updateOnlineIndicator() {
    var badge = document.getElementById('fk-offline-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'fk-offline-badge';
      badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:500;transition:all 0.3s;display:none;box-shadow:0 2px 10px rgba(0,0,0,0.15);';
      document.body.appendChild(badge);
    }
    if (window._isOnline) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'block';
      badge.style.background = '#ef4444';
      badge.style.color = '#fff';
      badge.textContent = '⚡ 离线模式 · 显示缓存数据';
    }
  }

  // ====== 公开API ======

  // 缓存API响应（写入IndexedDB）
  window.cachePut = async function(key, data) {
    try {
      var db = await openDB();
      await new Promise(function(resolve, reject) {
        var t = db.transaction('cache', 'readwrite');
        t.objectStore('cache').put({ key: key, data: data, cachedAt: Date.now() });
        t.oncomplete = resolve;
        t.onerror = function(e) { reject(e.target.error); };
      });
      return true;
    } catch(e) { return false; }
  };

  // 读取缓存（返回缓存的data或null）
  window.cacheGet = async function(key) {
    try {
      var db = await openDB();
      var result = await new Promise(function(resolve, reject) {
        var t = db.transaction('cache', 'readonly');
        var req = t.objectStore('cache').get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function(e) { reject(e.target.error); };
      });
      return result ? result.data : null;
    } catch(e) { return null; }
  };

  // 清空缓存
  window.cacheClear = async function() {
    try {
      var db = await openDB();
      await new Promise(function(r) { var t = db.transaction('cache', 'readwrite'); t.objectStore('cache').clear(); t.oncomplete = r; });
    } catch(e) {}
  };

  // ====== Network First 数据获取 ======
  // 先用网络请求，失败则返回缓存
  window.networkFirst = async function(key, fetcher) {
    // 有网 -> 请求网络
    if (window._isOnline) {
      try {
        var data = await fetcher();
        // 成功后缓存
        window.cachePut(key, data);
        return { data: data, source: 'network' };
      } catch(e) {
        // 网络失败 -> 用缓存
        var cached = await window.cacheGet(key);
        if (cached) return { data: cached, source: 'cache' };
        throw e;
      }
    }
    // 离线 -> 直接读缓存
    var cached = await window.cacheGet(key);
    if (cached) return { data: cached, source: 'cache' };
    throw new Error('网络不可用且没有缓存数据');
  };

  // ====== Write-Through 写入 ======
  // 先写本地，再尝试网络
  window.writeThrough = async function(key, endpoint, body, method) {
    method = method || 'POST';
    // 1. 立即写入本地缓存
    await window.cachePut(key, body);
    // 2. 如果有网，尝试推送云端
    if (window._isOnline) {
      try {
        var result = await window.api.request(method, endpoint, body);
        return result;
      } catch(e) {
        // 网络失败，加入队列
        await enqueueOp(method, endpoint, body);
        return { success: true, offline: true, queued: true };
      }
    }
    // 3. 离线，加入队列
    await enqueueOp(method, endpoint, body);
    return { success: true, offline: true, queued: true };
  };

  // ====== 离线操作队列 ======
  function enqueueOp(method, endpoint, body) {
    return new Promise(function(resolve) {
      _queue.push({ method: method, endpoint: endpoint, body: body });
      // 也存到IndexedDB持久化
      openDB().then(function(db) {
        var t = db.transaction('queue', 'readwrite');
        t.objectStore('queue').add({ method: method, endpoint: endpoint, body: JSON.stringify(body), timestamp: Date.now() });
        t.oncomplete = resolve;
      }).catch(resolve);
    });
  }

  // 处理队列：尝试将离线操作逐条推送到云端
  window.processQueue = async function() {
    if (_syncing || !window._isOnline) return;
    _syncing = true;

    // 标记同步中
    var badge = document.getElementById('fk-offline-badge');
    if (badge) { badge.style.background = '#d97706'; badge.textContent = '🔄 同步中...'; badge.style.display = 'block'; }

    try {
      var db = await openDB();
      var tx = db.transaction('queue', 'readonly');
      var items = await new Promise(function(resolve) {
        var req = tx.objectStore('queue').getAll();
        req.onsuccess = function() { resolve(req.result || []); };
      });

      if (items.length === 0) { _syncing = false; updateOnlineIndicator(); return; }

      var successCount = 0, failCount = 0;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        try {
          var body = JSON.parse(item.body);
          await window.api.request(item.method, item.endpoint, body);
          // 成功 -> 删除队列项
          var dt = db.transaction('queue', 'readwrite');
          await new Promise(function(r) { dt.objectStore('queue').delete(item.id); dt.oncomplete = r; });
          successCount++;
        } catch(e) {
          failCount++;
        }
      }

      // 更新badge
      if (badge) {
        if (failCount === 0 && successCount > 0) {
          badge.style.background = '#16a34a';
          badge.textContent = '✅ 同步完成 ' + successCount + ' 条';
          setTimeout(function() { updateOnlineIndicator(); }, 2000);
        } else if (failCount > 0) {
          badge.style.background = '#ef4444';
          badge.textContent = '⚠️ ' + successCount + ' 成功, ' + failCount + ' 失败';
        }
      }
    } catch(e) { console.warn('[offline] processQueue error:', e); }
    _syncing = false;
  };

  // 启动时加载队列
  openDB().then(function(db) {
    var t = db.transaction('queue', 'readonly');
    var req = t.objectStore('queue').getAll();
    req.onsuccess = function() {
      _queue = req.result || [];
      // 如果在线，尝试同步
      if (window._isOnline && _queue.length > 0) window.processQueue();
    };
  });

  // 每5分钟尝试一次同步
  setInterval(function() {
    if (window._isOnline) window.processQueue();
  }, 300000);

  console.log('[offline] 离线优先系统已启动');
})();
