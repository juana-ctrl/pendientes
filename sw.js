// Service Worker - Pendientes PWA
// Cache-first strategy for app shell, network-first for everything else
const CACHE = 'pendientes-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        // Update in background
        fetch(e.request)
          .then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
