/* Mini Radio v2 engine (spec Claude/specs/mini-radio-2026-10-21.md, v2 2026-10-29; Trello gamification HRlPCC2r, episodes dsbVN6AH).
   Byte-identical in english app/app/games/mini-radio/ and spanish app/app/games/mini-radio/. Plays ONE episode object built by
   episode.js (RadioEpisode.fromStory / fromAuthored). Runs inside the Game Theatre stage (kind 'radio') or any full-size box.

   Round: tune the dial (static fades as the needle nears the station, snap, ON AIR lamp, sting) -> predict (three show titles, not yet
   tappable) -> the passage in 2 parts (A1-A2) or 3 (B1-C1), each followed by "Which word did you hear?" (3 tiles) -> "Which show was it?"
   -> put three moments in order -> Off air: the host's sign-off, a read-along ("Listen with the words"), tappable lines.
   No timer, no lives, no score, and no number anywhere on screen. Replays are free and never a miss. Nothing can be failed:
   a wrong tile or title greys out, the last one is right by elimination; a replayed part marks its word with a dot; order cards lock.

   API
     MiniRadio.start({root, episode, lang:'en'|'es', ui:'en'|'tr'|'fa'|'es', host, art, replay, reduced, pace, onDone(stats), onLeave()}) -> game
     MiniRadio.loadArt(appRoot) -> Promise<art | null>   (art/manifest.json: the radio-body / radio-knob / radio-sill renders + radio-body.json)
   The radio is rendered art (spec 5.1, GAME-ART-STYLE): the engine only draws the live controls on it (dial ticks, station mark,
   needle, ON AIR pill, the knob cut-out turning). Without the renders there is NO drawn stand-in: the controls show as plain app UI.
     game.destroy()
   host (all optional): speak(text, {lang, who:'a'|'b', rate, interrupt}) -> Promise (natural clip, device voice fallback),
     stopSpeech(), sfx(name) -> true if the app played it, muted(), reduced(), keep(souvenir), openStory(id), result(el, stats)
   stats = {clean, total, replays, perfect, episode, kind, storyId}   (stored by the app, never shown)
*/
(function(){
'use strict';
if(window.MiniRadio) return;
var W = window, D = document, VERSION = '0.3.0', ABORT = {abort:true}, G = null;
var MARK = 0.68;   // where the station sits on the dial (0..1)

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function el(tag, cls, html){ var n = D.createElement(tag); if(cls) n.className = cls; if(html != null) n.innerHTML = html; return n; }
function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function live(){ if(!G || G.dead) throw ABORT; }
function RM(){ if(G && G.forceReduced) return true; try{ if(G && G.host.reduced && G.host.reduced()) return true; }catch(e){} try{ return W.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
function wait(ms){ return new Promise(function(res, rej){ var g = G; if(!g || g.dead) return rej(ABORT); var t = setTimeout(function(){ g.waits.delete(f); g.dead ? rej(ABORT) : res(); }, Math.max(0, ms * g.pace)); var f = function(){ clearTimeout(t); rej(ABORT); }; g.waits.add(f); }); }

/* ---------- strings (spec v2 + farin-lxd's READY fixes 2026-10-29; Persian تو) ---------- */
var UI = {
  onAir:{en:'On air', tr:'Yayında', fa:'روی آنتن', es:'En antena'},
  tuneLine:{en:'Turn the dial to find FEschool Radio.', tr:'FEschool Radyo’yu bulmak için düğmeyi çevir.', fa:'پیچ را بچرخان تا رادیو FEschool را پیدا کنی.', es:'Gira el dial para encontrar Radio FEschool.'},
  tune:{en:'Tune in', tr:'Radyoyu ayarla', fa:'رادیو را تنظیم کن', es:'Sintoniza'},
  predict:{en:'Three shows tonight. Which one is on? Listen and find out.', tr:'Bu gece üç program var. Hangisi yayında? Dinle ve bul.', fa:'امشب سه برنامه داریم. کدام پخش می‌شود؟ گوش کن و بفهم.', es:'Esta noche hay tres programas. ¿Cuál está en antena? Escucha y descúbrelo.'},
  which:{en:'Which word did you hear?', tr:'Hangi kelimeyi duydun?', fa:'کدام کلمه را شنیدی؟', es:'¿Qué palabra has oído?'},
  againPart:{en:'Play that part again', tr:'O kısmı tekrar çal', fa:'آن قسمت را دوباره پخش کن', es:'Escuchar esa parte otra vez'},
  notHere:{en:'Hm, not in this one.', tr:'Hmm, bunda yok.', fa:'هوم، این یکی را نگفت.', es:'Mmm, esa no sale.'},
  gist:{en:'Which show was it?', tr:'Hangi programdı?', fa:'کدام برنامه بود؟', es:'¿Qué programa era?'},
  againAll:{en:'Play it all again', tr:'Hepsini tekrar çal', fa:'همه‌اش را دوباره پخش کن', es:'Escucharlo todo otra vez'},
  notThat:{en:'Not that one. Listen again if you like.', tr:'O değil. İstersen tekrar dinle.', fa:'این نبود. اگر خواستی دوباره گوش کن.', es:'Ese no. Vuelve a escuchar si quieres.'},
  order:{en:'Which came first? Tap them in order.', tr:'Hangisi önceydi? Sırayla dokun.', fa:'کدام اول بود؟ به ترتیب بزن.', es:'¿Cuál fue primero? Tócalas en orden.'},
  offAir:{en:'Off air!', tr:'Yayın bitti!', fa:'پخش تمام شد!', es:'¡Fin de la emisión!'},
  sharp:{en:'Sharp ears tonight!', tr:'Bu gece kulakların keskin!', fa:'امشب گوش‌هایت تیز بود!', es:'¡Qué buen oído esta noche!'},
  thanks:{en:'Thanks for listening!', tr:'Dinlediğin için teşekkürler!', fa:'ممنون که گوش دادی!', es:'¡Gracias por escuchar!'},
  withWords:{en:'Listen with the words', tr:'Metinle birlikte dinle', fa:'با متن گوش کن', es:'Escúchalo con el texto'},
  wholeStory:{en:'Read the whole story', tr:'Hikayenin tamamını oku', fa:'کل داستان را بخوان', es:'Lee la historia completa'},
  done:{en:'Continue', tr:'Devam et', fa:'ادامه بده', es:'Continuar'},
  play:{en:'Play', tr:'Çal', fa:'پخش', es:'Reproducir'},
  pause:{en:'Pause', tr:'Duraklat', fa:'مکث', es:'Pausa'}
};
var IDENT = {en:'This is FEschool Radio.', es:'Esto es Radio FEschool.'};
var SIGN = {en:{sharp:'Sharp ears tonight! This was FEschool Radio.', thanks:'Thanks for listening! This was FEschool Radio.'},
            es:{sharp:'¡Qué buen oído esta noche! Esto ha sido Radio FEschool.', thanks:'¡Gracias por escuchar! Esto ha sido Radio FEschool.'}};
function U(k){ var o = UI[k] || {}; return o[G.ui] || o.en || k; }
function dir(){ return G.ui === 'fa' ? 'rtl' : 'ltr'; }
var SPK = '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6M17.8 6.5a7.5 7.5 0 010 11"/></svg>';
var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

/* ---------- sound: generated in code (static, sting), the app's sfx for the rest ---------- */
var actx = null;
function ac(){ try{ if(!actx) actx = new (W.AudioContext || W.webkitAudioContext)(); if(actx.state === 'suspended') actx.resume().catch(function(){}); return actx; }catch(e){ return null; } }
function muted(){ try{ return G && G.host.muted ? !!G.host.muted() : false; }catch(e){ return false; } }
function tone(c, f, t, dur, peak){ var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02); }
function sfx(name){
  if(!G || muted()) return;
  try{ if(G.host.sfx && G.host.sfx(name) === true) return; }catch(e){}
  var c = ac(); if(!c) return; var t = c.currentTime + 0.01;
  if(name === 'correct'){ tone(c, 523.25, t, .11, .1); tone(c, 659.25, t + .07, .11, .1); }
  else if(name === 'flip'){ var n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * .04), c.sampleRate), d = b.getChannelData(0); for(var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; var g = c.createGain(); g.gain.value = .05; n.connect(g); g.connect(c.destination); n.start(t); }
}
function sting(){ if(!G || muted()) return; var c = ac(); if(!c) return; var t = c.currentTime + 0.02; [523.25, 659.25, 783.99].forEach(function(f, i){ tone(c, f, t + i * .11, .14, .2); }); }
function staticOn(){
  if(!G || G.st || muted()) return;
  var c = ac(); if(!c) return;
  var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for(var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = .8;
  var g = c.createGain(); g.gain.value = 0;
  src.connect(bp); bp.connect(g); g.connect(c.destination); src.start();
  G.st = {src:src, g:g, c:c};
}
function staticLevel(dist){ if(G && G.st) G.st.g.gain.setTargetAtTime(.25 * clamp(dist / .5, 0, 1), G.st.c.currentTime, .03); }
function staticOff(){ if(G && G.st){ try{ G.st.src.stop(); }catch(e){} G.st = null; } }

/* ---------- speech ---------- */
function speak(text, who, rate){
  if(!G || !text) return Promise.resolve();
  var g = G, p;
  try{ p = g.host.speak ? g.host.speak(text, {lang:g.lang, who:who || 'a', rate:rate || g.ep.rate, interrupt:true}) : fallbackSpeak(text, rate || g.ep.rate); }catch(e){ p = null; }
  return Promise.resolve(p).catch(function(){});
}
function fallbackSpeak(text, rate){
  return new Promise(function(res){
    var est = (420 + 330 * text.split(/\s+/).length) * G.pace;
    if(G.tts === false || !W.speechSynthesis){ setTimeout(res, est); return; }
    try{ var u = new SpeechSynthesisUtterance(text); u.lang = G.lang === 'es' ? 'es-ES' : 'en-GB'; u.rate = rate || .92; var t = setTimeout(res, est * 2); u.onend = u.onerror = function(){ clearTimeout(t); res(); }; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){ setTimeout(res, est); }
  });
}
function stopSpeech(){ try{ if(G && G.host.stopSpeech) G.host.stopSpeech(); else if(W.speechSynthesis) speechSynthesis.cancel(); }catch(e){} }

/* ---------- the radio: rendered art + live controls (spec 5.1 as changed 2026-10-29) ---------- */
function box(b){ return b ? 'left:' + b[0] + '%;top:' + b[1] + '%;width:' + b[2] + '%;height:' + b[3] + '%' : ''; }
function setHtml(){
  var A = G.art, mx = (4 + MARK * 92).toFixed(2) + '%';
  var dial = '<div class="mr-dial" role="slider" aria-label="' + esc(U('tune')) + '"' + (A ? ' style="' + box(A.layout.dial) + '"' : '') + '><i class="mr-ticks"></i><i class="mr-mark" style="left:' + mx + '"></i><i class="mr-needle"></i></div>';
  var lampEl = '<div class="mr-lamp"' + (A ? ' style="' + box(A.layout.lamp) + '"' : '') + ' dir="' + dir() + '">' + esc(U('onAir')) + '</div>';
  if(A) return '<div class="mr-set mr-art"><img class="mr-body" src="' + esc(A.body) + '" alt="" draggable="false">' + dial + lampEl +
    '<div class="mr-knob" style="' + box(A.layout.knob) + '"><img src="' + esc(A.knob) + '" alt="" draggable="false"></div></div>';
  return '<div class="mr-set mr-plain">' + lampEl + dial + '<button type="button" class="mr-knob" aria-label="' + esc(U('tune')) + '"><i class="mr-notch"></i></button></div>';
}
function setNeedle(n){
  G.n = clamp(n, 0, 1);
  G.needle.style.left = (4 + G.n * 92) + '%';
  G.knob.style.transform = 'rotate(' + (G.n * 300 - 150) + 'deg)';
}
function lamp(on){ G.set.classList.toggle('mr-on', !!on); }
// the speaker pulse: the radio body scales 1 -> 1.03 -> 1 at each line start (the plain controls panel when there is no art)
function pulse(){ var n = G.set.querySelector('.mr-body') || G.set; if(RM() || !n.animate) return; n.animate([{transform:'scale(1)'}, {transform:'scale(1.03)'}, {transform:'scale(1)'}], {duration:220}); }
function sparks(node, n){
  if(RM()) return; var r = node.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for(var i = 0; i < n; i++){ (function(i){ var s = el('i', 'mr-spark'); s.style.left = cx + 'px'; s.style.top = cy + 'px'; D.body.appendChild(s); var a = Math.PI * 2 * i / n, d = 26 + Math.random() * 22;
    var an = s.animate([{transform:'translate(0,0)', opacity:1}, {transform:'translate(' + Math.cos(a) * d + 'px,' + Math.sin(a) * d + 'px) scale(.3)', opacity:0}], {duration:520, easing:'ease-out'}); an.onfinish = function(){ s.remove(); }; })(i); }
}
function shake(n){ n.classList.remove('mr-shake'); void n.offsetWidth; n.classList.add('mr-shake'); }

/* ---------- playback: lines a..b, pause / resume from the first unplayed line ---------- */
function playLines(a, b, prefix){
  var g = G, tok = ++g.tok;
  g.range = [a, b]; g.playing = true; paintPlay();
  return (async function(){
    try{
      if(prefix){ pulse(); await speak(prefix, 'a'); }
      for(var i = Math.max(a, g.resumeAt != null && g.resumeAt >= a && g.resumeAt <= b ? g.resumeAt : a); i <= b; i++){
        if(tok !== g.tok || g.dead) return false;
        g.cursor = i; pulse(); markRead(i);
        var l = g.ep.lines[i];
        await speak(l.text, l.who);
      }
      if(tok !== g.tok || g.dead) return false;
      g.resumeAt = null; g.heardTo = Math.max(g.heardTo, b);
      return true;
    }finally{ if(tok === g.tok){ g.playing = false; paintPlay(); markRead(-1); if(g.onEnd){ var f = g.onEnd; g.onEnd = null; f(); } } }
  })();
}
function pause(){ G.tok++; G.resumeAt = G.cursor; stopSpeech(); G.playing = false; paintPlay(); }
function paintPlay(){ if(!G.playBtn) return; G.playBtn.innerHTML = G.playing ? PAUSE : PLAY; G.playBtn.setAttribute('aria-label', U(G.playing ? 'pause' : 'play')); }
function markRead(i){ if(!G.readEl) return; G.readEl.querySelectorAll('p').forEach(function(p, k){ p.classList.toggle('mr-now', k === i); }); }
// plays a range to its end; resolves when the last line of the range has been heard (a pause just waits for Play)
function hearRange(a, b, prefix){
  return new Promise(function(res, rej){
    var g = G; var stop = function(){ rej(ABORT); }; g.waits.add(stop);
    var go = function(pre){ playLines(a, b, pre).then(function(done){ if(done){ g.waits.delete(stop); res(); } }); };
    g.resumeRange = function(){ go(null); };
    go(prefix);
  });
}

/* ---------- layout ---------- */
function build(){
  var root = el('div', 'mr-root' + (G.forceReduced ? ' mr-rm' : ''));
  root.setAttribute('data-ui', G.ui);
  var P = G.ep.parts.length;
  root.innerHTML = '<div class="mr-status"><span dir="' + dir() + '">' + esc(U('onAir')) + '</span><span class="mr-dots">' + new Array(P + 1).join('<i></i>') + '</span></div>' +
    '<div class="mr-scroll">' + setHtml() + '<p class="mr-line" aria-live="polite"></p><div class="mr-controls"></div><div class="mr-area"></div></div>';
  G.box.innerHTML = ''; G.box.appendChild(root);
  if(G.art && G.art.sill){ root.classList.add('mr-has-sill'); root.style.setProperty('--mr-sill', 'url("' + G.art.sill + '")'); }
  G.root = root; G.set = root.querySelector('.mr-set'); G.needle = root.querySelector('.mr-needle'); G.knob = root.querySelector('.mr-knob');
  G.lineEl = root.querySelector('.mr-line'); G.ctl = root.querySelector('.mr-controls'); G.area = root.querySelector('.mr-area'); G.dots = root.querySelectorAll('.mr-dots i');
}
function say(k, sub){ G.lineEl.innerHTML = '<span dir="' + dir() + '">' + esc(typeof k === 'string' && UI[k] ? U(k) : k) + '</span>' + (sub ? '<small dir="' + dir() + '">' + esc(sub) + '</small>' : ''); }
function dotsPaint(cur){ G.dots.forEach(function(d, i){ d.classList.toggle('mr-full', i < cur); d.classList.toggle('mr-cur', i === cur); }); }
function controls(html){ G.ctl.innerHTML = html; }
function untilTap(node, sel){
  return new Promise(function(res, rej){ var g = G; var h = function(e){ var t = e.target.closest(sel); if(!t || t.disabled) return; node.removeEventListener('click', h); g.waits.delete(stop); res(t); }; var stop = function(){ node.removeEventListener('click', h); rej(ABORT); }; g.waits.add(stop); node.addEventListener('click', h); });
}

/* ---------- 1 · tune in ---------- */
async function tuneIn(){
  setNeedle(G.replay ? MARK - 0.1 : 0.1);
  say('tuneLine');
  controls('<button type="button" class="mr-btn mr-primary mr-tunebtn">' + esc(U('tune')) + '</button>');
  G.status = {kind:'tune', knob:'.mr-knob', dial:'.mr-dial', button:'.mr-tunebtn', art:!!G.art};
  await new Promise(function(res, rej){
    var g = G, done = false, stop = function(){ rej(ABORT); }; g.waits.add(stop);
    function lock(){ if(done) return; done = true; g.waits.delete(stop); staticOff(); setNeedle(MARK); sfx('flip'); lamp(true); sting(); res(); }
    function drag(e){
      if(done) return; e.preventDefault();
      staticOn();
      var dw = G.set.querySelector('.mr-dial').getBoundingClientRect().width * 0.92, sx = e.clientX, n0 = G.n, pid = e.pointerId;
      var mv = function(ev){ if(ev.pointerId !== pid || done) return; var nn = n0 + (ev.clientX - sx) / dw; setNeedle(nn); var dist = Math.abs(G.n - MARK); staticLevel(dist); if(dist < 0.06){ off(); lock(); } };
      var up = function(ev){ if(ev.pointerId !== pid) return; off(); if(!done) staticLevel(.5); };
      var off = function(){ W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up); };
      W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
    }
    G.knob.addEventListener('pointerdown', drag); G.set.querySelector('.mr-dial').addEventListener('pointerdown', drag);
    G.ctl.querySelector('.mr-tunebtn').addEventListener('click', function(){
      if(done) return;
      if(RM()){ lock(); return; }
      staticOn();
      var from = G.n, t0 = performance.now();
      (function step(t){ if(done || !G) return; var q = Math.min(1, (t - t0) / 900); var e = 1 - Math.pow(1 - q, 3); setNeedle(from + (MARK - from) * e); staticLevel(Math.abs(G.n - MARK)); if(q < 1) requestAnimationFrame(step); else lock(); })(t0);
    });
  });
  controls('');
  await wait(450);
}

/* ---------- 2-3 · predict, parts, check-ins ---------- */
function titlesHtml(enabled){
  return '<div class="mr-chips">' + G.ep.titles.map(function(t, i){ return '<button type="button" class="mr-opt" data-i="' + i + '" lang="' + G.lang + '"' + (enabled ? '' : ' disabled') + '>' + esc(t) + '</button>'; }).join('') + '</div>';
}
function playerHtml(extra){ return '<button type="button" class="mr-play" aria-label="' + esc(U('pause')) + '">' + PAUSE + '</button>' + (extra || ''); }
function wirePlayer(){
  G.playBtn = G.ctl.querySelector('.mr-play');
  paintPlay();
  G.playBtn.addEventListener('click', function(){ if(G.playing) pause(); else if(G.resumeRange) G.resumeRange(); });
}
async function parts(){
  var ep = G.ep;
  say('predict');
  G.area.innerHTML = titlesHtml(false);
  for(var p = 0; p < ep.parts.length; p++){
    var a = ep.parts[p][0], b = ep.parts[p][1];
    dotsPaint(p);
    controls(playerHtml());
    wirePlayer();
    G.status = {kind:'listen', part:p, play:'.mr-play'};
    await hearRange(a, b, p === 0 ? IDENT[G.lang] : null);
    live();
    await checkin(p);
    dotsPaint(p + 1);
    if(p < ep.parts.length - 1){ sting(); await wait(700); }
  }
}
async function checkin(p){
  var ep = G.ep, ci = ep.checkins[p], a = ep.parts[p][0], b = ep.parts[p][1];
  var tiles = shuffle([ci.word].concat(ci.decoys));
  say('which');
  controls(playerHtml('<button type="button" class="mr-btn mr-ghost mr-again">' + SPK + esc(U('againPart')) + '</button>'));
  wirePlayer(); G.playing = false; paintPlay();
  G.resumeRange = function(){ G.replays++; replayed = true; G.onEnd = hint; playLines(a, b); };
  var area = el('div', 'mr-tiles', tiles.map(function(w){ return '<button type="button" class="mr-tile" data-w="' + esc(w) + '" lang="' + G.lang + '">' + esc(w) + '</button>'; }).join(''));
  G.area.innerHTML = ''; G.area.appendChild(area);
  var clean = true, replayed = false, hinted = false;
  function hint(){ if(!replayed || hinted || !area.isConnected) return; var t = area.querySelector('[data-w="' + CSS.escape(ci.word) + '"]'); if(t && !t.classList.contains('mr-lit')){ t.insertAdjacentHTML('beforeend', '<i class="mr-hintdot"></i>'); hinted = true; clean = false; } }
  G.ctl.querySelector('.mr-again').addEventListener('click', function(){ if(G.playing) pause(); G.resumeAt = null; G.resumeRange(); });
  G.status = {kind:'checkin', part:p, right:'.mr-tile[data-w="' + ci.word + '"]', wrong:ci.decoys.map(function(d){ return '.mr-tile[data-w="' + d + '"]'; }), again:'.mr-again'};
  while(true){
    var t = await untilTap(area, '.mr-tile');
    if(t.dataset.w === ci.word){
      if(G.playing) pause(); G.resumeAt = null;
      t.classList.add('mr-lit'); sfx('correct'); sparks(t, 4);
      var gl = ep.gloss && ep.gloss[ci.word];
      if(gl && G.ui !== G.lang){ t.insertAdjacentHTML('beforeend', '<small dir="' + dir() + '">' + esc(gl) + '</small>'); }
      area.querySelectorAll('.mr-tile').forEach(function(x){ x.disabled = true; });
      break;
    }
    clean = false; shake(t); sfx('flip'); t.classList.add('mr-off'); t.disabled = true;
    say('which', U('notHere'));
    var left = area.querySelectorAll('.mr-tile:not(.mr-off)');
    if(left.length === 1 && left[0].dataset.w !== ci.word) break;
  }
  if(clean) G.clean++;
  await wait(gl ? 1200 : 600);
}

/* ---------- 4 · which show was it? ---------- */
async function gist(){
  var ep = G.ep, n = ep.lines.length;
  say('gist');
  G.area.innerHTML = titlesHtml(true);
  controls(playerHtml('<button type="button" class="mr-btn mr-ghost mr-again">' + SPK + esc(U('againAll')) + '</button>'));
  wirePlayer(); G.playing = false; paintPlay();
  G.resumeRange = function(){ playLines(G.resumeAt != null ? G.resumeAt : 0, n - 1); };
  G.ctl.querySelector('.mr-again').addEventListener('click', function(){ if(G.playing) pause(); G.resumeAt = null; G.replays++; playLines(0, n - 1); });
  G.status = {kind:'gist', right:'.mr-opt[data-i="' + ep.answer + '"]', wrong:'.mr-opt:not([data-i="' + ep.answer + '"])'};
  var clean = true, box = G.area.firstChild;
  while(true){
    var t = await untilTap(box, '.mr-opt');
    if(+t.dataset.i === ep.answer){
      if(G.playing) pause();
      t.classList.add('mr-right', 'mr-sweep'); sfx('correct'); sparks(t, 6);
      if(!RM()){ for(var k = 0; k < 2; k++){ lamp(false); await wait(140); lamp(true); await wait(140); } }
      break;
    }
    clean = false; shake(t); sfx('flip'); t.classList.add('mr-off'); say('notThat');
    var left = box.querySelectorAll('.mr-opt:not(.mr-off)'); if(left.length === 1){ left[0].click(); }
  }
  if(clean) G.clean++;
  await wait(700);
}

/* ---------- 5 · put the moments in order ---------- */
async function order(){
  var ep = G.ep, m = ep.moments.slice(), cards = shuffle(m);
  say('order'); controls('');
  var pips = function(k){ return '<span class="mr-pips">' + new Array(k + 2).join('<i></i>') + '</span>'; };
  G.area.innerHTML = '<div class="mr-track">' + m.map(function(x, k){ return '<div class="mr-slot" data-k="' + k + '">' + pips(k) + '</div>'; }).join('') + '</div>' +
    '<div class="mr-track mr-pool">' + cards.map(function(i){ return cardHtml(i); }).join('') + '</div>';
  var pool = G.area.querySelector('.mr-pool'), slots = G.area.querySelectorAll('.mr-slot');
  var next = 0, wrong = 0, clean = true;
  G.area.addEventListener('click', function(e){ var s = e.target.closest('.mr-say'); if(s){ e.stopPropagation(); var l = ep.lines[+s.dataset.l]; speak(l.text, l.who); } }, true);
  function place(i, locked){ var c = pool.querySelector('.mr-card[data-l="' + i + '"]'); if(!c) return; slots[next].appendChild(c); if(locked) c.classList.add('mr-locked', 'mr-sweep'); c.disabled = true; next++; }
  G.status = {kind:'order', want:function(){ return '.mr-pool .mr-card[data-l="' + m[next] + '"]'; }, wrongCard:function(){ var c = G.area.querySelector('.mr-pool .mr-card:not([data-l="' + m[next] + '"])'); return c ? '.mr-pool .mr-card[data-l="' + c.dataset.l + '"]' : null; }};
  while(next < 3){
    if(next === 2){ place(m[2]); break; }
    var t = await untilTap(pool, '.mr-card');
    if(+t.dataset.l === m[next]){ place(m[next]); sfx('correct'); continue; }
    clean = false; wrong++; shake(t); sfx('flip');
    if(wrong === 2 && next === 0){ place(m[0], true); }
    if(wrong === 4 && next === 1){ place(m[1], true); }
  }
  sfx('correct');
  var solved = el('div', 'mr-solved', m.map(function(i){ return cardHtml(i); }).join(''));
  G.area.innerHTML = ''; G.area.appendChild(solved);
  if(clean) G.clean++;
  await wait(900);
}
function cardHtml(i){ return '<button type="button" class="mr-card" data-l="' + i + '" lang="' + G.lang + '">' + esc(G.ep.lines[i].text) + '<span class="mr-say" data-l="' + i + '" role="button" aria-label="' + esc(U('play')) + '">' + SPK + '</span></button>'; }

/* ---------- 6 · off air ---------- */
async function offAir(){
  var ep = G.ep, total = ep.parts.length + 2, perfect = G.clean === total;
  sfx('flip'); lamp(false);
  var words = ep.checkins.map(function(c){ return c.word; });
  var bold = function(text){ var h = esc(text); words.forEach(function(w){ h = h.replace(new RegExp('(^|[^\\p{L}])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\p{L}{0,3})(?![\\p{L}])', 'giu'), '$1<b>$2</b>'); }); return h; };
  var panel = el('div', 'mr-off-air');
  panel.innerHTML = '<h2 dir="' + dir() + '">' + esc(U('offAir')) + '</h2><p class="mr-sign" dir="' + dir() + '">' + esc(U(perfect ? 'sharp' : 'thanks')) + '</p>' +
    '<div class="mr-read" dir="ltr" lang="' + G.lang + '">' + ep.lines.map(function(l, i){ return '<p data-l="' + i + '">' + (ep.kind === 'authored' ? '<i class="mr-spk mr-spk-' + (l.who === 'b' ? 'b' : 'a') + '"></i>' : '') + bold(l.text) + '</p>'; }).join('') + '</div>' +
    '<button type="button" class="mr-btn mr-primary mr-with">' + esc(U('withWords')) + '</button>' +
    (ep.title ? '<p class="mr-title" lang="' + G.lang + '">' + esc(ep.title) + '</p>' : '') +
    (ep.kind === 'story' && ep.storyId && G.host.openStory ? '<button type="button" class="mr-btn mr-ghost mr-whole">' + esc(U('wholeStory')) + '</button>' : '') +
    '<div class="mr-hostresult"></div><button type="button" class="mr-btn mr-done">' + esc(U('done')) + '</button>';
  G.area.innerHTML = ''; G.area.appendChild(panel); controls(''); say('');
  G.lineEl.style.display = 'none';
  G.readEl = panel.querySelector('.mr-read');
  G.readEl.addEventListener('click', function(e){ var p = e.target.closest('p'); if(!p) return; var l = ep.lines[+p.dataset.l]; if(G.playing) pause(); markRead(+p.dataset.l); speak(l.text, l.who).then(function(){ if(G && !G.playing) markRead(-1); }); });
  panel.querySelector('.mr-with').addEventListener('click', function(){ if(G.playing){ pause(); return; } G.resumeAt = null; playLines(0, ep.lines.length - 1); });
  var whole = panel.querySelector('.mr-whole'); if(whole) whole.addEventListener('click', function(){ var id = ep.storyId, h = G.host; destroy(); h.openStory(id); });
  var stats = {clean:G.clean, total:total, replays:G.replays, perfect:perfect, episode:ep.id, kind:ep.kind, storyId:ep.storyId};
  try{ if(G.host.result) G.host.result(panel.querySelector('.mr-hostresult'), stats); }catch(e){}
  var w0 = ep.checkins[0];
  try{ if(G.host.keep) G.host.keep({kind:'radio', word:w0.word, meaning:(ep.gloss || {})[w0.word] || '', title:ep.title || (ep.titles && ep.titles[ep.answer]) || '', golden:perfect}); }catch(e){}
  G.status = {kind:'offair', done:'.mr-done', with:'.mr-with', stats:stats};
  var tapped = untilTap(panel, '.mr-done');
  speak(SIGN[G.lang][perfect ? 'sharp' : 'thanks'], 'a');
  await tapped;
  stopSpeech();
  return stats;
}

/* ---------- start / destroy ---------- */
function start(o){
  if(G) destroy();
  o = o || {};
  var g = G = {v:VERSION, ep:o.episode, lang:o.lang === 'es' ? 'es' : 'en', ui:o.ui || o.lang || 'en', host:o.host || {}, replay:!!o.replay, pace:o.pace || 1, tts:o.tts,
    forceReduced:!!o.reduced, art:validArt(o.art), onDone:o.onDone, onLeave:o.onLeave, waits:new Set(), tok:0, n:0, clean:0, replays:0, heardTo:-1, dead:false,
    box:o.root || (W.Theatre && W.Theatre.stageEl && W.Theatre.stageEl()) || D.body, status:{kind:'boot'}};
  if(!g.ep || !g.ep.lines || !g.ep.parts) throw new Error('mini-radio: no episode');
  build();
  g.mo = new MutationObserver(function(){ if(G === g && !g.box.isConnected) destroy(); });
  g.mo.observe(D.body, {childList:true});
  // x / Escape leave at once (no resume for a short round, spec 3)
  g.onKey = function(e){ if(e.key === 'Escape' && G === g){ var cb = g.onLeave; destroy(); if(cb) cb(); } };
  W.addEventListener('keydown', g.onKey);
  (async function(){
    try{
      await tuneIn(); await parts(); await gist(); await order();
      var stats = await offAir();
      var cb = g.onDone; destroy({keepDom:true}); if(cb) cb(stats);
    }catch(e){ if(e !== ABORT) console.error('[mini-radio]', e); }
  })();
  return {destroy:function(){ if(G === g) destroy(); }, get status(){ return g.status; }};
}
function destroy(o){
  var g = G; if(!g) return;
  g.dead = true; g.tok++;
  stopSpeech(); staticOff();
  g.waits.forEach(function(f){ try{ f(); }catch(e){} });
  if(g.mo) g.mo.disconnect();
  W.removeEventListener('keydown', g.onKey);
  G = null;
  if(!(o && o.keepDom) && g.root && g.root.parentNode) g.root.remove();
}
function validArt(a){ return a && a.body && a.knob && a.layout && a.layout.dial && a.layout.lamp && a.layout.knob ? a : null; }
// art/manifest.json = {ready, body, knob, sill, layout} (written when the GPU renders are cut); anything missing = plain controls
function loadArt(appRoot){
  var base = (appRoot || '') + 'games/mini-radio/art/';
  return fetch(base + 'manifest.json', {cache:'no-cache'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(m){
    if(!m || !m.ready) return null;
    return validArt({body:base + m.body, knob:base + m.knob, sill:m.sill ? base + m.sill : null, layout:m.layout});
  }).catch(function(){ return null; });
}
W.MiniRadio = {version:VERSION, start:start, loadArt:loadArt, UI:UI, IDENT:IDENT, SIGN:SIGN,
  debug:{status:function(){ var s = G ? G.status : null; if(!s) return null; var o = {}; for(var k in s) o[k] = typeof s[k] === 'function' ? s[k]() : s[k]; o.playing = !!G.playing; return o; }, game:function(){ return G; }}};
})();
