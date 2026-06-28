// 周迹 Service Worker v3.2 - 性能优化版
const VERSION = '2026.06.28-2305';
const CACHE_NAME = 'zhouji-v3-' + VERSION;
const API_CACHE = 'zhouji-api-' + VERSION;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/diary.js',
  '/weekly.js',
  '/stats.js',
  '/assistant.js',
  '/fate-killer.js',
  '/achievement.js',
  '/social.js',
  '/content-planner.js',
  '/creator-studio.js',
  '/delivery-gap.js',
  '/utils.js',
  '/styles.css',
  '/manifest.json',
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐个缓存，失败的跳过（不影响安装）
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] cache skip:', url, err.message);
          });
        })
      );
    })
  );
  self.skipWaiting();  // 立即激活新 SW
});

// 激活时清理旧缓存 + 接管所有页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zhouji-') && name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();  // 立即接管所有页面
});

// 请求拦截 - 三层策略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  var url = new URL(event.request.url);

  // 1. API 请求：网络优先，离线回退缓存
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // 成功：缓存响应
          if (response.ok) {
            var clone = response.clone();
            caches.open(API_CACHE).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          // 失败：返回缓存
          return caches.match(event.request).then(function(cached) {
            return cached || new Response(
              JSON.stringify({ error: '离线模式，数据可能过期', offline: true }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 2. 版本化资源（带 ?v= 参数）：缓存优先，网络更新
  var isVersioned = url.searchParams.has('v') || url.searchParams.has('ver');
  if (isVersioned) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        // 先返回缓存（如果有）
        var fetchPromise = fetch(event.request).then(function(response) {
          if (response.ok) {
            // 先 clone 再存缓存，防止 response body 已被读取
            var responseToCache = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(function() {});
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. 静态资源（HTML/CSS/JS 无版本号）：缓存优先
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // 后台更新缓存
        fetch(event.request).then(function(response) {
          if (response.ok) {
            var responseClone = response.clone(); // 先 clone 再存缓存
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
        }).catch(function() {});
        return cached;
      }
      // 无缓存：网络请求 + 缓存
      return fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // 离线 + 无缓存：返回离线页
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/offline.html') || new Response('离线模式', { status: 503 });
        }
      });
    })
  );
});

// 监听 Skip Waiting 消息（来自页面）
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
