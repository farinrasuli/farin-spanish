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
  // Fit Kit (Games 2.0 SPEC 5.1): every poster with real art shows the WHOLE picture (contain) between the title and Play, the same
  // image blurred behind it; never a cover crop (the 2:1 card plates and the 4:5 portrait posters alike)
  var wide = !placeholder;
  var frame = el('div', 'th-frame' + (first ? ' th-intro' : ' th-rest') + (placeholder ? ' th-is-ph' : '') + (wide ? ' th-wide' : ''));
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-modal', 'true');
  frame.setAttribute('aria-label', title);
  // --th-ratio = the art's own height / width (2:1 card plates .5, 4:5 posters 1.25): the picture is never taller than the column allows
  frame.style.cssText = paletteStyle(p.palette) + (wide ? '--th-ratio:' + (p.shape === 'wide' ? '.5' : '1.25') + ';' : '');
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
      braveHtml(s) +
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
// The Brave switch (Games 2.0 SPEC 5.5): "Normal · Brave" under Play, only when the app passes o.brave = {on, hint, onChange}
// (after the learner has finished that game once). Brave never adds a timer, hides a help button, shows a number or blocks a finish.
var ANCHOR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M7.5 11h9M4.5 14.5c.8 3.6 3.9 6.5 7.5 6.5s6.7-2.9 7.5-6.5"/></svg>';
function braveHtml(s){
  var b = s.opts.brave; if(!b) return '';
  return '<div class="th-brave" role="group" aria-label="' + esc(S('normal') + ' / ' + S('brave')) + '">' +
      '<button type="button" class="th-brave-opt" data-brave="0" aria-pressed="' + (b.on ? 'false' : 'true') + '">' + esc(S('normal')) + '</button>' +
      '<button type="button" class="th-brave-opt" data-brave="1" aria-pressed="' + (b.on ? 'true' : 'false') + '">' + ANCHOR + '<span>' + esc(S('brave')) + '</span></button>' +
    '</div>' + (b.hint ? '<p class="th-brave-hint" role="status">' + esc(S('braveHint')) + '</p>' : '');
}
function braveWire(s){
  var b = s.opts.brave, box = s.frame && s.frame.querySelector('.th-brave'); if(!b || !box) return;
  box.addEventListener('click', function(e){
    e.stopPropagation();
    var o = e.target.closest && e.target.closest('.th-brave-opt'); if(!o) return;
    var on = o.getAttribute('data-brave') === '1'; if(on === !!b.on) return;
    b.on = on;
    box.querySelectorAll('.th-brave-opt').forEach(function(x){ x.setAttribute('aria-pressed', (x.getAttribute('data-brave') === '1') === on ? 'true' : 'false'); });
    sfx('click');
    try{ if(b.onChange) b.onChange(on); }catch(err){ console.error('[theatre] brave', err); }
  });
  var hint = s.frame.querySelector('.th-brave-hint');
  if(hint) setTimeout(function(){ if(hint.isConnected) hint.classList.add('th-gone'); }, 5000);   // one caption, 5 s
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
// [x%, y%, w%] of the plate (the whole picture, shown at its natural aspect: Farin 2026-11-16 "the full art is viewable")
function boxStyle(b, sit){
  b = b || []; var x = cssNum(b[0], 0, -50, 150), y = cssNum(b[1], 0, -50, 150), w = cssNum(b[2], 20, 0, 200);
  return 'left:' + x + '%;' + (sit ? 'top:auto;bottom:var(--gw-sit, 18px);' : 'top:' + y + '%;') + 'width:' + w + '%;';
}
function worldData(s){
  var sk = skinData(s.world.kind, null) || {};
  return {gw:merge(sk.gw, s.world.gw), w:merge(sk.world, s.world.world)};
}
function paintWorld(s){
  var body = D.body, d = worldData(s), w = d.w, k;
  captainOff();
  body.className = body.className.replace(/\bgw-(?!on\b)[a-z0-9]+\b/g, '').replace(/\s+/g, ' ').trim();
  body.classList.add('gw-on', 'gw-' + s.world.kind);
  for(k in GW_VARS) body.style.removeProperty(GW_VARS[k]);
  for(k in GW_VARS) if(d.gw[k]) body.style.setProperty(GW_VARS[k], String(d.gw[k]));
  if(w.stage) body.style.setProperty('--gw-stage', String(w.stage).replace(/[^0-9a-z.,%()+\- ]/gi, ''));
  var ed = GW_ED[String(s.app.level || s.world.level || '').toUpperCase()];
  if(ed) body.style.setProperty('--gw-ed', ed); else body.style.removeProperty('--gw-ed');
  // Fit Kit (SPEC 5.1): the whole plate, contained in the stage band (a band under 240 px shows the world's colour + whole cut-outs; the
  // whole plate then shows in the establishing shot); the same image blurred fills the band's sides
  var src = w.plate && w.plate.ready && w.plate.src ? w.plate.src : '';
  body.classList.toggle('gw-small', w.band === 'small');
  var plate = src ? '<div class="th-world-blur" style="background-image:url(\'' + esc(src) + '\')"></div>' : '';
  var plateImg = src ? '<img class="th-world-plate" src="' + esc(src) + '" alt="">' : '';
  var cut = (w.layers || []).filter(function(l){ return l && l.ready && l.src; }).map(function(l){
    var small = w.band === 'small' && l.band;   // a small band places its whole cut-outs in band %
    return '<img class="th-world-cut ' + esc(l.cls || '') + (small ? ' th-in-band' : '') + '"' + (l.id ? ' id="' + esc(l.id) + '"' : '') + ' src="' + esc(l.src) + '" alt="" style="' + boxStyle(small ? l.band : l.box, small ? !!l.sit : false) + '">';
  }).join('');
  var txt = (w.text || []).filter(function(t){ return t && t.ready; }).map(function(t){
    return '<div class="th-world-live ' + esc(t.cls || '') + '"' + (t.id ? ' id="' + esc(t.id) + '"' : '') + ' style="' + boxStyle(t.box, t.sit) + '">' + esc(t.key ? ((content().worldText || {})[t.key] || '') : (t.text || '')) + '</div>';
  }).join('');
  // .th-world-stage is the plate's own box (4:5, contained in the band): cut-outs, actors and live text are in % of the plate
  // a front layer: the same picture again, only below its line (front.top %), over the people, so they stand behind the counter
  var front = src && w.front && w.front.top ? '<img class="th-world-front" src="' + esc(src) + '" alt="" style="clip-path:inset(' + cssNum(parseFloat(w.front.top), 70, 0, 100) + '% 0 0 0)">' : '';
  s.world.el.innerHTML = '<div class="th-world-art' + (src ? ' th-has-plate' : '') + '">' + plate + '<div class="th-world-stage">' + plateImg + front + cut + '</div></div><div class="th-world-text"><div class="th-world-stage">' + txt + '</div></div>';
  // the world's light: one mood element, the last child of the plate's box (over the art and cut-outs, under the balloons)
  var stageBox = s.world.el.querySelector('.th-world-art .th-world-stage');
  if(stageBox && src) stageBox.appendChild(moodEl(w.mood || 'warm', w.moodVars));
  if(w.css) loadWorldCss(s.world.kind, w.css);
  warmSfx(w.sfx);
  bedStart();
  spotStart();
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
  bedStop(); spotStop(); captainOff();
  if(s.world && s.world.el && s.world.el.parentNode) s.world.el.remove();
  if(s.sayEl && s.sayEl.parentNode) s.sayEl.remove();
  clearTimeout(s.sayTimer);
  body.className = body.className.replace(/\bgw-[a-z0-9]+\b/g, '').replace(/\s+/g, ' ').trim();
  for(var k in GW_VARS) body.style.removeProperty(GW_VARS[k]);
  body.style.removeProperty('--gw-ed');
  s.world = null;
}
// Theatre.actor(id, src, box, cls): put / replace / remove (src null) an image on the plate, in plate coordinates [x%, y%, w%]
function actor(id, src, box, cls){
  var s = cur; if(!s || !s.world) return null;
  var art = s.world.el.querySelector('.th-world-art .th-world-stage') || s.world.el.querySelector('.th-world-art'); if(!art) return null;
  var n = D.getElementById(id);
  if(!src){ if(n) n.remove(); return null; }
  if(!n || n.parentNode !== art){ if(n) n.remove(); n = el('img', 'th-world-cut ' + (cls || '')); n.id = id; n.alt = ''; art.appendChild(n); }
  if(n.getAttribute('src') !== src) n.setAttribute('src', src);
  n.style.cssText = boxStyle(box);
  return n;
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
  // a line with no Persian letter (an English / Spanish line in the fa UI: "Passport, please!") runs left to right in the target language
  if(rtl && !/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(String(text))){ rtl = false; lang = content().target || 'en'; }
  var hear = typeof o.hear === 'function';
  s.sayEl.innerHTML = '<div class="th-' + kind + (hear ? ' th-say-hear' : '') + '" lang="' + esc(lang) + '" dir="' + (rtl ? 'rtl' : 'ltr') + '"' + (hear ? ' role="button" tabindex="0" aria-label="' + esc(text + ' · ' + S('hear')) + '"' : '') + '>' + esc(text) +
    (hear ? '<span class="th-say-ear" aria-hidden="true">' + ICON.soundOn + '</span>' : '') + '</div>';
  var box = s.sayEl.firstChild;
  if(hear && o.ring) box.classList.add('th-ring');   // the first speaker a learner meets in a game pulses twice (SPEC 5.2)
  if(hear){ var go = function(e){ if(e) e.stopPropagation(); try{ o.hear(); }catch(err){} }; box.addEventListener('click', go); box.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } }); }
  if(kind === 'balloon'){
    var who = D.getElementById(o.who), r = who && who.getBoundingClientRect();
    if(r && r.width){
      // the whole balloon stays in the column (8 px margins) and below the voice pill; the tail points at the speaker; no room above
      // the speaker = the balloon goes under it, tail up
      var col = s.sayEl.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight, ax = r.left - col.left + r.width / 2;
      var minTop = 124 + (parseFloat(getComputedStyle(D.body).getPropertyValue('--th-safe-t')) || 0);
      var left = Math.max(8, Math.min(col.width - 8 - bw, ax - bw / 2)), top = r.top - 14 - bh, below = false;
      if(top < minTop){ top = Math.max(minTop, r.bottom + 14); below = true; }
      box.style.left = left + 'px'; box.style.top = top + 'px';
      box.style.setProperty('--tail-x', Math.max(14, Math.min(bw - 14, ax - left)) + 'px');
      if(below) box.classList.add('th-balloon-below');
    } else { box.classList.remove('th-balloon'); box.classList.add('th-caption'); }   // no speaker on screen: a caption, still tap to hear
  }
  if(!reduced()) anim(box, [{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'none'}], {duration:200, easing:'cubic-bezier(.2,.7,.2,1)'});
  clearTimeout(s.sayTimer);
  s.sayTimer = setTimeout(function(){ if(s.sayEl && s.sayEl.firstChild === box){ var a = reduced() ? null : anim(box, [{opacity:1}, {opacity:0}], {duration:180, fill:'forwards'}); var rm = function(){ if(box.parentNode) box.remove(); }; if(a) a.onfinish = rm; else rm(); } }, ms);
  return true;
}
// Theatre.progress(done, total): the world's own progress object (SPEC 4.8) reads data-done / data-total / data-third (0-3) and
// --gw-frac on .th-world: tickets on the rail, the croissant's bites, the reels. The count is never shown as a number.
function progress(done, total){
  var s = cur; if(!s || !s.world || !total) return;
  var w = s.world.el; done = Math.max(0, Math.min(total, Math.round(done) || 0));
  w.setAttribute('data-done', done); w.setAttribute('data-total', total); w.setAttribute('data-third', Math.min(3, Math.floor(done / total * 3)));
  w.style.setProperty('--gw-frac', (done / total).toFixed(3));
}
// Text direction in the fa UI (2026-11-19, "!Passport, please"): while a game runs in the Theatre, every element whose own text is in a
// Latin script only (an English / Spanish line: statements, transcripts, cards, measures, title cards, badge lines) gets dir="ltr", so the
// bidi algorithm never moves its marks and numbers. An element the app gave a dir itself is left alone. Never a change to the string.
var bidiObs = null, BIDI_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/, BIDI_LAT = /[A-Za-zÀ-ɏ]/;
function bidiOwn(e){ var t = ''; for(var n = e.firstChild; n; n = n.nextSibling) if(n.nodeType === 3) t += n.nodeValue; return t; }
function bidiFix(root){
  if(!root || root.nodeType !== 1) return;
  var list = [root], all = root.getElementsByTagName('*'); for(var i = 0; i < all.length; i++) list.push(all[i]);
  for(var k = 0; k < list.length; k++){
    var e = list[k]; if(/^(INPUT|TEXTAREA|SCRIPT|STYLE|SELECT)$/i.test(e.tagName) || e.namespaceURI === 'http://www.w3.org/2000/svg') continue;
    var t = bidiOwn(e), mine = e.hasAttribute('data-th-ltr');
    if(!t || !BIDI_LAT.test(t) || BIDI_RTL.test(t)){ if(mine && BIDI_RTL.test(t)){ e.removeAttribute('dir'); e.removeAttribute('data-th-ltr'); } continue; }
    if(e.hasAttribute('dir') && !mine) continue;
    if(!mine){ e.setAttribute('dir', 'ltr'); e.setAttribute('data-th-ltr', ''); }
  }
}
function bidiStart(){
  bidiStop();
  if(!cur || !cur.app || cur.app.lang !== 'fa' || !W.MutationObserver) return;
  bidiFix(D.body);
  bidiObs = new MutationObserver(function(ms){
    for(var i = 0; i < ms.length; i++){ var m = ms[i];
      if(m.type === 'characterData'){ bidiFix(m.target.parentElement); continue; }
      for(var j = 0; j < m.addedNodes.length; j++){ var n = m.addedNodes[j]; bidiFix(n.nodeType === 1 ? n : n.parentElement); } }
  });
  bidiObs.observe(D.body, {childList:true, subtree:true, characterData:true});
}
function bidiStop(){ if(bidiObs){ bidiObs.disconnect(); bidiObs = null; } }
var bed = null;
function bedStop(){ if(!bed) return; try{ clearInterval(bed.timer); bed.src.stop(); bed.lfo.stop(); bed.out.disconnect(); }catch(e){} bed = null; }
function bedStart(){
  bedStop();
  var s = cur; if(!s || !s.world) return;
  var b = worldData(s).w.bed; if(!b) return;
  var c = actxGet(); if(!c) return;
  try{
    var len = Math.floor(c.sampleRate * 4), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), last = 0;
    for(var i = 0; i < len; i++){ var wn = Math.random() * 2 - 1; last = (last + 0.02 * wn) / 1.02; d[i] = last * 3.5; }   // brown noise: a soft room
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = cssNum(b.freq, 500, 60, 4000); bp.Q.value = cssNum(b.q, .7, .1, 4);
    var sway = c.createGain(); sway.gain.value = 1;
    var lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = cssNum(b.lfo, .12, .02, 2); depth.gain.value = .3; lfo.connect(depth); depth.connect(sway.gain);
    var out = c.createGain(); out.gain.value = 0;
    src.connect(bp); bp.connect(sway); sway.connect(out); out.connect(c.destination); src.start(); lfo.start();
    bed = {src:src, lfo:lfo, out:out, ctx:c, vol:cssNum(b.vol, .03, 0, .08)};
    bed.timer = setInterval(bedTick, 250); bedTick();
  }catch(e){ bed = null; }
}
function bedTick(){
  if(!bed) return;
  var badge = D.getElementById('tts-badge');
  var talking = D.body.hasAttribute('data-speaking') || (W.speechSynthesis && W.speechSynthesis.speaking) || D.body.classList.contains('gw-live');   // the app's speaking flag
  var target = (!cur || muted() || talking || D.hidden) ? 0 : bed.vol;
  try{ bed.out.gain.setTargetAtTime(target, bed.ctx.currentTime, .3); }catch(e){}
}
// Spots (Games 2.0 SPEC 5.4): single sounds now and then in a world (skins.js world.spots: names), every 6-14 s at about -28 dBFS, never the
// same one twice in a row, playbackRate 0.96-1.04; never while a line, an order or a listening task plays, when muted or the page is hidden.
// A name plays its files (world.sfx / the CC0 kit) when there are any, else the Theatre makes it in code: 'gull' (a far gull's call, two
// or three cries), 'clock' (a quiet library clock, a few tick-tocks). Code-made = no file, no licence. Theatre.spot(name) plays one now.
var spotT = null, spotLast = null, spotN = 0;
function spotStop(){ clearTimeout(spotT); spotT = null; }
function spotList(){ var s = cur; if(!s || !s.world) return []; var l = worldData(s).w.spots; return (l && l.length) ? l : []; }
function spotStart(){ spotStop(); if(!spotList().length) return; spotNext(); }
function spotNext(){ spotT = setTimeout(spotTick, 6000 + Math.random() * 8000); }
function spotQuiet(){ return !cur || muted() || D.hidden || D.body.hasAttribute('data-speaking') || (W.speechSynthesis && W.speechSynthesis.speaking) || D.body.classList.contains('gw-live') || D.body.classList.contains('gw-establish'); }
function spotTick(){
  var list = spotList(); if(!list.length){ spotStop(); return; }
  if(!spotQuiet()){
    var opts = list.length > 1 ? list.filter(function(n){ return n !== spotLast; }) : list, nm = opts[Math.floor(Math.random() * opts.length)];
    spotLast = nm; spotPlay(nm);
  }
  spotNext();
}
function spotPlay(name){
  if(!cur || muted()) return false;
  var own = ((cur.world ? worldData(cur).w.sfx : null) || {})[name];
  if(own && own.length) return sfx(name);
  var c = actxGet(); if(!c || !SPOTS[name]) return false;
  try{ spotN++; SPOTS[name](c, c.currentTime + .03, 0.96 + Math.random() * 0.08); return true; }catch(e){ return false; }
}
var SPOTS = {
  gull:function(c, t0, rate){
    var out = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; out.gain.value = .045; lp.connect(out); out.connect(c.destination);
    var n = Math.random() < .5 ? 2 : 3, f = (1350 + Math.random() * 300) * rate;
    for(var k = 0; k < n; k++){
      var t = t0 + k * (0.3 + Math.random() * 0.08), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'triangle';
      [o, o2].forEach(function(x, j){ var m = j ? 2.01 : 1; x.frequency.setValueAtTime(f * .78 * m, t); x.frequency.linearRampToValueAtTime(f * 1.12 * m, t + .05); x.frequency.exponentialRampToValueAtTime(f * .6 * m, t + .24); x.connect(bp); x.start(t); x.stop(t + .3); });
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(f * 1.6, t); bp.Q.value = 1.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(k === n - 1 ? .7 : 1, t + .03); g.gain.exponentialRampToValueAtTime(0.0001, t + .26);
      bp.connect(g); g.connect(lp);
    }
    setTimeout(function(){ try{ out.disconnect(); }catch(e){} }, 1600);
  },
  clock:function(c, t0, rate){
    var out = c.createGain(); out.gain.value = .05; out.connect(c.destination);
    var len = Math.floor(c.sampleRate * .02), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for(var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    var n = 4 + Math.floor(Math.random() * 3);
    for(var k = 0; k < n; k++){
      var t = t0 + k * 1.0 / rate, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = (k % 2 ? 1700 : 2300) * rate; bp.Q.value = 9;
      g.gain.value = k % 2 ? .8 : 1; src.connect(bp); bp.connect(g); g.connect(out); src.start(t);
    }
    setTimeout(function(){ try{ out.disconnect(); }catch(e){} }, (n + 1) * 1000);
  }
};
// Mood Kit (Games 2.0 SPEC 5.3): Theatre.moodEl(preset, vars) -> the lighting overlay (last child of an art box, never over text);
// presets day warm lamp noir dusk night rain storm dawn darkroom snow train onair (space-separated mixes allowed)
function moodEl(preset, vars){
  var m = el('div', 'th-mood', '<i class="th-m-tint"></i><i class="th-m-glow"></i><i class="th-m-rain"></i><i class="th-m-blinds"></i><i class="th-m-sweep"></i><i class="th-m-vig"></i><i class="th-m-flash"></i>');
  m.setAttribute('aria-hidden', 'true');
  m.setAttribute('data-mood', String(preset || 'day').replace(/[^a-z ]/g, ''));
  for(var k in (vars || {})) if(/^--m-[a-z0-9]+$/.test(k)) m.style.setProperty(k, String(vars[k]).replace(/[^0-9.%a-z -]/gi, ''));
  return m;
}
// Theatre.flash(moodEl, {thunder}): two flashes in 420 ms, at most one lightning event every 5 s app-wide, never red, never over text;
// reduced motion: no flash, the tint brightens a little and back; thunder (a sound name) 700-1600 ms later unless muted
var lastFlash = 0;
function flash(m, o){
  o = o || {}; if(!m) return false;
  var now = Date.now(); if(now - lastFlash < 5000) return false; lastFlash = now;
  var f = m.querySelector('.th-m-flash'), t = m.querySelector('.th-m-tint');
  if(reduced()){ if(t) anim(t, [{filter:'brightness(1)'}, {filter:'brightness(1.06)'}, {filter:'brightness(1)'}], {duration:1200}); }
  else if(f) anim(f, [{opacity:0, offset:0}, {opacity:.55, offset:.08}, {opacity:.08, offset:.16}, {opacity:.42, offset:.26}, {opacity:0, offset:.4}, {opacity:0, offset:1}], {duration:420, easing:'linear'});
  if(o.thunder) setTimeout(function(){ sfx(o.thunder); }, 700 + Math.random() * 900);
  return true;
}
// Theatre.establish(ms) -> Promise: the establishing shot (SPEC 5.1): the whole plate at full column width, the panel slid down out of
// view (transform only); a tap skips; reduced motion = a straight cut. Runs when a round opens and during the finale.
function establish(ms){
  var s = cur;
  return new Promise(function(resolve){
    if(!s || !s.world || !worldData(s).w.plate || !worldData(s).w.plate.ready){ resolve(); return; }
    var body = D.body, done = false, t;
    var end = function(){ if(done) return; done = true; clearTimeout(t); body.classList.remove('gw-establish'); D.removeEventListener('pointerdown', end, true); setTimeout(captainSync, 450); resolve(); };   // Captain's tap target follows the panel back
    body.classList.add('gw-establish');
    try{ W.scrollTo(0, 0); }catch(e){}
    D.addEventListener('pointerdown', end, true);
    t = setTimeout(end, Math.min(cssNum(ms, 1600, 0, 2400), 2400));
  });
}
// Theatre.finale({beat, ms}) -> Promise: the world's own end moment (a class on .th-world for the CSS beat and/or a function),
// 2.4 s at most, one tap skips. The souvenir and the one button stay the app's own end card (SPEC 4.9).
function finale(o){
  var s = cur; o = o || {};
  return new Promise(function(resolve){
    if(!s || !s.world || reduced()){ resolve(); return; }
    var w = s.world.el, done = false, t;
    var end = function(){ if(done) return; done = true; clearTimeout(t); w.classList.remove('th-beat'); D.body.classList.remove('gw-beat', 'gw-establish'); D.removeEventListener('pointerdown', end, true); resolve(); };
    w.classList.add('th-beat'); D.body.classList.add('gw-beat', 'gw-establish');
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
  bidiStart();   // fa UI: Latin-script lines run left to right
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
  else if(o.brief && !o.brave) s.briefTimer = setTimeout(function(){ if(cur === s && s.phase === 'poster') start(); }, 1200);
  braveWire(s);
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
  if(s.world) setTimeout(function(){ if(cur === s && s.phase === 'running') establish(1600); }, 60);   // the round opens on the whole place (SPEC 5.1)
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
  bidiStop();
  cur = null; s.phase = 'closed';
  clearTimeout(s.introTimer); clearTimeout(s.briefTimer);
  D.removeEventListener('keydown', s.onKey, true);
  D.removeEventListener('visibilitychange', onVis);
  if(s.wake){ try{ s.wake.release(); }catch(e){} }
  if(s.fs){ s.fs = false; exitFullscreen(true); }
  var body = D.body;
  body.classList.remove('theatre-on', 'th-running', 'th-portrait', 'th-4x5', 'th-appcol', 'th-companion', 'th-skinned', 'th-boss');
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

// Theatre.boss(text): every game's last round (Games 2.0 SPEC 5.7): the light warms (body.th-boss: glow +.10), 'reveal' plays once and one
// caption shows for 5 s ("Last one!" or the game's own line). The app clears body.th-boss when the round is over or a new one starts.
function boss(text){
  if(!cur) return false;
  D.body.classList.add('th-boss');
  sfx('reveal');
  say(text || S('lastOne'), {kind:'caption', ms:5000});
  return true;
}
// Theatre.captain({spot:{box, band, pose}, onTap}): Captain, the town cat, hidden in a quick game's world (SPEC 5.8). He sits still (no idle
// motion); a tap: purr, an ear twitch (300 ms, scale 1.04), "Captain was here." for 5 s, then onTap once. The world sits under the app's
// game panel, so the tap goes to a clear button over him (body level), kept on his picture by Theatre.captainSync().
var cap = null;
function captainOff(){ if(!cap) return; if(cap.img && cap.img.parentNode) cap.img.remove(); if(cap.hit && cap.hit.parentNode) cap.hit.remove(); W.removeEventListener('resize', captainSync); cap = null; }
function captain(o){
  captainOff();
  var s = cur; if(!s || !s.world || !o || !o.spot) return null;
  var stage = s.world.el.querySelector('.th-world-art .th-world-stage'); if(!stage) return null;
  var small = D.body.classList.contains('gw-small'), sp = o.spot, pose = /^(sit|sleep|sniff)$/.test(sp.pose || '') ? sp.pose : 'sit';
  var img = el('img', 'th-world-cut th-captain' + (small ? ' th-in-band' : ''));
  img.alt = ''; img.setAttribute('draggable', 'false');
  img.src = (o.root || '') + 'games/cozy-chores/art/pt-captain-' + pose + '.webp';
  img.style.cssText = boxStyle(small ? (sp.band || sp.box) : sp.box, small ? true : false);
  stage.appendChild(img);
  var hit = el('button', 'th-captain-hit');
  hit.type = 'button'; hit.setAttribute('aria-label', S('captainLabel'));
  D.body.appendChild(hit);
  cap = {img:img, hit:hit, done:false, onTap:o.onTap};
  hit.addEventListener('click', function(e){
    e.stopPropagation();
    if(!cap || cap.done) return;
    cap.done = true; hit.disabled = true;
    sfx('purr');
    if(!reduced()) anim(img, [{transform:'scale(1)'}, {transform:'scale(1.04)'}, {transform:'scale(1)'}], {duration:300, easing:'ease-out'});
    say(S('captainHere'), {kind:'caption', ms:5000});
    try{ if(cap.onTap) cap.onTap(); }catch(err){ console.error('[theatre] captain', err); }
  });
  if(img.decode) img.decode().then(captainSync, function(){});
  img.addEventListener('load', captainSync);
  W.addEventListener('resize', captainSync);
  captainSync();
  return img;
}
function captainSync(){
  if(!cap || !cap.img.isConnected) return;
  var r = cap.img.getBoundingClientRect(), hidden = !r.width || D.body.classList.contains('gw-establish');
  cap.hit.style.display = hidden || cap.done ? 'none' : '';
  if(hidden) return;
  var pad = 6;   // a tap target a little larger than the cat (he is 36-48 px tall)
  cap.hit.style.left = (r.left + W.scrollX - pad) + 'px'; cap.hit.style.top = (r.top + W.scrollY - pad) + 'px';
  cap.hit.style.width = (r.width + pad * 2) + 'px'; cap.hit.style.height = (r.height + pad * 2) + 'px';
}
var api = {
  version:'1.2.2',
  open:open, close:close, sync:sync, exit:exit, play:start, skip:skip,
  titleCard:titleCard, transition:transition, setStrip:setStrip, setControls:setControls, stageEl:stageEl, setSkin:setSkin,
  say:say, finale:finale, sfx:sfx, progress:progress, actor:actor, establish:establish, moodEl:moodEl, flash:flash, world:function(){ return cur && cur.world ? cur.world.kind : null; },
  boss:boss, captain:captain, captainSync:captainSync, captainOff:captainOff, spot:spotPlay, spotCount:function(){ return spotN; },
  skin:function(){ return cur && cur.skin ? cur.skinKind : null; },
  isOpen:function(){ return !!cur; },
  phase:function(){ return cur ? cur.phase : null; },
  kind:function(){ return cur ? cur.kind : null; }
};
W.Theatre = api;
})();
