const CACHE = 'farin-spanish-v46';   // v46 2026-11-26: the last 3D posters + cards, Order Up! shelf pictures without slivers; v45 2026-11-26: Home without the profile and Premium courses boxes, the membership box in brand purple with FE in his season clothes, the settings button opens Profile (FE in a Special / Travel outfit, Settings in its head), Courses in the bottom bar; v44 v44 2026-11-26: Captain in 3D (pt-captain-*.webp, same names); v43 2026-11-26: premium courses only through Plus and Guided (no single-course request or price); vv42 2026-11-26: the games' microphones (Say It Back, Open House free line: tap to stop, no lost taps, says why); v41 2026-11-26: the practice score weighs the whole answer (length, sentences, variety, topic), not just its length; v40 2026-11-26: Messages shows only the chats (no News from Farin list); v39 2026-11-26: card posters with ?v=, image cache fills revalidate (no stale copies), Open House / Harbour Files names; v38 2026-11-26: the new 3D roadmap cards (art/posters/card-*.webp, same names) + 3D posters; v37 2026-11-26: speaking-club dates refresh themselves while a screen stays open, old bookings pruned; vv36 2026-11-26: Guided includes the Thursday speaking clubs free (package line + My Groups card), adminMbPlanFor, Plus box without the per-course link; v35 2026-11-25: Spanish speaking clubs (My Groups, Speaking Club! roadmap cards, admin Speaking clubs + put a learner in, free for Guided), Group classes section removed; vv34 2026-11-25: Order Up! 3D café art, full-body customers (same file names for the shelf items: a new cache); v33 2026-11-25: the speaking microphone starts and stops reliably (Round 3 of a speaking card, the Say it chips, course + IELTS recorders); v32 2026-11-25: Order Up! customer chats + the cozy café look (games/worlds/order/world.css, skins.js order, chat voice clips); v31 2026-11-25: memberships Free / Plus / Guided (header entry, membership page, manual payments + admin Payments / Members, 48-hour intro offer, page report in Plus); v30 2026-11-25: Premium courses list as picture cards (DELE photo, Plus pill); v29 2026-11-25: FEschool intro before the questions, the roadmap build after Go!; v28 2026-11-23: shorter group-class offer with the discount, In app class offers (Messages card, mailbox); v27 2026-11-23: admin Your week, drag a class to another time; v26 2026-11-23: group classes: one time each (new order), 8 seats then a new class, silent refit, codes EA/SA, no mid-private; v25 2026-11-23: group classes of 6–8, class price offer (toman + lira), new course prices; v24 2026-11-21: roadmap v4, the box holds the current card down to the end (page scrolls), finished cards above it out of view; v23 2026-11-21: app icon = white FE face on purple; v21 2026-11-21: the roadmap box scrolls on its own, current card at its top, no earlier-cards bar; v20 2026-11-21: sharp 900 px FE p-cheer, welcome card 300 px; v19 2026-11-21: Home opens at the top, current card first under the earlier-cards bar; v18 2026-11-21: welcome card = FE cheering, 200 px; v17 2026-11-21: admin class rows keep the name column (actions shrink + wrap); v16 2026-11-21: welcome card = FE medal + confetti; v15 2026-11-21: Messages v2 (clean list, brand status pills, admin reply context + edit/delete);   // v14 2026-11-21: roadmap cards (purple/white/orange, no symbols, solid circles, page report card, Home opens on the current card, plan bubble off); v13 2026-11-21: admin Group classes, gold frame + Offer sent tick; v12 2026-11-21: onboarding redesign + welcome screen; v10 2026-11-20: FE white (art/fe, notif/*, icon-*.png repainted under the same names), only the clean pose set
const CACHE_PREFIX = CACHE.replace(/\d+$/, '');   // 'farin-english-v' / 'farin-spanish-v'
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
/* Your Call (Story Path) painted scenes (Trello AlgNvFej, live 2026-10-14): path/<file>.webp, one town per app
   under the same file names. Chapter 1 (both scenes + its four outcome swaps, 13 files) is precached at install
   so the first chapter opens offline; chapters 2-6 are cached on first use (the app preloads a chapter's files
   when it starts). One request per file, so a missing file never blocks the rest. Bump CACHE when a file is
   repainted under the same name. */
