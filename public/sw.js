// CashPilot Service Worker - Offline-First PWA
const CACHE_NAME = 'cashpilot-v7';
const API_CACHE_NAME = 'cashpilot-api-v1';
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

const STATIC_ASSETS = ['/manifest.json', '/offline.html'];

function isCacheableJavaScriptResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('javascript') || contentType.includes('ecmascript');
}

function isSupabaseApiRequest(url) {
  return url.hostname.includes('supabase');
}

function isSensitiveRequest(url) {
  // Auth endpoints should never be cached
  if (url.pathname.includes('/auth/')) return true;
  const isInternalApi =
    url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp'));
  return isInternalApi;
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
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (!event?.data?.type) return;

  if (event.data.type === 'CLEAR_RUNTIME_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Never cache auth endpoints
  if (isSensitiveRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Supabase API: network-first with 5-minute cache fallback
  if (isSupabaseApiRequest(url) && !url.pathname.includes('/auth/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            const headers = new Headers(clone.headers);
            headers.append('sw-cached-at', Date.now().toString());
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(
                request,
                new Response(clone.body, {
                  status: clone.status,
                  statusText: clone.statusText,
                  headers: headers,
                })
              );
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: API_CACHE_NAME });
          if (cached) {
            const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
            if (Date.now() - cachedAt < API_CACHE_MAX_AGE) {
              return cached;
            }
            // Even if expired, return stale data when offline rather than nothing
            return cached;
          }
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // HTML navigation requests: network-first with offline fallback
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
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // JS chunks in /assets/: network-first
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
    badge: '/icon-192.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data));
});
