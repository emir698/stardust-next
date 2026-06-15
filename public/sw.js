// Stardust PWA Service Worker
const CACHE_NAME = 'stardust-scan-v1';
const STATIC = [
  '/',
  '/scan',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Firebase / CDN requests — always network
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('unpkg.com') ||
      e.request.url.includes('gstatic')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Navigation — network first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/scan')))
    );
    return;
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// ── Honeywell / Android barcode intent handler ──────────────────────────────
// Honeywell DataWedge broadcasts com.honeywell.decode.intent.action.DECODE_DATA
// We relay it to the active client via postMessage
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'BARCODE_SCAN') {
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({ type: 'BARCODE_SCAN', barcode: e.data.barcode }));
    });
  }
});
