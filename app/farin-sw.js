const CACHE = 'farin-spanish-v1';
const PAGE_URL = self.registration.scope;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(PAGE_URL, { cache: 'reload' }))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then((res) => {
        caches.open(CACHE).then((c) => c.put(PAGE_URL, res.clone()));
        return res;
      }).catch(() => caches.match(PAGE_URL))
    );
  }
});
