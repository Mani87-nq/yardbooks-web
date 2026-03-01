/**
 * YaadBooks Service Worker
 * Provides offline support, caching, and background sync.
 *
 * Strategies:
 * - App Shell (HTML/CSS/JS): Cache-first with network fallback
 * - API GET requests: Network-first with cache fallback (stale data better than nothing)
 * - API mutations (POST/PUT/DELETE): Queue for background sync when offline
 * - Static assets (fonts/images): Cache-first with long TTL
 * - Navigation: Network-first with offline fallback page
 */

const CACHE_VERSION = 'yaadbooks-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;

// App shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/offline',
];

// API patterns to cache (GET only)
const CACHEABLE_API_PATTERNS = [
  '/api/v1/customers',
  '/api/v1/products',
  '/api/v1/invoices',
  '/api/v1/expenses',
  '/api/v1/companies',
  '/api/auth/me',
  '/api/sync/pull/products',
  '/api/sync/pull/employees',
  '/api/pos/employees',
  '/api/shifts/active',
  '/api/employee/me',
  '/api/employee/me/schedule',
];

// Queue for offline mutations
const MUTATION_QUEUE_KEY = 'yaadbooks-mutation-queue';

// ─── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        // Pre-cache app shell — don't fail install if some fail
        return Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to pre-cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('yaadbooks-') && name !== STATIC_CACHE && name !== API_CACHE && name !== FONT_CACHE)
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activate complete');
        return self.clients.claim();
      })
  );
});

// ─── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET cross-origin requests
  if (url.origin !== self.location.origin) {
    // Cache Google Fonts
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(cacheFirst(request, FONT_CACHE, 30 * 24 * 60 * 60));
      return;
    }
    return;
  }

  // API mutations (POST/PUT/DELETE) — queue if offline
  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    event.respondWith(handleMutation(request));
    return;
  }

  // API GET requests — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5 * 60));
    return;
  }

  // Large media files — pass through to network (don't cache 30 MB videos)
  if (isLargeMedia(url.pathname)) {
    return; // Let the browser handle it natively
  }

  // Static assets — cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 7 * 24 * 60 * 60));
    return;
  }

  // Navigation requests — network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Everything else — network first
  event.respondWith(networkFirst(request, STATIC_CACHE, 60 * 60));
});

// ─── STRATEGIES ────────────────────────────────────────────────

/**
 * Cache-First: Check cache, fall back to network.
 * Good for static assets that rarely change.
 */
async function cacheFirst(request, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Check if cache entry is still fresh
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader) {
      const cachedAt = parseInt(dateHeader, 10);
      if (Date.now() - cachedAt < maxAgeSec * 1000) {
        return cached;
      }
    } else {
      return cached; // No timestamp, assume fresh
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const body = await cloned.blob();
      const cachedResponse = new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      await cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    // Network failed, return stale cache if available
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-First: Try network, fall back to cache.
 * Good for API data that should be fresh but works offline.
 */
async function networkFirst(request, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const body = await cloned.blob();
      const cachedResponse = new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      await cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'You are offline and no cached data is available.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle navigation requests with offline fallback.
 */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Cache successful navigations
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fall back to offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    // Last resort
    return new Response(offlineHTML(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * Handle API mutations — queue when offline.
 */
async function handleMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Offline — queue the mutation for later
    try {
      const body = await request.clone().text();
      const mutation = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        timestamp: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      // Store in IndexedDB via a simple approach
      const queue = await getMutationQueue();
      queue.push(mutation);
      await saveMutationQueue(queue);

      // Notify clients about queued mutation
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'MUTATION_QUEUED',
          mutation: { id: mutation.id, url: mutation.url, method: mutation.method },
        });
      });

      return new Response(
        JSON.stringify({
          queued: true,
          message: 'You are offline. This action has been saved and will be synced when you reconnect.',
          id: mutation.id,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (queueError) {
      return new Response(
        JSON.stringify({ error: 'You are offline and this action could not be saved.' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
}

// ─── BACKGROUND SYNC ──────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'yaadbooks-sync') {
    event.waitUntil(processMutationQueue());
  }
});

// Also sync when coming back online
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ONLINE') {
    processMutationQueue();
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Process queued mutations — retry in order.
 */
async function processMutationQueue() {
  const queue = await getMutationQueue();
  if (queue.length === 0) return;

  const remaining = [];
  const results = [];

  for (const mutation of queue) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body || undefined,
      });

      results.push({
        id: mutation.id,
        url: mutation.url,
        method: mutation.method,
        status: response.status,
        success: response.ok,
      });

      if (!response.ok && response.status >= 500) {
        // Server error — keep in queue for retry
        remaining.push(mutation);
      }
    } catch {
      // Still offline or network error — keep in queue
      remaining.push(mutation);
    }
  }

  await saveMutationQueue(remaining);

  // Notify clients about sync results
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      results,
      remaining: remaining.length,
    });
  });
}

// ─── MUTATION QUEUE (using Cache API as simple KV store) ───────

async function getMutationQueue() {
  try {
    const cache = await caches.open('yaadbooks-queue');
    const response = await cache.match('/queue');
    if (!response) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function saveMutationQueue(queue) {
  const cache = await caches.open('yaadbooks-queue');
  await cache.put(
    '/queue',
    new Response(JSON.stringify(queue), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ─── HELPERS ──────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|ogg|mp3|wav|pdf)$/.test(pathname) ||
    pathname.startsWith('/_next/static/');
}

/**
 * Large media files (video/audio) should NOT be cached by the SW.
 * Caching a 30 MB video via blob() wastes memory and can fail.
 */
function isLargeMedia(pathname) {
  return /\.(mp4|webm|ogg|mp3|wav)$/.test(pathname);
}

function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YaadBooks - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      background: #059669;
      color: white;
      font-weight: 700;
      font-size: 28px;
      border-radius: 20px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      color: #111827;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 24px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    button {
      padding: 12px 24px;
      background: #059669;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover { background: #047857; }
    .queued {
      margin-top: 24px;
      padding: 16px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      font-size: 14px;
      color: #374151;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">YB</div>
    <div class="status"><span class="dot"></span> Offline</div>
    <h1>You're offline</h1>
    <p>Don't worry — any changes you made while offline have been saved and will sync automatically when you reconnect.</p>
    <button onclick="window.location.reload()">Try Again</button>
    <div class="queued" id="queued" style="display:none">
      <strong>Pending changes:</strong>
      <span id="count">0</span> action(s) waiting to sync
    </div>
  </div>
  <script>
    window.addEventListener('online', () => window.location.reload());
    // Check for queued mutations
    if ('caches' in window) {
      caches.open('yaadbooks-queue').then(cache => {
        cache.match('/queue').then(response => {
          if (response) {
            response.json().then(queue => {
              if (queue.length > 0) {
                document.getElementById('queued').style.display = 'block';
                document.getElementById('count').textContent = queue.length;
              }
            });
          }
        });
      });
    }
  </script>
</body>
</html>`;
}
