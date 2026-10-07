const CACHE = 'farin-spanish-v1';
const PAGE_URL = self.registration.scope;
/* Cozy Chores painted art (Trello 1m2Y0zdU): the game's plates and cut-outs are sibling files
   under chores/ (chores/plate-<id>.webp, chores/co-<id>.webp). List them here when they land so
   they are precached with the page; until then the list is empty and the fetch rule below still
   caches any chores/*.webp on first use. */
const ART_PRECACHE = [];
const ART_RE = /\/chores\/[^/?#]+\.webp$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all([
    c.add(new Request(PAGE_URL, { cache: 'reload' })),
    c.addAll(ART_PRECACHE.map((u) => new URL(u, PAGE_URL).href)).catch(() => {})
  ])).catch(() => {}));
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
    return;
  }
  if (e.request.method === 'GET' && ART_RE.test(new URL(e.request.url).pathname)) {
    // game art: cache-first, filled on first use (the files never change under one name)
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }))
    );
  }
});
