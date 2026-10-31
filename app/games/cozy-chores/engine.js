/* Cozy Chores "Open House" engine v0.3 (Trello 2V8pPKGK; GDD Claude/specs/games-expansion-2026-10-22/COZY-CHORES-OPEN-HOUSE-GDD.md).
   Byte-identical in english app/app/games/cozy-chores/ and spanish app/app/games/cozy-chores/. Runs inside the Game Theatre
   stage (Theatre.stageEl(), THEATRE-API.md) or any full-size container.

   The engine runs data, not per-project code (GDD 4):
     projects/<id>.json   stations: shots (plate + layers + atmos + hot zones), beats (lines, verbs, one gesture each), photo crop
     content/<id>.json    every word the learner reads or hears (farin-lxd): variants[lang][band].stations[] -> lines by role
     art/manifest.json    one entry per plate / cut-out / portrait; ready:false draws a labelled placeholder, ready:true loads the WebP
     content/shared.json  lines every project shares (Mrs Bell's kind-line pools, cake Captain + curios), the building-wide end shot, its art
   v0.3 (2026-10-29, GDD 13): projects carry their own stand-in art entries ("art"), so a new project needs no manifest change; the
   art/manifest.json entry wins as soon as it exists. Added: per-station light arc (CZ8), curios + finds (CZ12), Captain's moment (CZ2),
   Mrs Bell's line pools with no repeats (CZ5), free-line and because-chip events (B2/C1, B1), spots / multi-target drags, the window
   that lights up (CZ10), the souvenir that shows your thing (CZ11), foley variants by material (CZ13, synth until sfx/ files land),
   cross-project memory (house.mem, <project>.delivered, house.made: what you made, for the Street Party table).
   A beat is one of: say [roles] | do [verbs] | gesture {type,...} | ask | reply | recap | produce | recapSpoken | note | mem |
   noteChange | recipe | shot | card | photo, with optional if / then / else, bands / notBands.

   Ported from the live stage engine (farin-english-app.html, STAGE ENGINE section: mountScene, chRun, chSkip, VERB, runSteps), copied here
   so the big app file is not touched. New verbs: line face cam note photo lapse sfxf (+ pose open ring tint bump squash motion atmos toNote).
   Gestures (closed set of 7): tap, drag-to, pour-until, stir-circles, turn-dial, pipe-letters, place. Each has a hint at 15 s, a guide
   at 45 s and a tap-only alternative that is always on screen (and is the reduced-motion mode). Camera shots: wide, two, close, top, pov.
   Motion is transform / opacity only (WAAPI or CSS loops). Nothing is ever marked wrong; there is no score, timer or number shown
   except the scale / dial readings the learner is asked to hit.

   API
     CozyChores.load({appRoot, project}) -> Promise<data>        fetches project + content + manifest + shared (relative to appRoot)
     CozyChores.start({root, data, lang:'en'|'es', ui:'en'|'tr'|'fa'|'es', band:'A1'..'C1' (a band the project has; else its anchor), name, host, resume, pace,
                       onDone(result), onLeave()}) -> game
     CozyChores.savedRound(host, projectId) -> round | null    (the poster shows Continue when there is one)
     game.destroy()
   host (all optional; defaults use localStorage + speechSynthesis + small WebAudio tones):
     speak(text, {lang, who, rate, interrupt}) -> Promise, stopSpeech(), sfx(name), muted(), reduced(),
     loadRound(), saveRound(round|null), loadHouse(), saveHouse(house), keep(souvenir)
*/
(function(){
'use strict';
if(window.CozyChores) return;
var W = window, D = document;
var VERSION = '0.4.0';
var ABORT = {abort:true};
var G = null;                       // the running game (one at a time, like chStage in the app)
var SPRING = 'cubic-bezier(.34,1.56,.64,1)';
var EASE = 'cubic-bezier(.2,.7,.2,1)';

/* ============================== small helpers ============================== */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function el(tag, cls, html){ var n = D.createElement(tag); if(cls) n.className = cls; if(html != null) n.innerHTML = html; return n; }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function words(s){ return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function rect(n){ return n.getBoundingClientRect(); }
function center(r){ return {x:r.left + r.width / 2, y:r.top + r.height / 2}; }
function dist(a, b){ var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
function live(){ if(!G || G.dead) throw ABORT; }
function RM(){
  if(G && G.forceReduced) return true;
  try{ if(G && G.host.reduced && G.host.reduced()) return true; }catch(e){}
  try{ return W.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; }
}
function cap1(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

var UI = {
  ask:{en:'Ask', tr:'Sor', fa:'بپرس', es:'Preguntar'},
  done:{en:'Done', tr:'Tamam', fa:'تموم شد', es:'Listo'},
  leaveQ:{en:'Leave? Your place is saved.', tr:'Çıkıyor musun? Kaldığın yer kayıtlı.', fa:'می‌خوای بری؟ تا همین‌جا ذخیره شده.', es:'¿Te vas? Tu sitio queda guardado.'},
  stay:{en:'Stay', tr:'Kal', fa:'می‌مونم', es:'Quedarme'},
  leave:{en:'Leave', tr:'Çık', fa:'می‌رم', es:'Salir'},
  note:{en:'Order note', tr:'Sipariş notu', fa:'یادداشت سفارش', es:'Nota del pedido'},
  hear:{en:'Hear it again', tr:'Tekrar dinle', fa:'دوباره گوش کن', es:'Escuchar otra vez'},
  gloss:{en:'Translation', tr:'Çeviri', fa:'ترجمه', es:'Traducción'},
  cue_tap:{en:'Tap it', tr:'Dokun', fa:'بزن روش', es:'Tócalo'},
  cue_drag:{en:'Drag it over', tr:'Sürükle', fa:'بکشش ببر', es:'Arrástralo'},
  cue_pour:{en:'Hold to pour', tr:'Dökmek için basılı tut', fa:'نگه دار تا بریزه', es:'Mantén pulsado para echar'},
  cue_stir:{en:'Stir in circles', tr:'Daire çizerek karıştır', fa:'دایره‌ای هم بزن', es:'Remueve en círculos'},
  cue_dial:{en:'Turn the dial', tr:'Düğmeyi çevir', fa:'پیچ رو بچرخون', es:'Gira el mando'},
  cue_pipe:{en:'Tap the letters', tr:'Harflere dokun', fa:'روی حرف‌ها بزن', es:'Toca las letras'},
  cue_place:{en:'Put them in place', tr:'Yerlerine koy', fa:'بذارشون سرِ جاشون', es:'Ponlos en su sitio'},
  cue_choose:{en:'Choose one', tr:'Birini seç', fa:'یکی رو انتخاب کن', es:'Elige uno'},
  cue_ask:{en:'Pick a question', tr:'Bir soru seç', fa:'یه سؤال انتخاب کن', es:'Elige una pregunta'},
  cue_reply:{en:'Your answer', tr:'Cevabın', fa:'جوابت', es:'Tu respuesta'},
  cue_story:{en:'Tap four photos', tr:'Dört fotoğrafa dokun', fa:'روی چهار عکس بزن', es:'Toca cuatro fotos'},
  stir:{en:'Stir', tr:'Karıştır', fa:'هم بزن', es:'Remover'},
  less:{en:'Less', tr:'Azalt', fa:'کمتر', es:'Menos'},
  more:{en:'More', tr:'Artır', fa:'بیشتر', es:'Más'},
  you:{en:'You', tr:'Sen', fa:'تو', es:'Tú'},
  phone:{en:'on the phone', tr:'telefonda', fa:'پشت تلفن', es:'al teléfono'},
  listen:{en:'Listen', tr:'Dinle', fa:'گوش کن', es:'Escuchar'},
  kept:{en:'Saved to your review cards', tr:'Tekrar kartlarına eklendi', fa:'به کارت‌های مرورت اضافه شد', es:'Guardado en tus tarjetas de repaso'},
  finish:{en:'Back to the street', tr:'Sokağa dön', fa:'برگرد به خیابون', es:'Volver a la calle'},
  flip:{en:'Tap to turn it over', tr:'Çevirmek için dokun', fa:'بزن تا پشتش رو ببینی', es:'Toca para darle la vuelta'},
  story:{en:'Your story', tr:'Hikâyen', fa:'داستانت', es:'Tu historia'},
  artSoon:{en:'Art in production', tr:'Çizim hazırlanıyor', fa:'تصویر داره کشیده می‌شه', es:'Ilustración en producción'},
  takeBack:{en:'Take it back', tr:'Geri al', fa:'برش دار', es:'Quitar'},
  album:{en:'Into your album', tr:'Albümüne eklendi', fa:'رفت تو آلبومت', es:'A tu álbum'},
  /* v0.3, lxd-review */
  send:{en:'Say it', tr:'Söyle', fa:'بگو', es:'Dilo'},
  typeHere:{en:'Type or say it…', tr:'Yaz ya da söyle…', fa:'بنویس یا بگو…', es:'Escríbelo o dilo…'},
  another:{en:'Another way to say it', tr:'Başka nasıl söylenir', fa:'یه جور دیگه هم می‌شه گفت', es:'Otra forma de decirlo'},
  helpMe:{en:'Show me one', tr:'Bir örnek göster', fa:'یه نمونه نشونم بده', es:'Enséñame un ejemplo'},
  mic:{en:'Speak', tr:'Konuş', fa:'حرف بزن', es:'Hablar'},
  next:{en:'Next', tr:'Devam', fa:'بعدی', es:'Siguiente'},
  said:{en:'I said it', tr:'Söyledim', fa:'گفتمش', es:'Ya lo he dicho'},
  skip:{en:'Skip', tr:'Geç', fa:'رد شو', es:'Saltar'},
  sayAloud:{en:'Now say it out loud.', tr:'Şimdi sesli söyle.', fa:'حالا بلند بگو.', es:'Ahora dilo en voz alta.'},
  cue_free:{en:'Your own words', tr:'Kendi sözlerinle', fa:'با حرفای خودت', es:'Con tus palabras'},
  cue_build:{en:'Build a sentence', tr:'Bir cümle kur', fa:'یه جمله بساز', es:'Forma una frase'},
  cue_find:{en:'Look closely', tr:'Dikkatli bak', fa:'دقیق نگاه کن', es:'Mira bien'}
};
// farin-lxd's UI strings (shared.ui: {en:{text, tr, fa}, es:{text, tr, fa, en}}) win over the built-in table
function U(k){
  var ui = G ? G.ui : 'en';
  var s = G && G.data && G.data.shared && G.data.shared.ui && G.data.shared.ui[k];
  if(s){
    if((ui === 'en' || ui === 'es') && s[ui] && s[ui].text) return s[ui].text;
    var rec = s[G.lang]; if(rec && rec[ui]) return rec[ui];
  }
  var o = UI[k] || {}; return o[ui] != null ? o[ui] : (o.en || k);
}
function uiDir(){ return G && G.ui === 'fa' ? 'rtl' : 'ltr'; }

/* ============================== text: lines by role, conditions, fills ============================== */
function variant(data, lang, band){
  var v = data.content.variants || {};
  return (v[lang] && (v[lang][band] || v[lang].A2)) || null;
}
// every {id, who} object inside a content station, keyed by role (= the id after ".<station>.")
function indexStation(cs){
  var map = {};
  (function walk(o){
    if(Array.isArray(o)){ o.forEach(walk); return; }
    if(!o || typeof o !== 'object') return;
    if(o.id && o.who){
      var k = '.' + cs.id + '.', i = o.id.indexOf(k);
      var role = i >= 0 ? o.id.slice(i + k.length) : o.id;
      if(!map[role]) map[role] = o;
    }
    for(var key in o) if(o[key] && typeof o[key] === 'object') walk(o[key]);
  })(cs);
  return map;
}
function contentStation(sid){ return (G.V.stations || []).filter(function(s){ return s.id === sid; })[0] || null; }
function lineFor(role, sid){
  sid = sid || G.sid;
  if(!role) return null;
  // '@full.id' = a shared line (content/shared.json), at A1 the '.a1' variant when there is one
  if(role.charAt(0) === '@') return sharedLine(role.slice(1));
  if(role.indexOf(':') > 0){ var p = role.split(':'); sid = p[0]; role = p[1]; }
  if(!G.roleIdx[sid]){ var cs = contentStation(sid); G.roleIdx[sid] = cs ? indexStation(cs) : {}; }
  var idx = G.roleIdx[sid], hit = idx[role];
  if(hit) return hit;
  // anchors name their curio and Captain lines by full id (bouq.curio.order, wash.captain.call); every other band by role (curio.order, captain.call)
  var m = /(?:^|.)((?:captain|curio).[w-]+)$/.exec(role);
  return (m && idx[m[1]]) || null;
}
function sharedLine(id){
  var L0 = (G.data.shared && G.data.shared.lines) || {};
  // shared.lines[id] = {who, en:{text, tr, fa}, es:{text, tr, fa, en}}: the glosses belong to each language's own line
  var o = (G.band === 'A1' && L0[id + '.a1']) || L0[id];
  var r = o && o[G.lang]; if(!r || !r.text) return null;
  var out = {id:id, who:o.who || 'bell', tr:r.tr, fa:r.fa, en:r.en};
  out[G.lang] = r.text;
  return out;
}
// CZ5: Mrs Bell never repeats herself. Pools of 3 variants per band; a variant is not used twice in one project
function kindLine(pool){
  var used = G.round.kindUsed = G.round.kindUsed || [];
  var ids = [1, 2, 3].map(function(i){ return 'kind.' + pool + '.' + G.band + '.' + i; }).filter(function(id){ return sharedLine(id); });
  var free = ids.filter(function(id){ return used.indexOf(id) < 0; });
  if(!free.length){ free = ids; G.round.kindUsed = used = used.filter(function(id){ return ids.indexOf(id) < 0; }); }
  var id = free[Math.floor(Math.random() * free.length)]; if(!id) return null;
  used.push(id);
  var l = sharedLine(id); if(l) l.who = G.P.mentor || 'bell';
  return l;
}
function T(o){ if(!o) return ''; return o[G.lang] != null ? o[G.lang] : (o.text != null ? o.text : (o.en || '')); }
// the gloss in the learner's interface language (none when it is the target language)
function GL(o){ if(!o || G.ui === G.lang) return ''; return o[G.ui] || ''; }
// a key this project does not own is read from the house (what the learner did in other projects, write-latest);
// '<x>.delivered' is derived: P.derive maps it to a project id, delivered at any band (party table, GDD 6)
function memGet(k){
  if(G.round.mem[k] !== undefined) return G.round.mem[k];
  var dv = (G.P.derive || {})[k];
  if(dv) return delivered(dv);
  var m = /^(\w+)\.delivered$/.exec(k);
  if(m) return delivered(m[1]);
  return (G.house.mem || {})[k];
}
function delivered(pid){ var p = G.house.projects && G.house.projects[pid]; return !!(p && Object.keys(p).length); }
function memSet(k, v){
  G.round.mem[k] = v;
  G.house.mem = G.house.mem || {}; G.house.mem[k] = v;   // write-latest (GDD 11)
  save(true);
}
function lit(s){
  s = String(s).trim();
  if(s === 'true') return true; if(s === 'false') return false; if(s === 'null') return null;
  if(/^-?\d+(\.\d+)?$/.test(s)) return +s;
  return s;
}
// tiny condition language from the content file: ! && || == != > < and band==A1; "(...)" notes are ignored
function cond(c, ctx){
  if(c == null || c === '') return true;
  if(typeof c === 'boolean') return c;
  c = String(c).replace(/\(.*?\)/g, '').trim();
  if(c.indexOf('||') >= 0) return c.split('||').some(function(p){ return cond(p, ctx); });
  if(c.indexOf('&&') >= 0) return c.split('&&').every(function(p){ return cond(p, ctx); });
  var m = c.match(/^(!?)\s*([\w.]+)\s*(==|!=|>=|<=|>|<|=)?\s*([\w.#-]*)$/);
  if(!m) return true;
  var key = m[2], val;
  if(key === 'band') val = G.band;
  else if(key.indexOf('drag') === 0) val = ctx && ctx.drag;
  else val = memGet(key);
  if(!m[3]){ var b = !!val; return m[1] ? !b : b; }
  var r = lit(m[4]), out;
  switch(m[3]){
    case '==': case '=': out = val === r || String(val) === String(r); break;
    case '!=': out = !(val === r || String(val) === String(r)); break;
    case '>': out = +val > +r; break; case '<': out = +val < +r; break;
    case '>=': out = +val >= +r; break; case '<=': out = +val <= +r; break;
  }
  return m[1] ? !out : out;
}
// {name} in a line: the line's "fill" says where the word comes from: "table[mem.key]" (a station field, the variant, or the
// project's fills) or "mem.key ? 'a' : 'b'" (P.fills[name] keyed "true" / "false" carries every language)
function fillEntry(k, line){
  var spec = (line && line.fill) || '';
  var m = /(\w+)\[([\w.]+)\]/.exec(spec), val, table = null;
  if(m){
    val = memGet(m[2]);
    var cs = contentStation(G.sid) || {};
    table = cs[m[1]] || (G.V.stations || []).map(function(x){ return x[m[1]]; }).filter(Boolean)[0] || G.V[m[1]] || null;
    var e = table && val != null ? table[val] : null;
    var pf = ((G.P.fills || {})[m[1]] || {})[val];
    return e ? Object.assign({}, pf || {}, e) : (pf || null);
  }
  m = /([\w.]+)\s*\?/.exec(spec);
  if(m){ val = !!memGet(m[1]); return ((G.P.fills || {})[k] || {})[String(val)] || null; }
  var t = (G.P.fills || {})[k]; if(t && t.key) return t[memGet(t.key)] || t[String(!!memGet(t.key))] || null;
  return null;
}
function fill(s, line, vars){
  vars = vars || {};
  return String(s || '').replace(/\{(\w+)\}/g, function(m, k){
    if(vars[k] != null) return vars[k];
    var fe = fillEntry(k, line); if(fe && T(fe)) return k === 'Colour' ? cap1(T(fe)) : T(fe);
    if(k === 'Colour' || k === 'colour'){
      var fem = line && /coloursFem/.test(line.fill || '');
      var set = (fem && G.V.coloursFem) || G.V.colours || {};
      var c = set[memGet('cake.colour') || 'purple'] || {};
      var w = T(c);
      return k === 'Colour' ? cap1(w) : w;
    }
    return vars[k] != null ? vars[k] : m;
  });
}
function fillGloss(s, line, vars){
  vars = vars || {};
  return String(s || '').replace(/\{(\w+)\}/g, function(m, k){
    if(vars[k] != null) return vars[k];
    var fe = fillEntry(k, line); if(fe && fe[G.ui]) return fe[G.ui];
    if(k === 'Colour' || k === 'colour'){
      var c = (G.V.colours || {})[memGet('cake.colour') || 'purple'] || {};
      var w = c[G.ui] || '';
      return k === 'Colour' ? cap1(w) : w;
    }
    return vars[k] != null ? vars[k] : m;
  });
}
function castName(who){
  if(who === 'you') return U('you');
  var c = (G.P.cast || {})[who];
  return c ? (c.name[G.lang] || c.name.en) : '';
}
function obj(k){ return (G.P.objects || {})[k] || null; }
// GDD 13.10: words a band lists as pictured carry their label at A2 too; a card (cardPics) or a line (linePics) can show the picture and the word
function isPictured(k){ return ((G.P.pictured || {})[G.band] || []).indexOf(k) >= 0; }
function picWord(k){
  var gl = G.band === 'A1' ? objGloss(k) : '';
  return '<span class="oh-word" lang="' + G.lang + '">' + esc(objWord(k)) + (gl ? '<small dir="' + uiDir() + '" lang="' + G.ui + '">' + esc(gl) + '</small>' : '') + '</span>';
}
function picArt(k){ var o = obj(k); return o && o.art ? artHtml(o.art) : ''; }
function linePic(line){
  var map = G.bandCfg.linePics, id = line && line.id; if(!map || !id) return null;
  for(var k in map){
    if(id.slice(-(k.length + 1)) !== '.' + k) continue;
    var v = map[k]; if(v.lang && v.lang !== G.lang) return null;
    return [].concat(v.pic || v);
  }
  return null;
}
// GDD 13.10 Glosses: the first line that holds a word of the band's glosses list shows its translation without a tap, and the word is underlined
function glossRe(word){
  var alts = String(word || '').split('/').map(function(w){ return w.trim().replace(/^(the|an?|to|el|la|los|las|un|una|unos|unas)\s+/i, ''); }).filter(Boolean)
    .map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (G.lang === 'es' ? '(?:s|es)?' : '(?:s|es|d|ed|ing)?'); });
  return alts.length ? new RegExp('(^|[^\\p{L}])(' + alts.join('|') + ')(?![\\p{L}])', 'iu') : null;
}
function glossHit(text){
  var seen = G.round.glossSeen = G.round.glossSeen || [], out = [];
  (G.V.glosses || []).forEach(function(g){
    if(seen.indexOf(g.word) >= 0) return;
    var re = glossRe(g.word); if(!re || !re.test(text)) return;
    seen.push(g.word); out.push(re);
  });
  return out;
}
function glossMark(html, res){ (res || []).forEach(function(re){ html = html.replace(re, function(m, a, w){ return a + '<u class="oh-glw">' + w + '</u>'; }); }); return html; }
function objWord(k){ var o = obj(k); return o ? (o[G.lang] || o.en) : k; }
function objGloss(k){ var o = obj(k); if(!o || G.ui === G.lang) return ''; var es = G.lang === 'es' && o.esGl ? o.esGl : null; return G.ui === 'en' ? ((o.gl && o.gl.en) || '') : ((es && es[G.ui]) || o[G.ui] || ''); }

/* ============================== art (manifest-driven, placeholders until art is ready) ============================== */
// the shipped manifest wins; a project's own stand-in entry (P.art) or a shared one (shared.art) covers art the manifest does not list yet
function man(id){ return (G.M.items || {})[id] || (G.P.art || {})[id] || ((G.data.shared || {}).art || {})[id] || null; }
function artUrl(m){ return (G.appRoot || '') + m.file; }
function artHtml(id, o){
  o = o || {};
  var m = man(id);
  if(m && m.ready){
    if(o.tint) return '<div class="oh-tint" style="--tint:' + esc(o.tint) + ';-webkit-mask-image:url(' + esc(artUrl(m)) + ');mask-image:url(' + esc(artUrl(m)) + ')"></div>';
    return '<img src="' + esc(artUrl(m)) + '" alt="" draggable="false" decoding="async">';
  }
  var ph = (m && m.ph) || {}, shape = ph.shape || 'soft', fillc = o.tint || ph.fill || '#f3e3c8';
  // the stand-in names the thing in the target language where the game has the word (a cut-out of an egg says "eggs" / "huevos")
  var name = (m && m.obj && obj(m.obj)) ? objWord(m.obj) : (m && m.who) ? castName(m.who) : ((m && m.name) || id.replace(/^(co|pt|plate)-/, '').replace(/-/g, ' '));
  return '<div class="oh-ph oh-ph-' + esc(shape) + (m && m.kind === 'portrait' ? ' oh-ph-pt' : '') + '" style="--ph:' + esc(fillc) + (ph.ink ? ';--ph-ink:' + esc(ph.ink) : '') + '">' +
    (ph.detail ? '<i class="oh-ph-d oh-ph-d-' + esc(ph.detail) + '"></i>' : '') +
    '<span class="oh-ph-name">' + esc(name) + '</span></div>';
}
function plateHtml(id){
  var m = man(id);
  if(m && m.ready) return '<img src="' + esc(artUrl(m)) + '" alt="" draggable="false" decoding="async">';
  var ph = (m && m.ph) || {};
  var shapes = (ph.shapes || []).map(function(s){
    return '<i class="oh-pp-s' + (s.round ? ' oh-pp-r' : '') + (s.line ? ' oh-pp-l' : '') + '" style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%;background:' + esc(s.fill || 'transparent') + (s.r != null ? ';border-radius:' + s.r + (typeof s.r === 'number' ? 'px' : '') : '') + '">' +
      (s.label ? '<b>' + esc(s.label) + '</b>' : '') + '</i>';
  }).join('');
  return '<div class="oh-pp" style="background:' + esc(ph.bg || '#fbefdc') + '">' + shapes +
    '<span class="oh-pp-tag">' + esc((m && m.name) || id) + ' · ' + esc(U('artSoon')) + '</span></div>';
}

/* ============================== sound + speech (host first, small built-ins as the fallback) ============================== */
var actx = null;
function ctx(){ try{ if(!actx) actx = new (W.AudioContext || W.webkitAudioContext)(); if(actx.state === 'suspended') actx.resume().catch(function(){}); return actx; }catch(e){ return null; } }
var DET = 1;   // CZ13: each play is detuned 0.96-1.04 so a repeated action never sounds the same
function tone(c, type, f0, f1, t, dur, peak){
  var o = c.createOscillator(), g = c.createGain();
  f0 *= DET; if(f1) f1 *= DET;
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.6, 0.0002), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(c, t, dur, peak, freq){
  var len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for(var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var s = c.createBufferSource(); s.buffer = buf;
  var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (freq || 2000) * DET; bp.Q.value = 1.1;
  var g = c.createGain(); g.gain.value = peak * 0.6;
  s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
}
function muted(){ try{ return G && G.host.muted ? !!G.host.muted() : false; }catch(e){ return false; } }
// UI tones keep the app's names (tick / correct / reveal / combo); the rest stand in for sfx/*.mp3 until the files exist (GDD 9)
var lastVar = {};
// CZ13 foley: sfx/<file>.mp3 from shared.sfx when the CC0 files land (3 variants per material x surface, never the same variant
// twice in a row, playbackRate 0.96-1.04); until then a synth stand-in with the same variant + detune rule
function sfxFile(name){
  var map = (G.data.shared && G.data.shared.sfx) || {}, list = map[name]; if(!list || !list.length) return false;
  var i = Math.floor(Math.random() * list.length); if(list.length > 1 && i === lastVar[name]) i = (i + 1) % list.length; lastVar[name] = i;
  try{ var a = new Audio((G.appRoot || '') + list[i]); a.playbackRate = 0.96 + Math.random() * 0.08; a.volume = .7; var p = a.play(); if(p && p.catch) p.catch(function(){}); return true; }catch(e){ return false; }
}
function sfx(name){
  if(!G || muted()) return;
  try{ if(G.host.sfx && G.host.sfx(name) === true) return; }catch(e){}
  if(sfxFile(name)) return;
  var c = ctx(); if(!c) return;
  var t = c.currentTime + 0.01;
  var v = Math.floor(Math.random() * 3); if(v === lastVar[name]) v = (v + 1) % 3; lastVar[name] = v;
  DET = [0.97, 1, 1.035][v] * (0.99 + Math.random() * 0.02);
  try{
    switch(name){
      case 'correct': tone(c,'sine',523.25,0,t,.11,.14); tone(c,'sine',659.25,0,t+.07,.11,.14); break;
      case 'combo': [523.25,659.25,784].forEach(function(f,i){ tone(c,'sine',f,0,t+i*.06,.11,.14); }); break;
      case 'reveal': [523.25,659.25,784,1046.5].forEach(function(f,i){ tone(c,'sine',f,0,t+i*.07,.14,.12); }); break;
      case 'tick': case 'paper': case 'pencil': noise(c,t,.03,.05,2200); break;
      case 'click': noise(c,t,.018,.06,3600); break;
      case 'pop': tone(c,'sine',520,880,t,.08,.08); break;
      case 'bell': tone(c,'sine',1568,0,t,.5,.06); tone(c,'sine',2093,0,t+.09,.45,.05); break;
      case 'ding': tone(c,'sine',1318.5,0,t,.9,.1); tone(c,'sine',2637,0,t,.5,.03); break;
      case 'knock': tone(c,'triangle',160,90,t,.09,.22); noise(c,t,.04,.12,600); break;
      case 'door': noise(c,t,.12,.05,900); tone(c,'sine',220,180,t,.12,.04); break;
      case 'crack': noise(c,t,.05,.12,3000); tone(c,'triangle',900,500,t,.05,.05); break;
      case 'zip': noise(c,t,.18,.05,4200); break;
      case 'purr': tone(c,'sawtooth',48,44,t,.7,.03); break;
      case 'ring': [0,.16,.32].forEach(function(d){ tone(c,'square',1320,0,t+d,.07,.03); tone(c,'square',1480,0,t+d+.08,.07,.03); }); break;
      case 'flash': noise(c,t,.08,.08,5000); break;
      case 'swish': noise(c,t,.14,.035,1400); break;
      case 'clink': tone(c,'sine',2400,0,t,.12,.05); tone(c,'sine',3100,0,t+.02,.1,.03); break;
      case 'land': case 'land-food': tone(c,'sine',300,180,t,.07,.07); break;
      case 'land-light': tone(c,'sine',620,420,t,.05,.05); break;
      case 'land-glass': tone(c,'sine',1900,0,t,.1,.04); tone(c,'sine',2600,0,t+.015,.08,.025); break;
      case 'land-heavy': tone(c,'triangle',130,80,t,.12,.18); noise(c,t,.05,.08,500); break;
      case 'land-soft': noise(c,t,.09,.04,900); break;
      case 'snip': noise(c,t,.03,.1,5200); noise(c,t+.05,.025,.08,4600); break;
      case 'cloth': case 'cloth-flap': case 'cloth-unroll': noise(c,t,.22,.035,700); break;
      case 'peg': tone(c,'triangle',1200,700,t,.05,.07); noise(c,t,.02,.06,3800); break;
      case 'medal-clink': case 'card-clack': tone(c,'sine',2900,0,t,.16,.05); tone(c,'sine',3700,0,t+.03,.12,.03); break;
      case 'paper-rustle': noise(c,t,.16,.04,2600); break;
      case 'machine': tone(c,'sawtooth',62,58,t,.9,.03); noise(c,t,.6,.02,400); break;
      case 'splash': noise(c,t,.25,.06,1300); break;
      case 'shutter': noise(c,t,.03,.09,4000); noise(c,t+.08,.03,.07,3000); break;
      case 'meow': tone(c,'sine',700,520,t,.32,.05); break;
    }
  }catch(e){}
  DET = 1;
}
function sfxf(name){ sfx(name); }   // sfx/<name>.mp3 when the CC0 files land (GDD 9); the synth tone until then
var synthVoice = {};
function defaultSpeak(text, o){
  return new Promise(function(res){
    var g = G, est = (400 + 330 * words(text)) * (g ? g.pace : 1);
    var t = setTimeout(res, Math.max(60, est * 1.6));
    if(!g || g.tts === false || !W.speechSynthesis || !W.SpeechSynthesisUtterance){ clearTimeout(t); setTimeout(res, Math.max(40, est)); return; }
    try{
      var ss = W.speechSynthesis;
      if(o.interrupt) ss.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var lang = o.lang === 'es' ? 'es-ES' : 'en-GB';
      u.lang = lang; u.rate = o.rate || 0.95;
      var v = synthVoice[lang];
      if(v === undefined){ v = (ss.getVoices() || []).filter(function(x){ return x.lang && x.lang.replace('_','-').indexOf(lang.slice(0, 2)) === 0; })[0] || null; if(v) synthVoice[lang] = v; }
      if(v) u.voice = v;
      u.onend = u.onerror = function(){ clearTimeout(t); res(); };
      ss.speak(u);
    }catch(e){ clearTimeout(t); res(); }
  });
}
function speak(text, o){
  o = o || {};
  if(!G || !text) return Promise.resolve();
  var p;
  try{ p = G.host.speak ? G.host.speak(text, {lang:G.lang, who:o.who, rate:o.rate || (G.band === 'A1' ? 0.9 : 1), interrupt:!!o.interrupt}) : defaultSpeak(text, {lang:G.lang, rate:o.rate || (G.band === 'A1' ? 0.9 : 1), interrupt:!!o.interrupt}); }catch(e){ p = null; }
  return Promise.resolve(p).catch(function(){});
}
function stopSpeech(){
  try{ if(G && G.host.stopSpeech) G.host.stopSpeech(); else if(W.speechSynthesis) W.speechSynthesis.cancel(); }catch(e){}
}

/* ============================== time: waits, animations, skip (ported chRun / chSkip) ============================== */
function wait(ms, keep){
  // choreography waits are 0 in reduced motion and while skipping; reading time (keep) is never cut
  return new Promise(function(res, rej){
    var g = G; if(!g || g.dead) return rej(ABORT);
    ms = (ms || 0) * g.pace;
    if(!keep && RM()) ms = 0;
    if((g.skipping && !keep) || ms <= 0) return setTimeout(function(){ g.dead ? rej(ABORT) : res(); }, 0);
    var t;
    var done = function(){ clearTimeout(t); g.waits.delete(done); g.dead ? rej(ABORT) : res(); };
    t = setTimeout(done, ms);
    g.waits.add(done);
  });
}
function run(node, frames, opts){
  return new Promise(function(res){
    if(!node || !node.animate || RM() || !G || G.skipping) return res();
    var a;
    try{ a = node.animate(frames, Object.assign({easing:'ease-out', fill:'none'}, opts)); }catch(e){ return res(); }
    var g = G; g.anims.add(a);
    a.onfinish = a.oncancel = function(){ g.anims.delete(a); res(); };
  });
}
// fire-and-forget animation that is NOT finished by skip (loops, readouts)
function fx(node, frames, opts){ if(!node || !node.animate || RM()) return null; try{ return node.animate(frames, opts); }catch(e){ return null; } }
function skipNow(){
  if(!G || G.skipping) return;
  G.skipping = true;
  G.anims.forEach(function(a){ try{ a.finish(); }catch(e){ try{ a.cancel(); }catch(e2){} } });
  G.waits.forEach(function(f){ f(); });
}

/* ============================== stage: shots, layers, atmos (ported mountScene) ============================== */
function layerOK(Lr){
  if(Lr.bands && Lr.bands.indexOf(G.band) < 0) return false;
  if(Lr.notBands && Lr.notBands.indexOf(G.band) >= 0) return false;
  if(Lr.if && !cond(Lr.if)) return false;
  return true;
}
function L(id){ return G && G.shot && G.shot.L[id] || null; }
function H(id){ return G && G.shot && G.shot.H[id] || null; }
function placeBox(n, x, y, w, h){
  n.style.left = x + '%'; n.style.top = y + '%'; n.style.width = w + '%'; if(h != null) n.style.height = h + '%';
  n.dataset.x = x; n.dataset.y = y; n.dataset.w = w; if(h != null) n.dataset.h = h;
}
function tintOf(t){ var v = memGet(t.key); if(Array.isArray(v)) v = v[0]; return ((t.set || {})[v] || {}).fill || null; }
function mountLayer(host, Lr, reg, opts){
  opts = opts || {};
  var d = el('div', 'oh-layer' + (Lr.anim ? ' oh-' + Lr.anim : '') + (Lr.hidden ? ' oh-gone' : ''));
  d.dataset.oh = Lr.id;
  if(Lr.in) d.dataset.in = Lr.in;
  if(Lr.item) d.dataset.item = Lr.item;
  d.dataset.mat = Lr.mat || MAT_OF[Lr.item] || 'food';
  placeBox(d, Lr.x, Lr.y, Lr.w, Lr.h);
  d.style.zIndex = Lr.z == null ? 5 : Lr.z;
  if(Lr.origin) d.style.transformOrigin = Lr.origin;
  if(Lr.composite){ d.classList.add('oh-comp'); d.innerHTML = ''; buildComposite(d, Lr.composite, {live:!!Lr.live && !opts.snap, boxed:!!Lr.boxed, from:Lr.from}, reg); }
  else d.innerHTML = artHtml(Lr.art || Lr.id, {tint:Lr.tint ? tintOf(Lr.tint) : null});
  d.dataset.art = Lr.art || '';
  if(Lr.word && (G.band === 'A1' || isPictured(Lr.word)) && !opts.snap){
    var gl = objGloss(Lr.word);
    d.insertAdjacentHTML('beforeend', '<span class="oh-word" lang="' + G.lang + '">' + esc(objWord(Lr.word)) + (gl ? '<small dir="' + uiDir() + '" lang="' + G.ui + '">' + esc(gl) + '</small>' : '') + '</span>');
  }
  if(Lr.item && G.band === 'A1' && !opts.snap && !Lr.word && !Lr.noWord && !/^egg/.test(Lr.id) && Lr.item !== 'tin'){
    var g2 = objGloss(Lr.item);
    d.insertAdjacentHTML('beforeend', '<span class="oh-word" lang="' + G.lang + '">' + esc(objWord(Lr.item)) + (g2 ? '<small dir="' + uiDir() + '" lang="' + G.ui + '">' + esc(g2) + '</small>' : '') + '</span>');
  }
  if(Lr.find && !opts.snap && curioDefs().some(function(c){ return c.id === Lr.find.id; })) mountFind(d, Lr.find);
  if(Lr.label){
    d.classList.add('oh-labelled');
    d.addEventListener('click', function(e){ if(G && !G.dragging){ e.stopPropagation(); labelTap(Lr); } });
  }
  host.appendChild(d);
  reg[Lr.id] = d;
  return d;
}
function mountShot(sdef, skey, opts){
  opts = opts || {};
  var shot = {def:sdef, key:skey, L:{}, H:{}, ui:[]};
  var wrap = el('div', 'oh-shot oh-k-' + sdef.kind + (sdef.blur ? ' oh-blur' : ''));
  var cam = el('div', 'oh-cam');
  cam.style.transformOrigin = sdef.origin || '50% 50%';
  var plate = el('div', 'oh-plate', plateHtml(sdef.plate));
  plate.dataset.oh = 'plate';
  cam.appendChild(plate);
  (sdef.layers || []).forEach(function(Lr){ if(layerOK(Lr)) mountLayer(cam, Lr, shot.L, opts); });
  (sdef.atmos || []).forEach(function(A){ mountAtmos(cam, A, shot.L); });
  if(!opts.snap) (sdef.hots || []).forEach(function(Hd){   // polaroids have no hot zones (and no nested buttons)
    if(!layerOK(Hd)) return;
    var b = el('button', 'oh-hot'); b.type = 'button';
    b.dataset.ohHot = Hd.id;
    b.style.left = Hd.x + '%'; b.style.top = Hd.y + '%'; b.style.width = Hd.w + '%'; b.style.height = Hd.h + '%';
    b.setAttribute('aria-label', Hd.label || Hd.id); b.tabIndex = -1;
    cam.appendChild(b); shot.H[Hd.id] = b;
  });
  wrap.appendChild(cam);
  shot.el = wrap; shot.cam = cam;
  if(opts.snap) applySnap(shot, opts.snap);
  return shot;
}
function mountAtmos(host, A, reg){
  var d;
  if(A.t === 'rain'){
    var h = host;
    if(A.clip){ h = el('div', 'oh-clip'); placeBox(h, A.clip.x, A.clip.y, A.clip.w, A.clip.h); h.style.zIndex = A.z || 1; host.appendChild(h); }
    ['far', 'near'].forEach(function(k){ var r = el('div', 'oh-rain oh-rain-' + k); if(!A.clip) r.style.zIndex = A.z || 40; h.appendChild(r); });
    if(A.id) reg[A.id] = h;
    return;
  }
  if(A.t === 'warm' || A.t === 'tint'){
    d = el('div', 'oh-wash oh-' + A.t + (A.hidden ? ' oh-gone' : ''));
    var col = A.col || '255,196,94';
    d.style.zIndex = A.z || 31;
    d.style.background = 'radial-gradient(ellipse ' + (A.rx || 40) + '% ' + (A.ry || 34) + '% at ' + A.x + '% ' + A.y + '%, rgba(' + col + ',' + (A.i || .5) + ') 0%, rgba(' + col + ',0) 70%)';
  } else if(A.t === 'sun'){
    d = el('div', 'oh-wash oh-sun' + (A.hidden ? ' oh-gone' : ''));
    d.style.zIndex = A.z || 32;
    if(A.op != null) d.style.opacity = A.op;
  } else if(A.t === 'flour'){
    d = el('div', 'oh-group' + (A.hidden ? ' oh-gone' : ''));
    d.style.zIndex = A.z || 34;
  } else if(A.t === 'motes'){
    for(var i = 0; i < (A.n || 7); i++){
      var m = el('div', 'oh-mote');
      m.style.left = (A.x + Math.random() * (A.w || 16)) + '%'; m.style.top = (A.y + Math.random() * (A.h || 22)) + '%';
      if(A.col) m.style.background = A.col;
      m.style.zIndex = A.z || 34;
      m.style.animationDelay = (Math.random() * 6).toFixed(2) + 's';
      m.style.animationDuration = (5 + Math.random() * 4).toFixed(1) + 's';
      host.appendChild(m);
    }
    return;
  } else if(A.t === 'steam'){
    d = el('div', 'oh-group' + (A.hidden ? ' oh-gone' : ''));
    d.style.zIndex = A.z || 20;
    for(var j = 0; j < (A.n || 3); j++){
      var s = el('div', 'oh-steam');
      s.style.left = (A.x + j * 1.6) + '%'; s.style.top = A.y + '%'; s.style.width = (A.w || 5) + '%';
      s.style.animationDuration = (2.6 + j * .5) + 's'; s.style.animationDelay = (j * .7) + 's';
      d.appendChild(s);
    }
  } else if(A.t === 'dark'){
    return;   // retired in this game (GDD 12): the lint rejects it, the engine ignores it
  }
  if(!d) return;
  if(A.id){ d.dataset.oh = A.id; reg[A.id] = d; }
  host.appendChild(d);
}
// layer state for polaroids and resume: which layers show, which art, where
function snapShot(shot){
  var s = {k:shot.key, l:{}};
  Object.keys(shot.L).forEach(function(id){
    var n = shot.L[id];
    s.l[id] = [n.classList.contains('oh-gone') ? 0 : 1, n.dataset.art || '', +n.dataset.x, +n.dataset.y];
  });
  return s;
}
function applySnap(shot, s){
  Object.keys(s.l || {}).forEach(function(id){
    var n = shot.L[id], v = s.l[id]; if(!n) return;
    n.classList.toggle('oh-gone', !v[0]);
    if(v[1] && v[1] !== n.dataset.art && !n.classList.contains('oh-comp')){ n.innerHTML = artHtml(v[1]); n.dataset.art = v[1]; }
    if(!isNaN(v[2])){ n.style.left = v[2] + '%'; n.dataset.x = v[2]; }
    if(!isNaN(v[3])){ n.style.top = v[3] + '%'; n.dataset.y = v[3]; }
  });
}

/* ---------- composites: the thing the learner made, drawn from memory (cake, bouquet, washing line, street plan, table) ---------- */
// a ring is n anchors on a circle (r, start or arc), or explicit points (pts: [[x, y], ...]), in % of the composite box
function ringAnchors(ring){
  if(ring.pts) return ring.pts.map(function(p){ return {x:p[0], y:p[1]}; });
  var out = [], n = ring.n, i, a;
  for(i = 0; i < n; i++){
    if(ring.arc) a = ring.arc[0] + (ring.arc[1] - ring.arc[0]) * (n === 1 ? .5 : i / (n - 1));
    else a = (ring.start || 0) + 360 * i / n;
    var r = a * Math.PI / 180;
    out.push({x:50 + ring.r * Math.cos(r), y:50 + (ring.ry || ring.r) * Math.sin(r)});
  }
  return out;
}
// C.palette = {key:'<mem key>', set:{value:{cream, pipe, fill}}}; the cake's default is P.colours by cake.colour
function colourSet(C){
  var pal = C && C.palette;
  if(pal){ var v = memGet(pal.key); return pal.set[v] || pal.set[pal.none || 'none'] || {cream:'#fffaf0', pipe:'#d27a4a', fill:'#fffaf0'}; }
  var c = memGet('cake.colour'); return (G.P.colours || {})[c] || (G.P.colours || {}).none || {cream:'#fffaf0', pipe:'#d27a4a'};
}
function compItems(C, o){
  // what was placed: this round's store, or (o.from) what the learner made in another project, kept in house.made at delivery
  var st = C.store || 'decorate';
  if(o && o.from){ var mk = (G.house.made || {})[o.from]; return (mk && mk.items) || {}; }
  return G.round.items[st] || {};
}
function buildComposite(host, cid, o, reg){
  var C = (G.P.composites || {})[cid]; if(!C) return;
  o = o || {};
  host.dataset.comp = cid;
  var cs = colourSet(C);
  (C.parts || []).forEach(function(p){
    if(p.if && !cond(p.if)) return;
    var d = el('div', 'oh-cpart' + (p.hidden && o.live ? ' oh-gone' : ''));
    d.dataset.part = p.id; d.dataset.art = p.art;
    d.style.left = p.box[0] + '%'; d.style.top = p.box[1] + '%'; d.style.width = p.box[2] + '%'; d.style.height = p.box[3] + '%';
    if(p.rot) d.style.transform = 'rotate(' + p.rot + 'deg)';
    var tint = p.tint === 'cream' ? cs.cream : p.tint === 'fill' ? (cs.fill || cs.cream) : null;
    d.innerHTML = artHtml(p.art, {tint:tint});
    if(p.tint) d.dataset.tint = p.tint;
    host.appendChild(d);
    if(reg) reg[cid + '.' + p.id] = d;
  });
  var anch = el('div', 'oh-canchors'); host.appendChild(anch);
  if(!o.live){
    // rebuild what the learner made (polaroids, the box, the doorstep, the party table, the souvenir)
    var items = compItems(C, o);
    Object.keys(C.rings || {}).forEach(function(rk){
      var ring = C.rings[rk];
      var list = items[rk] || [];
      var A = ringAnchors(ring);
      list.forEach(function(it){ if(A[it.a]) host.appendChild(placedPiece(ring, A[it.a], it.art)); });
    });
    var pw = items.pipes || {};
    Object.keys(pw).forEach(function(sk){ var sv = (C.surfaces || {})[sk]; if(sv) host.appendChild(pipeSvg(sv, pw[sk], pw[sk].length, true, C)); });
    if(o.boxed){ host.classList.add('oh-boxed'); host.insertAdjacentHTML('beforeend', '<div class="oh-cpart oh-boxlid" style="left:-14%;top:-14%;width:128%;height:128%">' + artHtml('co-box-closed') + '</div>' +
      '<div class="oh-cpart" style="left:-14%;top:20%;width:128%;height:50%">' + artHtml('co-ribbon') + '</div>'); }
  }
}
function placedPiece(ring, at, art){
  var p = el('div', 'oh-piece', artHtml(art));
  var sw = ring.size[0], sh = ring.size[1];
  p.style.width = sw + '%'; p.style.height = sh + '%';
  p.style.left = (at.x - sw / 2) + '%';
  p.style.top = (ring.foot ? at.y - sh : at.y - sh / 2) + '%';
  return p;
}
function pipeSvg(sv, word, shown, done, C){
  var n = Math.max(word.length, 1), vbw = n * 60;
  var col = colourSet(C).pipe;
  var svg = '<svg class="oh-pipe" viewBox="0 0 ' + vbw + ' 80" preserveAspectRatio="xMidYMid meet" style="left:' + sv.x + '%;top:' + sv.y + '%;width:' + sv.w + '%;height:' + sv.h + '%">';
  for(var i = 0; i < n; i++){
    svg += '<text x="' + (30 + i * 60) + '" y="64" text-anchor="middle" class="oh-pl' + (i < shown ? (done ? ' oh-pl-on' : '') : ' oh-pl-off') + '" data-i="' + i + '" style="fill:' + col + ';stroke:' + col + '">' + esc(word.charAt(i)) + '</text>';
  }
  var w = el('div', 'oh-pipebox'); w.innerHTML = svg + '</svg>';
  return w;
}

/* ============================== camera (GDD 4.3: wide two close top pov; the camera never moves during a gesture) ============================== */
function camEnter(shot, prev){
  var k = shot.def.kind, cam = shot.cam, rm = RM();
  G.frame.insertBefore(shot.el, G.uiLayer);
  var p = [];
  if(!rm && prev){
    if(k === 'close'){
      p.push(run(prev.cam, [{transform:'scale(1)'}, {transform:'scale(1.18)'}], {duration:600, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'}));
      p.push(run(shot.el, [{opacity:0}, {opacity:1}], {duration:600, easing:'ease-out'}));
    } else {
      p.push(run(shot.el, [{opacity:0}, {opacity:1}], {duration:240, easing:'ease-out'}));
    }
  }
  if(!rm && k === 'wide') p.push(run(cam, [{transform:'scale(1.04)'}, {transform:'scale(1)'}], {duration:520, delay:prev ? 200 : 0, easing:'ease-out', fill:'backwards'}));
  return Promise.all(p).then(function(){
    if(prev && prev.el.parentNode) prev.el.remove();
    if(rm || !G) return;
    // idle motion: wide drifts once over 14 s, pov pushes once over 5 s; both are frozen when a gesture starts
    var push = shot.def.push || (k === 'pov' ? [1, 1.08, 5000] : k === 'wide' ? [1, 1.04, 14000] : null);
    if(push){
      try{ G.camAnim = cam.animate([{transform:'scale(' + push[0] + ')'}, {transform:'scale(' + push[1] + ')'}], {duration:push[2] * (k === 'pov' ? 1 : 1), easing:k === 'pov' ? EASE : 'linear', fill:'forwards'}); }catch(e){}
    }
  });
}
function camStill(){
  var a = G && G.camAnim; if(!a) return;
  try{ if(a.playState === 'running'){ a.pause(); } }catch(e){}
}
function camRect(){ return rect(G.shot.cam); }
function camScale(){ var cr = camRect(); return cr.width / (G.shot.cam.offsetWidth || cr.width); }
// screen px -> % of the cam box (the plate's own coordinates, whatever the camera did)
function toPct(x, y){ var r = camRect(); return {x:(x - r.left) / r.width * 100, y:(y - r.top) / r.height * 100}; }
function frameRect(){ return rect(G.frame); }
function tolPx(){ return Math.max(frameRect().width * 0.09, 32); }

/* ============================== VERB: the closed motion vocabulary (ported + new) ============================== */
var FACE = {laugh:'warm', smile:'warm', relief:'warm', amused:'warm', proud:'warm', wry:'warm', arch:'warm', happy:'warm',
  worried:'oh', horror:'oh', sheepish:'oh', tearful:'oh', surprised:'oh'};
var VERB = {
  moveTo:function(id, x, ms){
    // the layer lands at its new left at once and a transform carries it there (FLIP: transform only, never layout)
    var n = L(id); if(!n) return;
    var from = parseFloat(n.dataset.x);
    n.style.left = x + '%'; n.dataset.x = x;
    if(Math.abs(from - x) <= .4) return;
    var w = n.parentNode ? n.parentNode.offsetWidth : 0, dx = (from - x) / 100 * w;
    return run(n, [{transform:'translateX(' + dx + 'px)'}, {transform:'translateX(0)'}], {duration:ms || Math.max(380, Math.abs(x - from) * 22), easing:'ease-in-out'});
  },
  work:function(id, beats){
    var n = L(id); if(!n || RM() || G.skipping) return;
    return run(n, [{transform:'rotate(0) translateY(0)'}, {transform:'rotate(6deg) translateY(1.6%)', offset:.5}, {transform:'rotate(0) translateY(0)'}], {duration:440, iterations:beats || 3});
  },
  lift:function(id){ var n = L(id); if(!n) return;
    return run(n, [{transform:'translateY(0) scale(1)', opacity:1}, {transform:'translateY(-13%) scale(.84)', opacity:0}], {duration:380}).then(function(){ n.classList.add('oh-gone'); }); },
  tuckAway:function(id){ var n = L(id); if(!n) return;
    return run(n, [{transform:'translateY(0)', opacity:1}, {transform:'translateY(24%)', opacity:0}], {duration:340, easing:'ease-in'}).then(function(){ n.classList.add('oh-gone'); }); },
  appear:function(id){ var n = L(id); if(!n) return; n.classList.remove('oh-gone');
    if(n.classList.contains('oh-wash') || n.classList.contains('oh-group')) return wait(380);
    return run(n, [{transform:'scale(.86)', opacity:0}, {transform:'scale(1.04)', opacity:1, offset:.7}, {transform:'scale(1)', opacity:1}], {duration:420, easing:SPRING}); },
  swapTo:function(a, b){
    // a door, lid or box: closed -> open with a 3 % scale bump in 120 ms (GDD 9)
    var na = L(a), nb = L(b); if(!na || !nb) return;
    nb.classList.remove('oh-gone'); na.classList.add('oh-gone');
    return run(nb, [{transform:'scale(1)', opacity:.4}, {transform:'scale(1.03)', opacity:1, offset:.5}, {transform:'scale(1)', opacity:1}], {duration:160, easing:'ease-out'});
  },
  shake:function(id){ var n = L(id); if(!n || n.classList.contains('oh-gone')) return;
    return run(n, [{transform:'translateX(0)'}, {transform:'translateX(-3%) rotate(-3deg)'}, {transform:'translateX(3%) rotate(3deg)'}, {transform:'translateX(0)'}], {duration:260, easing:'linear'}); },
  burst:function(x, y, n, color, rise){
    if(RM() || !G.shot) return;
    var host = G.shot.cam, r = rect(host);
    for(var i = 0; i < (n || 8); i++){
      var s = el('div', 'oh-spark');
      s.style.left = (x + (Math.random() * 7 - 3.5)) + '%'; s.style.top = y + '%';
      if(color) s.style.background = 'radial-gradient(circle,' + color + ' 0 42%,transparent 72%)';
      var z = 6 + Math.random() * 7; s.style.width = s.style.height = z + 'px';
      host.appendChild(s);
      var dx = (Math.random() * 2 - 1) * r.width * .085, dy = -(rise || .18) * r.height * (.6 + Math.random() * .8);
      var a = fx(s, [{transform:'translate(0,0) scale(.5)', opacity:0}, {transform:'translate(' + dx * .5 + 'px,' + dy * .5 + 'px) scale(1)', opacity:.95, offset:.35}, {transform:'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity:0}], {duration:900 + Math.random() * 500, easing:'ease-out'});
      if(a) a.onfinish = (function(q){ return function(){ q.remove(); }; })(s); else s.remove();
    }
  },
  say:function(text){ return caption(text); },
  lightUp:function(id){ var n = L(id); if(!n) return; n.classList.remove('oh-gone'); return run(n, [{opacity:0}, {opacity:1}], {duration:600}); },
  wait:function(ms){ return wait(ms); },
  sfx:function(name){ sfx(name); },
  /* ---- new (GDD 4.1) ---- */
  line:function(who, role){ return sayRole(role); },
  face:function(who, expr){
    // the portraits have 3 expressions (GDD 8): calm, warm, oh; the content's moods map onto them
    expr = FACE[expr] || expr;
    var c = (G.P.cast || {})[who]; if(!c) return;
    Object.keys(G.shot.L).forEach(function(id){
      var n = G.shot.L[id];
      if(n.dataset.art && n.dataset.art.indexOf(c.face + '-') === 0) VERB.pose(id, c.face + '-' + expr);
    });
  },
  pose:function(id, art){
    var n = L(id); if(!n || n.dataset.art === art) return;
    var keep = n.querySelector('.oh-word');
    n.innerHTML = artHtml(art); if(keep) n.appendChild(keep);
    n.dataset.art = art;
    return run(n, [{opacity:.55}, {opacity:1}], {duration:200});
  },
  cam:function(scale, x, y, ms){
    var cam = G.shot.cam;
    cam.style.transformOrigin = x + '% ' + y + '%';
    return run(cam, [{transform:getComputedStyle(cam).transform === 'none' ? 'scale(1)' : getComputedStyle(cam).transform}, {transform:'scale(' + scale + ')'}], {duration:ms || 600, easing:EASE, fill:'forwards'})
      .then(function(){ cam.style.transform = 'scale(' + scale + ')'; });
  },
  note:function(key){ return noteAdd(key); },
  photo:function(){ return flash(); },
  lapse:function(ids, ms, glowId){
    // a time-lapse swap through the states, the glow pulsing (GDD 9: 6000 ms); reduced motion jumps to the end state
    var glow = glowId ? L(glowId) : null, step = (ms || 6000) / ids.length;
    if(glow && !RM()) fx(glow, [{opacity:1}, {opacity:1.7}, {opacity:1}], {duration:ms || 6000, easing:'ease-in-out'});
    var p = Promise.resolve();
    ids.forEach(function(id, i){
      p = p.then(function(){
        if(i > 0){ var a = L(ids[i - 1]); if(a) a.classList.add('oh-gone'); }
        var n = L(id); if(n){ n.classList.remove('oh-gone'); }
        return n ? run(n, [{opacity:.3, transform:'scaleY(.92)'}, {opacity:1, transform:'scaleY(1)'}], {duration:380}) : null;
      }).then(function(){ return wait(step); });
    });
    return p;
  },
  sfxf:function(name){ sfxf(name); },
  open:function(closedId, openId, instant){
    var c = L(closedId), o = L(openId); if(!c || !o) return;
    var reveal = function(){
      Object.keys(G.shot.L).forEach(function(id){
        var n = G.shot.L[id]; if(n.dataset.in === closedId) n.classList.remove('oh-gone');
      });
    };
    if(instant){ c.classList.add('oh-gone'); o.classList.remove('oh-gone'); reveal(); return; }
    sfx('door');
    return VERB.swapTo(closedId, openId).then(function(){
      reveal();
      var kids = Object.keys(G.shot.L).filter(function(id){ return G.shot.L[id].dataset.in === closedId; });
      return Promise.all(kids.map(function(id, i){ return run(G.shot.L[id], [{transform:'translateY(6%) scale(.92)', opacity:0}, {transform:'none', opacity:1}], {duration:300, delay:i * 40, easing:SPRING, fill:'backwards'}); }));
    });
  },
  ring:function(id, on){ var n = L(id); if(!n) return; n.classList.toggle('oh-ringing', !!on); if(on){ sfx('ring'); motionLines(n); } },
  tint:function(id){
    var n = L(id); if(!n) return;
    var cs = colourSet((G.P.composites || {})[n.dataset.comp]);
    n.querySelectorAll('[data-tint]').forEach(function(p){ p.innerHTML = artHtml(p.dataset.art, {tint:p.dataset.tint === 'fill' ? (cs.fill || cs.cream) : cs.cream}); });
  },
  bump:function(id){ var n = L(id); if(!n) return; n.classList.add('oh-picked');
    return run(n, [{transform:'translateY(0)'}, {transform:'translateY(-16%) rotate(-6deg)'}, {transform:'translateY(-10%) rotate(-4deg)'}], {duration:420, easing:SPRING, fill:'forwards'}).then(function(){ n.style.transform = 'translateY(-10%) rotate(-4deg)'; }); },
  squash:function(id){ var n = L(id); if(!n) return; return land(n); },
  motion:function(id){ var n = L(id); if(n) motionLines(n); },
  atmos:function(id, op){ var n = L(id); if(!n) return; n.classList.remove('oh-gone'); n.style.opacity = op == null ? '' : op; },
  mem:function(k, v){ memSet(k, v); },
  toNote:function(id){
    // the order pad flies to the top right and becomes the order note (S1)
    var n = L(id); if(!n) return;
    var btn = G.noteBtn; btn.classList.add('oh-on');
    var a = rect(n), b = rect(btn), s = camScale();
    var dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / s, dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / s;
    sfx('paper');
    return run(n, [{transform:'none', opacity:1}, {transform:'translate(' + dx * .5 + 'px,' + (dy * .5 - 40) + 'px) rotate(-8deg) scale(.9)', opacity:1, offset:.55}, {transform:'translate(' + dx + 'px,' + dy + 'px) rotate(6deg) scale(.4)', opacity:0}], {duration:620, easing:'cubic-bezier(.5,0,.3,1)'})
      .then(function(){ n.classList.add('oh-gone'); G.round.noteOn = true; return run(btn, [{transform:'scale(.6) rotate(-10deg)', opacity:0}, {transform:'scale(1.08) rotate(3deg)', opacity:1, offset:.7}, {transform:'none', opacity:1}], {duration:420, easing:SPRING}); });
  }
};
async function runSteps(steps){
  var pend = [];
  for(var i = 0; i < (steps || []).length; i++){
    live();
    var s = steps[i], v = s[0], a = s.slice(1), bg = false;
    if(v.charAt(0) === '&'){ bg = true; v = v.slice(1); }
    if(v === 'join'){ await Promise.all(pend.splice(0)); continue; }
    if(v === 'loop'){ for(var k = 0; k < a[0]; k++) await runSteps(a[1]); continue; }
    if(!VERB[v]) continue;
    var p = Promise.resolve(VERB[v].apply(null, a));
    if(bg) pend.push(p); else await p;
  }
  await Promise.all(pend);
}
// CZ4 (GDD 13.2): every draggable has a material; the landing curve and the feel follow it (A Little to the Left)
var MAT_OF = {egg:'food', flour:'heavy', sugar:'food', butter:'food', cocoa:'glass', jam:'glass', salt:'glass', onion:'food', fish:'soft',
  tin:'heavy', box:'heavy', strawberry:'light', blueberry:'light', candle:'light', letter:'light', phone:'heavy', cream:'soft'};
var LAND = {
  light:{f:[{transform:'scale(1,1)'}, {transform:'scale(1.10,.92)', offset:.35}, {transform:'scale(.97,1.03)', offset:.7}, {transform:'scale(1,1)'}], ms:260},
  food:{f:[{transform:'scale(1,1)'}, {transform:'scale(1.06,.94)', offset:.4}, {transform:'scale(.98,1.03)', offset:.75}, {transform:'scale(1,1)'}], ms:220},
  glass:{f:[{transform:'scale(1,1)'}, {transform:'scale(1.03,.98)', offset:.5}, {transform:'scale(1,1)'}], ms:180},
  heavy:{f:[{transform:'scale(1,1)'}, {transform:'scale(1.02,.98)', offset:.5}, {transform:'scale(1,1)'}], ms:160},
  soft:{f:[{transform:'scale(1,1)'}, {transform:'scale(.94,1.04)', offset:.45}, {transform:'scale(1,1)'}], ms:300}
};
var lastBuzz = 0;
function land(n, mat){
  mat = mat || (n && n.dataset && n.dataset.mat) || 'food';
  var L0 = LAND[mat] || LAND.food;
  sfx('land-' + mat);
  if(mat === 'heavy'){
    if(Date.now() - lastBuzz > 300){ lastBuzz = Date.now(); try{ if(G.host.buzz) G.host.buzz([8]); else if(navigator.vibrate) navigator.vibrate([8]); }catch(e){} }
    if(G.shot && G.shot.cam) run(G.shot.cam, [{transform:'translateY(0)'}, {transform:'translateY(1px)'}, {transform:'translateY(-1px)'}, {transform:'translateY(1px)'}, {transform:'translateY(0)'}], {duration:160});
  }
  return run(n, L0.f, {duration:L0.ms, easing:mat === 'heavy' ? 'ease-out' : SPRING});
}
function motionLines(n){
  if(RM() || !n || !G.uiLayer) return;
  var r = rect(n), f = frameRect();
  var m = el('div', 'oh-mlines', '<svg viewBox="0 0 30 30"><path d="M4 8l7 3M3 16h8M4 24l7-3"/></svg>');
  m.style.left = (r.left - f.left - 26) + 'px'; m.style.top = (r.top - f.top + r.height / 2 - 15) + 'px';
  G.uiLayer.appendChild(m);
  var a = fx(m, [{opacity:0, transform:'translateX(6px)'}, {opacity:1, transform:'none', offset:.3}, {opacity:0, transform:'translateX(-4px)'}], {duration:520, easing:'ease-out'});
  if(a) a.onfinish = function(){ m.remove(); }; else m.remove();
}

/* ============================== dock: speech balloon, captions, cue ============================== */
function faceHtml(who){
  var c = (G.P.cast || {})[who];
  if(who === 'you') return '<span class="oh-face oh-face-you" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zm-7.5 8c.6-3.9 3.7-6.3 7.5-6.3s6.9 2.4 7.5 6.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>';
  if(!c) return '';
  var m = man(c.face + '-warm') || man(c.face + '-calm') || man(c.face + '-sit');
  var inner = m && m.ready ? '<img src="' + esc(artUrl(m)) + '" alt="">' : '<i class="oh-face-ph"></i>';
  return '<span class="oh-face" style="--hue:' + esc(c.hue || '#7C93FF') + '" aria-hidden="true">' + inner + '</span>';
}
function showGloss(){ return G.band === 'A1' || G.glossOn; }
function balloon(o){
  // o: {who, text, gloss, phone, kind:'line'|'caption'|'cue'}
  var say = G.say;
  // a Captain label or a curio caption has no speaker: never a balloon with an empty name
  var kind = o.kind || (o.who === 'card' || o.who === 'ui' || o.who === 'tts' || o.who === 'narr' || o.who === 'fact' ? 'caption' : 'line');
  var html, marked = !!(o.marks && o.marks.length), glossShown = showGloss() || marked;
  var chip = o.pic && o.pic.length ? '<div class="oh-linepics">' + o.pic.map(function(k){ return '<figure class="oh-linepic">' + picArt(k) + picWord(k) + '</figure>'; }).join('') + '</div>' : '';
  if(kind === 'caption'){
    html = '<div class="oh-caption"><p class="oh-ctext" lang="' + G.lang + '" dir="ltr">' + glossMark(esc(o.text), o.marks) + '</p>' +
      (o.gloss ? '<p class="oh-gloss' + (glossShown ? '' : ' oh-hide') + '" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(o.gloss) + '</p>' : '') + '</div>';
  } else {
    var you = o.who === 'you';
    html = '<div class="oh-line' + (you ? ' oh-you' : '') + (o.phone ? ' oh-phone' : '') + '">' + faceHtml(o.who) +
      '<div class="oh-balloon"><span class="oh-name">' + esc(castName(o.who)) + (o.phone ? ' <i>' + esc(U('phone')) + '</i>' : '') + '</span>' +
      '<p class="oh-text" lang="' + G.lang + '" dir="ltr">' + glossMark(esc(o.text), o.marks) + '</p>' +
      (o.gloss ? '<p class="oh-gloss' + (glossShown ? '' : ' oh-hide') + '" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(o.gloss) + '</p>' : '') +
      '<span class="oh-tools">' +
        (o.gloss && G.band !== 'A1' ? '<button type="button" class="oh-tool oh-gl-btn" aria-pressed="' + (G.glossOn ? 'true' : 'false') + '" aria-label="' + esc(U('gloss')) + '"><svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 4v2c0 4-2 7-4.5 8.5M6 10c1.2 2 3 3.4 5 4" /><path d="M13 20l4-9 4 9M14.4 17h5.2"/></svg></button>' : '') +
        '<button type="button" class="oh-tool oh-re-btn" aria-label="' + esc(U('hear')) + '"><svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6"/></svg></button>' +
      '</span></div>' + chip + '</div>';
  }
  say.innerHTML = html;
  var node = say.firstChild;
  node.dataset.text = o.text;
  var re = node.querySelector('.oh-re-btn');
  if(re) re.addEventListener('click', function(e){ e.stopPropagation(); speak(o.text, {who:o.who, interrupt:true}); });
  var gb = node.querySelector('.oh-gl-btn');
  if(gb) gb.addEventListener('click', function(e){
    e.stopPropagation(); G.glossOn = !G.glossOn; gb.setAttribute('aria-pressed', G.glossOn ? 'true' : 'false');
    var g = node.querySelector('.oh-gloss'); if(g) g.classList.toggle('oh-hide', !G.glossOn);
  });
  if(chip && !RM()) node.querySelectorAll('.oh-linepic').forEach(function(p){ fx(p, [{transform:'scale(.8)', opacity:0}, {transform:'scale(1)', opacity:1}], {duration:160, easing:EASE}); });
  if(!RM()) fx(node, [{opacity:0, transform:'translateY(8px) scale(.98)'}, {opacity:1, transform:'none'}], {duration:260, easing:EASE});
  return node;
}
function talkPulse(who){
  // the speaker's cut-out in the scene breathes a little and ink motion lines flick beside it
  if(!G.shot) return;
  var c = (G.P.cast || {})[who]; if(!c) return;
  Object.keys(G.shot.L).forEach(function(id){
    var n = G.shot.L[id];
    if(n.dataset.art && n.dataset.art.indexOf(c.face + '-') === 0 && !n.classList.contains('oh-gone')){
      fx(n, [{transform:'translateY(0)'}, {transform:'translateY(-1.4%)'}, {transform:'translateY(0)'}], {duration:360, easing:'ease-out'});
    }
  });
}
function readMs(text){ return 500 + 300 * words(text); }
async function lineSay(line, vars, opts){
  opts = opts || {};
  live();
  if(!line) return;
  var text = fill(T(line), line, vars);
  if(!text) return;
  var gloss = fillGloss(GL(line), line, vars);
  var who = line.who;
  var kind = (who === 'card' || who === 'ui' || who === 'tts' || who === 'narr' || who === 'fact') ? 'caption' : 'line';
  balloon({who:who, text:text, gloss:gloss, phone:!!line.phone, kind:kind, pic:linePic(line), marks:glossHit(text)});
  var inEvent = G.status && /^(gesture|ask|reply|recap|produce|recapSpoken|confirm|done)$/.test(G.status.kind);
  if(!inEvent && !opts.hint) G.status = {kind:'line', station:G.sid, text:text};
  G.lastLine = text;
  if(line.face && kind === 'line') VERB.face(who, line.face);
  if(kind === 'line') talkPulse(who);
  var skipped = new Promise(function(res){ if(!opts.hint) G.lineSkip = res; });
  var sp = speak(text, {who:who});
  await Promise.race([Promise.all([sp, wait(readMs(text), true)]), skipped]);
  live();
  if(!opts.hint) G.lineSkip = null;
  if(line.note) await noteAdd(line.note);
  await wait(160);
}
async function sayRole(role){
  var line = lineFor(role);
  if(!line || line.on) return false;
  if(line.if && !cond(line.if)) return false;
  await lineSay(line);
  return true;
}
function caption(text){ balloon({text:text, kind:'caption'}); }
function cue(kind){
  if(!G) return;
  var c = G.cueEl;
  if(!kind){ c.innerHTML = ''; c.classList.remove('oh-on'); return; }
  var icon = {tap:'M12 3v9m0 0l-3-3m3 3l3-3M5 15h14', drag:'M5 12h14m0 0l-4-4m4 4l-4 4', pour:'M8 4h8l-2 6h-4zM12 10v10', stir:'M12 4a8 8 0 108 8', dial:'M12 4a8 8 0 108 8M12 12l4-4', pipe:'M5 19l4-12 4 12M6.5 15h5M15 7v12', place:'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8z', choose:'M5 12l4 4 10-10', ask:'M9 9a3 3 0 115 2c-1 .7-2 1.3-2 3M12 18h.01', reply:'M4 6h16v9H9l-5 4z', story:'M4 6h7v12H4zM13 6h7v12h-7z'}[kind] || '';
  c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + icon + '"/></svg><span>' + esc(U('cue_' + kind)) + '</span>';
  c.classList.add('oh-on');
  if(!RM()) fx(c, [{opacity:0, transform:'translateY(4px)'}, {opacity:1, transform:'none'}], {duration:220, easing:EASE});
}
function controls(html){
  if(!G) return null;
  G.ctl.innerHTML = html || '';
  if(html && !RM()) fx(G.ctl, [{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'none'}], {duration:240, easing:EASE});
  return G.ctl;
}

/* ============================== order note (GDD 4.4) ============================== */
function noteEntry(key){
  var n = (G.V.note || {})[key];
  if(!n) n = (G.P.notes || {})[key];
  return n || null;
}
async function noteAdd(key, o){
  o = o || {};
  var e = noteEntry(key); if(!e) return;
  if(G.round.note.some(function(x){ return x.k === key; })) return;
  G.round.note.push({k:key});
  G.noteBtn.classList.add('oh-on'); G.round.noteOn = true;
  save(true);
  renderNote(key);
  sfx('pencil');
  if(!RM()) fx(G.noteBtn, [{transform:'rotate(0)'}, {transform:'rotate(-9deg) scale(1.1)'}, {transform:'rotate(6deg)'}, {transform:'none'}], {duration:480, easing:SPRING});
  // a quick peek: the note opens for the new entry, then tucks itself away again
  if(!o.quiet){ openNote(key); await wait(1500); if(!o.keepOpen) closeNote(); }
}
function noteStrike(key){
  var x = G.round.note.filter(function(e){ return e.k === key; })[0];
  if(x){ x.s = 1; save(true); renderNote(); }
}
function renderNote(fresh){
  var list = G.noteCard.querySelector('.oh-note-list');
  list.innerHTML = G.round.note.map(function(x){
    var e = noteEntry(x.k); if(!e) return '';
    var gl = G.band === 'A1' && G.ui !== G.lang ? (e[G.ui] || '') : '';
    return '<li class="' + (x.k === fresh ? 'oh-fresh' : '') + (x.s ? ' oh-struck' : '') + '" data-k="' + esc(x.k) + '"><span class="oh-nw" lang="' + G.lang + '" dir="ltr">' + esc(T(e)) + '</span>' +
      (gl ? '<small lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(gl) + '</small>' : '') + '</li>';
  }).join('');
}
function openNote(pulse){
  renderNote(pulse);
  G.noteCard.classList.add('oh-open');
  G.noteCard.setAttribute('aria-hidden', 'false');
  var card = G.noteCard.querySelector('.oh-note-paper');
  if(!RM()) fx(card, [{opacity:0, transform:'translateY(-30px) rotate(-4deg) scale(.7)'}, {opacity:1, transform:'rotate(-1.5deg)'}], {duration:360, easing:SPRING});
  var li = pulse ? G.noteCard.querySelector('li[data-k="' + pulse + '"]') : null;
  if(li){
    var w = li.querySelector('.oh-nw');
    if(w && !RM()) fx(w, [{clipPath:'inset(0 100% 0 0)'}, {clipPath:'inset(0 0 0 0)'}], {duration:400, delay:200, easing:'linear', fill:'backwards'});
    if(pulse && G.pulseNote === pulse && !RM()) fx(li, [{transform:'scale(1)'}, {transform:'scale(1.08)'}, {transform:'scale(1)'}, {transform:'scale(1.08)'}, {transform:'scale(1)'}], {duration:1100, delay:500});
  }
}
function closeNote(){ G.noteCard.classList.remove('oh-open'); G.noteCard.setAttribute('aria-hidden', 'true'); }

/* ============================== station strip + polaroids (GDD 3.4) ============================== */
function renderStrip(){
  G.strip.innerHTML = G.list.map(function(sid, i){
    return '<span class="oh-pol' + (i === G.round.stationIdx ? ' oh-cur' : '') + (G.round.photos.indexOf(sid) >= 0 ? ' oh-dev' : '') + '" data-s="' + sid + '"><span class="oh-pol-img">' +
      (G.round.photos.indexOf(sid) >= 0 ? thumbHtml(sid) : '') + '</span></span>';
  }).join('');
}
function thumbHtml(sid){
  var st = G.P.stations[sid]; if(!st) return '';
  var snap = G.round.snaps[sid];
  var key = (snap && snap.k) || (st.photo && st.photo.shot) || Object.keys(st.shots)[0];
  var sdef = st.shots[key]; if(!sdef) return '';
  var shot = mountShot(sdef, key, {snap:snap || {l:{}}});   // a polaroid always shows the cake as it was made
  shot.el.classList.add('oh-thumbshot');
  var crop = (st.photo && st.photo.crop) || [0, 0, 100, 100];
  // crop = [x, y, w, h] in % of the stage: the full 4:5 shot is laid out larger than the window and offset so the crop fills it
  shot.el.style.left = (-crop[0] / crop[2] * 100) + '%';
  shot.el.style.top = (-crop[1] / crop[3] * 100) + '%';
  shot.el.style.width = (10000 / crop[2]) + '%';
  var box = el('div', 'oh-thumb');
  var dd = (G.round.curios || {})[sid];
  if(dd && dd.length) box.insertAdjacentHTML('beforeend', doodleSvg(dd[0]));
  box.style.aspectRatio = (crop[2] * 4) + ' / ' + (crop[3] * 5);
  box.appendChild(shot.el);
  return box.outerHTML;
}
async function developPolaroid(sid){
  if(G.round.photos.indexOf(sid) < 0) G.round.photos.push(sid);
  var p = G.strip.querySelector('[data-s="' + sid + '"]'); if(!p) return;
  p.querySelector('.oh-pol-img').innerHTML = thumbHtml(sid);
  p.classList.add('oh-dev');
  if(RM()) return;
  fx(p, [{transform:'scale(1)'}, {transform:'scale(1.35) rotate(-4deg)', offset:.25}, {transform:'translateX(-1.5px) scale(1.12)', offset:.45}, {transform:'translateX(1.5px)', offset:.6}, {transform:'translateX(-1.5px)', offset:.75}, {transform:'none'}], {duration:1680, easing:'ease-out'});
  var veil = el('span', 'oh-pol-veil'); p.querySelector('.oh-pol-img').appendChild(veil);
  var a = fx(veil, [{opacity:1}, {opacity:0}], {duration:1600, delay:80, easing:'ease-in', fill:'forwards'});
  if(a) a.onfinish = function(){ veil.remove(); };
}
function flash(){
  sfx('flash');
  if(RM()) return Promise.resolve();
  return run(G.flashEl, [{opacity:0}, {opacity:.95, offset:.12}, {opacity:0}], {duration:520, easing:'ease-out'});
}

/* ============================== hints: h15 / h45 (GDD 4.2) ============================== */
function hints(o){
  // o.h15(), o.h45(on) visuals; the spoken hint is the station's hint line (or o.line)
  // both clocks count from the last correct progress; the hint line is spoken once per gesture, the visuals come back
  var g = G, fired15 = false, guide = false, wrongs = [], t15, t45;
  var ms15 = (g.hintMs && g.hintMs[0]) || 15000, ms45 = (g.hintMs && g.hintMs[1]) || 45000;
  function arm(){
    clearTimeout(t15); clearTimeout(t45);
    if(g.dead || h.off) return;
    t15 = setTimeout(fire15, ms15);
    if(!guide) t45 = setTimeout(fire45, ms45);
  }
  function fire15(){
    if(g.dead || h.off) return;
    if(!fired15){
      fired15 = true;
      var hl = (o.line ? lineFor(o.line) : null) || lineFor('h15');
      // CZ5: the first h15 of a project plays the station line as written; later ones get one of Mrs Bell's lead-ins first
      var n15 = g.round.h15n = (g.round.h15n || 0) + 1;
      var lead = n15 > 1 ? kindLine('h15lead') : null;
      if(hl) (lead ? lineSay(lead, null, {hint:true}).then(function(){ return lineSay(hl, null, {hint:true}); }) : lineSay(hl, null, {hint:true})).catch(function(){});
    }
    try{ o.h15 && o.h15(); }catch(e){}
  }
  function fire45(){ if(g.dead || h.off || guide) return; guide = true; h.guide = true; try{ o.h45 && o.h45(); }catch(e){} }
  var h = {
    guide:false, off:false,
    progress:function(){ wrongs = []; clearFx(); arm(); },
    wrong:function(){ var t = Date.now(); wrongs = wrongs.filter(function(x){ return t - x < 6000; }); wrongs.push(t); if(wrongs.length >= 3){ wrongs = []; fire15(); } },
    stop:function(){ h.off = true; clearTimeout(t15); clearTimeout(t45); clearFx(); },
    force:function(level){ if(level >= 45){ fire15(); fire45(); } else fire15(); }
  };
  g.hint = h;
  arm();
  // CZ6 (GDD 13.3): the first time a gesture type appears in the learner's life, its guide plays once for 1.2 s as a ghost demo
  if(g.demo){ g.demo = false; setTimeout(function(){ if(g.dead || h.off) return; try{ o.h45 && o.h45(); }catch(e){} setTimeout(function(){ if(!g.dead && !h.guide) clearFx(); }, 1200 * Math.max(g.pace, .3)); }, 60); }
  return h;
}
function clearFx(){ if(G && G.uiLayer) G.uiLayer.querySelectorAll('.oh-shim, .oh-finger, .oh-arrow, .oh-ringhint').forEach(function(n){ n.remove(); }); }
function relBox(n){ var r = rect(n), f = frameRect(); return {x:r.left - f.left, y:r.top - f.top, w:r.width, h:r.height}; }
function shimmer(n, round){
  if(!n) return;
  var b = relBox(n), s = el('div', 'oh-shim' + (round ? ' oh-shim-r' : ''));
  s.style.left = (b.x - 6) + 'px'; s.style.top = (b.y - 6) + 'px'; s.style.width = (b.w + 12) + 'px'; s.style.height = (b.h + 12) + 'px';
  G.uiLayer.appendChild(s);
}
function finger(n){
  if(!n) return;
  var b = relBox(n), f = el('div', 'oh-finger', '<svg viewBox="0 0 40 48"><path d="M15 20V7.5a3.5 3.5 0 017 0V19l9.5 2.6c2 .6 3.2 2.6 2.7 4.6L32 37c-.6 2.4-2.8 4-5.2 4H18c-1.6 0-3.1-.8-4-2.1L7 29c-1.1-1.6-.7-3.7.9-4.8 1.4-.9 3.3-.7 4.4.6z"/></svg>');
  f.style.left = (b.x + b.w / 2 - 14) + 'px'; f.style.top = (b.y + b.h / 2 - 6) + 'px';
  G.uiLayer.appendChild(f);
}
function arrow(a, b){
  var A = relBox(a), B = relBox(b), x1 = A.x + A.w / 2, y1 = A.y + A.h / 2, x2 = B.x + B.w / 2, y2 = B.y + B.h / 2;
  var f = frameRect();
  var s = el('div', 'oh-arrow', '<svg width="' + f.width + '" height="' + f.height + '"><path d="M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2) + ' ' + (Math.min(y1, y2) - 40) + ' ' + x2 + ' ' + y2 + '"/><circle cx="' + x2 + '" cy="' + y2 + '" r="7"/></svg>');
  G.uiLayer.appendChild(s);
}

/* ============================== pointer plumbing (touch + mouse; touch-action:none on the stage) ============================== */
function onPress(node, fns){
  // fns: start(e) -> false to refuse, move(e, d), end(e, tap)
  var st = null;
  var down = function(e){
    if(!G || G.dead || (e.button != null && e.button > 0)) return;
    if(fns.start && fns.start(e) === false) return;
    e.preventDefault();
    st = {id:e.pointerId, x:e.clientX, y:e.clientY, t:Date.now(), moved:false};
    try{ node.setPointerCapture(e.pointerId); }catch(err){}
  };
  var move = function(e){
    if(!st || e.pointerId !== st.id) return;
    var dx = e.clientX - st.x, dy = e.clientY - st.y;
    if(!st.moved && dx * dx + dy * dy > 64) st.moved = true;
    if(fns.move) fns.move(e, {x:dx, y:dy, moved:st.moved});
  };
  var up = function(e){
    if(!st || e.pointerId !== st.id) return;
    var tap = !st.moved && Date.now() - st.t < 600;
    st = null;
    try{ node.releasePointerCapture(e.pointerId); }catch(err){}
    if(fns.end) fns.end(e, tap);
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return function(){ node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); };
}
function liftOn(n){
  n.classList.add('oh-lifted');
  n.style.zIndex = 30;
}
function liftOff(n, z){ n.classList.remove('oh-lifted'); n.style.zIndex = z; n._lx = null; n._rot = 0; }
var TILT_K = 0.2;   // deg per px of horizontal speed per frame, smoothed by 0.25 each frame (GDD 13.2 CZ3, farin-gamification 2026-10-29)
function moveBy(n, d){
  var s = camScale(), now = performance.now();
  var vx = n._lx == null ? 0 : (d.x - n._lx) / Math.max(1, (now - n._lt) / 16.7);
  n._lx = d.x; n._lt = now;
  var want = RM() ? 0 : clamp(vx * TILT_K, -6, 6);
  n._rot = (n._rot || 0) + (want - (n._rot || 0)) * 0.25;
  n.style.transform = 'translate(' + (d.x / s) + 'px,' + (d.y / s) + 'px) rotate(' + n._rot.toFixed(2) + 'deg) scale(1.08)';
}
// FLIP an element (left/top in % of the cam) to a new box centre, from wherever it shows now
function flyTo(n, cx, cy, ms, size){
  // FLIP: the box moves (and may shrink: size = factor) to centre (cx, cy); it animates from where it shows now
  var before = rect(n);
  var k = size || 1, w = +n.dataset.w * k, h = +n.dataset.h * k;
  n.style.transform = '';
  placeBox(n, cx - w / 2, cy - h / 2, w, h);
  var after = rect(n), s = camScale();
  var dx = (before.left - after.left) / s, dy = (before.top - after.top) / s, sc = after.width ? before.width / after.width : 1;
  n.style.transformOrigin = '0 0';
  return run(n, [{transform:'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')'}, {transform:'translate(0,0) scale(1)'}], {duration:ms || 300, easing:SPRING})
    .then(function(){ n.style.transformOrigin = ''; });
}
function springBack(n){
  // a wrong drop travels back along its path (300 ms, SPRING); it is never marked wrong
  var t = n.style.transform;
  n.style.transform = '';
  sfx('tick');
  return run(n, [{transform:t || 'none'}, {transform:'none'}], {duration:300, easing:SPRING});
}
function inside(pt, r, tol){ return pt.x >= r.left - tol && pt.x <= r.right + tol && pt.y >= r.top - tol && pt.y <= r.bottom + tol; }

/* ============================== the 7 gestures ============================== */
var GESTURE = {};

/* ---- tap: targets [hot or layer], order any|seq, count n, choose <memKey> ---- */
GESTURE.tap = function(g){
  return new Promise(function(done){
    var targets = g.targets.slice(), need = {}, seq = g.order === 'seq', count = g.count || 1, n = 0, total = targets.length * count;
    targets.forEach(function(t){ need[t] = count; });
    if(g.choose) total = 1;
    cue(g.choose ? 'choose' : 'tap');
    var nodes = {}, offs = [];
    var hn = hints({h15:function(){ var t = next(); if(t) shimmer(nodes[t], true); }, h45:function(){ var t = next(); if(t) finger(nodes[t]); }});
    function next(){ for(var i = 0; i < targets.length; i++) if(need[targets[i]] > 0) return targets[i]; return null; }
    G.status = {kind:'gesture', type:'tap', station:G.sid, next:function(){ var t = next(); return t ? sel(t) : null; }, targets:targets.map(sel), count:count};
    function sel(t){ return H(t) ? '.oh-live [data-oh-hot="' + t + '"]' : '.oh-live [data-oh="' + t + '"]'; }
    var busy = false;
    targets.forEach(function(t){
      var node = H(t) || L(t); if(!node) { need[t] = 0; total -= count; return; }
      nodes[t] = node;
      node.classList.add('oh-tapme');
      var h = async function(e){
        e.stopPropagation(); e.preventDefault();
        if(busy || !G || need[t] <= 0) return;
        if(seq && next() !== t){ hn.wrong(); sfx('tick'); return; }
        busy = true; need[t]--; n++;
        hn.progress();
        try{
          if(g.choose){
            var val = findLayerDef(t).value || t;
            memSet(g.choose, val);
            await VERB.bump(t);
          }
          if(g.speakCount){ var cw = (G.P.counting || {})[G.lang]; if(cw && cw[n - 1]) speak(cap1(cw[n - 1]), {interrupt:true}); }
          sfx('pop');
          if(g.on && g.on[t]) await runSteps(g.on[t]);
          else if(L(t)) await VERB.shake(t);
        }catch(err){ if(err !== ABORT && G) console.warn('[cozy] tap', err); }
        busy = false;
        if(!G) return;
        if(need[t] <= 0) node.classList.remove('oh-tapme');
        if(n >= total) finish();
      };
      node.addEventListener('click', h);
      offs.push(function(){ node.removeEventListener('click', h); node.classList.remove('oh-tapme'); });
    });
    if(total <= 0) return finish();
    function finish(){ hn.stop(); offs.forEach(function(f){ f(); }); cue(null); done(); }
  });
};
function findLayerDef(id){
  var st = G.P.stations[G.sid]; if(!st) return {};
  for(var k in st.shots){ var ls = st.shots[k].layers || []; for(var i = 0; i < ls.length; i++) if(ls[i].id === id) return ls[i]; }
  return {};
}

/* ---- drag-to: items [{item|layer, n}] onto hot 'to'; extras spring back with their line; tap item then tap target ---- */
GESTURE['drag-to'] = function(g){
  // g.to = the default target hot; an item may name its own (item.to) or several spots (item.spots: any of them is right, the learner's
  // choice sets memory and plays that spot's line: CZ1 expressive). g.zones = off-target drop areas with their own line (spring back).
  // g.misdrop[item] = the line for a needed item dropped on another item's target. g.captain = Captain's moment after the nth drop.
  return new Promise(function(done){
    var shot = G.shot;
    var st = G.round.items[G.sid] = G.round.items[G.sid] || {};
    st.placed = st.placed || [];
    var groups = (g.items || []).filter(function(it){ return !it.if || cond(it.if); }).map(function(it){
      var ids = Object.keys(shot.L).filter(function(id){ var n = shot.L[id]; return it.layer ? id === it.layer : n.dataset.item === it.item; });
      var tos = it.spots ? it.spots.map(function(s){ return s.to; }) : [it.to || g.to];
      return {key:it.item || it.layer, n:it.n || 1, ids:ids, got:0, to:tos, spots:it.spots || null, countBy:it.countBy || 0, say:it.say || null};
    });
    var tgtIds = []; groups.forEach(function(gr){ gr.to.forEach(function(t){ if(tgtIds.indexOf(t) < 0) tgtIds.push(t); }); });
    if(g.to && tgtIds.indexOf(g.to) < 0) tgtIds.push(g.to);
    var targets = tgtIds.map(function(t){ return {id:t, node:H(t)}; }).filter(function(t){ return t.node; });
    var zones = (g.zones || []).map(function(z){ return {node:H(z.hot), line:z.line}; }).filter(function(z){ return z.node; });
    var extras = {}; (g.extras || []).forEach(function(x){ extras[x.item] = x.line || '~'; });
    var slotN = {}, sel = null, offs = [], drops = 0;
    cue('drag');
    function groupOf(id){ for(var i = 0; i < groups.length; i++) if(groups[i].ids.indexOf(id) >= 0) return groups[i]; return null; }
    function slot(to){ var byT = g.slotsBy && g.slotsBy[to], sl = byT || g.slots || [], key = byT ? to : '*', k = slotN[key] || 0; var s = sl[k % Math.max(1, sl.length)] || (g.snapBy && g.snapBy[to]) || g.snap || [50, 50]; slotN[key] = k + 1; return s; }
    function remaining(){ return groups.filter(function(gr){ return gr.got < gr.n; }); }
    function freeId(gr){ for(var i = 0; i < gr.ids.length; i++){ var n = shot.L[gr.ids[i]]; if(n && !n.dataset.done && !n.classList.contains('oh-gone')) return gr.ids[i]; } return null; }
    function nextNeed(){ var r = remaining()[0]; return r ? freeId(r) : null; }
    function tick(gr){ if(g.recipe && gr.got >= gr.n) recipeTick(gr.key); }
    function tnode(id){ var t = targets.filter(function(x){ return x.id === id; })[0]; return t ? t.node : null; }
    // resume: items that were already placed go straight back
    st.placed.forEach(function(rec){
      var id = typeof rec === 'string' ? rec : rec.id, to = typeof rec === 'string' ? null : rec.to;
      var n = shot.L[id]; if(!n) return;
      var gr = groupOf(id); if(!gr) return;
      gr.got++; n.classList.remove('oh-gone'); n.dataset.done = '1';
      if(g.into){ n.classList.add('oh-gone'); return; }
      var sp = gr.spots && to ? gr.spots.filter(function(x){ return x.to === to; })[0] : null;
      var s = sp && sp.snap ? sp.snap : slot(to || gr.to[0]);
      var k = sp || g.snap ? 1 : .8;
      placeBox(n, s[0] - (+n.dataset.w) * k / 2, s[1] - (+n.dataset.h) * k / 2, +n.dataset.w * k, +n.dataset.h * k);
      tick(gr);
    });
    var hn = hints({
      h15:function(){ var id = nextNeed(); if(id){ shimmer(shot.L[id]); var gr = groupOf(id); shimmer(tnode(gr.to[0])); } },
      h45:function(){ var id = nextNeed(); if(id){ var gr = groupOf(id); arrow(shot.L[id], tnode(gr.to[0])); } }
    });
    G.status = {kind:'gesture', type:'drag-to', station:G.sid, to:'.oh-live [data-oh-hot="' + (g.to || tgtIds[0]) + '"]',
      need:function(){ return remaining().map(function(gr){ var id = freeId(gr); return id ? '.oh-live [data-oh="' + id + '"]' : null; }).filter(Boolean); },
      needTo:function(){ return remaining().filter(freeId).map(function(gr){ return '.oh-live [data-oh-hot="' + gr.to[gr.to.length > 1 ? Math.floor(Math.random() * gr.to.length) : 0] + '"]'; }); },
      extras:function(){ return Object.keys(shot.L).filter(function(id){ var n = shot.L[id]; return extras[n.dataset.item] && !n.classList.contains('oh-gone'); }).map(function(id){ return '.oh-live [data-oh="' + id + '"]'; }); },
      overflow:function(){ var gr = groups.filter(function(x){ return g.overflow && g.overflow[x.key] && x.got >= x.n; })[0]; if(!gr) return null; var id = gr.ids.filter(function(i){ return !shot.L[i].dataset.done; })[0]; return id ? '.oh-live [data-oh="' + id + '"]' : null; },
      zones:zones.map(function(z){ return '.oh-live [data-oh-hot="' + z.node.dataset.ohHot + '"]'; })};
    var movable = Object.keys(shot.L).filter(function(id){ var n = shot.L[id]; return groupOf(id) || extras[n.dataset.item]; });
    movable.forEach(function(id){
      var n = shot.L[id], z = n.style.zIndex;
      n.classList.add('oh-grab');
      var off = onPress(n, {
        start:function(){ if(n.dataset.done || n.classList.contains('oh-gone') || G.busyLine) return false; G.dragging = true; liftOn(n); sfx('tick'); if(g.speakWord && G.band === 'A1' && n.dataset.item){ speak(objWord(n.dataset.item), {interrupt:true}); } },
        move:function(e, d){ moveBy(n, d); },
        end:function(e, tap){
          G.dragging = false;
          if(tap){ n.style.transform = ''; liftOff(n, z); select(id); return; }
          var c = center(rect(n)), tol = tolPx();
          // the closest target the drop is within tolerance of; CZ4: within 1.5 x tolerance it still glides home
          var best = null, bd = 1e9;
          targets.forEach(function(t){ var r = rect(t.node); if(inside(c, r, tol * 1.5)){ var d = dist(c, center(r)); if(d < bd){ bd = d; best = t; } } });
          var zone = zones.filter(function(zz){ return inside(c, rect(zz.node), 0); })[0];
          if(best && !(zone && !inside(c, rect(best.node), 0))) drop(id, z, best.id);
          else if(zone){ liftOff(n, z); hn.wrong(); springBack(n); sayOnce(zone.line, null); }
          else { liftOff(n, z); springBack(n); }
        }
      });
      offs.push(off);
    });
    targets.forEach(function(t){
      var tapT = function(e){ if(sel){ e.stopPropagation(); var id = sel; select(null); var n = shot.L[id]; drop(id, n.style.zIndex, t.id); } };
      t.node.classList.add('oh-droptarget');
      t.node.addEventListener('click', tapT);
      offs.push(function(){ t.node.removeEventListener('click', tapT); t.node.classList.remove('oh-droptarget'); });
    });
    function select(id){
      if(sel && shot.L[sel]) shot.L[sel].classList.remove('oh-selected');
      sel = id;
      if(id){
        shot.L[id].classList.add('oh-selected'); sfx('tick');
        // the guide (h45): tapping an item flies it to its target by itself
        var gr = groupOf(id);
        if(hn.guide && gr){ var n = shot.L[id]; select(null); drop(id, n.style.zIndex, gr.to[0]); }
      }
    }
    // an item's own line plays the first time; after that (and for items without one) Mrs Bell's pool takes over (CZ5)
    async function sayOnce(role, pool){
      var said = G.round.said = G.round.said || {};
      var line = role && role !== '~' && !said[G.sid + ':' + role] ? lineFor(role) : null;
      if(line) said[G.sid + ':' + role] = 1;
      else if(pool) line = kindLine(pool);
      if(!line) return;
      G.busyLine = true;
      try{ await lineSay(line); } finally{ if(G) G.busyLine = false; }
    }
    async function drop(id, z, to){
      var n = shot.L[id]; var gr = groupOf(id), item = n.dataset.item;
      try{
        if(!gr){
          // an extra: its line plays and it springs back (300 ms SPRING); nothing new is picked up while the line plays
          liftOff(n, z); hn.wrong(); springBack(n);
          await sayOnce(extras[item], 'wrong');
          return;
        }
        if(gr.to.indexOf(to) < 0){
          liftOff(n, z); hn.wrong(); springBack(n);
          await sayOnce(g.misdrop && g.misdrop[gr.key], 'wrong');
          return;
        }
        if(gr.got >= gr.n){
          liftOff(n, z); hn.wrong(); springBack(n);
          await sayOnce(g.overflow && g.overflow[gr.key], 'extra');
          return;
        }
        gr.got++; drops++; n.dataset.done = '1'; st.placed.push({id:id, to:to});
        var dm = findLayerDef(id).mem; if(dm) Object.keys(dm).forEach(function(k){ memSet(k, dm[k]); });
        hn.progress();
        liftOff(n, z);
        var tn = tnode(to);
        if(g.into){
          var tr = rect(tn), c = center(tr), p = toPct(c.x, c.y);
          await flyTo(n, p.x, p.y, 320, .7);
          await run(n, [{opacity:1, transform:'scale(.7)'}, {opacity:0, transform:'scale(.5)'}], {duration:220});
          n.classList.add('oh-gone');
        } else {
          var sp = gr.spots ? gr.spots.filter(function(x){ return x.to === to; })[0] : null;
          var s = (sp && sp.snap) || g.snap || slot(to);
          await flyTo(n, s[0], s[1], 140 + 160 * (RM() ? 0 : 1), sp || g.snap ? 1 : .8);
          if(n.dataset.item === 'egg') sfx('clink');
          await land(n);
          if(sp){
            if(sp.mem) Object.keys(sp.mem).forEach(function(k){ memSet(k, sp.mem[k]); });
            var sl = lineFor(sp.line); if(sl){ G.busyLine = true; await lineSay(sl); }
          }
        }
        if(gr.countBy){ var cw = (G.P.counting || {})[G.lang], ci = gr.got * gr.countBy - 1; if(cw && cw[ci]) speak(cap1(cw[ci]), {interrupt:true}); }
        if(gr.say && gr.got === gr.n){ var gl = lineFor(gr.say); if(gl){ G.busyLine = true; await lineSay(gl); } }
        tick(gr);
        save(true);
        if(g.captain && drops === g.captain.at){ await captainBeat(Object.assign({}, (G.P.stations[G.sid] || {}).captain || {}, g.captain)); hn.progress(); }
      }catch(err){ if(err !== ABORT && G) console.warn('[cozy] drop', err); }
      finally{ if(G) G.busyLine = false; }
      if(G && !remaining().length && !G.finishedDrag){ G.finishedDrag = true; finish(); }
    }
    G.finishedDrag = false;
    if(!remaining().length) return finish();
    function finish(){ hn.stop(); offs.forEach(function(f){ f(); }); movable.forEach(function(id){ var n = shot.L[id]; if(n){ n.classList.remove('oh-grab', 'oh-selected'); } }); cue(null); G.dragging = false; done(); }
  });
};

/* ---- pour-until: hold to pour; release inside [target-tol, target+tol]; +50 / +10 buttons ---- */
GESTURE['pour-until'] = function(g){
  return new Promise(function(done){
    var v = 0, pouring = false, raf = 0, last = 0, first = true, offs = [], finished = false;
    var needle = L(g.needle), bag = L(g.from), bagP = g.pouring ? L(g.pouring) : null, stream = g.stream ? L(g.stream) : null, mound = g.fill ? L(g.fill) : null;
    var unit = ((G.P.units || {})[g.unit] || {})[G.lang] || g.unit || '';
    var scale = G.uiLayer.querySelector('.oh-scale');
    var read = el('div', 'oh-readout', '<b>0</b><span>' + esc(unit) + '</span>');
    if(scale) scale.appendChild(read); else G.uiLayer.appendChild(read);
    var mark = scale ? scale.querySelector('.oh-scale-mark') : null;
    if(scale) scale.style.setProperty('--mark', angleOf(g.target) + 'deg');
    if(scale) scale.classList.add('oh-on');
    cue('pour');
    function angleOf(x){ return -120 + 240 * clamp(x / g.max, 0, 1); }
    function paint(){
      if(needle) needle.style.transform = 'rotate(' + angleOf(v) + 'deg)';
      read.querySelector('b').textContent = Math.round(v);
      if(mound){ mound.classList.remove('oh-gone'); mound.style.transform = 'scale(' + (0.15 + 0.85 * clamp(v / g.target, 0, 1.25)) + ')'; mound.style.opacity = clamp(v / 30, 0, 1); }
    }
    paint();
    var hn = hints({h15:function(){ if(mark) mark.classList.add('oh-pulse'); }, h45:function(){ if(mark) mark.classList.add('oh-pulse'); }});
    G.status = {kind:'gesture', type:'pour-until', station:G.sid, hold:'.oh-live [data-oh-hot="' + g.hold[0] + '"]', target:g.target, rate:g.rate, tol:g.tol, steps:g.steps || [50, 10], value:function(){ return v; }};
    function startPour(){
      if(finished || pouring || G.busyPour) return;
      pouring = true; last = performance.now();
      if(bagP && bag){ bag.classList.add('oh-gone'); bagP.classList.remove('oh-gone'); }
      if(stream){ stream.classList.remove('oh-gone'); stream.classList.add('oh-flowing'); }
      if(first && g.puff){ first = false; VERB.burst(g.puff[0], g.puff[1], 10, '#ffffff', .12); }
      sfx('swish');
      var loop = function(t){
        if(!pouring || !G) return;
        var dt = Math.min(0.1, (t - last) / 1000); last = t;
        v = Math.min(g.max, v + g.rate * dt);
        if(hn.guide && v >= g.target){ v = g.target; paint(); stopPour(); return; }   // the guide stops by itself at the target
        paint();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    function stopPour(){
      if(!pouring) return;
      pouring = false; cancelAnimationFrame(raf);
      if(bagP && bag){ bagP.classList.add('oh-gone'); bag.classList.remove('oh-gone'); }
      if(stream){ stream.classList.add('oh-gone'); stream.classList.remove('oh-flowing'); }
      check();
    }
    var busyCheck = false;
    async function check(){
      if(busyCheck) return; busyCheck = true; G.busyPour = true;
      try{
        var n = Math.round(v);
        var rl = lineFor(g.readout);
        if(rl) speak(fill(T(rl), rl, {n:n}), {interrupt:true}); else speak(n + ' ' + unit, {interrupt:true});
        if(Math.abs(v - g.target) <= g.tol){ hn.stop(); v = Math.round(v); paint(); sfx('correct'); fx(read, [{transform:'scale(1)'}, {transform:'scale(1.25)'}, {transform:'scale(1)'}], {duration:420, easing:SPRING}); await wait(700); return finish(); }
        if(v > g.target + g.tol){
          hn.wrong();
          var ol = lineFor(g.over); if(ol) await lineSay(ol);
          // a spoon brings it back to target - 4 tol (GDD 4.2)
          var to = g.target - 4 * g.tol, from = v, t0 = performance.now();
          await new Promise(function(res){ var f = function(t){ var k = clamp((t - t0) / (600 * (RM() ? .01 : 1)), 0, 1); v = from + (to - from) * k; paint(); if(k < 1 && G) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        } else hn.progress();
      }catch(err){ if(err !== ABORT && G) console.warn('[cozy] pour', err); }
      finally{ busyCheck = false; if(G) G.busyPour = false; }
    }
    g.hold.forEach(function(hid){
      var node = H(hid); if(!node) return;
      node.classList.add('oh-holdme');
      offs.push(onPress(node, {start:function(){ if(finished || busyCheck) return false; startPour(); }, end:function(){ stopPour(); }}));
    });
    var steps = g.steps || [50, 10];
    controls('<div class="oh-alt">' + steps.map(function(k){ return '<button type="button" class="oh-chip oh-alt-btn" data-add="' + k + '">+' + k + ' ' + esc(unit) + '</button>'; }).join('') + '</div>');
    G.ctl.querySelectorAll('[data-add]').forEach(function(b){
      b.addEventListener('click', function(){
        if(finished || busyCheck || pouring) return;
        var add = +b.dataset.add, from = v, to = Math.min(g.max, v + add), t0 = performance.now();
        if(first && g.puff){ first = false; VERB.burst(g.puff[0], g.puff[1], 10, '#ffffff', .12); }
        sfx('swish');
        var f = function(t){ var k = clamp((t - t0) / (RM() ? 1 : 360), 0, 1); v = from + (to - from) * k; paint(); if(k < 1) requestAnimationFrame(f); else check(); };
        requestAnimationFrame(f);
      });
    });
    function finish(){ finished = true; hn.stop(); offs.forEach(function(f){ f(); }); g.hold.forEach(function(hid){ var n = H(hid); if(n) n.classList.remove('oh-holdme'); }); controls(''); cue(null); if(scale) scale.classList.remove('oh-on'); if(mark) mark.classList.remove('oh-pulse'); done(); }
  });
};

/* ---- stir-circles: the total angle reaches turns x 2 pi (either way; reversing never subtracts) ---- */
GESTURE['stir-circles'] = function(g){
  return new Promise(function(done){
    var total = 0, need = g.turns * Math.PI * 2, lastA = null, state = 0, finished = false, spin = 0, offs = [];
    var states = (g.states || []).map(L);
    var grow = g.grow ? (G.shot.L[g.grow] || null) : null;
    if(grow){ grow.classList.remove('oh-gone'); grow.style.transform = 'scale(.2) rotate(0deg)'; grow.style.opacity = '.2'; }
    var frame = G.frame;
    cue('stir');
    var ringHint = null;
    var hn = hints({
      h15:function(){ showRing(); },
      h45:function(){ showRing(); }
    });
    function showRing(){
      if(ringHint) return;
      var f = frameRect(), cr = camRect();
      var cx = cr.left + cr.width * g.center[0] / 100 - f.left, cy = cr.top + cr.height * g.center[1] / 100 - f.top, r = cr.width * (g.r[0] + g.r[1]) / 200;
      ringHint = el('div', 'oh-ringhint', '<i></i><b><svg viewBox="0 0 24 24"><path d="M5 12h14m0 0l-5-5m5 5l-5 5"/></svg></b>');
      ringHint.style.left = (cx - r) + 'px'; ringHint.style.top = (cy - r) + 'px'; ringHint.style.width = ringHint.style.height = (2 * r) + 'px';
      G.uiLayer.appendChild(ringHint);
    }
    G.status = {kind:'gesture', type:'stir-circles', station:G.sid, center:g.center, r:g.r, turns:g.turns, progress:function(){ return total / need; }};
    function geo(){ var cr = camRect(); return {cx:cr.left + cr.width * g.center[0] / 100, cy:cr.top + cr.height * g.center[1] / 100, r0:cr.width * g.r[0] / 100, r1:cr.width * g.r[1] / 100}; }
    var paused = false, capDone = false;
    function add(da){
      if(finished || paused) return;
      if(g.captain && !capDone && total / need >= g.captain.at){
        capDone = true; paused = true; tracking = false;
        captainBeat(Object.assign({}, (G.P.stations[G.sid] || {}).captain || {}, g.captain)).catch(function(){}).then(function(){ paused = false; hn.progress(); });
        return;
      }
      total += Math.abs(da); spin += da;
      var k = clamp(total / need, 0, 1);
      if(states.length){
        var si = Math.min(states.length - 1, Math.floor(k * states.length));
        if(si !== state){
          var a = states[state], b = states[si]; state = si;
          if(a && b){ b.classList.remove('oh-gone'); a.classList.add('oh-gone'); fx(b, [{opacity:.3}, {opacity:1}], {duration:380}); }
          sfx('swish');
        }
        var cur = states[state]; if(cur) cur.style.transform = 'rotate(' + (spin * 180 / Math.PI * .25) + 'deg)';
      }
      if(grow){ grow.style.transform = 'scale(' + (0.2 + 0.8 * k) + ') rotate(' + (spin * 180 / Math.PI * .5) + 'deg)'; grow.style.opacity = String(0.2 + 0.8 * k); }
      if(k >= 1) finish();
    }
    var tracking = false;
    var off = onPress(frame, {
      start:function(e){
        if(finished) return false;
        var q = geo(), dx = e.clientX - q.cx, dy = e.clientY - q.cy, d = Math.sqrt(dx * dx + dy * dy);
        if(d > q.r1 * 1.35) return false;
        tracking = true; lastA = Math.atan2(dy, dx);
        // the guide (h45): each tap on the ring adds a quarter turn
        if(hn.guide){ add(Math.PI / 2); hn.progress(); }
      },
      move:function(e){
        if(!tracking) return;
        var q = geo(), dx = e.clientX - q.cx, dy = e.clientY - q.cy, d = Math.sqrt(dx * dx + dy * dy);
        if(d < q.r0 * .5 || d > q.r1 * 1.6){ lastA = Math.atan2(dy, dx); return; }
        var a = Math.atan2(dy, dx), da = a - lastA;
        if(da > Math.PI) da -= 2 * Math.PI; if(da < -Math.PI) da += 2 * Math.PI;
        lastA = a;
        if(Math.abs(da) > .9) return;
        var before = Math.floor(total / (Math.PI / 2));
        add(da);
        if(Math.floor(total / (Math.PI / 2)) > before){ hn.progress(); if(ringHint){ ringHint.remove(); ringHint = null; } }
      },
      end:function(){ tracking = false; }
    });
    offs.push(off);
    frame.classList.add('oh-stirring');
    controls('<div class="oh-alt"><button type="button" class="oh-chip oh-alt-btn oh-stir-btn"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-3-6.2M17 3v3.5h-3.5"/></svg>' + esc(U('stir')) + '</button></div>');
    G.ctl.querySelector('.oh-stir-btn').addEventListener('click', function(){ add(Math.PI); hn.progress(); });
    function finish(){
      if(finished) return; finished = true; hn.stop(); offs.forEach(function(f){ f(); }); frame.classList.remove('oh-stirring');
      if(ringHint) ringHint.remove();
      if(grow){ grow.style.transform = 'scale(1)'; grow.style.opacity = '1'; }
      controls(''); cue(null); sfx('correct'); done();
    }
  });
};

/* ---- turn-dial: release on the target detent; every detent is spoken; - / + buttons ---- */
GESTURE['turn-dial'] = function(g){
  return new Promise(function(done){
    var dial = L(g.layer), steps = Math.round((g.max - g.min) / g.step), i = 0, finished = false, offs = [], busy = false;
    var ti = Math.round((g.target - g.min) / g.step);
    var ring = G.uiLayer.querySelector('.oh-dialring');
    if(ring){ ring.classList.add('oh-on'); }
    cue('dial');
    function ang(k){ return g.arc[0] + (g.arc[1] - g.arc[0]) * k / steps; }
    function val(k){ return g.min + k * g.step; }
    function paint(){ dial.style.transform = 'rotate(' + ang(i) + 'deg)'; if(ring) ring.querySelectorAll('.oh-dt').forEach(function(t){ t.classList.toggle('oh-at', +t.dataset.v === val(i)); }); }
    paint();
    function setI(k, voice){
      k = clamp(k, 0, steps);
      if(k === i) return;
      i = k; paint(); sfx('click');
      if(voice !== false) speak(String(val(i)), {interrupt:true});
    }
    var hn = hints({
      h15:function(){ if(ring){ var t = ring.querySelector('.oh-dt[data-v="' + g.target + '"]'); if(t) t.classList.add('oh-glow'); } },
      h45:function(){ if(ring){ var t = ring.querySelector('.oh-dt[data-v="' + g.target + '"]'); if(t) t.classList.add('oh-glow'); } }
    });
    G.status = {kind:'gesture', type:'turn-dial', station:G.sid, dial:'.oh-live [data-oh="' + g.layer + '"]', value:function(){ return val(i); }, target:g.target, arc:g.arc, min:g.min, max:g.max, step:g.step};
    var again = false;
    var altWait = function(){ return 900 * (G ? Math.max(G.pace, .5) : 1); };
    async function release(){
      if(finished) return;
      if(!G) return;
      if(busy){ again = true; return; }   // turned again while the line played: check the new value when it ends
      busy = true;
      try{
        if(i === ti){ hn.stop(); sfx('correct'); await wait(500); return finish(); }
        hn.wrong();
        var role = val(i) > g.target ? g.lines.over : g.lines.under;
        var ln = lineFor(role) || lineFor(g.lines.wrong);
        if(ln) await lineSay(ln, {n:String(val(i))});
      }catch(err){ if(err !== ABORT && G) console.warn('[cozy] dial', err); }
      finally{ busy = false; }
      if(again && !finished){ again = false; clearTimeout(altT); altT = setTimeout(release, altWait()); }   // a beat to go on tapping, as after any tap
    }
    var drag = false;
    offs.push(onPress(dial, {
      start:function(){ if(finished || busy) return false; drag = true; },
      move:function(e){
        if(!drag) return;
        var c = center(rect(dial)), a = Math.atan2(e.clientX - c.x, -(e.clientY - c.y)) * 180 / Math.PI;   // 0 = up, clockwise
        a = clamp(a, g.arc[0], g.arc[1]);
        setI(Math.round((a - g.arc[0]) / (g.arc[1] - g.arc[0]) * steps));
      },
      end:function(e, tap){
        drag = false;
        if(tap && hn.guide){ setI(i + (ti > i ? 1 : -1)); if(i === ti) release(); return; }   // the guide: each tap moves one detent toward the target
        if(!tap) release();
      }
    }));
    dial.classList.add('oh-turnme');
    controls('<div class="oh-alt oh-alt-dial"><button type="button" class="oh-chip oh-alt-btn oh-round" data-d="-1" aria-label="' + esc(U('less')) + '">−</button><span class="oh-dialval" lang="' + G.lang + '"></span><button type="button" class="oh-chip oh-alt-btn oh-round" data-d="1" aria-label="' + esc(U('more')) + '">+</button></div>');
    var dv = G.ctl.querySelector('.oh-dialval');
    var showV = function(){ dv.textContent = val(i) + ' ' + (((G.P.units || {})[g.unit || 'min'] || {})[G.lang] || ''); };
    showV();
    var altT = 0;
    G.ctl.querySelectorAll('[data-d]').forEach(function(b){
      b.addEventListener('click', function(){
        if(finished) return;
        setI(i + (+b.dataset.d)); showV();
        // a pause between taps can release too early and start a line: the taps during it are not lost, they are checked when it ends
        if(busy){ again = true; if(G.lineSkip){ var ls = G.lineSkip; G.lineSkip = null; stopSpeech(); ls(); } return; }
        clearTimeout(altT); altT = setTimeout(release, altWait());   // the button way "releases" when the learner stops tapping
      });
    });
    var mo = setInterval(showV, 200);
    offs.push(function(){ clearInterval(mo); clearTimeout(altT); });
    function finish(){ finished = true; hn.stop(); offs.forEach(function(f){ f(); }); dial.classList.remove('oh-turnme'); if(ring) ring.classList.remove('oh-on'); controls(''); cue(null); done(); }
  });
};

/* ---- pipe-letters: tap the next letter of the word; each pipes itself in 450 ms; a wrong letter wobbles back and is spoken ---- */
GESTURE['pipe-letters'] = function(g){
  return new Promise(function(done){
    var word = typeof g.word === 'object' ? (g.word[G.lang] || g.word.en) : g.word;
    var extras = Array.isArray(g.extras) ? g.extras : ((g.extras || {})[G.lang] || []);
    var comp = L(g.composite), C = G.P.composites[(comp && comp.dataset.comp) || g.composite], sv = C.surfaces[g.surface];
    var k = 0, finished = false;
    var box = pipeSvg(sv, word, 0, false);
    comp.appendChild(box);
    var texts = box.querySelectorAll('text');
    cue('pipe');
    var tiles = shuffle(word.split('').concat(extras));
    G.root.classList.add('oh-compact');
    controls('<div class="oh-tray">' + tiles.map(function(ch, j){ return '<button type="button" class="oh-tile" data-ch="' + esc(ch) + '" data-j="' + j + '">' + esc(ch) + '</button>'; }).join('') + '</div>');
    var hn = hints({
      h15:function(){ var t = nextTile(); if(t) t.classList.add('oh-shine'); },
      h45:function(){ if(texts[k]) texts[k].classList.add('oh-pl-ghost'); }
    });
    G.status = {kind:'gesture', type:'pipe-letters', station:G.sid, next:function(){ return word.charAt(k); }, word:word};
    function nextTile(){ var want = word.charAt(k); return [].filter.call(G.ctl.querySelectorAll('.oh-tile:not(.oh-used)'), function(b){ return b.dataset.ch === want; })[0]; }
    G.ctl.querySelectorAll('.oh-tile').forEach(function(b){
      b.addEventListener('click', function(){
        if(finished || b.classList.contains('oh-used')) return;
        var want = word.charAt(k);
        speak(b.dataset.ch, {interrupt:true});
        if(b.dataset.ch !== want){
          hn.wrong(); sfx('tick');
          fx(b, [{transform:'none'}, {transform:'translateY(-6px) rotate(-8deg)'}, {transform:'translateY(0) rotate(6deg)'}, {transform:'none'}], {duration:380, easing:SPRING});
          return;
        }
        b.classList.add('oh-used'); G.ctl.querySelectorAll('.oh-shine').forEach(function(x){ x.classList.remove('oh-shine'); });
        hn.progress();
        var t = texts[k];
        t.classList.remove('oh-pl-off', 'oh-pl-ghost'); t.classList.add(RM() ? 'oh-pl-on' : 'oh-pl-draw');
        sfx('swish');
        k++;
        var pipes = (G.round.items.decorate = G.round.items.decorate || {}).pipes = (G.round.items.decorate.pipes || {});
        pipes[g.surface] = word.slice(0, k);
        if(k >= word.length){ finished = true; hn.stop(); setTimeout(function(){ sfx('correct'); if(G) G.root.classList.remove('oh-compact'); controls(''); cue(null); done(); }, RM() ? 0 : 520 * (G ? G.pace : 1) + 100); }
      });
    });
  });
};

/* ---- place: items from sources onto anchors (need n, or min..max then Done); tap an anchor to place ---- */
GESTURE.place = function(g){
  return new Promise(function(done){
    var comp = L(g.composite), C = G.P.composites[(comp && comp.dataset.comp) || g.composite], ring = C.rings[g.ring];
    var A = ringAnchors(ring), filled = new Array(A.length).fill(null), offs = [], finished = false;
    var dec = G.round.items[C.store || 'decorate'] = G.round.items[C.store || 'decorate'] || {};
    var store = dec[g.store] = dec[g.store] || [];
    var srcs = g.sources.filter(function(s){ return !s.if || cond(s.if); }).map(function(s){ return {def:s, node:L(s.from), blocked:false}; });
    var used = function(src){ return filled.filter(function(f){ return f && f.id === src.def.id; }).length; };
    var full = function(src){ return src.def.max != null && used(src) >= src.def.max; };
    var sel = srcs[0];
    var need = g.need || null, min = g.min || need || 1, max = g.max || need || A.length;
    var layer = el('div', 'oh-anchors');
    comp.appendChild(layer);
    var dots = A.map(function(a, i){
      var d = el('button', 'oh-anchor'); d.type = 'button';
      d.style.left = a.x + '%'; d.style.top = a.y + '%';
      d.dataset.a = i; d.tabIndex = -1;
      layer.appendChild(d); return d;
    });
    // resume: what was placed before comes back
    store.forEach(function(it){ if(A[it.a]){ filled[it.a] = it; comp.appendChild(placedPiece(ring, A[it.a], it.art)); dots[it.a].classList.add('oh-full'); } });
    cue('place');
    var hn = hints({
      h15:function(){ dots.forEach(function(d, i){ if(!filled[i]) d.classList.add('oh-pulse'); }); },
      h45:function(){ dots.forEach(function(d, i){ if(!filled[i]) d.classList.add('oh-pulse'); }); G.frame.classList.add('oh-guide-place'); }
    });
    function count(){ return filled.filter(Boolean).length; }
    function free(){ return A.map(function(a, i){ return i; }).filter(function(i){ return !filled[i]; }); }
    G.status = {kind:'gesture', type:'place', station:G.sid, sources:function(){ return srcs.filter(function(s){ return !full(s) && !s.blocked; }).map(function(s){ return {id:s.def.id, sel:'.oh-live [data-oh="' + s.def.from + '"]', guarded:!!s.def.guard}; }); },
      anchors:function(){ return free().map(function(i){ return '.oh-live [data-oh="' + g.composite + '"] .oh-anchor[data-a="' + i + '"]'; }); },
      need:need, min:min, max:max, count:count, done:'.oh-place-done'};
    function nearestFree(pt){
      var best = -1, bd = 1e9;
      free().forEach(function(i){ var c = center(rect(dots[i])), d = dist(c, pt); if(d < bd){ bd = d; best = i; } });
      return {i:best, d:bd};
    }
    async function put(i, src){
      if(finished || i < 0 || filled[i] || count() >= max) return;
      if(full(src)) return;
      var it = {a:i, art:src.def.art, id:src.def.id};
      filled[i] = it; store.push(it); dots[i].classList.add('oh-full'); dots[i].classList.remove('oh-pulse');
      var p = placedPiece(ring, A[i], src.def.art);
      comp.appendChild(p);
      hn.progress();
      sfx('land');
      if(!RM()) fx(p, [{transform:'translateY(-30%) scale(1.15)', opacity:0}, {transform:'scale(1.06,.94)', opacity:1, offset:.6}, {transform:'none', opacity:1}], {duration:260, easing:SPRING});
      if(g.burst){ var c = center(rect(p)), q = toPct(c.x, c.y); VERB.burst(q.x, q.y, 5, '#FFD166', .06); }
      if(g.count){ var cw = (G.P.counting || {})[G.lang]; if(cw && cw[count() - 1]) speak(cap1(cw[count() - 1]), {interrupt:true}); }
      save(true);
      if(full(src) && src.node){ src.node.classList.add('oh-blocked'); if(sel === src) sel = srcs.filter(function(x){ return !x.blocked && !full(x); })[0] || sel; }
      paintDone();
      if(g.near) await nearCheck(it);
      if(g.captain && count() === g.captain.at){ G.busyDrop = true; try{ await captainBeat(Object.assign({}, (G.P.stations[G.sid] || {}).captain || {}, g.captain)); } finally{ if(G) G.busyDrop = false; } hn.progress(); }
      if(!G) return;
      if(src.def.say && used(src) === 1){ var sl = lineFor(src.def.say); if(sl){ G.busyDrop = true; try{ await lineSay(sl); } finally{ if(G) G.busyDrop = false; } } }
      if(need && count() >= need) finish();
    }
    // advice, never a block: a piece dropped next to one it should not sit by gets one kind line (the party plan speaker)
    async function nearCheck(it){
      var nr = g.near; if(!nr || G.round.said && G.round.said[G.sid + ':near']) return;
      var a = it.id === nr.a ? it : null, others = filled.filter(function(f){ return f && f.id === (a ? nr.b : nr.a); });
      if(!a && it.id === nr.b) a = it; if(!a) return;
      var hit = others.some(function(o2){ var p = A[o2.a], q = A[a.a]; return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)) <= (nr.dist || 22); });
      if(!hit) return;
      (G.round.said = G.round.said || {})[G.sid + ':near'] = 1;
      var l = lineFor(nr.line); if(!l) return;
      G.busyDrop = true; try{ await lineSay(l); } finally{ if(G) G.busyDrop = false; }
    }
    async function guardHit(src, piece){
      // the blueberry stop (GDD 5 S6): Mrs Bell's sling hand slides in and the berry stops in mid-air
      var gd = src.def.guard;
      G.busyDrop = true;
      try{
        var hand = gd.hand ? L(gd.hand) : null;
        if(hand && piece){
          hand.classList.remove('oh-gone');
          var pr = rect(piece), q = toPct(pr.left + pr.width, pr.top + pr.height / 2);
          var hx = q.x - 2, hy = q.y - (+hand.dataset.h) / 2;
          hand.style.top = hy + '%'; hand.dataset.y = hy;
          await run(hand, [{transform:'translateX(30%)', opacity:0}, {transform:'none', opacity:1}], {duration:320, easing:SPRING});
          hand.style.left = hx + '%';
        }
        VERB.face('bell', 'oh');
        if(gd.mem) Object.keys(gd.mem).forEach(function(k){ memSet(k, gd.mem[k]); });
        var lines = (gd.say || []).map(function(r){ return lineFor(r); }).filter(Boolean);
        for(var i = 0; i < lines.length; i++) await lineSay(lines[i]);
        if(gd.note){ G.pulseNote = gd.note; openNote(gd.note); await wait(1800); closeNote(); G.pulseNote = null; }
        if(piece){ await run(piece, [{transform:piece.style.transform || 'none', opacity:1}, {transform:'translate(0,0) scale(.6)', opacity:0}], {duration:320, easing:SPRING}); piece.remove(); }
        if(hand){ await run(hand, [{transform:'none', opacity:1}, {transform:'translateX(40%)', opacity:0}], {duration:260}); hand.classList.add('oh-gone'); hand.style.left = '104%'; hand.dataset.x = 104; }
        src.blocked = true; if(src.node) src.node.classList.add('oh-blocked');
        if(sel === src) sel = srcs.filter(function(s){ return !s.blocked; })[0];
      }catch(err){ if(err !== ABORT && G) console.warn('[cozy] guard', err); }
      finally{ if(G) G.busyDrop = false; }
    }
    srcs.forEach(function(src){
      var n = src.node; if(!n) return;
      n.classList.add('oh-grab');
      var piece = null, startPt = null, stopped = false;
      offs.push(onPress(n, {
        start:function(e){
          if(finished || G.busyDrop || count() >= max || full(src)) return false;
          startPt = {x:e.clientX, y:e.clientY}; stopped = false; G.dragging = true;
        },
        move:function(e, d){
          if(stopped) return;
          if(!piece && d.moved){
            // a fresh piece leaves the bowl under the finger
            piece = el('div', 'oh-floater oh-lifted', artHtml(src.def.art));
            var f = frameRect(), cr = camRect(), cw = rect(comp);
            piece.style.width = (cw.width * ring.size[0] / 100) + 'px'; piece.style.height = (cw.height * ring.size[1] / 100) + 'px';
            G.uiLayer.appendChild(piece);
            piece._w = cw.width * ring.size[0] / 100; piece._h = cw.height * ring.size[1] / 100;
            sfx('tick');
          }
          if(piece){
            var f2 = frameRect();
            piece.style.left = (e.clientX - f2.left - piece._w / 2) + 'px'; piece.style.top = (e.clientY - f2.top - piece._h / 2) + 'px';
            var gd = src.def.guard;
            if(gd && !src.blocked && cond(gd.if, {drag:src.def.id}) && dist({x:e.clientX, y:e.clientY}, startPt) > 40){ stopped = true; hn.wrong(); guardHit(src, piece); piece = null; }
          }
        },
        end:function(e, tap){
          G.dragging = false;
          if(stopped) return;
          if(tap){
            if(src.blocked){ sfx('tick'); fx(n, [{transform:'none'}, {transform:'translateX(-3%)'}, {transform:'translateX(3%)'}, {transform:'none'}], {duration:260}); return; }
            if(src.def.guard && cond(src.def.guard.if, {drag:src.def.id})){ guardHit(src, null); return; }
            selSrc(src); return;
          }
          if(!piece) return;
          var p = piece; piece = null;
          var pt = {x:e.clientX, y:e.clientY}, cr2 = rect(comp), cc = center(cr2);
          var nf = nearestFree(pt);
          var ok = nf.i >= 0 && (nf.d <= tolPx() || dist(pt, cc) <= cr2.width / 2 + tolPx());
          if(src.blocked) ok = false;
          if(ok){ p.remove(); put(nf.i, src); }
          else { hn.wrong(); sfx('tick'); var a = fx(p, [{opacity:1, transform:'none'}, {opacity:0, transform:'scale(.5)'}], {duration:300, easing:SPRING}); if(a) a.onfinish = function(){ p.remove(); }; else p.remove(); }
        }
      }));
    });
    function selSrc(src){ sel = src; srcs.forEach(function(s){ if(s.node) s.node.classList.toggle('oh-selected', s === src); }); sfx('tick'); }
    dots.forEach(function(d, i){
      d.addEventListener('click', function(e){
        e.stopPropagation();
        if(finished || G.busyDrop) return;
        if(!sel || sel.blocked || full(sel)) sel = srcs.filter(function(s){ return !s.blocked && !full(s); })[0] || sel;
        if(sel.def.guard && !sel.blocked && cond(sel.def.guard.if, {drag:sel.def.id})){ guardHit(sel, null); return; }
        put(i, sel);
      });
    });
    // the guide (h45): each tap anywhere places an item on the nearest free anchor
    var guideTap = function(e){
      if(!hn.guide || finished || G.busyDrop) return;
      if(e.target.closest && (e.target.closest('.oh-anchor') || e.target.closest('.oh-grab'))) return;
      var s = srcs.filter(function(x){ return !x.blocked && !full(x) && !(x.def.guard && cond(x.def.guard.if, {drag:x.def.id})); })[0];
      if(s) put(nearestFree({x:e.clientX, y:e.clientY}).i, s);
    };
    G.frame.addEventListener('click', guideTap);
    offs.push(function(){ G.frame.removeEventListener('click', guideTap); G.frame.classList.remove('oh-guide-place'); });
    function paintDone(){
      if(need) return;
      if(count() >= min && !G.ctl.querySelector('.oh-place-done')){
        controls('<div class="oh-alt"><button type="button" class="oh-chip oh-primary oh-place-done">' + esc(U('done')) + '</button></div>');
        G.ctl.querySelector('.oh-place-done').addEventListener('click', function(){ if(count() >= min) finish(); });
      }
    }
    if(!need) controls('');
    paintDone();
    if(need && count() >= need) return finish();
    function finish(){
      if(finished) return; finished = true; hn.stop(); offs.forEach(function(f){ f(); });
      srcs.forEach(function(s){ if(s.node) s.node.classList.remove('oh-grab', 'oh-selected'); });
      layer.remove(); controls(''); cue(null);
      if(g.mem) memSet(g.mem, count());
      if(g.memList) memSet(g.memList, filled.filter(Boolean).map(function(f){ return f.id; }));
      sfx('correct'); done();
    }
  });
};

/* ============================== language events: ask, reply, produce, recap ============================== */
async function evAsk(){
  var cs = contentStation(G.sid);
  var cfg = G.bandCfg.ask || {}, pick = cfg.pick || 2;
  var of = cfg.of || (G.V.ask && G.V.ask.of) || null;
  var cards = (cs.cards || []).filter(function(c){ return !of || of.indexOf(c.id) >= 0; });
  var asked = G.round.choices.asked = G.round.choices.asked || [];
  var left = cards.filter(function(c){ return asked.indexOf(c.id) < 0; });
  pick = Math.min(pick, cards.length);
  var hn = null;
  while(asked.length < pick){
    live();
    cue('ask');
    G.root.classList.add('oh-asking');
    var chosen = await new Promise(function(res){
      var html = '<div class="oh-cards" data-n="' + left.length + '">' + left.map(function(c, i){
        var gl = GL(c.q), pics = (G.bandCfg.cardPics || {})[c.id] || [];
        return '<button type="button" class="oh-qcard" data-id="' + esc(c.id) + '" style="--i:' + i + ';--n:' + left.length + '">' +
          (pics.length ? '<span class="oh-qpics">' + pics.map(function(k){ return '<span class="oh-qpic">' + picArt(k) + picWord(k) + '</span>'; }).join('') + '</span>' : '') +
          '<span class="oh-q" lang="' + G.lang + '" dir="ltr">' + esc(T(c.q)) + '</span>' +
          (gl ? '<small class="oh-gloss' + (showGloss() ? '' : ' oh-hide') + '" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(gl) + '</small>' : '') + '</button>';
      }).join('') + '</div><div class="oh-askrow"><button type="button" class="oh-chip oh-primary oh-askbtn" disabled>' + esc(U('ask')) + '</button></div>';
      controls(html);
      var picked = null;
      hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-qcard:not(.oh-sel)'); if(b) b.classList.add('oh-shine'); }, h45:function(){ G.ctl.querySelectorAll('.oh-qcard').forEach(function(b){ b.classList.add('oh-shine'); }); }});
      G.status = {kind:'ask', station:G.sid, cards:left.map(function(c){ return '.oh-qcard[data-id="' + c.id + '"]'; }), ask:'.oh-askbtn'};
      G.ctl.querySelectorAll('.oh-qcard').forEach(function(b){
        b.addEventListener('click', function(){
          G.ctl.querySelectorAll('.oh-qcard').forEach(function(x){ x.classList.toggle('oh-sel', x === b); x.classList.remove('oh-shine'); });
          picked = left.filter(function(c){ return c.id === b.dataset.id; })[0];
          var ab = G.ctl.querySelector('.oh-askbtn'); ab.disabled = false;
          if(!RM()) fx(ab, [{transform:'scale(.9)'}, {transform:'scale(1.06)'}, {transform:'none'}], {duration:300, easing:SPRING});
          hn.progress(); sfx('paper');
          speak(T(picked.q), {who:'you', interrupt:true});
        });
      });
      G.ctl.querySelector('.oh-askbtn').addEventListener('click', function(){ if(picked){ hn.stop(); G.status = {kind:'scripted', station:G.sid}; G.root.classList.remove('oh-asking'); res(picked); } });
    });
    var card = G.ctl.querySelector('.oh-qcard[data-id="' + chosen.id + '"]');
    if(card && !RM()) await run(card, [{transform:getComputedStyle(card).transform, opacity:1}, {transform:'translateY(-120px) scale(.8) rotate(-4deg)', opacity:0}], {duration:360, easing:'ease-in'});
    controls('');
    G.status = {kind:'scripted', station:G.sid};
    asked.push(chosen.id);
    left = left.filter(function(c){ return c.id !== chosen.id; });
    memSet(chosen.mem, true);
    var sets = Object.assign({}, (G.P.askSets || {})[chosen.id] || {}, ((G.bandCfg.sets || {})[chosen.id]) || {});
    Object.keys(sets).forEach(function(k){ memSet(k, sets[k]); });
    save(true);
    await lineSay(Object.assign({}, chosen.q, {who:'you'}));
    await lineSay(chosen.a);
    if(chosen.note) await noteAdd(chosen.note);
  }
  controls(''); cue(null);
}
async function evReply(o){
  o = o || {};
  var cs = contentStation(G.sid);
  var choices;
  if(o.line){
    var ln = lineFor(o.line); if(!ln) return;
    choices = [{id:'line.' + o.line, text:ln, say:true}];
  } else {
    // the chips live on the station, or (Laundry B1 sock) on the branch whose condition holds
    var br = (cs.branches || []).filter(function(b){ return b.choices && (!b.if || cond(b.if)); })[0];
    choices = (cs.choices || (br && br.choices) || []).filter(function(c){ return !c.if || cond(c.if); });
  }
  if(!choices.length) return;
  cue('reply');
  var key = G.sid + (o.line ? '.' + o.line : '');
  G.root.classList.add('oh-compact');
  var pickedId = await new Promise(function(res){
    controls('<div class="oh-chips">' + choices.map(function(c){
      var gl = GL(c.text);
      return '<button type="button" class="oh-chip oh-reply" data-id="' + esc(c.id) + '"><span lang="' + G.lang + '" dir="ltr">' + esc(T(c.text)) + '</span>' +
        (gl ? '<small class="oh-gloss' + (showGloss() ? '' : ' oh-hide') + '" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(gl) + '</small>' : '') + '</button>';
    }).join('') + '</div>');
    var hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-reply'); if(b) b.classList.add('oh-shine'); }, h45:function(){ G.ctl.querySelectorAll('.oh-reply').forEach(function(b){ b.classList.add('oh-shine'); }); }});
    G.status = {kind:'reply', station:G.sid, chips:choices.map(function(c){ return '.oh-reply[data-id="' + c.id + '"]'; })};
    G.ctl.querySelectorAll('.oh-reply').forEach(function(b){
      b.addEventListener('click', function(){
        hn.stop();
        G.ctl.querySelectorAll('.oh-reply').forEach(function(x){ x.classList.toggle('oh-sel', x === b); x.disabled = true; });
        sfx('pop'); G.status = {kind:'scripted', station:G.sid}; G.root.classList.remove('oh-compact'); res(b.dataset.id);
      });
    });
  });
  var c = choices.filter(function(x){ return x.id === pickedId; })[0];
  G.status = {kind:'scripted', station:G.sid};
  G.round.choices[key] = pickedId;
  await wait(260);
  controls(''); cue(null);
  if(c.mem) Object.keys(c.mem).forEach(function(k){ memSet(k, c.mem[k]); });
  save(true);
  await lineSay({who:'you', en:c.text.en, es:c.text.es, tr:c.text.tr, fa:c.text.fa});
  for(var i = 0; i < (c.reply || []).length; i++){ if(!c.reply[i].if || cond(c.reply[i].if)) await lineSay(c.reply[i]); }
}
async function evProduce(){
  // A1: "This is a ___ cake for Ada!" built from chips; the learner's line is the souvenir
  var cs = contentStation(G.sid), pr = cs.production; if(!pr) return;
  var model = T(pr.model), chips = pr.chips || [];
  var hit = chips.filter(function(c){ return model.indexOf(c) >= 0; }).sort(function(a, b){ return b.length - a.length; })[0];
  var frame = hit ? model.replace(hit, '___') : model;
  await lineSay(pr.prompt);
  cue('choose');
  var pre = frame.split('___');
  G.root.classList.add('oh-compact');
  var chosen = await new Promise(function(res){
    controls('<p class="oh-frame-line" lang="' + G.lang + '" dir="ltr">' + esc(pre[0]) + '<b class="oh-blank">&nbsp;</b>' + esc(pre[1] || '') + '</p>' +
      '<div class="oh-chips oh-chips-sm">' + chips.map(function(c){ return '<button type="button" class="oh-chip oh-pchip" data-w="' + esc(c) + '" lang="' + G.lang + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="oh-askrow"><button type="button" class="oh-chip oh-primary oh-say-btn" disabled>' + esc(U('done')) + '</button></div>');
    var w = null;
    var hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-pchip'); if(b) b.classList.add('oh-shine'); }, h45:function(){ G.ctl.querySelectorAll('.oh-pchip').forEach(function(b){ b.classList.add('oh-shine'); }); }});
    G.status = {kind:'produce', station:G.sid, chips:chips.map(function(c){ return '.oh-pchip[data-w="' + c + '"]'; }), done:'.oh-say-btn'};
    G.ctl.querySelectorAll('.oh-pchip').forEach(function(b){
      b.addEventListener('click', function(){
        w = b.dataset.w; G.ctl.querySelectorAll('.oh-pchip').forEach(function(x){ x.classList.toggle('oh-sel', x === b); });
        var bl = G.ctl.querySelector('.oh-blank'); bl.textContent = w; bl.classList.add('oh-filled');
        if(!RM()) fx(bl, [{transform:'scale(.7)'}, {transform:'scale(1.08)'}, {transform:'none'}], {duration:280, easing:SPRING});
        G.ctl.querySelector('.oh-say-btn').disabled = false; hn.progress();
        speak(pre[0] + w + (pre[1] || ''), {who:'you', interrupt:true});
      });
    });
    G.ctl.querySelector('.oh-say-btn').addEventListener('click', function(){ if(w){ hn.stop(); G.status = {kind:'scripted', station:G.sid}; G.root.classList.remove('oh-compact'); res(w); } });
  });
  var sentence = pre[0] + chosen + (pre[1] || '');
  G.status = {kind:'scripted', station:G.sid};
  controls(''); cue(null);
  await lineSay({who:'you', en:sentence, es:sentence});
  G.round.souvenir = {text:sentence, say:sentence, back:T((cs.souvenir || {}).back), backGl:GL((cs.souvenir || {}).back)};
  save(true);
}
async function evRecapSpoken(){
  // A1: the game shows and speaks the recap; the learner only taps play
  var cs = contentStation(G.sid), list = cs.recapSpoken || []; if(!list.length) return;
  var board = el('div', 'oh-board oh-board-a1');
  board.innerHTML = '<div class="oh-pols">' + list.map(function(r, i){ return '<figure class="oh-bigpol" style="--r:' + (i % 2 ? 2.5 : -2.5) + 'deg">' + thumbHtml(r.photo) + '<figcaption lang="' + G.lang + '">' + esc(T(r)) + (GL(r) ? '<small dir="' + uiDir() + '" lang="' + G.ui + '">' + esc(GL(r)) + '</small>' : '') + '</figcaption></figure>'; }).join('') + '</div>';
  G.over.appendChild(board);
  if(!RM()) await run(board, [{opacity:0}, {opacity:1}], {duration:300});
  await new Promise(function(res){
    controls('<div class="oh-askrow"><button type="button" class="oh-chip oh-primary oh-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' + esc(U('listen')) + '</button></div>');
    G.status = {kind:'recapSpoken', station:G.sid, play:'.oh-play'};
    var hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-play'); if(b) b.classList.add('oh-shine'); }, h45:function(){}});
    G.ctl.querySelector('.oh-play').addEventListener('click', async function(){
      hn.stop(); controls(''); G.status = {kind:'scripted', station:G.sid};
      var figs = board.querySelectorAll('.oh-bigpol');
      for(var i = 0; i < list.length; i++){ if(!G) return; figs.forEach(function(f, j){ f.classList.toggle('oh-hl', j === i); }); await speak(T(list[i])); await wait(250); }
      figs.forEach(function(f){ f.classList.remove('oh-hl'); });
      res();
    });
  });
}
async function evRecap(){
  var cs = contentStation('recap'); if(!cs) return;
  var phrases = (cs.phrases || []).filter(function(p){ return G.list.indexOf(p.station) >= 0; });
  var cons = (cs.connectors || []).slice(0, 4);
  var because = (cs.connectors || [])[4] || null;
  for(var i = 0; i < (cs.lines || []).length; i++){ var ln = cs.lines[i]; if(/\.say$/.test(ln.id)) continue; await lineSay(ln); }
  var slots = [null, null, null, null];
  var board = el('div', 'oh-board');
  board.innerHTML = '<div class="oh-pols oh-pols-' + phrases.length + '">' + phrases.map(function(p, i){
    return '<button type="button" class="oh-bigpol oh-pick" data-st="' + esc(p.station) + '" style="--r:' + ([-3, 2.5, -1.5, 3, -2.5, 1.5, -2][i % 7]) + 'deg">' + thumbHtml(p.station) + '<i class="oh-pnum"></i></button>';
  }).join('') + '</div>';
  G.over.appendChild(board);
  if(!RM()) await run(board, [{opacity:0}, {opacity:1}], {duration:320});
  cue('story');
  G.root.classList.add('oh-recapping');
  function sentence(i){
    var p = slots[i]; if(!p) return '';
    var c = T(cons[i]), t = T(p);
    if(G.lang === 'es') t = t.charAt(0).toLowerCase() + t.slice(1);
    var comma = /^(then|luego)$/i.test(c) ? ' ' : ', ';
    return c + comma + t;
  }
  function paint(){
    var html = '<ol class="oh-slots">' + cons.map(function(c, i){
      var p = slots[i];
      return '<li class="oh-slot' + (p ? ' oh-full' : '') + '" data-i="' + i + '"><b class="oh-con" lang="' + G.lang + '">' + esc(T(c)) + '</b>' +
        (p ? '<button type="button" class="oh-slotbtn" aria-label="' + esc(U('takeBack')) + '" lang="' + G.lang + '" dir="ltr">' + esc(sentence(i).slice(T(c).length).replace(/^,?\s/, '')) + '</button>' : '<span class="oh-slotdash"></span>') + '</li>';
    }).join('') + '</ol>' +
      (because ? '<p class="oh-because' + (slots.some(function(p){ return p && p.usesBecause; }) ? ' oh-on' : '') + '" lang="' + G.lang + '">' + esc(T(because)) + '</p>' : '') +
      '<div class="oh-askrow oh-recap-row"><button type="button" class="oh-chip oh-primary oh-play"' + (slots.every(Boolean) ? '' : ' disabled') + '><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' + esc(U('listen')) + '</button></div>';
    controls(html);
    G.ctl.querySelectorAll('.oh-slot.oh-full .oh-slotbtn').forEach(function(b){
      b.addEventListener('click', function(){ var i = +b.parentNode.dataset.i; var p = slots[i]; slots[i] = null; var pol = board.querySelector('[data-st="' + p.station + '"]'); if(pol){ pol.classList.remove('oh-used'); } sfx('tick'); paint(); numbers(); });
    });
    var pb = G.ctl.querySelector('.oh-play');
    pb.addEventListener('click', function(){ if(slots.every(Boolean) && G.recapPlay) G.recapPlay(); });
  }
  function numbers(){ board.querySelectorAll('.oh-bigpol').forEach(function(b){ var i = slots.map(function(p){ return p && p.station; }).indexOf(b.dataset.st); b.querySelector('.oh-pnum').textContent = i >= 0 ? (i + 1) : ''; b.classList.toggle('oh-used', i >= 0); }); }
  paint();
  var hn = hints({h15:function(){ var b = board.querySelector('.oh-pick:not(.oh-used)'); if(b) b.classList.add('oh-shine'); }, h45:function(){ board.querySelectorAll('.oh-pick:not(.oh-used)').forEach(function(b){ b.classList.add('oh-shine'); }); }});
  G.status = {kind:'recap', station:'recap', pols:phrases.map(function(p){ return '.oh-pick[data-st="' + p.station + '"]'; }), play:'.oh-play', said:'.oh-said', skip:'.oh-skip'};
  await new Promise(function(res){
    board.querySelectorAll('.oh-pick').forEach(function(b){
      b.addEventListener('click', function(){
        if(b.classList.contains('oh-used')) return;
        var i = slots.indexOf(null); if(i < 0) return;
        slots[i] = phrases.filter(function(p){ return p.station === b.dataset.st; })[0];
        hn.progress(); sfx('paper');
        if(!RM()) fx(b, [{transform:'rotate(var(--r)) scale(1)'}, {transform:'rotate(0) scale(1.12)'}, {transform:'rotate(var(--r)) scale(1)'}], {duration:300, easing:SPRING});
        speak(sentence(i), {who:'you', interrupt:true});
        paint(); numbers();
      });
    });
    G.recapPlay = async function(){
      hn.stop();
      G.recapPlay = null;
      G.status = {kind:'scripted', station:'recap'};
      var lis = G.ctl.querySelectorAll('.oh-slot');
      G.ctl.querySelector('.oh-play').disabled = true;
      board.querySelectorAll('.oh-pick').forEach(function(b){ b.disabled = true; });
      // the model in a natural voice: connector, then phrase, slot by slot (the app's speakSlots pattern)
      for(var i = 0; i < 4; i++){ if(!G) return; lis.forEach(function(l, j){ l.classList.toggle('oh-hl', j === i); }); await speak(sentence(i), {who:'you'}); await wait(220); }
      if(!G) return;
      lis.forEach(function(l){ l.classList.remove('oh-hl'); });
      var sayLine = (cs.lines || []).filter(function(l){ return /\.say$/.test(l.id); })[0];
      var row = G.ctl.querySelector('.oh-recap-row');
      if(sayLine){ var sp = el('p', 'oh-sayit', esc(T(sayLine)) + (GL(sayLine) ? '<small dir="' + uiDir() + '" lang="' + G.ui + '">' + esc(GL(sayLine)) + '</small>' : '')); sp.setAttribute('lang', G.lang); row.parentNode.insertBefore(sp, row); }
      row.innerHTML = '<button type="button" class="oh-chip oh-skip">' + esc(T(cs.buttons.skip)) + '</button><button type="button" class="oh-chip oh-primary oh-said">' + esc(T(cs.buttons.said)) + '</button>';
      G.root.classList.add('oh-recap-say');
      if(!RM()) fx(row, [{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'none'}], {duration:240});
      try{ row.scrollIntoView({block:'nearest'}); }catch(e){}
      G.status = {kind:'recapSay', station:'recap', said:'.oh-said', skip:'.oh-skip'};
      var fin = function(said){ G.status = {kind:'scripted', station:'recap'}; var text = [0, 1, 2, 3].map(sentence).join(' '); G.round.souvenir = {text:text, say:text, said:said, back:T(cs.souvenir.back), backGl:GL(cs.souvenir.back)}; save(true); res(); };
      row.querySelector('.oh-said').addEventListener('click', function(){ sfx('combo'); fin(true); });
      row.querySelector('.oh-skip').addEventListener('click', function(){ fin(false); });
    };
  });
  G.root.classList.remove('oh-recapping', 'oh-recap-say');
  controls(''); cue(null);
}

/* ============================== recipe card (live HTML on paper) ============================== */
function recipeShow(){
  var ui = (G.shot.def.ui || []).filter(function(u){ return u.type === 'recipe'; })[0]; if(!ui) return;
  var R = G.P.recipe; if(!R) return;
  var a1 = G.band === 'A1';
  var rows = R.rows.filter(function(r){ return !r.if || cond(r.if); });
  var card = el('div', 'oh-recipe');
  card.style.left = ui.x + '%'; card.style.top = ui.y + '%'; card.style.width = ui.w + '%';
  var contrast = '';
  var cs = contentStation(G.sid);
  if(cs && cs.explain && cs.explain.contrast){ var ct = cs.explain.contrast[G.ui]; if(ct && G.ui !== G.lang) contrast = '<p class="oh-contrast" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(ct) + '</p>'; }
  card.innerHTML = '<i class="oh-tape"></i><p class="oh-rtitle" lang="' + G.lang + '">' + esc(T(R.title)) + '</p><ul>' + rows.map(function(r){
    // A1 shows the bare word (flour), so its gloss is the word's own, not the 'some ...' row's
    var gl = a1 && G.ui !== G.lang ? (r.kind === 'mass' ? objGloss(r.item) : (r.gl || {})[G.ui]) : '';
    return '<li data-item="' + esc(r.item) + '" class="oh-' + r.kind + '"><span class="oh-rtick"></span><span lang="' + G.lang + '" dir="ltr">' + esc(T(a1 && r.a1 ? r.a1 : r.text)) + '</span>' + (gl ? '<small lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(gl) + '</small>' : '') + '</li>';
  }).join('') + '</ul>' + contrast;
  G.uiLayer.appendChild(card);
  G.recipe = card;
  // resume: rows already done stay ticked
  sfx('paper');
  if(!RM()) return run(card, [{opacity:0, transform:'translate(-30px,-20px) rotate(-12deg) scale(.8)'}, {opacity:1, transform:'rotate(-2deg)'}], {duration:480, easing:SPRING});
}
function recipeExplain(){ if(G.recipe) G.recipe.classList.add('oh-explain'); }
function recipeTick(item){
  if(!G.recipe) return;
  var li = G.recipe.querySelector('li[data-item="' + item + '"]'); if(!li || li.classList.contains('oh-ticked')) return;
  li.classList.add('oh-ticked'); sfx('pencil');
  var t = li.querySelector('.oh-rtick');
  if(!RM()) fx(t, [{transform:'scale(0) rotate(-30deg)', opacity:0}, {transform:'scale(1.3) rotate(0)', opacity:1, offset:.6}, {transform:'none', opacity:1}], {duration:360, easing:SPRING});
}

/* ============================== shot UI widgets (scale dial, oven dial ring) ============================== */
function mountShotUi(){
  (G.shot.def.ui || []).forEach(function(u){
    if(u.type === 'scale'){
      var s = el('div', 'oh-scale', '<i class="oh-scale-mark"></i>');
      var r = u.r;
      s.style.left = (u.pivot[0] - r) + '%'; s.style.width = (2 * r) + '%';
      s.style.top = 'calc(' + u.pivot[1] + '% - ' + r + 'cqw)';
      s.style.height = (2 * r) + 'cqw';
      G.uiLayer.appendChild(s);
    }
    if(u.type === 'dialring'){
      var n = L(u.layer); if(!n) return;
      var ring = el('div', 'oh-dialring');
      var x = +n.dataset.x, y = +n.dataset.y, w = +n.dataset.w, h = +n.dataset.h;
      ring.style.left = (x - w * .25) + '%'; ring.style.width = (w * 1.5) + '%';
      ring.style.top = 'calc(' + (y + h / 2) + '% - ' + (w * .75) + 'cqw)'; ring.style.height = (w * 1.5) + 'cqw';
      var steps = (u.max - u.min) / u.step, html = '';
      for(var i = 0; i <= steps; i++){
        var v = u.min + i * u.step, a = u.arc[0] + (u.arc[1] - u.arc[0]) * i / steps;
        html += '<span class="oh-dt' + (v % u.every === 0 ? ' oh-dt-big' : '') + '" data-v="' + v + '" style="--a:' + a + 'deg"><i></i>' + (v % u.every === 0 ? '<b style="--na:' + (-a) + 'deg">' + v + '</b>' : '') + '</span>';
      }
      ring.innerHTML = html;
      G.uiLayer.appendChild(ring);
    }
  });
}

/* ============================== label event (optional: tap to hear) ============================== */
function labelTap(Lr){
  var line = lineFor(Lr.label);
  VERB.shake(Lr.id);
  if(Lr.cast === 'captain') sfx('purr');
  if(line){ var t = T(line); balloon({who:line.who, text:t, gloss:GL(line)}); speak(t, {interrupt:true}); }
}

/* ============================== v0.3: light arc, curios, Captain, free-line, because chips, the party table ============================== */
// CZ8: every station has a light (morning, noon, afternoon, golden; never night). Until each plate is painted in its light, a soft
// wash over the panel carries the arc toward the brightest, warmest frame at the delivery
function setLight(sid){
  var st = G.P.stations[sid] || {}, cs = contentStation(sid) || {};
  var l = st.light || cs.light || G.P.light || 'morning';
  if(l === 'night' || l === 'dark') l = 'golden';
  G.frame.dataset.light = l;
}
// CZ12 curios (optional tap zones that tell a neighbour's story) and finds (the same, but they write memory: laundry.sockFound)
// a curio whose line this band does not have is not there (the layer may stay as plain decoration)
function curioDefs(){ return ((G.P.stations[G.sid] || {}).curios || []).filter(function(c){ return (!c.if || cond(c.if)) && lineFor(c.line); }); }
function mountCurios(key){
  curioDefs().forEach(function(c){
    if(c.layer || (c.shot && c.shot !== key) || !c.hot) return;
    var b = el('button', 'oh-curio'); b.type = 'button'; b.tabIndex = -1;
    b.dataset.curio = c.id;
    b.style.left = c.hot.x + '%'; b.style.top = c.hot.y + '%'; b.style.width = c.hot.w + '%'; b.style.height = c.hot.h + '%';
    b.setAttribute('aria-label', c.id);
    b.addEventListener('click', function(e){ e.stopPropagation(); curioTap(c, b); });
    G.shot.cam.appendChild(b);
  });
}
function mountFind(d, f){
  var b = el('button', 'oh-curio oh-find'); b.type = 'button'; b.tabIndex = -1; b.dataset.curio = f.id;
  b.style.left = f.x + '%'; b.style.top = f.y + '%'; b.style.width = f.w + '%'; b.style.height = f.h + '%';
  if(f.art) b.innerHTML = artHtml(f.art);
  // the find sits inside a draggable layer: a press on it must not start the drag
  b.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
  b.addEventListener('click', function(e){
    e.stopPropagation();
    var c = ((G.P.stations[G.sid] || {}).curios || []).filter(function(x){ return x.id === f.id; })[0];
    if(c) curioTap(c, b);
  });
  d.appendChild(b);
}
var curioBusy = false;
async function curioTap(c, b){
  if(!G || curioBusy) return;
  var found = G.round.curios = G.round.curios || {};
  var mine = found[G.sid] = found[G.sid] || [];
  var first = mine.indexOf(c.doodle || c.id) < 0;
  if(c.once && !first) return;
  curioBusy = true;
  try{
    sfx(c.sfx || 'pop');
    var hb = c.hot || {x:50, y:50, w:0, h:0};
    if(first){ mine.push(c.doodle || c.id); VERB.burst(hb.x + hb.w / 2, hb.y, 5, '#FFD166', .06); }
    if(b && !RM()) fx(b, [{transform:'scale(1)'}, {transform:'scale(1.12)'}, {transform:'scale(1)'}], {duration:300, easing:SPRING});
    if(c.mem && first) Object.keys(c.mem).forEach(function(k){ memSet(k, c.mem[k]); });
    if(c.do && first) await runSteps(c.do);
    var line = lineFor(c.line);
    if(line){
      // a curio never interrupts a gesture or the script: its line shows and speaks, and play goes on
      var t = fill(T(line), line);
      balloon({who:line.who, text:t, gloss:fillGloss(GL(line), line)});
      speak(t, {who:line.who, interrupt:true});
      G.lastLine = t;
    }
    if(c.once && b) b.remove();
    save(true);
  }catch(err){ if(err !== ABORT && G) console.warn('[cozy] curio', err); }
  finally{ curioBusy = false; }
}
// a found curio adds a small ink doodle to that station's polaroid (never a count, never a list)
var DOODLE = {
  carpet:'M4 14h16v-6H4zM6 8V6M10 8V6M14 8V6M18 8V6M6 16v2M10 16v2M14 16v2M18 16v2', lanyard:'M8 3l4 8 4-8M9 11h6v9H9z', medal:'M8 3l4 6 4-6M12 21a5 5 0 100-10 5 5 0 000 10z',
  sock:'M9 3h5v9l4 3c2 2 0 6-3 5l-6-3V3z', poster:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', photo:'M4 6h16v12H4zM8 14l3-3 3 3 2-2 2 2', oven:'M4 4h16v16H4zM7 9h10v8H7zM8 6h1M11 6h1',
  bowl:'M3 11h18a9 7 0 01-18 0zM9 7c0-2 6-2 6 0', bell:'M6 16h12l-2-3V9a4 4 0 00-8 0v4zM11 19h2', calendar:'M4 6h16v14H4zM4 10h16M8 4v4M16 4v4',
  tag:'M4 12l8-8h8v8l-8 8zM15 9h.01', scissors:'M6 7a2 2 0 100-4 2 2 0 000 4zM6 21a2 2 0 100-4 2 2 0 000 4zM7.5 6.5L20 18M7.5 17.5L20 6',
  star:'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8z'
};
function doodleSvg(k){
  return '<svg class="oh-doodle" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (DOODLE[k] || DOODLE.star) + '"/></svg>';
}

// CZ2 Captain's moment: short, comic, never failing, never in a top shot. Captain hops in and paws something; Mrs Bell calls out;
// a tap on him (or the thing) settles him and the label line plays once; ignored for 6 s, he settles by himself. No polaroid, no memory
async function captainBeat(c){
  if(!G || !c) return;
  if((c.notBands && c.notBands.indexOf(G.band) >= 0) || (c.bands && c.bands.indexOf(G.band) < 0)) return;   // A2 and up (GDD 13.1)
  var flag = G.round.captain = G.round.captain || {};
  if(flag[G.sid]) return;
  flag[G.sid] = 1;
  var kind = G.shot && G.shot.def.kind;
  if(kind === 'top' && !c.allowTop) return;   // Q18: never in a precision shot
  var lid = c.layer || 'captain', cat = L(lid), prop = c.prop ? L(c.prop) : null;
  if(!cat) return;
  var t0 = Date.now();
  var label = lineFor(c.label);
  if(RM()){
    // reduced motion: Captain is simply there, sitting; a tap plays the label line
    cat.classList.remove('oh-gone'); if(c.sit) VERB.pose(lid, c.sit);
    labelOn(cat, label);
    return;
  }
  G.busyLine = true; G.busyDrop = true;
  var prevStatus = G.status;
  try{
    cat.classList.remove('oh-gone');
    if(c.jump) VERB.pose(lid, c.jump);
    sfx('meow');
    await run(cat, [{transform:'translateY(40%) scale(.9)', opacity:0}, {transform:'translateY(-12%) scale(1.04)', opacity:1, offset:.6}, {transform:'none', opacity:1}], {duration:420, easing:SPRING});
    if(c.paw) VERB.pose(lid, c.paw);
    if(prop){ motionLines(prop); VERB.shake(c.prop); }
    var call = lineFor(c.call);
    if(call) await lineSay(call, null, {hint:true});
    var tapped = new Promise(function(res){
      var on = function(e){ e.stopPropagation(); res(true); };
      [cat, prop].forEach(function(n){ if(n){ n.classList.add('oh-tapme', 'oh-catme'); n.addEventListener('click', on, {once:true}); } });
      G.catOff = function(){ [cat, prop].forEach(function(n){ if(n){ n.classList.remove('oh-tapme', 'oh-catme'); n.removeEventListener('click', on); } }); };
    });
    G.status = {kind:'captain', station:G.sid, cat:'.oh-live [data-oh="' + lid + '"]'};
    var left = Math.max(1500, 10000 - (Date.now() - t0) - 1500);
    var settled = await Promise.race([tapped, wait(Math.min(6000, left), true).then(function(){ return false; })]);
    if(G.catOff){ G.catOff(); G.catOff = null; }
    if(prop) VERB.shake(c.prop);
    if(c.sit) VERB.pose(lid, c.sit);
    sfx('purr');
    if(settled && label){ var lt = T(label); balloon({who:label.who, text:lt, gloss:GL(label)}); G.lastLine = lt; await Promise.race([speak(lt, {interrupt:true}), wait(readMs(lt), true)]); }
    labelOn(cat, label);
  }catch(err){ if(err !== ABORT) throw err; }
  finally{ if(G){ G.busyLine = false; G.busyDrop = false; G.status = prevStatus; } }
}
function labelOn(n, line){
  if(!line || n.dataset.lab) return;
  n.dataset.lab = '1'; n.classList.add('oh-labelled');
  n.addEventListener('click', function(e){ if(G && !G.dragging){ e.stopPropagation(); var t = T(line); balloon({who:line.who, text:t, gloss:GL(line)}); speak(t, {interrupt:true}); sfx('purr'); } });
}

// free-line (B2 / C1, GDD 4.4): the learner types or says one line (3 words or more, unscored); the neighbour answers from the script,
// then "Another way to say it" shows the model with play. Starters drop into the field; after the guide, "Show me one" fills the model.
function freeSpec(){
  var cs = contentStation(G.sid) || {};
  if(cs.freeLine) return cs.freeLine;
  var br = (cs.branches || []).filter(function(b){ return !b.if || cond(b.if); })[0];
  if(br && br.freeLine) return br.freeLine;
  var model = cs.model2 && cond(cs.model2.if) ? cs.model2 : cs.model;
  return {starters:cs.starters, model:model, reply:cs.reply};
}
async function evFreeLine(o){
  o = o || {};
  var sp = freeSpec(); if(!sp || !sp.model) return;
  if(sp.prompt) await lineSay(sp.prompt);
  cue('free');
  G.root.classList.add('oh-compact', 'oh-freeing');
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var text = await new Promise(function(res){
    controls('<div class="oh-free">' +
      '<div class="oh-chips oh-chips-sm oh-starters">' + (sp.starters || []).map(function(st, i){ return '<button type="button" class="oh-chip oh-starter" data-i="' + i + '" lang="' + G.lang + '" dir="ltr">' + esc(st) + '</button>'; }).join('') + '</div>' +
      '<div class="oh-freebox"><textarea class="oh-freein" rows="2" lang="' + G.lang + '" dir="ltr" placeholder="' + esc(U('typeHere')) + '" autocomplete="off" spellcheck="false"></textarea>' +
      (SR ? '<button type="button" class="oh-tool oh-mic" aria-label="' + esc(U('mic')) + '"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4"/></svg></button>' : '') + '</div>' +
      '<div class="oh-askrow"><button type="button" class="oh-chip oh-help" hidden>' + esc(U('helpMe')) + '</button><button type="button" class="oh-chip oh-primary oh-send" disabled>' + esc(U('send')) + '</button></div></div>');
    var inp = G.ctl.querySelector('.oh-freein'), send = G.ctl.querySelector('.oh-send'), help = G.ctl.querySelector('.oh-help');
    var hn = null;
    var ok = function(){ send.disabled = words(inp.value) < 3; };
    inp.addEventListener('input', function(){ ok(); if(hn) hn.progress(); });
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(!send.disabled) send.click(); } });
    G.ctl.querySelectorAll('.oh-starter').forEach(function(b){
      b.addEventListener('click', function(){
        var stx = b.textContent.replace(/[….]+\s*$/, '').trim();
        inp.value = (inp.value.trim() ? inp.value.trim() + ' ' : '') + stx + ' ';
        ok(); if(hn) hn.progress(); sfx('paper');
        b.classList.remove('oh-shine');
      });
    });
    var mic = G.ctl.querySelector('.oh-mic');
    if(mic) mic.addEventListener('click', function(){
      try{
        var r = new SR(); r.lang = G.lang === 'es' ? 'es-ES' : 'en-GB'; r.interimResults = false;
        mic.classList.add('oh-on');
        r.onresult = function(e){ var t = e.results[0][0].transcript; inp.value = (inp.value.trim() ? inp.value.trim() + ' ' : '') + t; ok(); if(hn) hn.progress(); };
        r.onend = r.onerror = function(){ mic.classList.remove('oh-on'); };
        r.start();
      }catch(e){ mic.classList.remove('oh-on'); }
    });
    help.addEventListener('click', function(){ inp.value = fill(T(sp.model), sp.model); ok(); sfx('paper'); });
    hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-starter'); if(b) b.classList.add('oh-shine'); }, h45:function(){ help.hidden = false; help.classList.add('oh-shine'); }});
    G.status = {kind:'free', station:G.sid, input:'.oh-freein', send:'.oh-send', starters:'.oh-starter', help:'.oh-help'};
    send.addEventListener('click', function(){ if(words(inp.value) < 3) return; hn.stop(); G.status = {kind:'scripted', station:G.sid}; res(inp.value.trim().replace(/\s+/g, ' ')); });
  });
  G.root.classList.remove('oh-compact', 'oh-freeing');
  controls(''); cue(null);
  G.round.choices[G.sid + '.free'] = text;
  save(true);
  await lineSay({who:'you', en:text, es:text});
  var rep = [].concat(sp.reply || [], sp.replies || []);
  for(var i = 0; i < rep.length; i++) if(!rep[i].if || cond(rep[i].if)) await lineSay(rep[i]);
  await modelCard(sp.model);
  if(o.souvenir){ var cs = contentStation(o.backFrom || G.sid) || {}; G.round.souvenir = {text:text, say:text, model:fill(T(sp.model), sp.model), back:T((cs.souvenir || {}).back), backGl:GL((cs.souvenir || {}).back)}; save(true); }
}
// "Another way to say it": the model line with play, then Next
async function modelCard(m){
  if(!m) return;
  var t = fill(T(m), m), gl = fillGloss(GL(m), m);
  G.root.classList.add('oh-compact');
  await new Promise(function(res){
    controls('<div class="oh-model"><p class="oh-model-h" dir="' + uiDir() + '">' + esc(U('another')) + '</p><p class="oh-model-t" lang="' + G.lang + '" dir="ltr">' + esc(t) + '</p>' +
      (gl ? '<p class="oh-gloss' + (showGloss() ? '' : ' oh-hide') + '" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(gl) + '</p>' : '') +
      '<div class="oh-askrow"><button type="button" class="oh-chip oh-mplay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' + esc(U('listen')) + '</button><button type="button" class="oh-chip oh-primary oh-mnext">' + esc(U('next')) + '</button></div></div>');
    G.status = {kind:'model', station:G.sid, next:'.oh-mnext', play:'.oh-mplay'};
    G.ctl.querySelector('.oh-mplay').addEventListener('click', function(){ speak(t, {who:'you', interrupt:true}); });
    G.ctl.querySelector('.oh-mnext').addEventListener('click', function(){ stopSpeech(); G.status = {kind:'scripted', station:G.sid}; res(); });
    speak(t, {who:'you'});
  });
  G.root.classList.remove('oh-compact');
  controls('');
}
// because chips (B1 recap): one "I ..." chip and one "because ..." chip make the learner's sentence; play it, say it, see a model
async function evChips(o){
  o = o || {};
  var cs = contentStation(G.sid) || {};
  var fl = {fill:G.P.chipFill || ''};
  var all = (cs.chips || []).map(function(c){ return fill(c, fl); });
  var isB = function(c){ return /^(because|porque)\b/i.test(c); };
  var A = all.filter(function(c){ return !isB(c); }), B = all.filter(isB);
  cue('build');
  G.root.classList.add('oh-compact', 'oh-building');
  var pick = {a:null, b:null};
  var text = await new Promise(function(res){
    controls('<div class="oh-build"><p class="oh-frame-line oh-buildline" lang="' + G.lang + '" dir="ltr"><b class="oh-blank">&nbsp;</b> <b class="oh-blank">&nbsp;</b></p>' +
      '<div class="oh-chips oh-chips-sm">' + A.map(function(c, i){ return '<button type="button" class="oh-chip oh-bchip" data-g="a" data-i="' + i + '" lang="' + G.lang + '" dir="ltr">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="oh-chips oh-chips-sm">' + B.map(function(c, i){ return '<button type="button" class="oh-chip oh-bchip oh-because" data-g="b" data-i="' + i + '" lang="' + G.lang + '" dir="ltr">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="oh-askrow"><button type="button" class="oh-chip oh-primary oh-say-btn" disabled>' + esc(U('done')) + '</button></div></div>');
    var hn = hints({h15:function(){ var b = G.ctl.querySelector('.oh-bchip:not(.oh-sel)'); if(b) b.classList.add('oh-shine'); }, h45:function(){ G.ctl.querySelectorAll('.oh-bchip').forEach(function(b){ b.classList.add('oh-shine'); }); }});
    G.status = {kind:'chips', station:G.sid, a:'.oh-bchip[data-g="a"]', b:'.oh-bchip[data-g="b"]', done:'.oh-say-btn'};
    G.ctl.querySelectorAll('.oh-bchip').forEach(function(b){
      b.addEventListener('click', function(){
        var gk = b.dataset.g; pick[gk] = b.textContent;
        G.ctl.querySelectorAll('.oh-bchip[data-g="' + gk + '"]').forEach(function(x){ x.classList.toggle('oh-sel', x === b); x.classList.remove('oh-shine'); });
        var bl = G.ctl.querySelectorAll('.oh-buildline .oh-blank'), bi = gk === 'a' ? 0 : 1;
        bl[bi].textContent = pick[gk] + (gk === 'b' ? '.' : ''); bl[bi].classList.add('oh-filled');
        hn.progress(); sfx('paper');
        speak(pick[gk], {who:'you', interrupt:true});
        G.ctl.querySelector('.oh-say-btn').disabled = !(pick.a && pick.b);
      });
    });
    G.ctl.querySelector('.oh-say-btn').addEventListener('click', function(){ if(!(pick.a && pick.b)) return; hn.stop(); G.status = {kind:'scripted', station:G.sid}; res(pick.a + ' ' + pick.b + '.'); });
  });
  G.root.classList.remove('oh-building');
  controls(''); cue(null);
  await lineSay({who:'you', en:text, es:text});
  // say it out loud (unscored)
  var said = await new Promise(function(res){
    controls('<p class="oh-sayit" lang="' + G.ui + '" dir="' + uiDir() + '">' + esc(U('sayAloud')) + '</p><div class="oh-askrow"><button type="button" class="oh-chip oh-skip">' + esc(U('skip')) + '</button><button type="button" class="oh-chip oh-primary oh-said">' + esc(U('said')) + '</button></div>');
    G.status = {kind:'recapSay', station:G.sid, said:'.oh-said', skip:'.oh-skip'};
    G.ctl.querySelector('.oh-said').addEventListener('click', function(){ sfx('combo'); res(true); });
    G.ctl.querySelector('.oh-skip').addEventListener('click', function(){ res(false); });
  });
  G.status = {kind:'scripted', station:G.sid};
  G.root.classList.remove('oh-compact');
  controls('');
  await modelCard(cs.model);
  var sb = (contentStation(o.backFrom || G.sid) || {}).souvenir || {};
  G.round.souvenir = {text:text, say:text, said:said, model:T(cs.model), back:T(sb.back), backGl:GL(sb.back)};
  save(true);
}
// the party table (GDD 6 table rule): a pull line plays for a dish when its condition holds; at most 3 in all, never a gap
function pullLine(keys){
  var cs = contentStation(G.sid) || {};
  var n = G.round.pulls || 0;
  if(n >= (G.P.maxPulls || 3)) return null;
  for(var i = 0; i < keys.length; i++){
    var k = '.' + keys[i];
    var p = (cs.pulls || []).filter(function(x){ return x.line && x.line.id.slice(-k.length) === k; })[0];
    if(p && cond(p.if)){ G.round.pulls = n + 1; return p.line; }
  }
  return null;
}
VERB.pull = function(){ var l = pullLine([].slice.call(arguments)); if(l) return lineSay(l); };
VERB.captain = function(){ var st = G.P.stations[G.sid] || {}; return captainBeat(st.captain); };
VERB.find = function(id){ var c = ((G.P.stations[G.sid] || {}).curios || []).filter(function(x){ return x.id === id; })[0]; if(c) return curioTap(c, null); };
VERB.kind = function(pool){ var l = kindLine(pool); if(l) return lineSay(l); };
VERB.light = function(l){ G.frame.dataset.light = l; };
// take what was placed on one ring of a composite off again (Ada B2: the chocolate sprinkles come off the cake)
VERB.clearRing = function(id, ringKey){ var n = L(id); if(!n || !n.dataset.comp) return; var C = (G.P.composites || {})[n.dataset.comp] || {}, st = G.round.items[C.store || 'decorate']; if(st) delete st[ringKey]; save(true); return VERB.recomp(id); };
// rebuild a composite layer from what was placed so far (the ribbon appears on the bouquet once its colour is chosen)
VERB.recomp = function(id){ var n = L(id); if(!n || !n.dataset.comp) return; var cid = n.dataset.comp; n.innerHTML = ''; buildComposite(n, cid, {}); return run(n, [{opacity:.6}, {opacity:1}], {duration:240}); };

// CZ10 the window lights up: number 12 from the street, this project's window lamp swaps on, its polaroid tucks into the frame
async function windowShot(){
  var B = (G.data.shared || {}).building; if(!B) return;
  G.windowShown = true;
  var sdef = JSON.parse(JSON.stringify(B.shot));
  var mine = G.P.id;
  (B.windows || []).forEach(function(w){
    var on = w.id === mine ? false : delivered(w.id);
    sdef.layers.push({id:'win-' + w.id, art:B.unlit, x:w.x, y:w.y, w:w.w, h:w.h, z:4, hidden:on});
    sdef.layers.push({id:'lit-' + w.id, art:B.lit, x:w.x, y:w.y, w:w.w, h:w.h, z:5, hidden:!on});
    sdef.layers.push({id:'pol-' + w.id, art:B.polaroid, x:w.x + w.w * .55, y:w.y + w.h * .52, w:w.w * .38, h:w.h * .36, z:6, hidden:!on});
  });
  G.say.innerHTML = ''; controls(''); cue(null);
  G.over.innerHTML = '';
  var prev = G.shot;
  var shot = mountShot(sdef, 'building'); shot.el.classList.add('oh-live');
  G.shot = shot; G.uiLayer.innerHTML = '';
  G.frame.dataset.light = 'morning';
  G.status = {kind:'end', station:'end'};
  await camEnter(shot, prev);
  var skip = false;
  var skipP = new Promise(function(res){ var f = function(){ skip = true; res(); }; G.frame.addEventListener('click', f, {once:true}); });
  var w = (B.windows || []).filter(function(x){ return x.id === mine; })[0];
  if(w && !RM()){
    await Promise.race([wait(500), skipP]);
    sfx('click');
    VERB.swapTo('win-' + mine, 'lit-' + mine);
    VERB.appear('pol-' + mine);
    VERB.burst(w.x + w.w / 2, w.y + w.h / 2, 12, '#FFD166', .1);
    sfx('reveal');
    if(!skip) await Promise.race([wait(2200), skipP]);
  } else {
    var a = L('win-' + mine), b = L('lit-' + mine), p = L('pol-' + mine);
    if(a) a.classList.add('oh-gone'); if(b) b.classList.remove('oh-gone'); if(p) p.classList.remove('oh-gone');
    sfx('reveal');
    await Promise.race([wait(1200, true), skipP]);
  }
}

/* ============================== the station runner ============================== */
function beatOK(b){
  if(b.bands && b.bands.indexOf(G.band) < 0) return false;
  if(b.notBands && b.notBands.indexOf(G.band) >= 0) return false;
  return true;
}
async function runBeats(beats){
  for(var i = 0; i < (beats || []).length; i++){
    live();
    var b = beats[i];
    if(!beatOK(b)) continue;
    if(b.if != null){ await runBeats(cond(b.if) ? (b.then || []) : (b.else || [])); if(!b.say && !b.do && !b.gesture) continue; }
    G.skipping = false;
    if(b.recipe === 'show') await recipeShow();
    if(b.recipe === 'explain') recipeExplain();
    if(b.shot) await enterShot(b.shot);
    if(b.card){ var cl = lineFor(b.card); if(cl) await titleCard(T(cl), GL(cl)); }
    if(b.do){ G.status = {kind:'scripted', station:G.sid}; await runSteps(b.do); G.skipping = false; }
    if(b.say){ for(var k = 0; k < b.say.length; k++) await sayRole(b.say[k]); }
    if(b.mem) Object.keys(b.mem).forEach(function(key){ memSet(key, b.mem[key]); });
    if(b.note) await noteAdd(b.note);
    if(b.noteChange){ if(b.noteChange.strike) noteStrike(b.noteChange.strike); if(b.noteChange.add) await noteAdd(b.noteChange.add); }
    if(b.ask) await evAsk(b.ask);
    if(b.reply) await evReply(b.reply);
    if(b.produce) await evProduce();
    if(b.recapSpoken) await evRecapSpoken();
    if(b.freeLine) await evFreeLine(b.freeLine);
    if(b.chips) await evChips(b.chips);
    if(b.souvenirLine){ var svl = lineFor(b.souvenirLine), svs = (contentStation(G.sid) || {}).souvenir || {}; if(svl){ var svt = fill(T(svl), svl); G.round.souvenir = {text:svt, say:svt, back:T(svs.back), backGl:GL(svs.back)}; save(true); } }
    if(b.model) await modelCard(lineFor(b.model));
    if(b.captain) await captainBeat(G.P.stations[G.sid].captain);
    if(b.photo){ await flash(); if(b.photo === 'album') await albumPop(); }
    if(b.gesture){
      var gd = b.gesture;
      if(gd.if && !cond(gd.if)) continue;
      var sti = G.round.items[G.sid] = G.round.items[G.sid] || {};
      var gi = G.gIdx = (G.gIdx || 0) + 1;
      if(G.resumeG && gi <= (sti.gdone || 0)){
        // resume: a gesture finished before the break jumps to its end state (a door opened stays open), it is not asked again
        if(gd.type === 'tap' && gd.on){ G.skipping = true; for(var t = 0; t < gd.targets.length; t++){ if(gd.on[gd.targets[t]]) await runSteps(gd.on[gd.targets[t]]); } G.skipping = false; }
        // the same for a big piece that was already moved (the bed at B1 and C1, the lamp): it stays where it was put
        if(gd.type === 'drag-to' && gd.snap) (sti.placed || []).forEach(function(rec){ var pn = L(rec.id); if(pn && gd.items.some(function(it){ return it.layer === rec.id || (it.item && pn.dataset.item === it.item); })){ pn.dataset.done = '1'; placeBox(pn, gd.snap[0] - (+pn.dataset.w) / 2, gd.snap[1] - (+pn.dataset.h) / 2, +pn.dataset.w, +pn.dataset.h); } });
        continue;
      }
      camStill();
      G.gestureNo = (G.gestureNo || 0) + 1;
      G.root.classList.add('oh-gesturing');
      G.house.taught = G.house.taught || {};
      if(!G.house.taught[gd.type]){ G.house.taught[gd.type] = true; if(['tap', 'drag-to', 'stir-circles', 'turn-dial', 'pipe-letters'].indexOf(gd.type) >= 0) G.demo = true; }   // pour and place guides change the gesture itself, so they get no ghost run
      await GESTURE[gd.type](gd);
      sti.gdone = gi; save(true);
      G.root.classList.remove('oh-gesturing');
      G.status = {kind:'scripted', station:G.sid};
      clearFx();
      live();
    }
  }
}
async function enterShot(key){
  var st = G.P.stations[G.sid], sdef = st.shots[key];
  var prev = G.shot;
  G.camAnim = null;
  var shot = mountShot(sdef, key);
  shot.el.classList.add('oh-live');
  G.shot = shot;
  G.uiLayer.innerHTML = '';
  G.recipe = null;
  await camEnter(shot, prev);
  mountShotUi();
  mountCurios(key);
}
async function titleCard(text, sub){
  var T2 = W.Theatre;
  if(T2 && T2.isOpen && T2.isOpen() && T2.titleCard) return T2.titleCard(text, sub || '', {ms:RM() ? 800 : 1500 * Math.max(G.pace, .1)});
  var c = el('div', 'oh-titlecard', '<div><p>' + esc(text) + '</p>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>');
  G.root.appendChild(c);
  await new Promise(function(res){ var t = setTimeout(res, (RM() ? 800 : 1500) * G.pace); c.addEventListener('click', function(){ clearTimeout(t); res(); }); });
  c.remove();
}
async function albumPop(){
  // the delivery photo flashes into the album
  var sid = G.sid;
  G.round.snaps[sid] = snapShot(G.shot);
  (G.round.albumed = G.round.albumed || {})[sid] = 1; G.round.albumSid = sid;
  var p = el('div', 'oh-albumpop', '<figure class="oh-bigpol">' + thumbHtml(sid) + '<figcaption>' + esc(U('album')) + '</figcaption></figure>');
  G.over.appendChild(p);
  sfx('reveal');
  if(!RM()){
    await run(p.firstChild, [{transform:'scale(.4) rotate(-12deg)', opacity:0}, {transform:'scale(1.04) rotate(2deg)', opacity:1, offset:.6}, {transform:'rotate(-2deg)', opacity:1}], {duration:520, easing:SPRING});
    await wait(900);
    var b = rect(G.noteBtn), r = rect(p.firstChild);
    await run(p.firstChild, [{transform:'rotate(-2deg)', opacity:1}, {transform:'translate(' + (b.left - r.left) + 'px,' + (b.top - r.top) + 'px) scale(.2) rotate(10deg)', opacity:0}], {duration:520, easing:'cubic-bezier(.5,0,.3,1)'});
  } else await wait(900);
  p.remove();
}
async function runStation(idx){
  live();
  var sid = G.list[idx];
  G.sid = sid; G.round.stationIdx = idx; G.gIdx = 0;
  renderStrip();
  var st = G.P.stations[sid];
  setLight(sid);
  G.over.innerHTML = '';
  if(st.type === 'recap'){
    await enterShot('main');
    await evRecap();
  } else {
    // a band that skips the opening beats (A1 has no boxing step) starts on its own first shot, never on a frame it won't use
    var beats = st.beats || [], first = beats.filter(beatOK)[0];
    if(first && first.shot && Object.keys(first).every(function(k){ return k === 'shot' || k === 'bands' || k === 'notBands'; })){
      await enterShot(first.shot);
      beats = beats.slice(beats.indexOf(first) + 1);
    } else await enterShot(Object.keys(st.shots)[0]);
    await runBeats(beats);
  }
  live();
  G.round.snaps[sid] = G.round.snaps[sid] || snapShot(G.shot);
  if(st.type !== 'recap' && !(G.round.albumed || {})[sid]) G.round.snaps[sid] = snapShot(G.shot);
  await flash();
  developPolaroid(sid);
  sfx('correct');
  G.round.stationIdx = idx + 1;
  G.round.items[sid] = G.round.items[sid] || {};
  save(true);
  await wait(900);
}

/* ============================== save / resume (GDD 11) ============================== */
var LS_ROUND = 'farinCozyRound', LS_HOUSE = 'farinCozyHouse';
function hostLoadRound(host){ try{ if(host && host.loadRound) return host.loadRound(); return JSON.parse(localStorage.getItem(LS_ROUND) || 'null'); }catch(e){ return null; } }
function save(){
  if(!G) return;
  try{ if(G.host.saveRound) G.host.saveRound(G.round); else localStorage.setItem(LS_ROUND, JSON.stringify(G.round)); }catch(e){}
  try{ if(G.host.saveHouse) G.host.saveHouse(G.house); else localStorage.setItem(LS_HOUSE, JSON.stringify(G.house)); }catch(e){}
}
function loadHouse(host){
  var h = null;
  try{ h = host.loadHouse ? host.loadHouse() : JSON.parse(localStorage.getItem(LS_HOUSE) || 'null'); }catch(e){}
  h = h && typeof h === 'object' ? h : {};
  h.projects = h.projects || {}; h.mem = h.mem || {}; h.party = h.party || {};
  return h;
}

/* ============================== the end: souvenir card ============================== */
async function souvenir(){
  var sv = G.round.souvenir;
  if(!sv) sv = {text:'', back:''};
  // CZ11: the front shows the learner's own version (their composite, or the photo of the station where they made it)
  var SV = G.P.souvenir || {}, deliverThumb;
  if(SV.composite){
    var cbox = el('div', 'oh-thumb oh-souv-comp'); cbox.style.aspectRatio = '1 / 1';
    var cl = el('div', 'oh-layer oh-comp'); cl.style.cssText = 'left:' + (SV.box ? SV.box[0] : 8) + '%;top:' + (SV.box ? SV.box[1] : 8) + '%;width:' + (SV.box ? SV.box[2] : 84) + '%;height:' + (SV.box ? SV.box[3] : 84) + '%';
    buildComposite(cl, SV.composite, {});
    if(SV.bg) cbox.style.background = SV.bg;
    cbox.appendChild(cl); deliverThumb = cbox.outerHTML;
  } else deliverThumb = thumbHtml(SV.station || G.round.albumSid || 'deliver');
  G.say.innerHTML = ''; cue(null);
  var card = el('div', 'oh-souv');
  card.innerHTML = '<div class="oh-souv-card"><div class="oh-souv-face oh-souv-front"><figure class="oh-bigpol oh-souv-pol">' + deliverThumb + '<figcaption lang="' + G.lang + '">' + esc(T(G.V.title)) + '</figcaption></figure><p class="oh-souv-flip" dir="' + uiDir() + '">' + esc(U('flip')) + '</p></div>' +
    '<div class="oh-souv-face oh-souv-back"><p class="oh-souv-k" lang="' + G.lang + '">' + esc(sv.back || '') + '</p><p class="oh-souv-t" lang="' + G.lang + '" dir="ltr">' + esc(sv.text || '') + '</p>' +
    '<button type="button" class="oh-tool oh-souv-say" aria-label="' + esc(U('hear')) + '"><svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6M17.8 6.5a7.5 7.5 0 010 11"/></svg></button>' +
    '<p class="oh-souv-kept" dir="' + uiDir() + '">' + esc(U('kept')) + '</p></div></div>';
  G.over.innerHTML = ''; G.over.appendChild(card);
  var inner = card.firstChild;
  sfx('reveal');
  if(!RM()) await run(inner, [{transform:'translateY(40px) scale(.85) rotate(-4deg)', opacity:0}, {transform:'none', opacity:1}], {duration:520, easing:SPRING});
  inner.addEventListener('click', function(e){
    if(e.target.closest('.oh-souv-say')){ speak(sv.say || sv.text, {who:'you', interrupt:true}); return; }
    inner.classList.toggle('oh-flipped'); sfx('paper');
  });
  setTimeout(function(){ if(G && !inner.classList.contains('oh-flipped')){ inner.classList.add('oh-flipped'); } }, 1600 * G.pace);
  try{ if(G.host.keep && sv.text) G.host.keep({kind:'chores', project:G.P.id, text:sv.text, say:sv.say || sv.text, note:sv.back || ''}); }catch(e){}
  await wait(600);
  controls('<div class="oh-askrow"><button type="button" class="oh-chip oh-primary oh-finish">' + esc(U('finish')) + '</button></div>');
  G.status = {kind:'done', finish:'.oh-finish'};
  await new Promise(function(res){ G.ctl.querySelector('.oh-finish').addEventListener('click', res); });
}

/* ============================== leave (x / Escape): "Leave? Your place is saved." ============================== */
function confirmLeave(){
  if(!G || G.leaving) return;
  if(G.modal.classList.contains('oh-open')) return;
  save(true);
  G.modal.innerHTML = '<div class="oh-modal-card" role="alertdialog" aria-modal="true" dir="' + uiDir() + '"><p>' + esc(U('leaveQ')) + '</p><div class="oh-askrow"><button type="button" class="oh-chip oh-stay">' + esc(U('stay')) + '</button><button type="button" class="oh-chip oh-primary oh-leave">' + esc(U('leave')) + '</button></div></div>';
  G.modal.classList.add('oh-open');
  var card = G.modal.firstChild;
  if(!RM()) fx(card, [{opacity:0, transform:'translateY(16px) scale(.94)'}, {opacity:1, transform:'none'}], {duration:280, easing:SPRING});
  G.prevStatus = G.status; G.status = {kind:'confirm', stay:'.oh-stay', leave:'.oh-leave'};
  card.querySelector('.oh-stay').addEventListener('click', function(){ G.modal.classList.remove('oh-open'); G.status = G.prevStatus; });
  card.querySelector('.oh-leave').addEventListener('click', function(){ leaveNow(); });
  try{ card.querySelector('.oh-stay').focus({preventScroll:true}); }catch(e){}
}
function leaveNow(){
  var g = G; if(!g) return;
  g.leaving = true; save(true);
  var cb = g.onLeave;
  destroy();
  if(cb) cb(); else if(W.Theatre && W.Theatre.isOpen && W.Theatre.isOpen()) W.Theatre.exit();
}
// Theatre's x calls onExit straight away (and force-closes after 700 ms), so the game catches the x and Escape first to ask.
// API request in games/cozy-chores/NOTES-THEATRE-API.md: an exitGuard option on Theatre.open would replace this.
function guardExit(g){
  var onClick = function(e){
    if(!G || G !== g || g.leaving) return;
    var x = e.target && e.target.closest && e.target.closest('.th-x');
    // the Theatre's day card and its play transition (.th-vt) lie over the HUD, so a tap where the x is lands on them: it counts as the x, and the card goes so the question can be seen
    if(!x && e.target && e.target.closest && e.target.closest('.th-titlecard, .th-vt')){
      var bx = D.querySelector('.th-x'), r = bx && bx.getBoundingClientRect();
      if(r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom){
        confirmLeave();
        var tc = D.querySelector('.th-titlecard'); if(tc && !e.target.closest('.th-titlecard')) tc.click();
      }
      return;
    }
    if(!x) return;
    e.preventDefault(); e.stopImmediatePropagation();
    confirmLeave();
  };
  var onKey = function(e){
    if(!G || G !== g || g.leaving) return;
    if(e.key === 'Escape'){
      e.preventDefault(); e.stopImmediatePropagation();
      if(g.modal.classList.contains('oh-open')){ g.modal.classList.remove('oh-open'); g.status = g.prevStatus; }
      else if(g.noteCard.classList.contains('oh-open')) closeNote();
      else confirmLeave();
    }
  };
  D.addEventListener('click', onClick, true);
  W.addEventListener('keydown', onKey, true);
  return function(){ D.removeEventListener('click', onClick, true); W.removeEventListener('keydown', onKey, true); };
}

/* ============================== layout: the 4:5 frame fits between the strip and the dock ============================== */
function layout(){
  if(!G) return;
  var cell = G.cell, cw = cell.clientWidth, ch = cell.clientHeight;
  if(!cw || !ch) return;
  var fw = Math.min(cw - 16, ch * 0.8), fh = fw * 1.25;
  if(fw > cw - 16){ fw = cw - 16; fh = fw * 1.25; }
  G.frame.style.width = Math.round(fw) + 'px'; G.frame.style.height = Math.round(fh) + 'px';
  G.root.style.setProperty('--oh-fw', Math.round(fw) + 'px');
}

/* ============================== build + start ============================== */
function build(box){
  // the engine draws in its own root inside the container (the Theatre's .th-stage keeps its own positioning)
  box.innerHTML = '';
  var root = el('div', 'oh-root');
  box.appendChild(root);
  G.root = root;
  if(G.forceReduced) root.classList.add('oh-rm');
  root.setAttribute('data-ui', G.ui);
  if(G.ui === 'fa') root.classList.add('oh-ui-rtl');
  var head = el('div', 'oh-head', '<div class="oh-strip" role="list"></div>');
  var cell = el('div', 'oh-cell');
  var frame = el('div', 'oh-frame');
  frame.setAttribute('dir', 'ltr');
  var uiL = el('div', 'oh-ui'), flashEl = el('div', 'oh-flash'), over = el('div', 'oh-over');
  frame.appendChild(uiL); frame.appendChild(over); frame.appendChild(flashEl);
  cell.appendChild(frame);
  var dock = el('div', 'oh-dock', '<div class="oh-say" aria-live="polite"></div><div class="oh-cue"></div><div class="oh-ctl"></div>');
  var noteBtn = el('button', 'oh-notebtn', '<i class="oh-tape"></i><span class="oh-nb-lines"></span>');
  noteBtn.type = 'button'; noteBtn.setAttribute('aria-label', U('note'));
  var noteCard = el('div', 'oh-notecard', '<div class="oh-note-paper"><i class="oh-tape"></i><p class="oh-note-h" lang="' + G.lang + '">' + esc(T(G.V.title)) + '</p><ul class="oh-note-list"></ul></div>');
  noteCard.setAttribute('aria-hidden', 'true');
  var modal = el('div', 'oh-modal');
  root.appendChild(head); root.appendChild(cell); root.appendChild(dock); root.appendChild(noteBtn); root.appendChild(noteCard); root.appendChild(modal);
  G.head = head; G.strip = head.firstChild; G.cell = cell; G.frame = frame; G.uiLayer = uiL; G.flashEl = flashEl; G.over = over;
  G.dock = dock; G.say = dock.querySelector('.oh-say'); G.cueEl = dock.querySelector('.oh-cue'); G.ctl = dock.querySelector('.oh-ctl');
  G.noteBtn = noteBtn; G.noteCard = noteCard; G.modal = modal;
  if(G.round.noteOn) noteBtn.classList.add('oh-on');
  noteBtn.addEventListener('click', function(e){ e.stopPropagation(); if(noteCard.classList.contains('oh-open')) closeNote(); else { openNote(); sfx('paper'); } });
  noteCard.addEventListener('click', function(){ closeNote(); });
  // tap to skip a scripted beat or a line (chSkip)
  var skipTap = function(e){
    if(!G || G.root.classList.contains('oh-gesturing')) return;
    if(e.target.closest('button')) return;
    if(G.lineSkip){ var f = G.lineSkip; G.lineSkip = null; stopSpeech(); f(); return; }
    if(G.status && G.status.kind === 'scripted') skipNow();
  };
  dock.addEventListener('click', skipTap);
  frame.addEventListener('click', skipTap);
  G.ro = W.ResizeObserver ? new ResizeObserver(layout) : null;
  if(G.ro) G.ro.observe(cell); else W.addEventListener('resize', layout);
  layout();
}
// a band can change a station without a second project file: bands[band].over = {station:{fields to replace}}, bands[band].souvenir
function bandProject(P, band){
  var cfg = P.bands[band], o = cfg && cfg.over;
  if(!o && !(cfg && cfg.souvenir)) return P;
  var st = Object.assign({}, P.stations);
  Object.keys(o || {}).forEach(function(k){ st[k] = Object.assign({}, st[k] || {}, o[k]); });
  return Object.assign({}, P, {stations:st}, cfg.souvenir ? {souvenir:cfg.souvenir} : {});
}
function newRound(P, band, lang){
  return {v:1, project:P.id, band:band, lang:lang, stationIdx:0, items:{}, choices:{}, note:[], noteOn:false, photos:[], snaps:{}, mem:JSON.parse(JSON.stringify(P.memory || {})), startedAt:Date.now()};
}
function start(o){
  if(G) destroy();
  o = o || {};
  var data = o.data, P = data.project;
  var band = (o.band && P.bands[o.band]) ? o.band : (P.anchor || 'A2');
  var lang = o.lang === 'es' ? 'es' : 'en';
  var host = o.host || {};
  var saved = o.resume ? hostLoadRound(host) : null;
  if(saved && (saved.project !== P.id || saved.lang !== lang || !P.bands[saved.band])) saved = null;
  if(saved) band = saved.band;
  var g = G = {
    v:VERSION, data:data, P:bandProject(P, band), M:data.manifest || {items:{}}, lang:lang, ui:o.ui || lang, band:band, bandCfg:P.bands[band],
    V:null, host:host, appRoot:o.appRoot || '', name:o.name || '', pace:o.pace || 1, tts:o.tts, hintMs:o.hintMs || null,
    forceReduced:!!o.reduced, onDone:o.onDone, onLeave:o.onLeave,
    round:saved || newRound(P, band, lang), house:loadHouse(host),
    list:P.bands[band].stations.slice(), roleIdx:{}, waits:new Set(), anims:new Set(), dead:false, skipping:false, status:{kind:'boot'},
    glossOn:false, box:o.root || (W.Theatre && W.Theatre.stageEl && W.Theatre.stageEl()) || D.body
  };
  g.V = variant(data, lang, band);
  if(!g.V) throw new Error('cozy: no content for ' + lang + ' ' + band);
  build(g.box);
  g.unguard = guardExit(g);
  // a closed Theatre removes the stage: stop everything with it
  g.mo = new MutationObserver(function(){ if(G === g && !g.box.isConnected) destroy(); });
  g.mo.observe(D.body, {childList:true});
  renderStrip();
  main(g, !!saved);
  return api(g);
}
async function main(g, resumed){
  try{
    if(!resumed){
      var day = T(g.V.dayCard), title = T(g.V.title);
      await titleCard(day, title);
    } else if(g.round.noteOn) g.noteBtn.classList.add('oh-on');
    for(var i = g.round.stationIdx; i < g.list.length; i++){
      // resume = the start of that station, camera at its entry frame; partial drag / place counts come back
      g.resumeG = resumed && i === g.round.stationIdx;
      await runStation(i);
      g.resumeG = false;
    }
    live();
    // delivered: the record, memory (write-latest), then the souvenir
    var H2 = g.house; H2.projects[g.P.id] = H2.projects[g.P.id] || {}; H2.projects[g.P.id][g.band] = {date:new Date().toISOString().slice(0, 10)};
    Object.keys(g.round.mem).forEach(function(k){ H2.mem[k] = g.round.mem[k]; });
    // what the learner made, kept for the Street Party table and later souvenirs (house.made, write-latest)
    if(g.P.keep){ H2.made = H2.made || {}; H2.made[g.P.id] = {band:g.band, items:JSON.parse(JSON.stringify(g.round.items[g.P.keep] || {}))}; }
    save(true);
    await souvenir();
    live();
    await windowShot();
    live();
    var result = {project:g.P.id, band:g.band, mem:Object.assign({}, g.round.mem), souvenir:g.round.souvenir || null, photos:g.round.photos.slice(), pulls:g.round.pulls || 0, windowShown:!!g.windowShown};
    try{ if(g.host.saveRound) g.host.saveRound(null); else localStorage.removeItem(LS_ROUND); }catch(e){}
    g.finished = true;
    var cb = g.onDone;
    destroy({keepDom:true});
    if(cb) cb(result);
  }catch(e){
    // destroyed mid-animation (x, Theatre closed): what was still awaiting has nothing to do any more; that is not an error
    if(e !== ABORT && !g.dead) console.error('[cozy]', e);
  }
}
function destroy(o){
  var g = G; if(!g) return;
  g.dead = true;
  stopSpeech();
  g.waits.forEach(function(f){ try{ f(); }catch(e){} });
  if(g.hint) g.hint.stop();
  if(g.unguard) g.unguard();
  if(g.mo) g.mo.disconnect();
  if(g.ro) g.ro.disconnect();
  G = null;
  if(!(o && o.keepDom) && g.root && g.root.parentNode) g.root.remove();
}
function api(g){
  return {
    destroy:function(){ if(G === g) destroy(); },
    leave:function(){ if(G === g) confirmLeave(); },
    get round(){ return g.round; }, get house(){ return g.house; }
  };
}

/* ============================== loading (lazy, per project) ============================== */
function getJSON(url){ return fetch(url, {cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
function load(o){
  o = o || {};
  var base = (o.appRoot || '') + 'games/cozy-chores/';
  var id = o.project || 'cake';
  if(W.COZY_DATA && W.COZY_DATA[id]) return Promise.resolve(W.COZY_DATA[id]);   // the single-file demo inlines its data
  return getJSON(base + 'projects/' + id + '.json').then(function(project){
    return Promise.all([getJSON(base + project.content), getJSON(base + 'art/manifest.json'), getJSON(base + 'content/shared.json').catch(function(){ return {}; })]).then(function(r){ return {project:project, content:r[0], manifest:r[1], shared:r[2]}; });
  });
}

W.CozyChores = {
  version:VERSION,
  load:load,
  start:start,
  savedRound:function(host, id){ var r = hostLoadRound(host || {}); return r && (!id || r.project === id) ? r : null; },
  clearRound:function(host){ try{ if(host && host.saveRound) host.saveRound(null); else localStorage.removeItem(LS_ROUND); }catch(e){} },
  UI:UI,
  debug:{
    status:function(){ return G ? G.status : null; },
    game:function(){ return G; },
    hint:function(level){ if(G && G.hint) G.hint.force(level || 15); },
    skip:skipNow
  }
};
})();