const PATH_PRECACHE = [
  'path/plate-lane-ch1-1.webp',
  'path/lane-ch1-1-glint.webp',
  'path/lane-ch1-1-street.webp',
  'path/lane-ch1-1-dress.webp',
  'path/lane-ch1-1-people.webp',
  'path/lane-ch1-d1a.webp',
  'path/lane-ch1-d1b.webp',
  'path/plate-lane-ch1-2.webp',
  'path/lane-ch1-2-wash.webp',
  'path/lane-ch1-2-dress.webp',
  'path/lane-ch1-2-people.webp',
  'path/lane-ch1-d2a.webp',
  'path/lane-ch1-d2b.webp'
];
const PATH_RE = /\/path\/[^/?#]+\.webp$/;
/* Character and story art (Trello c24wjywa): the companion (FE, art/fe/fe-<pose>.webp, since 2026-11-19; was char-<goal>.png),
   the story genre cut-outs (stories, souvenirs, the journal) and the logo on every souvenir back, precached at
   install so they show offline even before a screen first used them. One request per file, so a missing file
   never blocks the rest. The bigger menu icons stay cache-on-first-use (IMG_RE below). */
const APP_ART_PRECACHE = [
  // FE, the app's character (2026-11-19): the five goal outfits + the faces the bubbles, hints and results use most
  'art/fe/fe-l-laptop.webp', 'art/fe/fe-p-mug.webp', 'art/fe/fe-l-books.webp', 'art/fe/fe-t-binoculars.webp', 'art/fe/fe-t-explorer.webp',
  'art/fe/fe-p-idea.webp', 'art/fe/fe-p-cheer.webp', 'art/fe/fe-m-trophy.webp', 'art/fe/fe-m-medal.webp', 'art/fe/fe-m-heart.webp', 'art/fe/fe-p-hooray.webp',
  'art/fe/fe-s-autumn.webp', 'art/fe/fe-s-winter.webp', 'art/fe/fe-s-spring.webp', 'art/fe/fe-s-summer.webp', 'art/fe/fe-x-astronaut.webp', 'art/fe/fe-x-detective.webp', 'art/fe/fe-x-artist.webp', 'art/fe/fe-x-king.webp', 'art/fe/fe-t-guidebook.webp',   // 2026-11-26: the membership box (seasons) + Profile (Special / Travel)
  'story-adventure-cutout.png', 'story-documentary-cutout.png', 'story-fiction-cutout.png', 'story-romance-cutout.png', 'story-thriller-cutout.png',
  'logo-fe-cutout.png',
  // roadmap game-card posters (2026-10-28, filled 2026-11-12): one art/posters/card-<kind>.webp per kind CARD_POSTERS lists, + the Story Path plates
  'art/posters/card-path.webp', 'art/posters/card-chores.webp', 'art/posters/card-radio.webp', 'art/posters/card-order.webp', 'art/posters/card-desk.webp', 'art/posters/card-mystery.webp', 'art/posters/card-spell.webp', 'art/posters/card-bingo.webp', 'art/posters/card-hunt.webp', 'art/posters/card-cross.webp', 'art/posters/card-build.webp', 'art/posters/card-dictation.webp', 'art/posters/card-echo.webp', 'art/posters/card-match.webp', 'art/posters/card-trap.webp', 'art/posters/plate-lane-ch1-1.webp', 'art/posters/plate-lane-ch2-1.webp', 'art/posters/plate-lane-ch3-1.webp', 'art/posters/plate-lane-ch4-1.webp', 'art/posters/plate-lane-ch5-1.webp', 'art/posters/plate-lane-ch6-1.webp'
];
// Natural voice clips (Claude/tts): audio/<lang>/<key>.mp3 never change under one name -> cache-first;
// audio/<lang>/manifest.json changes when clips are added -> network-first, cached copy offline.
// audio/<lang>/alt/ holds the same lines in the other accent (accent switch).
// audio/<lang>/<code>/ (one letter): the game characters' second voices (2026-11-23: Spanish Lucía l / Aldo a in the app; English
// Emma e / Michael m on the English voice site), same rules.
const AUDIO_RE = /\/audio\/[a-z]{2}\/(alt\/|[a-z]\/)?[0-9a-f]{16}\.mp3$/;
const MANIFEST_RE = /\/audio\/[a-z]{2}\/(alt\/|[a-z]\/)?manifest\.json$/;
/* Offline: the app's own images, the Google Fonts files and the pinned Firebase SDK are
   cache-first, filled on first use, so a learner who has opened the app once can open it again
   with no connection. Bump CACHE whenever an image is replaced under the same name. */
// Game Theatre + lazy game files (x35crL5M): games/**/*.js|css load on the first tap of a game; stale-while-revalidate keeps
// them offline after that and picks up a new ?v= on the next visit. Poster WebPs (games/posters/) fall under IMG_RE.
const GAMES_RE = /\/games\/[^?#]+\.(js|css|json|woff2)$/;
const IMG_RE = /\.(png|webp|jpg|jpeg|svg)$/;
// Firebase SDK, served from this site since 2026-11-14 (vendor/firebase-<version>/): a new version gets a new folder, so a file never
// changes under one name -> cache-first, and precached at install so the app's login works offline-first.
const VENDOR_PRECACHE = ['vendor/firebase-10.7.1/firebase-app-compat.js', 'vendor/firebase-10.7.1/firebase-auth-compat.js'];
const VENDOR_RE = /\/vendor\/[^?#]+\.js$/;
const STATIC_HOSTS = ['fonts.gstatic.com'];
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';
const FONT_CSS_HOST = 'fonts.googleapis.com';
// On a slow connection, open the saved copy instead of waiting; the fresh page still lands in the cache.
const PAGE_TIMEOUT_MS = 4000;

// Install on a slow connection (2026-11-14): the page is taken from the browser's own cache when it is there (the learner just
// downloaded it; GitHub Pages lets it be reused for 10 min), instead of downloading the 7 MB page a second time. The next open
// fetches it fresh anyway (pageWithTimeout). Art that is already saved is not downloaded again when the worker updates.
// Files repainted under the same name still need a CACHE bump.
function addMissing(c, list) {
  return Promise.all(list.map((u) => {
    const href = new URL(u, PAGE_URL).href;
    return c.match(href).then((hit) => hit || c.add(new Request(href, { cache: 'no-cache' }))).catch(() => {});   // never a stale HTTP-cache copy (2026-11-26)
  }));
}
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all([
    c.add(new Request(PAGE_URL)),
    addMissing(c, VENDOR_PRECACHE),
    addMissing(c, ART_PRECACHE),
    addMissing(c, APP_ART_PRECACHE),
    addMissing(c, PATH_PRECACHE)
  ])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // Only this app's older caches (and unknown leftovers): the English and Spanish apps share the
    // farinrasuli.github.io origin, so deleting every other name wiped the other app's saved page, art
    // and clips whenever one of them updated (found 2026-10-14, AlgNvFej).
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE && (k.indexOf(CACHE_PREFIX) === 0 || !/^farin-(english|spanish)-v\d+$/.test(k))).map((k) => caches.delete(k))
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
  // the fill revalidates with the server (cache:'no-cache'): right after a release the browser's HTTP cache can still hold the old
  // picture for ~10 min, and a copy taken from it stayed in this cache until the next bump (2026-11-26, the old posters)
  return caches.match(req).then((hit) => hit || fetch(req, { cache: 'no-cache' }).then((res) => {
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

// A slow open was answered with the saved copy and the fresh page that landed afterwards is different: tell this app's open
// windows, so the page reloads the next time the learner comes back to it on Home (2026-11-11, farin-app). Same text = no message.
function tellPageUpdated() {
  return self.clients.matchAll({ type: 'window' }).then((list) => list.forEach((cl) => {
    if (cl.url.split(/[?#]/)[0] === PAGE_URL) cl.postMessage({ type: 'farin-page-updated' });
  }));
}

// No saved page yet (first open after the worker installed, or the cache was cleared): hand the page to the browser as it streams
// in, so the loading screen at the top of the file shows at once, and save a copy in the background. Before, the browser got
// nothing until the whole 7 MB had arrived and been saved (2026-11-14).
function pageStreamAndSave(e) {
  const net = fetch(e.request, { cache: 'no-store' });
  e.waitUntil(net.then((res) => {
    if (!res.ok) return null;
    const copy = res.clone();   // now, before the browser starts reading the body
    return caches.open(CACHE).then((c) => c.put(PAGE_URL, copy));
  }).catch(() => {}));
  return net.catch(() => Response.error());
}

function pageOpen(e) {
  return caches.match(PAGE_URL).then((hit) => (hit ? pageWithTimeout(e) : pageStreamAndSave(e)), () => pageStreamAndSave(e));
}

function pageWithTimeout(e) {
  let servedSaved = false;
  const net = fetch(e.request, { cache: 'no-store' }).then((res) => {
    if (!res.ok) return res;
    const copy = res.clone();
    return caches.open(CACHE).then((c) => c.match(PAGE_URL).then((old) => c.put(PAGE_URL, copy.clone()).then(() => (servedSaved && old
      ? Promise.all([old.text(), copy.text()]).then(([a, b]) => (a !== b ? tellPageUpdated() : null)).catch(() => {})
      : null)))).then(() => res);
  });
  e.waitUntil(net.catch(() => {}));
  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => { if (!done && res) { done = true; resolve(res); return true; } return false; };
    const saved = () => caches.match(PAGE_URL);
    const timer = setTimeout(() => saved().then((hit) => { if (finish(hit)) servedSaved = true; }), PAGE_TIMEOUT_MS);
    net.then((res) => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); saved().then((hit) => finish(hit || Response.error())); });
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(pageOpen(e));
    return;
  }
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    // game art and app images: cache-first, filled on first use (the files never change under one name)
    if (AUDIO_RE.test(url.pathname)) { e.respondWith(audioCacheFirst(e.request)); return; }
    if (MANIFEST_RE.test(url.pathname)) { e.respondWith(networkFirst(e.request)); return; }
    if (GAMES_RE.test(url.pathname)) { e.respondWith(staleWhileRevalidate(e)); return; }
    if (VENDOR_RE.test(url.pathname)) { e.respondWith(cacheFirst(e.request)); return; }
    if (ART_RE.test(url.pathname) || PATH_RE.test(url.pathname) || IMG_RE.test(url.pathname)) e.respondWith(cacheFirst(e.request));
    return;
  }
  if (STATIC_HOSTS.includes(url.hostname) || url.href.startsWith(FIREBASE_SDK)) {
    e.respondWith(cacheFirst(e.request));
  } else if (url.hostname === FONT_CSS_HOST) {
    e.respondWith(staleWhileRevalidate(e));
  }
});

/* ---------- Phone notifications (2026-11-15): fe-notify sends {title, body, go, k, id, tag, icon, image}, encrypted for this phone ----------
   icon / image = FE in a goal outfit (notif/<name>-icon.png, notif/<name>-wide.jpg, next to this file; 2026-11-16, FE since 2026-11-19).
   The tap opens the app on the right screen: an open app gets a 'notif-go' message, otherwise the page opens with #n=<go>. */
const NOTIF_OPENED_URL = 'https://fe-notify.farinrasuli.workers.dev/opened';
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ''}; }
  const rtl = /[؀-ۿ]/.test((d.title || '') + (d.body || ''));
  e.waitUntil(self.registration.showNotification(d.title || 'Farin Spanish', {
    body: d.body || '', icon: d.icon || 'icon-180.png', image: d.image || undefined, tag: d.tag || undefined, renotify: !!d.tag, dir: rtl ? 'rtl' : 'auto',
    data: {go: d.go || '', k: d.k || '', id: d.id || ''}
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const page = self.registration.scope;   // this worker's scope is the app page itself
  e.waitUntil((async () => {
    fetch(NOTIF_OPENED_URL, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify({k: d.k, id: d.id})}).catch(() => {});
    const wins = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const open = wins.find((c) => c.url.split('#')[0].split('?')[0] === page.split('?')[0]);
    if (open) { open.postMessage({type: 'notif-go', go: d.go}); return open.focus(); }
    return self.clients.openWindow(page + (d.go ? '#n=' + encodeURIComponent(d.go) : ''));
  })());
});
