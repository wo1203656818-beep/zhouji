// ====== 周迹 Core: IndexedDB 离线存储 ======
// 提供本地离线数据库，网络恢复后自动同步到云端
(function() {

  var DB_NAME = 'zhouji-offline';
  var DB_VERSION = 1;
  var _db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        // 通用键值存储
        if (!db.objectStoreNames.contains('kv')) {
          var store = db.createObjectStore('kv', { keyPath: 'key' });
          store.createIndex('updated', 'updated', { unique: false });
        }
        // 离线操作队列
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  }

  // ====== 公开API ======

  // 保存数据（本地离线）
  window.offlinePut = async function(key, value) {
    try {
      var db = await openDB();
      await new Promise(function(resolve, reject) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ key: key, value: JSON.stringify(value), updated: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = function(e) { reject(e.target.error); };
      });
      return true;
    } catch(e) {
      console.warn('[offline] put error:', e);
      return false;
    }
  };

  // 读取数据（优先本地，没有则返回null）
  window.offlineGet = async function(key) {
    try {
      var db = await openDB();
      var result = await new Promise(function(resolve, reject) {
        var tx = db.transaction('kv', 'readonly');
        var req = tx.objectStore('kv').get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function(e) { reject(e.target.error); };
      });
      if (result && result.value) return JSON.parse(result.value);
      return null;
    } catch(e) {
      console.warn('[offline] get error:', e);
      return null;
    }
  };

  // 删除本地数据
  window.offlineDelete = async function(key) {
    try {
      var db = await openDB();
      await new Promise(function(resolve, reject) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = resolve;
        tx.onerror = function(e) { reject(e.target.error); };
      });
      return true;
    } catch(e) {
      return false;
    }
  };

  // 添加离线操作到队列（网络恢复后自动执行）
  window.offlineEnqueue = async function(action, endpoint, body) {
    try {
      var db = await openDB();
      await new Promise(function(resolve, reject) {
        var tx = db.transaction('queue', 'readwrite');
        tx.objectStore('queue').add({ action: action, endpoint: endpoint, body: JSON.stringify(body), created: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = function(e) { reject(e.target.error); };
      });
      // 尝试立即同步
      syncQueue();
      return true;
    } catch(e) {
      return false;
    }
  };

  // 同步队列：将离线操作批量推送到云端
  window.syncQueue = async function() {
    try {
      var db = await openDB();
      var tx = db.transaction('queue', 'readonly');
      var items = await new Promise(function(resolve, reject) {
        var req = tx.objectStore('queue').getAll();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function(e) { reject(e.target.error); };
      });
      if (!items || items.length === 0) return;

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        try {
          var body = JSON.parse(item.body);
          if (item.action === 'PUT') {
            await window.api.put(item.endpoint, body);
          } else if (item.action === 'POST') {
            await window.api.post(item.endpoint, body);
          } else if (item.action === 'DELETE') {
            await window.api.del(item.endpoint);
          }
          // 移除已同步的队列项
          var tx2 = db.transaction('queue', 'readwrite');
          await new Promise(function(resolve, reject) {
            tx2.objectStore('queue').delete(item.id);
            tx2.oncomplete = resolve;
            tx2.onerror = function(e) { reject(e.target.error); };
          });
        } catch(e) {
          console.warn('[offline] sync item failed:', item.id, e);
          // 单个失败不阻塞其他
        }
      }
    } catch(e) {
      console.warn('[offline] sync error:', e);
    }
  };

  // 在线状态变化时自动同步
  window.addEventListener('online', function() {
    console.log('[offline] 网络恢复，开始同步...');
    window.syncQueue();
  });

  // 页面打开时尝试同步一次
  setTimeout(function() {
    if (navigator.onLine) window.syncQueue();
  }, 3000);

  console.log('[offline] IndexedDB 离线模块已加载');
})();
