const CACHE = 'agodeo-web-printer-v3.0.21';
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
  'js/filters.js',
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
  const path = new URL(e.request.url).pathname;
  const isCode = path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.webmanifest') || path.includes('/js/') || path.includes('/vendor/');
  if (isCode) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
