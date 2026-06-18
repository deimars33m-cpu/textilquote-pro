// Service Worker con estrategia Network-First para evitar pantallas en blanco tras despliegues
const CACHE_NAME = 'nyx-pro-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/icon.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Solo gestiona peticiones locales del mismo origen
  if (e.request.url.startsWith(self.location.origin)) {
    // Para peticiones POST o peticiones que no sean GET, usamos solo red
    if (e.request.method !== 'GET') {
      e.respondWith(fetch(e.request));
      return;
    }

    // Estrategia: Network First (Red primero, cae en caché si falla la conexión)
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Si la respuesta es correcta, guardamos una copia en caché
          if (response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red (offline), servimos desde la caché
          return caches.match(e.request);
        })
    );
  }
});
