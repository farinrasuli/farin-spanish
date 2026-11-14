/* Game Theatre v1 - the shared full-screen stage and poster intro for every scenario game.
   Trello x35crL5M (Your Call v2 card 6, widened to all scenario games); games-expansion proposal 2026-10-22, section 03.
   This file is byte-identical in english app/app/games/theatre/ and spanish app/app/games/theatre/. Per-language
   posters and HUD strings live next to it in content.js (window.THEATRE_CONTENT). Full API notes:
   Claude/specs/games-expansion-2026-10-22/THEATRE-API.md

   The app lazy-loads theatre.css, content.js and this file on the first tap of a scenario game card, then calls:

   Theatre.open({
     kind,               // 'path' | 'chores' | 'mystery' | 'order' | 'desk' | 'spell' | any new kind with a poster
     poster,             // optional overrides merged over THEATRE_CONTENT.posters[kind]:
                         //   {title, sub, tagline, art, artReady, artWide, palette:{sky,glow,ink,accent,accentInk}}
                         //   title may be a string or a per-level map {A1:'..', A2:'..', default:'..'}
     strip,              // optional [{id, label, thumb, state:'developed'|'developing'|'locked', note, onTap(item)}] (note = small grey line under the photo)
     controls,           // optional extra HUD buttons, right of sound: [{id, label, icon(svg string), onTap(btn)}]
     stage,              // 'portrait' (default, full-height tall column) | '4:5' (wider column for 4:5 art) | 'app' (the app's own column, max 480px)
     skin,               // optional overrides merged over THEATRE_SKINS[kind] (skins.js): {card, focus, palette, backdrop, props}; false = no skin.
                         //   A kind with a skin and no portrait key art shows its card poster (960x480) in the wide poster layout, and the
                         //   game runs over the skin's world (backdrop + corner props, palette tint); body gets data-th-skin=<kind>.
     label,              // 'play' = the poster button says Play even when seen (quick games: every round is a new one)
     brief,              // true = once seen, the poster rests 1.2 s and goes into the game by itself (a tap goes in at once; x still closes)
     companion,          // true = the app's game companion stays on screen (quick games); the scenario games draw their own cast
     confirmExit,        // optional fn -> true while a round is in progress: HUD x / Escape first ask "Leave the game?" (Stay / Leave)
     world,              // World Kit on for this kind (the app's WORLDS_LIVE switch): {level, gw, world} over skins.js gw / world
     seen,               // true = the learner has met this poster: show it at rest with Continue, no sequence
     forcePoster,        // show the poster even without artReady (previews only; learners never see a placeholder)
     cover, from,        // the app's loading cover element (adopted) and the tapped card's DOMRect
     views,              // app view names that belong to the game; leaving them closes the Theatre (see sync)
     app,                // {lang, name, level, gameName, view(), muted(), setMuted(bool)}
     onPlay(info),       // Play / Continue tapped (info.poster true), or at once when there is no art yet (info.poster false)
     onExit(),           // HUD x while the game runs: save and leave the way the game's Back does
     onClose()           // after the Theatre has fully closed, for any reason
   })
   Theatre.close({instant})     close now (also called by sync when the game's views are left)
   Theatre.sync(view)           the app calls this after every render
   Theatre.titleCard(text, sub, {ms}) -> Promise   1.5 s card between chapters, one tap skips
   Theatre.transition(fn) -> Promise   runs a DOM update inside a View Transition (WAAPI fade fallback)
   Theatre.setStrip(items) / Theatre.setControls(list)   update the poster strip / extra HUD buttons
   Theatre.setSkin(kind)        switch the running game's world to another kind's skin (a round that fell back to another game)
   Theatre.say(text, {who, kind:'caption'|'balloon', ms, lang})   World Kit caption box / speech balloon, 5 s at most, a new line replaces
   Theatre.finale({beat, ms}) -> Promise   the world's end beat (2.4 s at most, a tap skips)
   Theatre.sfx(name) -> bool    World Kit foley (CC0 kit, variants, detune); false = no file, play the app's own sound
   Theatre.world()              the kind whose world is on, or null
   Theatre.stageEl()            a full-size element over #app for games that draw their own stage (Your Call v2)
   Theatre.isOpen() / Theatre.phase()   'poster' | 'running' | null
   Theatre.version
*/
(function(){
'use strict';
if(window.Theatre) return;
var D = document, W = window;
var cur = null;

var ICON = {
  close:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  soundOn:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 010 6M17.8 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  lock:'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>'
};

function content(){ return W.THEATRE_CONTENT || {posters:{}, strings:{}}; }
function reduced(){ try{ return W.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function el(tag, cls, html){ var n = D.createElement(tag); if(cls) n.className = cls; if(html != null) n.innerHTML = html; return n; }
// UI string in the app's interface language: content strings are {en, tr, fa, es}
function S(key, vars){
  var lang = (cur && cur.app.lang) || D.documentElement.lang || 'en';
  var e = (content().strings || {})[key] || {};
  var s = e[lang] != null ? e[lang] : (e.en != null ? e.en : key);
  if(vars) s = s.replace(/\{(\w+)\}/g, function(m, k){ return vars[k] != null ? vars[k] : m; });
  return s;
}
function pick(v, level){
  if(v == null || typeof v === 'string') return v || '';
  return v[level] || v['default'] || v.A1 || '';
}
function vt(fn){ var de = D.documentElement; de.classList.add('th-vt'); var t = D.startViewTransition(fn); var off = function(){ de.classList.remove('th-vt'); }; var no = function(){};
  t.ready.catch(no); t.updateCallbackDone.catch(no); t.finished.then(off, off); return t; }
function anim(n, frames, o){ try{ return n && n.animate ? n.animate(frames, o) : null; }catch(e){ return null; } }

/* ---------- skin: one world per game (skins.js) ---------- */
function skinData(kind, over){
  if(over === false) return null;
  var base = (W.THEATRE_SKINS || {})[kind];
  if(!base && !over) return null;
  var sk = {}, k;
  for(k in (base || {})) sk[k] = base[k];
  for(k in (over || {})) sk[k] = over[k];
  return sk;
}
function merge(){ var out = {}; for(var i = 0; i < arguments.length; i++){ var a = arguments[i] || {}; for(var k in a) out[k] = a[k]; } return out; }

/* ---------- poster ---------- */
function posterData(o, sk){
  var base = (content().posters || {})[o.kind] || {};
  var over = o.poster || {};
  var p = merge(base, over);
  // palette: the skin's (from the poster) under the content's and the caller's
  p.palette = merge(sk && sk.palette, base.palette, over.palette);
  // no portrait key art of its own yet: the game's live roadmap card poster (landscape) in the wide layout
  if(!(p.art && p.artReady) && sk && sk.card){ p.art = sk.card; p.artReady = true; p.shape = 'wide'; p.focus = sk.focus || ''; }
  return p;
}
function artHtml(p, kind, title){
  // final key art: one swappable WebP per poster (games/posters/<kind>.webp), loaded only once artReady is true
  // so a missing file never costs a 404. Until then: a gradient plate with the title set big as a placeholder.
  if(p.art && p.artReady) return '<img class="th-art-img" src="' + esc(p.art) + '" alt="" decoding="async">';
  var mono = esc(String(title || '').replace(/^(the|an?|el|la|los|las|un|una)\s+/i, '').charAt(0));
  return '<div class="th-ph th-ph-' + esc(kind) + '" aria-hidden="true"><span class="th-ph-sun"></span><span class="th-ph-mono">' + mono + '</span><span class="th-ph-horizon"></span><span class="th-ph-grain"></span></div>';
}
function paletteStyle(pal){
  var map = {sky:'--th-sky', sky2:'--th-sky2', glow:'--th-glow', ink:'--th-ink', accent:'--th-accent', accentInk:'--th-accent-ink', ground:'--th-ground'};
  var out = '';
  for(var k in map) if(pal[k]) out += map[k] + ':' + pal[k] + ';';
  return out;
}
function billing(app){
  var name = String(app.name || '').trim();
  return name ? S('starring', {name:'<b class="th-star">' + esc(name) + '</b>'}) : S('starringYou', {you:'<b class="th-star">' + esc(S('you')) + '</b>'});
}
function stripHtml(items){
  if(!items || !items.length) return '';
  return items.map(function(it, i){
    var st = it.state || 'developed', locked = st === 'locked';
    return '<button type="button" class="th-strip-item th-' + esc(st) + '" data-i="' + i + '"' + (locked ? ' disabled aria-disabled="true"' : '') + '>' +
      '<span class="th-strip-thumb">' + (it.thumb ? '<img src="' + esc(it.thumb) + '" alt="">' : '') + (locked ? '<span class="th-strip-lock">' + ICON.lock + '</span>' : '') + '</span>' +
      '<span class="th-strip-label">' + esc(it.label || '') + '</span>' + (it.note ? '<span class="th-strip-note">' + esc(it.note) + '</span>' : '') + '</button>';
  }).join('');
}
function buildPoster(s){
  var p = s.poster, app = s.app, title = pick(p.title, app.level) || app.gameName || '';
  var level = String(app.level || '').toUpperCase();
  var first = !s.seen && !reduced();
  var art = artHtml(p, s.kind, title);
  var placeholder = !(p.art && p.artReady);
  var C = content(), q = C.quotes || ['“', '”'], tl = C.target ? ' lang="' + esc(C.target) + '" dir="ltr"' : '';
  var wide = p.shape === 'wide' && !placeholder;
  var frame = el('div', 'th-frame' + (first ? ' th-intro' : ' th-rest') + (placeholder ? ' th-is-ph' : '') + (wide ? ' th-wide' : ''));
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-modal', 'true');
  frame.setAttribute('aria-label', title);
  frame.style.cssText = paletteStyle(p.palette) + (wide && p.focus ? '--th-focus:' + String(p.focus).replace(/[^0-9.%a-z ]/gi, '') + ';' : '');
  var lockup =
    '<div class="th-lockup">' +
      '<p class="th-kicker"><span>' + esc(p.sub || app.gameName || '') + '</span></p>' +
      '<h1 class="th-title"' + tl + '>' + esc(title) + '</h1>' +
      (p.tagline ? '<p class="th-tagline"' + tl + '>' + esc(q[0]) + esc(p.tagline) + esc(q[1]) + '</p>' : '') +
    '</div>';
  // wide = landscape card art (960x480): the same picture, blurred and extended, fills the column; the sharp plate sits between
  // the title and Play, cropped around the subject (--th-focus). Everything scrolls inside the frame on a short screen.
  var head = wide
    ? '<div class="th-art"><img class="th-art-img" src="' + esc(p.art) + '" alt="" decoding="async"></div><div class="th-grade" aria-hidden="true"></div>' +
      '<div class="th-scroll"><div class="th-scroll-in">' + lockup +
      '<div class="th-plate" aria-hidden="true"><img class="th-plate-img" src="' + esc(p.art) + '" alt="" decoding="async"></div>'
    : '<div class="th-art">' + art + '</div><div class="th-grade" aria-hidden="true"></div>' + lockup;
  frame.innerHTML =
    head +
    '<div class="th-foot">' +
      '<button type="button" class="th-play">' + esc(s.seen && s.opts.label !== 'play' ? S('continue') : S('play')) + '</button>' +
      '<div class="th-strip" role="list" aria-label="' + esc(S('episodes')) + '">' + stripHtml(s.strip) + '</div>' +
      '<div class="th-billing">' +
        '<span class="th-bill-line">' + billing(app) + '</span>' +
        (level ? '<span class="th-stamp">' + esc(S('level', {level:level})) + '</span>' : '') +
      '</div>' +
      (placeholder ? '<p class="th-ph-tag">' + esc(S('artSoon')) + '</p>' : '') +
    '</div>' +
    (wide ? '</div></div>' : '') +
    (first ? '<div class="th-flash" aria-hidden="true"></div>' : '');
  return frame;
}
function cssNum(v, d, lo, hi){ v = Number(v); if(!isFinite(v)) v = d; return Math.max(lo, Math.min(hi, v)); }
function cssPos(v){ return String(v || '50% 50%').replace(/[^0-9.%a-z \-]/gi, ''); }
// the world behind a running game: its backdrop (the card art blurred, or a crisp illustrated one) under the palette's veil,
// plus the corner props in the game column
function worldHtml(s){
  var sk = s.skin, p = s.poster, b = sk.backdrop || {}, src = b.src || sk.card || p.artWide || p.art;
  var st = paletteStyle(p.palette) + '--th-bd-blur:' + cssNum(b.blur, 30, 0, 60) + 'px;--th-bd-veil:' + Math.round(cssNum(b.veil, .56, 0, 1) * 100) + '%;--th-bd-pos:' + cssPos(b.position) + ';';
  var props = (sk.props || []).map(function(pr){
    if(!pr || !pr.src) return '';
    var at = /^(tl|tr|bl|br)$/.test(pr.at) ? pr.at : 'br';
    var css = (pr.w ? 'width:' + cssPos(pr.w) + ';' : '') + (pr.h ? 'height:' + cssPos(pr.h) + ';' : '') + (pr.opacity != null ? 'opacity:' + cssNum(pr.opacity, 1, 0, 1) + ';' : '');
    return '<img class="th-prop th-prop-' + at + '" src="' + esc(pr.src) + '" alt="" style="' + css + '">';
  }).join('');
  return '<div class="th-bd-art th-bd-world" style="' + st + '">' + (src ? '<img src="' + esc(src) + '" alt="">' : '') + '</div>' +
    '<div class="th-bd-veil th-bd-wveil" style="' + st + '"></div><div class="th-props" aria-hidden="true">' + props + '</div>';
}
function backdropHtml(s){
  if(s.skin) return worldHtml(s);
  var p = s.poster, title = pick(p.title, s.app.level);
  var src = p.artReady ? (p.artWide || p.art) : null;
  // no art yet: the sides are just the palette's soft light (no placeholder plate)
  var bare = '<div class="th-ph th-ph-bare" aria-hidden="true"><span class="th-ph-sun"></span></div>';
  return '<div class="th-bd-art" style="' + paletteStyle(p.palette) + '">' + (src ? '<img src="' + esc(src) + '" alt="">' : (s.noPoster ? bare : artHtml(p, s.kind, title))) + '</div><div class="th-bd-veil"></div>';
}

/* ---------- HUD ---------- */
function buildHud(s){
  var hud = el('div', 'th-hud');
  hud.innerHTML = '<button type="button" class="th-btn th-x" aria-label="' + esc(S('close')) + '">' + ICON.close + '</button>' +
    '<div class="th-hud-r"><span class="th-controls"></span><button type="button" class="th-btn th-sound"></button></div>';
  hud.querySelector('.th-x').addEventListener('click', function(){ exit(); });
  hud.querySelector('.th-sound').addEventListener('click', function(){
    var m = !muted(); try{ s.app.setMuted && s.app.setMuted(m); }catch(e){} s.localMuted = m;
    paintSound(); if(!m) chime();
  });
  return hud;
}
function muted(){ if(!cur) return true; try{ return cur.app.muted ? !!cur.app.muted() : !!cur.localMuted; }catch(e){ return !!cur.localMuted; } }
function paintSound(){
  if(!cur) return;
  var b = cur.hud.querySelector('.th-sound'), m = muted();
  b.innerHTML = m ? ICON.soundOff : ICON.soundOn;
  b.setAttribute('aria-label', S('sound'));
  b.setAttribute('aria-pressed', m ? 'false' : 'true');
}
function paintControls(){
  if(!cur) return;
  var box = cur.hud.querySelector('.th-controls'); box.innerHTML = '';
  (cur.controls || []).forEach(function(c){
    var b = el('button', 'th-btn th-ctl', c.icon || esc(c.text || ''));
    b.type = 'button'; if(c.id) b.dataset.id = c.id;
    b.setAttribute('aria-label', typeof c.label === 'object' ? (c.label[cur.app.lang] || c.label.en || '') : (c.label || ''));
    b.addEventListener('click', function(){ try{ c.onTap && c.onTap(b); }catch(e){ console.warn('[theatre] control', e); } });
    box.appendChild(b);
  });
  D.body.style.setProperty('--th-hud-r', (58 + 48 * (cur.controls || []).length) + 'px');
}

/* ---------- leave sheet: "Leave the game?" while a round is in progress (confirmExit) ---------- */
function askLeave(s, go){
  if(s.leave) return;
  var rtl = s.app.lang === 'fa' || D.documentElement.dir === 'rtl';
  var box = el('div', 'th-leave');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.style.cssText = paletteStyle(s.poster.palette);
  box.innerHTML = '<div class="th-leave-card" dir="' + (rtl ? 'rtl' : 'ltr') + '" lang="' + esc(s.app.lang || 'en') + '"><p class="th-leave-q">' + esc(S('leaveQ')) + '</p>' +
    '<div class="th-leave-row"><button type="button" class="th-leave-stay">' + esc(S('stay')) + '</button>' +
    '<button type="button" class="th-leave-go">' + esc(S('leave')) + '</button></div></div>';
  box.setAttribute('aria-label', S('leaveQ'));
  s.leave = box;
  D.body.appendChild(box);
  var done = function(){ if(box.parentNode) box.remove(); if(s.leave === box) s.leave = null; };
  s.leaveStay = done;
  box.querySelector('.th-leave-stay').addEventListener('click', function(e){ e.stopPropagation(); done(); });
  box.querySelector('.th-leave-go').addEventListener('click', function(e){ e.stopPropagation(); done(); go(); });
  box.addEventListener('click', function(e){ if(e.target === box){ e.stopPropagation(); done(); } });
  if(!reduced()) anim(box.firstChild, [{opacity:0, transform:'translateY(14px) scale(.97)'}, {opacity:1, transform:'none'}], {duration:220, easing:'cubic-bezier(.2,.7,.2,1)'});
  try{ box.querySelector('.th-leave-stay').focus({preventScroll:true}); }catch(e){}
}

/* ---------- skin on the page: data-th-skin + the palette as CSS variables on body (the game screen reads them) ---------- */
var PAL_VARS = {sky:'--th-sky', sky2:'--th-sky2', glow:'--th-glow', ink:'--th-ink', accent:'--th-accent', accentInk:'--th-accent-ink', ground:'--th-ground'};
function paintSkin(s){
  var body = D.body, k;
  for(k in PAL_VARS) body.style.removeProperty(PAL_VARS[k]);
  if(!s.skin){ body.classList.remove('th-skinned'); body.removeAttribute('data-th-skin'); return; }
  body.classList.add('th-skinned');
  body.setAttribute('data-th-skin', s.skinKind || s.kind);
  var pal = s.poster.palette || {};
  for(k in PAL_VARS) if(pal[k]) body.style.setProperty(PAL_VARS[k], pal[k]);
}
function setSkin(kind){
  var s = cur; if(!s || !kind || kind === s.skinKind) return;
  var sk = skinData(kind, null); if(!sk) return;
  s.skin = sk; s.skinKind = kind;
  s.poster = merge(s.poster, {palette:merge(sk.palette, ((content().posters || {})[kind] || {}).palette)});
  paintSkin(s);
  if(s.backdrop) s.backdrop.innerHTML = worldHtml(s);
  if(s.world){ s.world.kind = kind; paintWorld(s); }
}

/* ---------- World Kit (worlds SPEC 4.3-4.10, 2026-11-14): a quick game plays inside its own place ----------
   Switched on per kind by the app (WORLDS_LIVE, ?worlds=1 previews), never by the Theatre itself. The world tokens live in skins.js
   (skin.gw = the colours, skin.world = plate / cut-outs / live text / stage height / sounds). Layers, in the game column:
     .th-world (z 0, behind #app) > .th-world-art (the plate + cut-outs; mirrored in a Persian UI) + .th-world-text (live text on the
     art, never mirrored) ; .th-say (z 52) = the caption box / speech balloon (Theatre.say).
   A plate or cut-out shows only when it is ready:true (the file exists): until then the game opens on the flat --gw-bg colour
   (Farin: nothing low designed), fully playable. body.gw-on.gw-<kind> switches the skin tokens on and lets #app sit over the world. */
var GW_VARS = {bg:'--gw-bg', surface:'--gw-surface', paper:'--gw-paper', ink:'--gw-ink', hue:'--gw-hue', accent:'--gw-accent', cta:'--gw-cta', ctaInk:'--gw-cta-ink', line:'--gw-line', stage:'--gw-stage'};
var GW_ED = {A1:'#FFD166', A2:'#5FC9B8', B1:'#4FC3E8', B2:'#A99BEA', C1:'#FF6F5E'};   // the level edition colour (SPEC 4.6)
function boxStyle(b){
  b = b || []; var x = cssNum(b[0], 0, -50, 150), y = cssNum(b[1], 0, -50, 150), w = cssNum(b[2], 20, 0, 200);
  return 'left:' + x + '%;top:' + y + '%;width:' + w + '%;';
}
function worldData(s){
  var sk = skinData(s.world.kind, null) || {};
  return {gw:merge(sk.gw, s.world.gw), w:merge(sk.world, s.world.world)};
}
function paintWorld(s){
  var body = D.body, d = worldData(s), w = d.w, k;
  body.className = body.className.replace(/\bgw-(?!on\b)[a-z0-9]+\b/g, '').replace(/\s+/g, ' ').trim();
  body.classList.add('gw-on', 'gw-' + s.world.kind);
  for(k in GW_VARS) body.style.removeProperty(GW_VARS[k]);
  for(k in GW_VARS) if(d.gw[k]) body.style.setProperty(GW_VARS[k], String(d.gw[k]));
  if(w.stage) body.style.setProperty('--gw-stage', String(w.stage).replace(/[^0-9a-z.,%()+\- ]/gi, ''));
  var ed = GW_ED[String(s.app.level || s.world.level || '').toUpperCase()];
  if(ed) body.style.setProperty('--gw-ed', ed); else body.style.removeProperty('--gw-ed');
  var plate = w.plate && w.plate.ready && w.plate.src ? '<img class="th-world-plate" src="' + esc(w.plate.src) + '" alt="" style="object-position:' + cssPos(w.plate.pos) + ';">' : '';
  var cut = (w.layers || []).filter(function(l){ return l && l.ready && l.src; }).map(function(l){
    return '<img class="th-world-cut ' + esc(l.cls || '') + '"' + (l.id ? ' id="' + esc(l.id) + '"' : '') + ' src="' + esc(l.src) + '" alt="" style="' + boxStyle(l.box) + '">';
  }).join('');
  var txt = (w.text || []).filter(function(t){ return t && t.ready; }).map(function(t){
    return '<div class="th-world-live ' + esc(t.cls || '') + '"' + (t.id ? ' id="' + esc(t.id) + '"' : '') + ' style="' + boxStyle(t.box) + '">' + esc(t.text || '') + '</div>';
  }).join('');
  s.world.el.innerHTML = '<div class="th-world-art' + (plate ? ' th-has-plate' : '') + '">' + plate + cut + '</div><div class="th-world-text">' + txt + '</div>';
  if(w.css) loadWorldCss(s.world.kind, w.css);
  warmSfx(w.sfx);
}
var worldCss = {};
function loadWorldCss(kind, href){
  if(worldCss[kind]) return;
  worldCss[kind] = 1;
  var l = D.createElement('link'); l.rel = 'stylesheet'; l.href = String(href); l.onerror = function(){ l.remove(); worldCss[kind] = 0; };
  D.head.appendChild(l);
}
function openWorld(s){
  if(!s.opts.world) return;
  s.world = {kind:s.kind, gw:s.opts.world.gw, world:s.opts.world.world, level:s.opts.world.level, el:el('div', 'th-world')};
  s.world.el.setAttribute('aria-hidden', 'true');
  D.body.appendChild(s.world.el);
  paintWorld(s);
}
function closeWorld(s){
  var body = D.body;
  if(s.world && s.world.el && s.world.el.parentNode) s.world.el.remove();
  if(s.sayEl && s.sayEl.parentNode) s.sayEl.remove();
  clearTimeout(s.sayTimer);
  body.className = body.className.replace(/\bgw-[a-z0-9]+\b/g, '').replace(/\s+/g, ' ').trim();
  for(var k in GW_VARS) body.style.removeProperty(GW_VARS[k]);
  body.style.removeProperty('--gw-ed');
  s.world = null;
}
// Theatre.say(text, {who, kind:'caption'|'balloon', ms, lang}): the narrator / companion caption box at the stage's top inline-start,
// or a character's balloon over the element `who`. 5 s at most; a new line replaces the old one; nothing on a timer (the app calls it
// after a learner action or an arrival). Works in any running Theatre; the quick games use it in world mode (SPEC 4.7).
function say(text, o){
  var s = cur; if(!s || !text) return false;
  o = o || {};
  var ms = Math.min(cssNum(o.ms, 5000, 600, 5000), 5000), kind = o.kind === 'balloon' && o.who ? 'balloon' : 'caption';
  if(!s.sayEl){ s.sayEl = el('div', 'th-say'); s.sayEl.setAttribute('role', 'status'); s.sayEl.setAttribute('aria-live', 'polite'); D.body.appendChild(s.sayEl); }
  var lang = o.lang || (kind === 'balloon' ? (content().target || 'en') : s.app.lang) || 'en';
  var rtl = lang === 'fa';
  s.sayEl.innerHTML = '<div class="th-' + kind + '" lang="' + esc(lang) + '" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + esc(text) + '</div>';
  var box = s.sayEl.firstChild;
  if(kind === 'balloon'){
    var who = D.getElementById(o.who), r = who && who.getBoundingClientRect();
    if(r && r.width){
      var col = s.sayEl.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(col.width - 8, r.left - col.left + r.width / 2)) + 'px';
      box.style.top = Math.max(84, r.top) + 'px';
    } else box.className = 'th-caption';
  }
  if(!reduced()) anim(box, [{opacity:0, transform:(kind === 'balloon' ? 'translate(-50%, calc(-100% + 8px))' : 'translateY(6px)')}, {opacity:1, transform:(kind === 'balloon' ? 'translate(-50%, -100%)' : 'none')}], {duration:200, easing:'cubic-bezier(.2,.7,.2,1)'});
  clearTimeout(s.sayTimer);
  s.sayTimer = setTimeout(function(){ if(s.sayEl && s.sayEl.firstChild === box){ var a = reduced() ? null : anim(box, [{opacity:1}, {opacity:0}], {duration:180, fill:'forwards'}); var rm = function(){ if(box.parentNode) box.remove(); }; if(a) a.onfinish = rm; else rm(); } }, ms);
  return true;
}
// Theatre.finale({beat, ms}) -> Promise: the world's own end moment (a class on .th-world for the CSS beat and/or a function),
// 2.4 s at most, one tap skips. The souvenir and the one button stay the app's own end card (SPEC 4.9).
function finale(o){
  var s = cur; o = o || {};
  return new Promise(function(resolve){
    if(!s || !s.world || reduced()){ resolve(); return; }
    var w = s.world.el, done = false, t;
    var end = function(){ if(done) return; done = true; clearTimeout(t); w.classList.remove('th-beat'); D.removeEventListener('pointerdown', end, true); resolve(); };
    w.classList.add('th-beat');
    try{ if(typeof o.beat === 'function') o.beat(w); }catch(e){}
    D.addEventListener('pointerdown', end, true);
    t = setTimeout(end, Math.min(cssNum(o.ms, 2400, 0, 2400), 2400));
  });
}
// Theatre.sfx(name): the Open House foley player lifted into the Theatre (SPEC 4.10). A name maps to files (skin.world.sfx over the shared
// CC0 kit in games/cozy-chores/sfx/); a variant never plays twice in a row, playbackRate 0.96-1.04, decoded once, the mute switch
// respected. false = no file for that name (the app plays its own sfx()).
var SFX_KIT = {bell:2, 'card-clack':2, click:2, clink:3, combo:1, correct:1, ding:2, door:2, knock:2, 'land-food':3, 'land-glass':3, 'land-heavy':3,
  'land-light':3, 'land-soft':3, lift:2, 'medal-clink':2, paper:3, 'paper-rustle':2, pencil:2, pop:2, reveal:1, swish:3, tick:3};
var sfxBufs = {}, sfxLast = {}, sfxCtx = null;
function sfxList(name){
  var w = cur && cur.world ? worldData(cur).w : {}, own = (w.sfx || {})[name];
  if(own && own.length) return own;
  var n = SFX_KIT[name]; if(!n) return null;
  var out = []; for(var i = 1; i <= n; i++) out.push('games/cozy-chores/sfx/' + name + '-' + i + '.mp3');
  return out;
}
function actxGet(){ try{ if(!sfxCtx) sfxCtx = new (W.AudioContext || W.webkitAudioContext)(); if(sfxCtx.state === 'suspended') sfxCtx.resume().catch(function(){}); return sfxCtx; }catch(e){ return null; } }
function warmSfx(map){
  if(!W.fetch) return;
  var names = Object.keys(map || {});
  names.forEach(function(nm){ (sfxList(nm) || []).forEach(function(url){
    if(sfxBufs[url]) return; sfxBufs[url] = 'wait';
    var c = actxGet(); if(!c){ sfxBufs[url] = null; return; }
    fetch(url).then(function(r){ if(!r.ok) throw new Error(url); return r.arrayBuffer(); })
      .then(function(b){ return new Promise(function(ok, no){ var p = c.decodeAudioData(b, ok, no); if(p && p.then) p.then(ok, no); }); })
      .then(function(buf){ sfxBufs[url] = buf; }, function(){ sfxBufs[url] = 'fail'; });
  }); });
}
function sfx(name){
  if(!cur || muted()) return !!cur;
  var list = sfxList(name); if(!list || !list.length) return false;
  var i = Math.floor(Math.random() * list.length); if(list.length > 1 && i === sfxLast[name]) i = (i + 1) % list.length; sfxLast[name] = i;
  var url = list[i], rate = 0.96 + Math.random() * 0.08, buf = sfxBufs[url];
  if(buf === 'fail') return false;
  if(buf && typeof buf === 'object'){
    try{ var c = actxGet(); var src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(c.destination); src.start(); return true; }catch(e){}
  }
  try{ var a = new Audio(url); a.preservesPitch = false; a.webkitPreservesPitch = false; a.playbackRate = rate; var p = a.play(); if(p && p.catch) p.catch(function(){}); if(!buf) warmSfx(merge((function(){ var m = {}; m[name] = 1; return m; })())); return true; }catch(e){ return false; }
}

/* ---------- sound: a short cinematic swell on Play (never before a tap) ---------- */
var CHORDS = {path:[220, 261.63, 329.63, 493.88], chores:[174.61, 220, 261.63, 349.23], mystery:[146.83, 174.61, 220, 277.18],
  order:[261.63, 329.63, 392, 523.25], desk:[196, 261.63, 293.66, 392], spell:[164.81, 207.65, 246.94, 329.63, 659.25],
  match:[293.66, 369.99, 440, 587.33], build:[196, 246.94, 293.66, 392], cross:[220, 277.18, 329.63, 440], bingo:[261.63, 329.63, 392, 659.25],
  hunt:[174.61, 220, 261.63, 329.63], echo:[246.94, 311.13, 369.99, 493.88], dictation:[233.08, 293.66, 349.23, 466.16], trap:[220, 293.66, 369.99, 440]};
function swell(kind){
  if(muted()) return;
  try{
    var AC = W.AudioContext || W.webkitAudioContext; if(!AC) return;
    var ctx = new AC(), t = ctx.currentTime + 0.02, out = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2600, t + 1.4);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.07, t + 0.9); out.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    lp.connect(out); out.connect(ctx.destination);
    (CHORDS[kind] || CHORDS.path).forEach(function(f, i){
      [-4, 4].forEach(function(det){
        var o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f, t); o.detune.setValueAtTime(det, t);
        var g = ctx.createGain(); g.gain.setValueAtTime(i === 0 ? 0.5 : 0.32, t);
        o.connect(g); g.connect(lp); o.start(t + i * 0.06); o.stop(t + 3);
      });
    });
    setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 3400);
  }catch(e){}
}
function chime(){
  try{
    var AC = W.AudioContext || W.webkitAudioContext; if(!AC) return;
    var ctx = new AC(), t = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(784, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.32);
    setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 600);
  }catch(e){}
}

