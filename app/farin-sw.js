const CACHE = 'farin-spanish-v6';
const PAGE_URL = self.registration.scope;
/* Cozy Chores painted art (Trello 1m2Y0zdU, 8JAiLuV7): the game's plates and cut-outs are sibling files
   under chores/ (chores/plate-<id>.webp, chores/co-<id>.webp), precached with the page so the room
   opens offline. home1 (the family kitchen, live 2026-10-10) + the helper and steam puff every place
   shares; home2, home3, home4, the bakery, the flower shop and the building (live 2026-10-14). Add a
   room's files here when it opens or changes (and bump CACHE); the fetch rule below still caches any
   chores/*.webp on first use. */
const ART_PRECACHE = [
  'chores/plate-home1.webp',
  'chores/co-char.webp',
  'chores/co-f1-chairFront.webp',
  'chores/co-f1-dishesClean.webp',
  'chores/co-f1-dishesDirty.webp',
  'chores/co-f1-lamp.webp',
  'chores/co-f1-plantHappy.webp',
  'chores/co-f1-plantSad.webp',
  'chores/co-f1-shopping.webp',
  'chores/co-f1-tableMess.webp',
  'chores/co-f1-toys.webp',
  'chores/co-f1-toysBasket.webp',
  'chores/co-f1-valance.webp',
  'chores/co-f1-view.webp',
  'chores/co-puff.webp',
  'chores/co-f2-basket.webp',
  'chores/co-f2-bedEnd.webp',
  'chores/co-f2-bedMade.webp',
  'chores/co-f2-bedMessy.webp',
  'chores/co-f2-binEmpty.webp',
  'chores/co-f2-binFull.webp',
  'chores/co-f2-books.webp',
  'chores/co-f2-booksShelf.webp',
  'chores/co-f2-clothes.webp',
  'chores/co-f2-curtainsClosed.webp',
  'chores/plate-home2.webp',
  'chores/co-f3-blanketFolded.webp',
  'chores/co-f3-blanketMessy.webp',
  'chores/co-f3-bowl.webp',
  'chores/co-f3-catHappy.webp',
  'chores/co-f3-catHungry.webp',
  'chores/co-f3-fire.webp',
  'chores/co-f3-papers.webp',
  'chores/co-f3-papersStack.webp',
  'chores/co-f3-plantHappy.webp',
  'chores/co-f3-plantSad.webp',
  'chores/co-f3-sweepings.webp',
  'chores/plate-home3.webp',
  'chores/co-f4-balloons.webp',
  'chores/co-f4-chairFront.webp',
  'chores/co-f4-cups.webp',
  'chores/co-f4-footprints.webp',
  'chores/co-f4-lamp.webp',
  'chores/co-f4-lights.webp',
  'chores/co-f4-lightsGlow.webp',
  'chores/co-f4-puddle.webp',
  'chores/co-f4-spill.webp',
  'chores/co-f4-tableFront.webp',
  'chores/co-f4-towels.webp',
  'chores/co-f4-towelsHung.webp',
  'chores/co-f4-tray.webp',
  'chores/co-f4-view.webp',
  'chores/co-f4-windowClosed.webp',
  'chores/co-f4-windowOpen.webp',
  'chores/plate-home4.webp',
  'chores/co-fl-bouquet.webp',
  'chores/co-fl-flowersFresh.webp',
  'chores/co-fl-flowersWilted.webp',
  'chores/co-fl-hanging.webp',
  'chores/co-fl-petals.webp',
  'chores/co-fl-signClosed.webp',
  'chores/co-fl-signOpen.webp',
  'chores/co-fl-stemsLong.webp',
  'chores/co-fl-stemsTrimmed.webp',
  'chores/co-fl-tableFront.webp',
  'chores/plate-flowers.webp',
  'chores/co-bk-bulb.webp',
  'chores/co-bk-dough.webp',
  'chores/co-bk-doughKneaded.webp',
  'chores/co-bk-flour.webp',
  'chores/co-bk-loaves.webp',
  'chores/co-bk-ovenGlow.webp',
  'chores/co-bk-shutter.webp',
  'chores/co-bk-traysClean.webp',
  'chores/co-bk-traysDirty.webp',
  'chores/plate-bakery.webp',
  'chores/co-ext-awnings.webp',
  'chores/co-win-bakery.webp',
  'chores/co-win-flowers.webp',
  'chores/co-win-home1.webp',
  'chores/co-win-home2.webp',
  'chores/co-win-home3-tv.webp',
  'chores/co-win-home3.webp',
  'chores/co-win-home4.webp',
  'chores/plate-facade.webp'
];
const ART_RE = /\/chores\/[^/?#]+\.webp$/;
/* Character and story art (Trello c24wjywa): the companions (char-<goal>.png, also the Order Up! customers),
   the story genre cut-outs (stories, souvenirs, the journal) and the logo on every souvenir back, precached at
   install so they show offline even before a screen first used them. One request per file, so a missing file
   never blocks the rest. The bigger menu icons stay cache-on-first-use (IMG_RE below). */
const APP_ART_PRECACHE = [
  'char-career.png', 'char-everyday.png', 'char-exam.png', 'char-immigration.png', 'char-travel.png',
  'story-adventure-cutout.png', 'story-documentary-cutout.png', 'story-fiction-cutout.png', 'story-romance-cutout.png', 'story-thriller-cutout.png',
  'logo-fe-cutout.png'
];
// Natural voice clips (Claude/tts): audio/<lang>/<key>.mp3 never change under one name -> cache-first;
// audio/<lang>/manifest.json changes when clips are added -> network-first, cached copy offline.
// audio/<lang>/alt/ holds the same lines in the other accent (accent switch).
const AUDIO_RE = /\/audio\/[a-z]{2}\/(alt\/)?[0-9a-f]{16}\.mp3$/;
const MANIFEST_RE = /\/audio\/[a-z]{2}\/(alt\/)?manifest\.json$/;
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
    c.addAll(ART_PRECACHE.map((u) => new URL(u, PAGE_URL).href)).catch(() => {}),
    Promise.all(APP_ART_PRECACHE.map((u) => c.add(new URL(u, PAGE_URL).href).catch(() => {})))
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
