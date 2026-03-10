// CashPilot Service Worker
const CACHE_NAME = 'cashpilot-v6';
const STATIC_ASSETS = [
  '/manifest.json',
];

function isCacheableJavaScriptResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('javascript') || contentType.includes('ecmascript');
}

function isSensitiveRequest(url) {
  const isSupabaseHost = url.hostname.includes('supabase');
  const isInternalApi = url.origin === self.location.origin
    && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp'));
  return isSupabaseHost || isInternalApi;
}

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event?.data?.type !== 'CLEAR_RUNTIME_CACHES') return;

  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  );
});

// Fetch: never cache sensitive API/database traffic.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  if (isSensitiveRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigation requests: network-first (prevents stale index.html after deploy)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // JS chunks in /assets/: network-first (prevents stale chunk errors after deploy)
  if (url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isCacheableJavaScriptResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // This will be handled by the offlineSync utility
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'CashPilot';
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data)
  );
});
