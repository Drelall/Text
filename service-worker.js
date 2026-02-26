const CACHE_NAME = 'scribouillart-editor-v1';

const APP_SHELL = [
  './',
  './tirages.html',
  './style.css',
  './publication.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // App shell: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          // Offline fallback
          const fallback = await caches.match('./tirages.html');
          return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Cross-origin (ex: YouTube): network-first
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (err) {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
