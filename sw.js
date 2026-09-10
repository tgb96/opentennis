const CACHE_NAME = 'open-tennis-v26-fast-offline';

const CORE_ASSETS = [
  './',
  './index.html',
  './partidos.html',
  './tablas.html',
  './resultados-2025.html',
  './reglas.html',
  './marcador.html',
  './assets/css/app.css',
  './assets/css/scoreboard.css',
  './assets/js/app.js',
  './assets/js/config.js',
  './assets/js/data-cache.js',
  './assets/js/data-model.js',
  './assets/js/pwa-install.js',
  './assets/js/personalization.js',
  './data/resultados-2025.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  const cachePromise = caches.open(CACHE_NAME);
  const cachedPromise = cachePromise.then(cache =>
    cache.match(request, { ignoreSearch: url.origin === self.location.origin })
  );
  const networkPromise = cachePromise.then(cache =>
    fetch(request).then(async response => {
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );

  event.waitUntil(networkPromise.catch(() => null));
  event.respondWith(cachedPromise.then(async cached => {

    if (cached) {
      return cached;
    }

    try {
      return await networkPromise;
    } catch (error) {
      if (request.mode === 'navigate') {
        const cache = await cachePromise;
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  }));
});
