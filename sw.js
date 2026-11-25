const CACHE = 'agodeo-web-printer-v2.7.0';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'js/app.js',
  'js/protocol.js',
  'js/printer.js',
  'js/image.js',
  'js/qr.js',
  'js/templates.js',
  'js/photobooth.js',
  'vendor/qrcode.mjs',
  'vendor/qrcode_UTF8.mjs',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
