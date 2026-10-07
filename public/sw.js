const CACHE_NAME = 'shumei-pwa-v1.25';
const ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/youth/list.html',
  '/youth/admin.html',
  '/youth/group.html',
  '/youth/seminar.html',
  '/youth/lineage.html',
  '/farm/natural-farm.html',
  '/farm/natural-farm-admin.html',
  '/seed/change.html',
  '/activities/training.html',
  '/activities/jyorei.html',
  '/activities/events.html',
  '/js/pwa.js',
  '/js/redirect.js',
  '/js/index.js',
  '/js/list.js',
  '/js/admin.js',
  '/js/group.js',
  '/js/seminar.js',
  '/js/lineage.js',
  '/js/natural-farm.js',
  '/js/natural-farm-admin.js',
  '/js/change.js',
  '/js/training.js',
  '/js/jyorei.js',
  '/js/events.js',
  '/css/app.css',
  '/css/natural-farm.css',
  '/logo.png',
  '/favicon.ico'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching shell assets...');
      // Bypass HTTP cache to ensure we get the latest files
      const requests = ASSETS.map(url => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache...', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  // Skip caching for Firebase SDK auth/firestore and non-GET requests
  if (
    e.request.method !== 'GET' ||
    e.request.url.includes('firestore.googleapis.com') ||
    e.request.url.includes('identitytoolkit.googleapis.com') ||
    e.request.url.includes('firebase')
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, but fetch fresh in background to update cache
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* ignore background update error */});
        return cachedResponse;
      }
      return fetch(e.request);
    }).catch(() => {
      // Offline fallback for HTML requests
      if (e.request.headers.get('accept').includes('text/html')) {
        return caches.match('/index.html');
      }
    })
  );
});
