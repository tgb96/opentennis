const CACHE_NAME = 'open-tennis-v24-history-aliases';

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

  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        const network = fetch(request).then(response => {
          if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
          return response;
        });
        if (cached) {
          network.catch(() => null);
          return cached;
        }
        return network;
      })
    );
    return;
  }

  const network = fetch(request).then(response => {
    if (response.ok) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }
    return response;
  });

  event.respondWith(
    network.catch(() =>
      caches.match(request, { ignoreSearch: true })
        .then(cached => cached || caches.match('./index.html'))
    )
  );
});
