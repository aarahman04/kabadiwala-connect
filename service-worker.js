/* Kabadiwala Connect service worker.
 * Build step (vite.config.ts) replaces the precache list and build id.
 * Strategy: precache the app shell on install, serve cache-first, fall back to
 * index.html for navigations so deep links open offline.
 */
const CACHE = 'kc-shell-__BUILD_ID__';
const PRECACHE = self.__PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Background Sync: the queue and mock API live in the page (IndexedDB +
// localStorage), so the worker just wakes any open client to flush it.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'kc-sync') return;
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'kc-sync' }))),
  );
});
