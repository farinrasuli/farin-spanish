const CACHE = 'farin-spanish-v2';
const PAGE_URL = self.registration.scope;
/* Cozy Chores painted art (Trello 1m2Y0zdU): the game's plates and cut-outs are sibling files
   under chores/ (chores/plate-<id>.webp, chores/co-<id>.webp). List them here when they land so
   they are precached with the page; until then the list is empty and the fetch rule below still
   caches any chores/*.webp on first use. */
const ART_PRECACHE = [];
const ART_RE = /\/chores\/[^/?#]+\.webp$/;
// Natural voice clips (Claude/tts): audio/<lang>/<key>.mp3 never change under one name -> cache-first;
// audio/<lang>/manifest.json changes when clips are added -> network-first, cached copy offline.
const AUDIO_RE = /\/audio\/[a-z]{2}\/[0-9a-f]{16}\.mp3$/;
const MANIFEST_RE = /\/audio\/[a-z]{2}\/manifest\.json$/;
/* Offline: the app's own images, the Google Fonts files and the pinned Firebase SDK are
   cache-first, filled on first use, so a learner who has opened the app once can open it again
   with no connection. Bump CACHE whenever an image is replaced under the same name. */
const IMG_RE = /\.(png|webp|jpg|jpeg|svg)$/;
const STATIC_HOSTS = ['fonts.gstatic.com'];
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';
const FONT_CSS_HOST = 'fonts.googleapis.com';
// On a slow connection, open the saved copy instead of waiting; the fresh page still lands in the cache.
const PAGE_TIMEOUT_MS = 4000;

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

// Audio clips: a media element asks for byte ranges, and a 206 can't be cached, so fetch the whole
// file (no Range header), cache that 200 and answer with it.
function audioCacheFirst(req) {
  return caches.match(req.url).then((hit) => hit || fetch(req.url).then((res) => {
    if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.url, copy)); }
    return res;
  }));
}
function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req));
}

const cacheable = (res) => res && (res.ok || res.type === 'opaque');

function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }));
}

function staleWhileRevalidate(e) {
  const net = fetch(e.request).then((res) => {
    if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  return caches.match(e.request).then((hit) => hit || net);
}

function pageWithTimeout(e) {
  const net = fetch(e.request, { cache: 'no-store' }).then((res) => {
    if (res.ok) { const copy = res.clone(); return caches.open(CACHE).then((c) => c.put(PAGE_URL, copy)).then(() => res); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
    const saved = () => caches.match(PAGE_URL);
    const timer = setTimeout(() => saved().then(finish), PAGE_TIMEOUT_MS);
    net.then((res) => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); saved().then((hit) => finish(hit || Response.error())); });
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(pageWithTimeout(e));
    return;
  }
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    // game art and app images: cache-first, filled on first use (the files never change under one name)
    if (AUDIO_RE.test(url.pathname)) { e.respondWith(audioCacheFirst(e.request)); return; }
    if (MANIFEST_RE.test(url.pathname)) { e.respondWith(networkFirst(e.request)); return; }
    if (ART_RE.test(url.pathname) || IMG_RE.test(url.pathname)) e.respondWith(cacheFirst(e.request));
    return;
  }
  if (STATIC_HOSTS.includes(url.hostname) || url.href.startsWith(FIREBASE_SDK)) {
    e.respondWith(cacheFirst(e.request));
  } else if (url.hostname === FONT_CSS_HOST) {
    e.respondWith(staleWhileRevalidate(e));
  }
});
