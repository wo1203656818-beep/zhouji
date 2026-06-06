// 周迹 Service Worker - 实现 PWA 离线功能 (修复 FE-016)
const CACHE_NAME = 'zhouji-v2.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.warn('SW cache failed:', err);
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
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 网络优先策略，离线时回退缓存
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求和 API 请求
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 缓存成功的响应
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败时回退缓存
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // 如果缓存也没有，返回离线页面
          if (event.request.mode === 'navigate') {
            return new Response('<html><body style="font-family:sans-serif;text-align:center;padding:2rem"><h1>周迹</h1><p>您当前处于离线状态</p><p>请连接网络后重试</p></body></html>', {
              headers: { 'Content-Type': 'text/html' }
            });
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// 后台同步（用于离线队列）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-zhouji') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'sync-offline-queue' });
        });
      })
    );
  }
});
