/**
 * YaadBooks Service Worker v5
 * Provides offline support, caching, and background sync.
 *
 * IMPORTANT: Next.js App Router uses RSC (React Server Components) for
 * client-side navigation. RSC requests use the same URLs as pages but with
 * special headers (RSC: 1). These MUST NOT be intercepted or cached by the SW,
 * otherwise client-side navigation (Link clicks, router.push) will break.
 *
 * Strategies:
 * - Next.js RSC/prefetch requests: PASS THROUGH (never cache)
 * - API GET requests: Network-first with cache fallback
 * - API mutations (POST/PUT/DELETE): Queue for background sync when offline
 * - Static assets (_next/static/*, fonts, images): Cache-first
 * - Navigation (full page loads): Network-first with offline fallback
 */

const CACHE_VERSION = 'yaadbooks-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;

// App shell files to pre-cache on install
const APP_SHELL = [
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/offline',
];

// Queue for offline mutations
const MUTATION_QUEUE_KEY = 'yaadbooks-mutation-queue';

// ─── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to pre-cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete (v5)');
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
        console.log('[SW] Activate complete (v5)');
        return self.clients.claim();
      })
  );
});

// ─── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ═══ CRITICAL: Skip Next.js App Router RSC/data requests ═══
  // These are used for client-side navigation and MUST pass through
  // untouched. Intercepting them breaks Link clicks and router.push().
  if (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') !== null ||
    request.headers.get('Next-Router-State-Tree') !== null ||
    url.searchParams.has('_rsc')
  ) {
    return; // Let the browser handle natively — do NOT call event.respondWith()
  }

  // Skip non-GET requests for non-API routes
  if (request.method !== 'GET' && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip cross-origin requests (except Google Fonts)
  if (url.origin !== self.location.origin) {
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

  // Large media files — pass through (don't cache 30 MB videos)
  if (isLargeMedia(url.pathname)) {
    return;
  }

  // Next.js static assets (_next/static/*) — cache first, content-hashed
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 365 * 24 * 60 * 60));
    return;
  }

  // Other static assets (images, fonts, etc.) — cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 7 * 24 * 60 * 60));
    return;
  }

  // Navigation requests (full page loads) — network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Everything else — pass through to network (don't cache unknown requests)
  // This is safer than caching, which could break Next.js internal requests
  return;
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
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader) {
      const cachedAt = parseInt(dateHeader, 10);
      if (Date.now() - cachedAt < maxAgeSec * 1000) {
        return cached;
      }
    } else {
      return cached;
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
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

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

      const queue = await getMutationQueue();
      queue.push(mutation);
      await saveMutationQueue(queue);

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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ONLINE') {
    processMutationQueue();
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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
        remaining.push(mutation);
      }
    } catch {
      remaining.push(mutation);
    }
  }

  await saveMutationQueue(remaining);

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
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf)$/.test(pathname);
}

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
