// 周迹 Service Worker v3 - 离线优先策略
const CACHE_NAME = 'zhouji-v3';
const API_CACHE = 'zhouji-api-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/fate-killer.js',
  '/assistant.js',
  '/weekly.js',
  '/diary.js',
  '/stats.js',
  '/social.js',
  '/content-planner.js',
  '/styles.css',
  '/manifest.json',
  '/core/utils.js',
  '/core/api.js',
  '/core/db.js',
  '/core/router.js',
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('SW cache skip:', url, err.message);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 网络优先策略，离线时回退缓存
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  var url = new URL(event.request.url);

  // API 请求：网络优先，缓存回退
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(API_CACHE).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || new Response(JSON.stringify({ error: '离线模式', offline: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match('/offline.html');
      });
    })
  );
});
