const CACHE_NAME = 'trumdrama-v20261022-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './app.js',
  './js/app.js',
  './logo.png',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Pass video streaming and external APIs directly through network
  if (
    url.includes('/stream/') ||
    url.includes('googleusercontent.com') ||
    url.includes('drive.google.com') ||
    url.includes('googleapis.com') ||
    url.includes('script.google.com') ||
    url.includes('trumdrama.com') ||
    url.includes('.mp4')
  ) {
    return;
  }

  // Network-First strategy for HTML, CSS, JS, JSON so updates appear immediately
  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && e.request.method === 'GET') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return networkRes;
      })
      .catch(() => caches.match(e.request))
  );
});
