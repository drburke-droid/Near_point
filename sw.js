const CACHE_NAME = 'nearpoint-v6';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './logo.png',
    './windows-11-bloom-5120x2880-14423.jpg',
    './clinician.html',
    './clinician.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