/* ---------- wake lock + fullscreen (both optional, every failure tolerated) ---------- */
function wake(){
  if(!cur || !navigator.wakeLock || D.visibilityState !== 'visible') return;
  try{ navigator.wakeLock.request('screen').then(function(l){ if(cur) cur.wake = l; else try{ l.release(); }catch(e){} }).catch(function(){}); }catch(e){}
}
function onVis(){ if(cur && D.visibilityState === 'visible') wake(); }
function mobile(){
  try{ return W.matchMedia('(pointer: coarse)').matches || /Android|Mobi/i.test(navigator.userAgent); }catch(e){ return false; }
}
function enterFullscreen(){
  var de = D.documentElement;
  if(!mobile() || D.fullscreenElement || !de.requestFullscreen) return;
  try{
    var r = de.requestFullscreen({navigationUI:'hide'});
    if(r && r.then) r.then(function(){ if(cur) cur.fs = true; else exitFullscreen(true); }).catch(function(){});
  }catch(e){}
}
function exitFullscreen(force){
  if(!(force || (cur && cur.fs)) || !D.fullscreenElement || !D.exitFullscreen) return;
  try{ var r = D.exitFullscreen(); if(r && r.catch) r.catch(function(){}); }catch(e){}
}

/* ---------- open / play / exit / close ---------- */
function open(o){
  o = o || {};
  if(cur) close({instant:true});
  var app = o.app || {};
  var sk = skinData(o.kind, o.skin);
  var s = cur = {kind:o.kind, opts:o, app:app, poster:posterData(o, sk), skin:sk, skinKind:sk ? o.kind : null, strip:o.strip || null, controls:o.controls || [],
    seen:!!o.seen, views:o.views || null, phase:'poster', openView:app.view ? app.view() : null, localMuted:false};
  // Farin's rule "nothing low designed": the poster only shows once its real key art exists (artReady). Until then
  // the Theatre still takes over (full screen, HUD, wake lock, transition) but goes straight into the game: no poster,
  // no billing, no sound swell, and the first view is not marked seen (onPlay gets {poster:false}).
  s.noPoster = !(s.poster.art && s.poster.artReady) && !o.forcePoster;
  var stage = o.stage === '4:5' ? 'th-4x5' : (o.stage === 'app' ? 'th-appcol' : 'th-portrait');
  var body = D.body;
  body.classList.add('theatre-on', stage);
  body.classList.remove('th-running');
  body.classList.toggle('th-companion', !!o.companion);
  paintSkin(s);

  s.backdrop = el('div', 'th-backdrop', backdropHtml(s));
  body.appendChild(s.backdrop);
  openWorld(s);

  var root = o.cover && o.cover.parentNode ? o.cover : el('div');
  root.className = 'th-root'; root.removeAttribute('style');
  if(s.noPoster) root.style.background = s.poster.palette.sky || '#f6f1e7';   // the cover stays until the game is drawn
  if(!root.parentNode) body.appendChild(root);
  s.root = root;
  root.innerHTML = '';
  if(!s.noPoster){ s.frame = buildPoster(s); root.appendChild(s.frame); }
  if(!s.noPoster && o.cover && o.cover.parentNode && o.from && !reduced()){
    // the cover grew from the card; settle the poster in under it
    anim(s.frame, [{opacity:0}, {opacity:1}], {duration:180, easing:'ease-out'});
  }

  s.hud = buildHud(s);
  body.appendChild(s.hud);
  paintSound(); paintControls();

  s.onKey = function(e){
    if(e.key === 'Escape' && cur === s){ e.preventDefault(); if(s.leave && s.leaveStay) s.leaveStay(); else exit(); }
  };
  D.addEventListener('keydown', s.onKey, true);
  D.addEventListener('visibilitychange', onVis);
  s.returnFocus = D.activeElement;
  wake();
  enterFullscreen();
  if(s.noPoster){ start(); return api; }

  var play = s.frame.querySelector('.th-play');
  play.addEventListener('click', function(e){ e.stopPropagation(); start(); });
  s.frame.addEventListener('click', function(e){
    var it = e.target.closest && e.target.closest('.th-strip-item');
    if(it){ e.stopPropagation(); var item = (s.strip || [])[+it.dataset.i]; if(item && item.state !== 'locked' && item.onTap) item.onTap(item); return; }
    skip();
  });
  try{ play.focus({preventScroll:true}); }catch(e){}
  if(s.frame.classList.contains('th-intro')) s.introTimer = setTimeout(function(){ if(cur === s) s.frame.classList.add('th-done'); }, 2600);
  // quick games (worlds SPEC 4.2): a poster already seen shows briefly, then dissolves into the game by itself
  else if(o.brief) s.briefTimer = setTimeout(function(){ if(cur === s && s.phase === 'poster') start(); }, 1200);
  return api;
}
function skip(){
  if(!cur || cur.phase !== 'poster' || !cur.frame) return;
  var f = cur.frame;
  if(f.classList.contains('th-intro') && !f.classList.contains('th-done')){ f.classList.add('th-skip', 'th-done'); }
}
function start(){
  var s = cur; if(!s || s.phase !== 'poster') return;
  s.phase = 'running';
  clearTimeout(s.introTimer); clearTimeout(s.briefTimer);
  if(!s.noPoster) swell(s.kind);
  var frame = s.frame;
  var update = function(keepCover){
    D.body.classList.add('th-running');
    if(frame && frame.parentNode) frame.remove();
    if(!keepCover) s.root.classList.add('th-root-run');
    try{ s.opts.onPlay && s.opts.onPlay({poster:!s.noPoster}); }catch(e){ console.error('[theatre] onPlay', e); }
    W.scrollTo(0, 0);
    // a fallback game outside the Theatre's views (e.g. Case Closed -> Build It) leaves the Theatre straight away
    if(cur === s && s.views && s.app.view && s.views.indexOf(s.app.view()) < 0) close();
  };
  // with a poster: View Transition (dissolve poster -> game); without one the cover simply fades off the game (WAAPI)
  if(frame && !reduced() && D.startViewTransition){
    try{ vt(function(){ update(); }); return; }catch(e){}
  }
  if(reduced()){ update(); return; }
  if(!frame){
    // no poster: the loading cover dissolves over the freshly rendered game
    update(true);
    var root = s.root, c = anim(root, [{opacity:1}, {opacity:0}], {duration:320, easing:'ease-out', fill:'forwards'});
    var hide = function(){ root.classList.add('th-root-run'); root.style.opacity = ''; if(c) try{ c.cancel(); }catch(e){} };
    if(c) c.onfinish = hide; else hide();
    return;
  }
  // WAAPI fallback: the poster lifts off over the freshly rendered game
  var ghost = frame;
  D.body.appendChild(ghost); ghost.classList.add('th-ghost');
  update();
  D.body.appendChild(ghost);
  var a = anim(ghost, [{opacity:1, transform:'scale(1)'}, {opacity:0, transform:'scale(1.04)'}], {duration:380, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'});
  if(a) a.onfinish = function(){ ghost.remove(); }; else ghost.remove();
}
function exit(){
  var s = cur; if(!s) return;
  if(s.phase === 'poster'){ close(); return; }
  if(s.leave) return;
  var go = function(){
    if(cur !== s) return;
    if(s.opts.onExit){
      var keep;
      try{ keep = s.opts.onExit(); }catch(e){ console.error('[theatre] onExit', e); }
      // onExit returns false = the game asks first ("Leave? Your place is safe.") and navigates itself if the learner leaves
      if(keep === false) return;
      // the app's navigation calls sync(); if nothing navigated, close anyway
      setTimeout(function(){ if(cur === s) close(); }, 700);
    } else close();
  };
  // a round in progress (confirmExit): "Leave the game?" first; Stay keeps playing, Leave goes the way x always did
  var ask = false;
  try{ ask = !!(s.opts.confirmExit && s.opts.confirmExit()); }catch(e){ ask = false; }
  if(ask){ askLeave(s, go); return; }
  go();
}
function close(o){
  var s = cur; if(!s) return;
  cur = null; s.phase = 'closed';
  clearTimeout(s.introTimer); clearTimeout(s.briefTimer);
  D.removeEventListener('keydown', s.onKey, true);
  D.removeEventListener('visibilitychange', onVis);
  if(s.wake){ try{ s.wake.release(); }catch(e){} }
  if(s.fs){ s.fs = false; exitFullscreen(true); }
  var body = D.body;
  body.classList.remove('theatre-on', 'th-running', 'th-portrait', 'th-4x5', 'th-appcol', 'th-companion', 'th-skinned');
  body.removeAttribute('data-th-skin');
  body.style.removeProperty('--th-hud-r');
  for(var pv in PAL_VARS) body.style.removeProperty(PAL_VARS[pv]);
  [s.hud, s.backdrop, s.stage, s.leave].forEach(function(n){ if(n && n.parentNode) n.remove(); });
  s.leave = null;
  closeWorld(s);
  var root = s.root;
  if(root && root.parentNode){
    var a = (o && o.instant) || reduced() || !root.childElementCount ? null : anim(root, [{opacity:1}, {opacity:0}], {duration:220, easing:'ease-out', fill:'forwards'});
    if(a) a.onfinish = function(){ root.remove(); }; else root.remove();
  }
  try{ if(s.returnFocus && s.returnFocus.isConnected) s.returnFocus.focus({preventScroll:true}); }catch(e){}
  try{ s.opts.onClose && s.opts.onClose(); }catch(e){ console.error('[theatre] onClose', e); }
}
function sync(view){
  var s = cur; if(!s) return;
  if(s.phase === 'poster'){ if(s.openView != null && view !== s.openView) close(); return; }
  if(s.views && s.views.indexOf(view) < 0) close();
}

/* ---------- helpers games can call ---------- */
function titleCard(text, sub, o){
  o = o || {};
  var ms = o.ms || 1500;
  return new Promise(function(resolve){
    var card = el('div', 'th-titlecard', '<div class="th-tc-in"><p class="th-tc-text">' + esc(text) + '</p>' + (sub ? '<p class="th-tc-sub">' + esc(sub) + '</p>' : '') + '</div>');
    card.setAttribute('role', 'status');
    if(cur && cur.poster) card.style.cssText = paletteStyle(cur.poster.palette);
    D.body.appendChild(card);
    var done = false, t;
    var finish = function(){
      if(done) return; done = true; clearTimeout(t);
      var a = reduced() ? null : anim(card, [{opacity:1}, {opacity:0}], {duration:260, easing:'ease-in', fill:'forwards'});
      var end = function(){ card.remove(); resolve(); };
      if(a) a.onfinish = end; else end();
    };
    card.addEventListener('click', finish);
    if(!reduced()){
      anim(card, [{opacity:0}, {opacity:1}], {duration:240, easing:'ease-out'});
      anim(card.querySelector('.th-tc-text'), [{opacity:0, transform:'translateY(10px) scale(.98)'}, {opacity:1, transform:'none'}], {duration:420, delay:80, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards'});
    }
    t = setTimeout(finish, ms);
  });
}
function transition(fn){
  if(!reduced() && D.startViewTransition){
    try{ return vt(fn).finished.catch(function(){}); }catch(e){}
  }
  fn();
  if(!reduced()){
    var target = (cur && cur.stage) || D.getElementById('app');
    var a = anim(target, [{opacity:0, transform:'scale(.985)'}, {opacity:1, transform:'none'}], {duration:320, easing:'cubic-bezier(.2,.7,.2,1)'});
    if(a) return a.finished.catch(function(){});
  }
  return Promise.resolve();
}
function setStrip(items){
  if(!cur) return;
  cur.strip = items || null;
  var box = cur.frame && cur.frame.querySelector('.th-strip');
  if(box) box.innerHTML = stripHtml(cur.strip);
}
function setControls(list){ if(!cur) return; cur.controls = list || []; paintControls(); }
function stageEl(){
  if(!cur) return null;
  if(!cur.stage){ cur.stage = el('div', 'th-stage'); D.body.appendChild(cur.stage); }
  return cur.stage;
}

var api = {
  version:'1.1.0',
  open:open, close:close, sync:sync, exit:exit, play:start, skip:skip,
  titleCard:titleCard, transition:transition, setStrip:setStrip, setControls:setControls, stageEl:stageEl, setSkin:setSkin,
  say:say, finale:finale, sfx:sfx, world:function(){ return cur && cur.world ? cur.world.kind : null; },
  skin:function(){ return cur && cur.skin ? cur.skinKind : null; },
  isOpen:function(){ return !!cur; },
  phase:function(){ return cur ? cur.phase : null; },
  kind:function(){ return cur ? cur.kind : null; }
};
W.Theatre = api;
})();
