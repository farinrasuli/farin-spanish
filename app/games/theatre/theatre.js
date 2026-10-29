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
     stage,              // 'portrait' (default, full-height tall column) | '4:5' (wider column for 4:5 art)
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

/* ---------- poster ---------- */
function posterData(o){
  var base = (content().posters || {})[o.kind] || {};
  var p = {}; var k;
  for(k in base) p[k] = base[k];
  for(k in (o.poster || {})) p[k] = o.poster[k];
  p.palette = p.palette || {};
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
  var frame = el('div', 'th-frame' + (first ? ' th-intro' : ' th-rest') + (placeholder ? ' th-is-ph' : ''));
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-modal', 'true');
  frame.setAttribute('aria-label', title);
  frame.style.cssText = paletteStyle(p.palette);
  frame.innerHTML =
    '<div class="th-art">' + art + '</div>' +
    '<div class="th-grade" aria-hidden="true"></div>' +
    '<div class="th-lockup">' +
      '<p class="th-kicker"><span>' + esc(p.sub || app.gameName || '') + '</span></p>' +
      '<h1 class="th-title"' + tl + '>' + esc(title) + '</h1>' +
      (p.tagline ? '<p class="th-tagline"' + tl + '>' + esc(q[0]) + esc(p.tagline) + esc(q[1]) + '</p>' : '') +
    '</div>' +
    '<div class="th-foot">' +
      '<button type="button" class="th-play">' + esc(s.seen ? S('continue') : S('play')) + '</button>' +
      '<div class="th-strip" role="list" aria-label="' + esc(S('episodes')) + '">' + stripHtml(s.strip) + '</div>' +
      '<div class="th-billing">' +
        '<span class="th-bill-line">' + billing(app) + '</span>' +
        (level ? '<span class="th-stamp">' + esc(S('level', {level:level})) + '</span>' : '') +
      '</div>' +
      (placeholder ? '<p class="th-ph-tag">' + esc(S('artSoon')) + '</p>' : '') +
    '</div>' +
    (first ? '<div class="th-flash" aria-hidden="true"></div>' : '');
  return frame;
}
function backdropHtml(s){
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

/* ---------- sound: a short cinematic swell on Play (never before a tap) ---------- */
var CHORDS = {path:[220, 261.63, 329.63, 493.88], chores:[174.61, 220, 261.63, 349.23], mystery:[146.83, 174.61, 220, 277.18],
  order:[261.63, 329.63, 392, 523.25], desk:[196, 261.63, 293.66, 392], spell:[164.81, 207.65, 246.94, 329.63, 659.25]};
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
  var s = cur = {kind:o.kind, opts:o, app:app, poster:posterData(o), strip:o.strip || null, controls:o.controls || [],
    seen:!!o.seen, views:o.views || null, phase:'poster', openView:app.view ? app.view() : null, localMuted:false};
  // Farin's rule "nothing low designed": the poster only shows once its real key art exists (artReady). Until then
  // the Theatre still takes over (full screen, HUD, wake lock, transition) but goes straight into the game: no poster,
  // no billing, no sound swell, and the first view is not marked seen (onPlay gets {poster:false}).
  s.noPoster = !(s.poster.art && s.poster.artReady) && !o.forcePoster;
  var stage = o.stage === '4:5' ? 'th-4x5' : 'th-portrait';
  var body = D.body;
  body.classList.add('theatre-on', stage);
  body.classList.remove('th-running');

  s.backdrop = el('div', 'th-backdrop', backdropHtml(s));
  body.appendChild(s.backdrop);

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
    if(e.key === 'Escape' && cur === s){ e.preventDefault(); exit(); }
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
  clearTimeout(s.introTimer);
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
  if(s.opts.onExit){
    try{ s.opts.onExit(); }catch(e){ console.error('[theatre] onExit', e); }
    // the app's navigation calls sync(); if nothing navigated, close anyway
    setTimeout(function(){ if(cur === s) close(); }, 700);
  } else close();
}
function close(o){
  var s = cur; if(!s) return;
  cur = null; s.phase = 'closed';
  clearTimeout(s.introTimer);
  D.removeEventListener('keydown', s.onKey, true);
  D.removeEventListener('visibilitychange', onVis);
  if(s.wake){ try{ s.wake.release(); }catch(e){} }
  if(s.fs){ s.fs = false; exitFullscreen(true); }
  var body = D.body;
  body.classList.remove('theatre-on', 'th-running', 'th-portrait', 'th-4x5');
  body.style.removeProperty('--th-hud-r');
  [s.hud, s.backdrop, s.stage].forEach(function(n){ if(n && n.parentNode) n.remove(); });
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
  version:'1.0.0',
  open:open, close:close, sync:sync, exit:exit, play:start, skip:skip,
  titleCard:titleCard, transition:transition, setStrip:setStrip, setControls:setControls, stageEl:stageEl,
  isOpen:function(){ return !!cur; },
  phase:function(){ return cur ? cur.phase : null; },
  kind:function(){ return cur ? cur.kind : null; }
};
W.Theatre = api;
})();
