/* Case Closed "Harbour Files" engine v0.1 (Trello gOW8oVsO; GDD Claude/specs/games-expansion-2026-10-22/CASE-CLOSED-HARBOUR-FILES-GDD.md).
   Byte-identical in english app/app/games/case-closed/ and spanish app/app/games/case-closed/. Runs inside the Game Theatre stage
   (Theatre.stageEl(), THEATRE-API.md) or any full-size container.

   The engine runs data, not per-episode code:
     episodes/<id>.json   the stage: cast colours, the opening plate, investigation views + find boxes, evidence art, truth panels,
                          placeholder recipes for every plate (drawn until art/<id>.webp exists)
     content/<id>.json    every word (farin-lxd format): {meta, en:{...}, es:{...}} with question, suspects, evidence (name, fact,
                          words), statements (by, breaks, confirms, then, gives, keyWords, h15), thenLines, wrongDropPool,
                          reevaluation, stamps, links, deduction (text, gaps, ladder, solved), truth panels, souvenir, ui
     art/manifest.json    {items:{<id>:{file, ready}}}: ready:true draws the WebP, otherwise the placeholder recipe
   Every episode walks the 9 spine steps in order (GDD 4): QUESTION, POSSIBILITIES, INVESTIGATION, EVIDENCE, CONTRADICTION,
   RE-EVALUATION, CONNECTION, DEDUCTION, TRUTH. You cannot lose and cannot get stuck: hints at 15 s, a guided drop / thread / lens at
   45 s, the deduction ladder solves by the 5th check. No timer, no score, no number shown. Motion is transform / opacity only.

   API
     CaseClosed.load({appRoot, episode}) -> Promise<data>
     CaseClosed.start({root, data, lang:'en'|'es', ui:'en'|'tr'|'fa'|'es', name, host, resume, pace, tts, reduced, hintMs,
                       onDone(result), onLeave()}) -> game
     CaseClosed.savedRound(host, episodeId) -> round | null      CaseClosed.EPISODES = {A1..C1: episode id}
     game.destroy()
   host (all optional; defaults use localStorage + speechSynthesis + small WebAudio tones):
     speak(text, {lang, who, rate, interrupt}) -> Promise, stopSpeech(), sfx(name), muted(), reduced(), buzz(pattern),
     loadRound(), saveRound(round|null), loadCases(), saveCases(cases), loadHouse() (Cozy Chores memory, read only), keep(souvenir)
*/
(function(){
'use strict';
if(window.CaseClosed) return;

var W = window, D = document;
var VERSION = '0.1.0';
var ABORT = {abort:true};
var G = null;
var SPRING = 'cubic-bezier(.34,1.56,.64,1)';
var EASE = 'cubic-bezier(.2,.7,.2,1)';
var SPINE = ['question', 'possibilities', 'investigation', 'evidence', 'contradiction', 'reevaluation', 'connection', 'deduction', 'truth'];
var EPISODES = {A1:'a1-where-is-captain', A2:'a2-regatta-cup', B1:'b1-lamp-pier', B2:'b2-boats-at-dawn', C1:'c1-sea-swallow'};

/* ============================== small helpers ============================== */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function el(tag, cls, html){ var n = D.createElement(tag); if(cls) n.className = cls; if(html != null) n.innerHTML = html; return n; }
function words(s){ return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function rect(n){ return n.getBoundingClientRect(); }
function center(r){ return {x:r.left + r.width / 2, y:r.top + r.height / 2}; }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function live(){ if(!G || G.dead) throw ABORT; }
function RM(){
  if(G && G.forceReduced) return true;
  try{ if(G && G.host.reduced && G.host.reduced()) return true; }catch(e){}
  try{ return W.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; }
}
function buzz(p){ try{ if(G && G.host.buzz) return G.host.buzz(p); if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }

/* ============================== strings: UI language (en tr fa es; Persian informal) ============================== */
var UI = {
  take:{en:'Take the case', tr:'Davayı al', fa:'پرونده رو قبول کن', es:'Aceptar el caso'},
  next:{en:'Next', tr:'Sıradaki', fa:'بعدی', es:'Siguiente'},
  back:{en:'Back to the scene', tr:'Olay yerine dön', fa:'برگرد سر صحنه', es:'Volver a la escena'},
  saidIt:{en:'I said it', tr:'Söyledim', fa:'گفتمش', es:'Lo he dicho'},
  skip:{en:'Skip', tr:'Geç', fa:'رد شو', es:'Saltar'},
  places:{en:'In the house', tr:'Evde', fa:'توی خونه', es:'En la casa'},
  words:{en:'Your words', tr:'Kelimelerin', fa:'کلمه‌هات', es:'Tus palabras'},
  press:{en:'Tap a line to press it. Drag evidence onto the line it breaks.', tr:'Sorgulamak için bir cümleye dokun. Kanıtı, çürüttüğü cümleye sürükle.', fa:'برای پرسیدن بیشتر روی یه جمله بزن. مدرک رو بکش روی جمله‌ای که دروغش رو نشون می‌ده.', es:'Toca una frase para insistir. Arrastra una prueba a la frase que desmiente.'},
  done:{en:'Done', tr:'Tamam', fa:'تموم شد', es:'Listo'},
  check:{en:'Check', tr:'Kontrol et', fa:'بررسی کن', es:'Comprobar'},
  evidence:{en:'Evidence', tr:'Kanıtlar', fa:'مدارک', es:'Pruebas'},
  board:{en:'Case board', tr:'Dava panosu', fa:'تابلوی پرونده', es:'Tablero del caso'},
  close:{en:'Close', tr:'Kapat', fa:'ببند', es:'Cerrar'},
  thisToldYou:{en:'This told you:', tr:'Bu sana şunu söyledi:', fa:'این بهت گفت:', es:'Esto te dijo:'},
  tapEach:{en:'Tap each person.', tr:'Her kişiye dokun.', fa:'روی تک‌تک آدم‌ها بزن.', es:'Toca a cada persona.'},
  lens:{en:'Drag the lens over the room.', tr:'Büyüteci odada gezdir.', fa:'ذره‌بین رو روی اتاق بکش.', es:'Arrastra la lupa por la sala.'},
  lensRM:{en:'Tap the room to look closer.', tr:'Yakından bakmak için odaya dokun.', fa:'برای دقیق‌تر دیدن روی اتاق بزن.', es:'Toca la sala para mirar de cerca.'},
  tapFind:{en:'Found something! Tap it.', tr:'Bir şey buldun! Dokun.', fa:'یه چیزی پیدا کردی! روش بزن.', es:'¡Has encontrado algo! Tócalo.'},
  listen:{en:'Listen. Tap a line to translate it.', tr:'Dinle. Çevirmek için bir satıra dokun.', fa:'گوش کن. برای ترجمه روی یه خط بزن.', es:'Escucha. Toca una frase para traducirla.'},
  listenA1:{en:'Listen.', tr:'Dinle.', fa:'گوش کن.', es:'Escucha.'},
  drop:{en:'Drag evidence onto the line it breaks.', tr:'Kanıtı, çürüttüğü cümlenin üstüne sürükle.', fa:'مدرک رو بکش روی جمله‌ای که دروغش رو نشون می‌ده.', es:'Arrastra una prueba a la frase que desmiente.'},
  dropRM:{en:'Tap evidence, then tap a line.', tr:'Bir kanıta, sonra bir cümleye dokun.', fa:'اول روی مدرک بزن، بعد روی یه جمله.', es:'Toca una prueba y luego una frase.'},
  confirm:{en:'Which evidence shows a line is true?', tr:'Hangi kanıt bir cümlenin doğru olduğunu gösteriyor?', fa:'کدوم مدرک نشون می‌ده یه جمله راسته؟', es:'¿Qué prueba demuestra que una frase es verdad?'},
  thread:{en:'Pull a red thread from pin to pin.', tr:'Raptiyeden raptiyeye kırmızı ip çek.', fa:'نخ قرمز رو از یه پونز به پونز دیگه بکش.', es:'Tira un hilo rojo de chincheta a chincheta.'},
  threadRM:{en:'Tap one pin, then another.', tr:'Bir raptiyeye, sonra başka birine dokun.', fa:'روی یه پونز بزن، بعد روی یکی دیگه.', es:'Toca una chincheta y luego otra.'},
  ded:{en:'Fill every gap. Then check.', tr:'Bütün boşlukları doldur. Sonra kontrol et.', fa:'همهٔ جاهای خالی رو پر کن. بعد بررسی کن.', es:'Rellena los huecos. Luego comprueba.'},
  closeOne:{en:'Close: one or two words are wrong.', tr:'Yaklaştın: bir iki kelime yanlış.', fa:'نزدیکی: یکی دو تا کلمه اشتباهه.', es:'Casi: una o dos palabras no encajan.'},
  someWrong:{en:'Not yet: some words are wrong.', tr:'Henüz değil: bazı kelimeler yanlış.', fa:'هنوز نه: چند تا کلمه اشتباهه.', es:'Todavía no: algunas palabras no encajan.'},
  notYet:{en:'Not yet.', tr:'Henüz değil.', fa:'هنوز نه.', es:'Todavía no.'},
  tapOn:{en:'Tap to go on', tr:'Devam için dokun', fa:'برای ادامه بزن', es:'Toca para seguir'},
  leaveQ:{en:'Leave? Your place is saved.', tr:'Çıkıyor musun? Kaldığın yer kayıtlı.', fa:'می‌خوای بری؟ تا همین‌جا ذخیره شده.', es:'¿Te vas? Tu sitio queda guardado.'},
  stay:{en:'Stay', tr:'Kal', fa:'می‌مونم', es:'Quedarme'},
  leave:{en:'Leave', tr:'Çık', fa:'می‌رم', es:'Salir'},
  finish:{en:'Close the file', tr:'Dosyayı kapat', fa:'پرونده رو ببند', es:'Cerrar el expediente'},
  flip:{en:'Tap the card to turn it over', tr:'Çevirmek için karta dokun', fa:'برای برگردوندن کارت روش بزن', es:'Toca la tarjeta para darle la vuelta'},
  kept:{en:'Saved to your review cards', tr:'Tekrar kartlarına kaydedildi', fa:'توی کارت‌های مرورت ذخیره شد', es:'Guardada en tus tarjetas de repaso'},
  hear:{en:'Listen', tr:'Dinle', fa:'گوش کن', es:'Escuchar'},
  album:{en:'A photo for your album', tr:'Albümün için bir fotoğraf', fa:'یه عکس برای آلبومت', es:'Una foto para tu álbum'},
  artSoon:{en:'art in production', tr:'çizim hazırlanıyor', fa:'نقاشی در حال آماده شدن', es:'arte en producción'},
  tr:{en:'EN', tr:'TR', fa:'FA', es:'ES'},
  archive:{en:'Archive', tr:'Arşiv', fa:'بایگانی', es:'Archivo'},
  question:{en:'The question', tr:'Soru', fa:'سؤال', es:'La pregunta'},
  broken:{en:'The line that broke', tr:'Çürüyen cümle', fa:'جمله‌ای که لو رفت', es:'La frase que cayó'},
  truthH:{en:'What really happened', tr:'Gerçekte ne oldu', fa:'واقعاً چی شد', es:'Lo que pasó de verdad'},
  replay:{en:'Replay the truth', tr:'Gerçeği yeniden oynat', fa:'دوباره ببین چی شد', es:'Ver otra vez la verdad'},
  town:{en:'{place} will remember this.', tr:'{place} bunu unutmayacak.', fa:'{place} این رو یادش می‌مونه.', es:'{place} no lo olvidará.'},
  empty:{en:'Your solved cases will be filed here.', tr:'Çözdüğün davalar buraya dosyalanacak.', fa:'پرونده‌هایی که حل می‌کنی اینجا بایگانی می‌شن.', es:'Aquí se archivarán los casos que resuelvas.'},
  steps:{en:['The question', 'The people', 'The scene', 'The interviews', 'Contradictions', 'Think again', 'Connections', 'Deduction', 'The truth'],
         tr:['Soru', 'Kişiler', 'Olay yeri', 'Sorgular', 'Çelişkiler', 'Yeniden düşün', 'Bağlantılar', 'Çıkarım', 'Gerçek'],
         fa:['سؤال', 'آدم‌ها', 'صحنه', 'بازجویی‌ها', 'تناقض‌ها', 'دوباره فکر کن', 'ربط‌ها', 'نتیجه‌گیری', 'حقیقت'],
         es:['La pregunta', 'Las personas', 'La escena', 'Los interrogatorios', 'Contradicciones', 'Repensar', 'Conexiones', 'Deducción', 'La verdad']}
};
function U(k){ var o = UI[k] || {}; var ui = G ? G.ui : 'en'; return o[ui] != null ? o[ui] : (o.en != null ? o.en : k); }
function uiDir(){ return G && G.ui === 'fa' ? 'rtl' : 'ltr'; }
// generic target-language lines from Moss (the episode content can override any of them by id)
var TL = {
  lensH15:{en:{en:'Look closely. Move the lens slowly.', tr:'Dikkatle bak. Büyüteci yavaşça gezdir.', fa:'دقیق نگاه کن. ذره‌بین رو آروم حرکت بده.'},
           es:{es:'Mira bien. Mueve la lupa despacio.', en:'Look closely. Move the lens slowly.', tr:'Dikkatle bak. Büyüteci yavaşça gezdir.', fa:'دقیق نگاه کن. ذره‌بین رو آروم حرکت بده.'}},
  lensElse:{en:{en:'Nothing more here. Look in the next place.', tr:'Burada başka bir şey yok. Bir sonraki yere bak.', fa:'اینجا دیگه چیزی نیست. جای بعدی رو نگاه کن.'},
            es:{es:'Aquí no hay nada más. Mira en el siguiente sitio.', en:'Nothing more here. Look in the next place.', tr:'Burada başka bir şey yok. Bir sonraki yere bak.', fa:'اینجا دیگه چیزی نیست. جای بعدی رو نگاه کن.'}},
  confirmH15:{en:{en:'One piece of evidence shows this is true.', tr:'Bir kanıt bunun doğru olduğunu gösteriyor.', fa:'یه مدرک نشون می‌ده این راسته.'},
              es:{es:'Una prueba demuestra que esto es verdad.', en:'One piece of evidence shows this is true.', tr:'Bir kanıt bunun doğru olduğunu gösteriyor.', fa:'یه مدرک نشون می‌ده این راسته.'}},
  notYet:{en:{en:'We haven’t talked to {name} yet.', tr:'Henüz {name} ile konuşmadık.', fa:'هنوز با {name} حرف نزدیم.'},
          es:{es:'Aún no hemos hablado con {name}.', en:'We haven’t talked to {name} yet.', tr:'Henüz {name} ile konuşmadık.', fa:'هنوز با {name} حرف نزدیم.'}},
  likeThis:{en:{en:'Like this. Now you.', tr:'Böyle. Şimdi sen.', fa:'این‌جوری. حالا تو.'},
            es:{es:'Así. Ahora tú.', en:'Like this. Now you.', tr:'Böyle. Şimdi sen.', fa:'این‌جوری. حالا تو.'}},
  sayIt:{en:{en:'Now say it like a detective.', tr:'Şimdi bir dedektif gibi söyle.', fa:'حالا مثل یه کارآگاه بگو.'},
         es:{es:'Ahora dilo con voz de detective.', en:'Now say it like a detective.', tr:'Şimdi bir dedektif gibi söyle.', fa:'حالا مثل یه کارآگاه بگو.'}},
  pressPool:{en:{en:'That’s all I know.', tr:'Bütün bildiğim bu.', fa:'همهٔ چیزی که می‌دونم همینه.'},
             es:{es:'Es todo lo que sé.', en:'That’s all I know.', tr:'Bütün bildiğim bu.', fa:'همهٔ چیزی که می‌دونم همینه.'}},
  secret:{en:{en:'Look at that! A little secret.', tr:'Şuna bak! Küçük bir sır.', fa:'اونو ببین! یه راز کوچولو.'},
          es:{es:'¡Mira eso! Un pequeño secreto.', en:'Look at that! A little secret.', tr:'Şuna bak! Küçük bir sır.', fa:'اونو ببین! یه راز کوچولو.'}}
};
var STAMPS = {en:{contradiction:'CONTRADICTION', checked:'CHECKED', closed:'CASE CLOSED', file:'FILE 1970'}, es:{contradiction:'CONTRADICCIÓN', checked:'COMPROBADO', closed:'CASO CERRADO', file:'ARCHIVO 1970'}};
function stampText(k){ var st = (C() && C().stamps) || {}; return st[k] ? T(st[k]) : STAMPS[G.lang][k]; }
function tl(k){ var o = TL[k]; return o ? o[G.lang] : null; }
// farin-lxd's per-episode lines (content[lang].lines) win over the engine's built-in ones
var GAP_T = {who:'who', when:'when', where:'where', why:'why', what:'what', how:'how'};
function gt(t){ return GAP_T[t] || 'what'; }
function lx(key, fallback){ var L = (G.C && G.C.lines) || {}; return L[key] || (fallback ? tl(fallback) : null); }

/* ============================== content access ============================== */
function T(o){ if(o == null) return ''; if(typeof o === 'string') return o; return o[G.lang] != null ? o[G.lang] : (o.text != null ? o.text : (o.en || '')); }
function GL(o){ if(!o || typeof o === 'string' || G.ui === G.lang) return ''; return o[G.ui] || ''; }
function C(){ return G.C; }
// cast.<who>.as on the stage = the same person under another id (C1: "pike" is Mr Pike's voice today, Arthur's portrait)
function castId(who){ var s = (G.S.cast || {})[who]; return s && s.as ? s.as : who; }
function castName(who){ var c = (C().cast || {})[who] || (C().cast || {})[castId(who)]; return c ? (typeof c.name === 'string' ? c.name : T(c.name)) : ''; }
// who speaks a statement (C1 Arthur's lines are voiced by "pike"); the polaroid and the board always use s.by
function voiceOf(s){ return s && s.who && s.who !== 'owner' ? s.who : (s && s.by); }
function isFile(s){ return !!(s && s.source === 'file1970'); }
// `if` keys on lines (GDD 8 cross-game payoffs): Cozy memory (progress.house.mem), case:<episodeId> (progress.cases), town keys (progress.cases.town)
function flag(k){
  if(k.indexOf('case:') === 0) return !!(G.cases || {})[k.slice(5)];
  if(G.house && G.house[k]) return true;
  return !!(((G.cases || {}).town || {})[k]);
}
function cond(l){ if(!l || !l.if) return true; var k = String(l.if).trim(), neg = k.charAt(0) === '!'; if(neg) k = k.slice(1); var v = flag(k); return neg ? !v : v; }
function castShort(who){ var s = (G.S.cast || {})[who]; if(s && s.short) return T(s.short); var n = castName(who); return n.split(' ')[0] || n; }
function castRole(who){ var c = (C().cast || {})[who]; if(!c || !c.role) return ''; return G.ui === G.lang ? T(c.role) : (c.role[G.ui] || T(c.role)); }
function hue(who){ var s = (G.S.cast || {})[who]; return (s && s.hue) || '#A99BEA'; }
function evDef(id){ return (C().evidence || []).filter(function(e){ return e.id === id; })[0] || (C().secret && C().secret.id === id ? C().secret : null); }
function evStage(id){ return (G.S.evidence || {})[id] || {}; }
function stmts(){ return C().statements || []; }
function stmt(id){
  var s = stmts().filter(function(x){ return x.id === id; })[0];
  if(s) return s;
  var t = C().thenLines || {};
  for(var k in t){ var l = (t[k] || []).filter(function(x){ return x.id === id; })[0]; if(l) return Object.assign({by:l.who}, l); }
  return null;
}
function suspects(){ return (C().suspects || []).map(function(s){ return s.id; }); }
function interviewOrder(){ var o = []; stmts().forEach(function(s){ if(o.indexOf(s.by) < 0) o.push(s.by); }); suspects().forEach(function(w){ if(o.indexOf(w) < 0) o.push(w); }); return o; }

/* ============================== art (placeholders until art/<id>.webp exists) ============================== */
function man(id){ return ((G.M || {}).items || {})[id] || null; }
function artUrl(m){ return /^data:/.test(m.file) ? m.file : (G.appRoot || '') + m.file; }
function plateHtml(id){
  var m = man(id);
  if(m && m.ready) return '<img src="' + esc(artUrl(m)) + '" alt="" draggable="false" decoding="async">';
  var ph = (G.S.plates || {})[id] || {};
  var shapes = (ph.shapes || []).map(function(s){
    return '<i class="cc-pp-s' + (s.round ? ' cc-pp-r' : '') + (s.n ? ' cc-pp-n' : '') + '" style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%;background:' + esc(s.fill || 'transparent') +
      (s.r != null ? ';border-radius:' + esc(s.r) : '') + (s.rot ? ';transform:rotate(' + s.rot + 'deg)' : '') + '">' + (s.label ? '<b>' + esc(T(s.label)) + '</b>' : '') + '</i>';
  }).join('');
  return '<div class="cc-pp" style="background:' + esc(ph.bg || 'linear-gradient(180deg,#fdf3df,#f4e2c2)') + '">' + shapes + '<div class="cc-sun"></div>' +
    '<span class="cc-pp-tag">' + esc(T(ph.name) || id.replace(/^(plate|panel)-/, '').replace(/-/g, ' ')) + ' · ' + esc(U('artSoon')) + '</span></div>';
}
function faceHtml(who, expr, y70){
  // y70: the 1970 polaroid (C1 file statements). cast.young = the young portrait id, cast.face = a one-off portrait art id
  var cs = (G.S.cast || {}), id = castId(who);
  if(y70 && cs[id] && cs[id].young) id = cs[id].young;
  var c = cs[id] || {};
  var m = c.face ? man(c.face) : (man('pt-' + id + '-' + (expr || 'calm')) || man('pt-' + id + '-calm'));
  var inner = m && m.ready ? '<img src="' + esc(artUrl(m)) + '" alt="" draggable="false">' :
    '<span class="cc-bust"><i></i><u></u><em>' + esc((castShort(id) || castShort(who) || '?').charAt(0)) + '</em></span>';
  var sep = c.sepia || (y70 && id !== castId(who)) || (y70 && cs[castId(who)] && cs[castId(who)].sepia);
  return '<span class="cc-face' + (sep ? ' cc-1970' : '') + '" data-who="' + esc(who) + '" data-x="' + esc(expr || 'calm') + '" style="--hue:' + esc(hue(id) || hue(who)) + '">' + inner + '</span>';
}
var ICON = {
  photo:'<rect x="3" y="5" width="18" height="14" rx="1.5" class="w"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>',
  doc:'<path d="M6 3h9l4 4v14H6z" class="w"/><path d="M15 3v4h4M9 11h7M9 14h7M9 17h5"/>',
  key:'<circle cx="8" cy="12" r="3.6" class="w"/><path d="M11.6 12H21M18 12v3M15.5 12v2.4"/>',
  scale:'<path d="M12 3c5 3 6 10 0 18C6 13 7 6 12 3z" class="w"/><path d="M12 7v10M9.5 10.5l2.5 2 2.5-2"/>',
  sand:'<path d="M3 18c3-3 6-3 9 0s6 3 9 0" /><circle class="f" cx="7" cy="12" r="1"/><circle class="f" cx="11" cy="10" r="1"/><circle class="f" cx="15" cy="12.5" r="1"/><circle class="f" cx="9" cy="14.5" r="1"/><circle class="f" cx="17" cy="9.5" r="1"/>',
  paw:'<ellipse cx="12" cy="15.5" rx="4" ry="3.4" class="w"/><circle cx="7" cy="10" r="1.7" class="w"/><circle cx="10.2" cy="7.2" r="1.7" class="w"/><circle cx="13.8" cy="7.2" r="1.7" class="w"/><circle cx="17" cy="10" r="1.7" class="w"/>',
  cup:'<path d="M7 4h10v5a5 5 0 01-10 0z" class="w"/><path d="M7 6H4.5a2.5 2.5 0 002.8 3M17 6h2.5a2.5 2.5 0 01-2.8 3M12 14v3M8.5 20h7M9.5 17h5v3h-5z"/>',
  hair:'<path d="M4 16c3-6 5 2 8-4s5 2 8-4"/><path d="M4 19c3-6 5 2 8-4s5 2 8-4"/>',
  bag:'<path d="M5 8h14l-1.4 12H6.4z" class="w"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  tag:'<path d="M3 12l8-8h8v8l-8 8z" class="w"/><circle cx="15" cy="8" r="1.6"/>',
  lamp:'<path d="M9 3h6l2 6H7z" class="w"/><path d="M12 9v9M8 21h8"/>',
  plan:'<rect x="3" y="4" width="18" height="16" class="w"/><path d="M3 12h9v8M12 4v4M16 12h5"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2" class="w"/><path d="M10.5 18h3"/>',
  letter:'<rect x="3" y="6" width="18" height="12" rx="1" class="w"/><path d="M3 7l9 6 9-6"/>',
  tide:'<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  frame:'<rect x="4" y="4" width="16" height="16" class="w"/><rect x="7" y="7" width="10" height="10"/>',
  book:'<path d="M4 5h7a2 2 0 012 2v13H6a2 2 0 01-2-2z" class="w"/><path d="M13 7a2 2 0 012-2h5v13h-5a2 2 0 00-2 2"/>',
  rope:'<path d="M5 19c0-6 4-6 4-11a3 3 0 016 0c0 5 4 5 4 11"/><circle cx="12" cy="8" r="1.5"/>',
  glass:'<path d="M4 18l5-12 3 6 3-4 5 10z" class="w"/><path d="M9 6l1 7M15 8l-1 6"/>',
  clock:'<circle cx="12" cy="12" r="8" class="w"/><path d="M12 7v5l-3 2"/>',
  oar:'<path d="M4 20L15 9" /><path d="M14 10c1-4 3-6 6-7-1 3-3 5-7 6z" class="w"/>',
  receipt:'<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" class="w"/><path d="M9 8h6M9 11h6M9 14h4"/>',
  sail:'<path d="M12 3v14M12 4l7 12h-7z" class="w"/><path d="M4 18h16l-2 3H6z"/>',
  crate:'<rect x="3" y="7" width="18" height="13" class="w"/><path d="M3 7l9-4 9 4M3 7l18 13M21 7L3 20"/>',
  ticket:'<path d="M3 7h18v3a2 2 0 000 4v3H3v-3a2 2 0 000-4z" class="w"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  knot:'<path d="M3 14c4 0 5-6 9-6s4 8 0 8-3-6 1-8 6 2 8 2"/>',
  bell:'<path d="M6 17c1-2 1-4 1-7a5 5 0 0110 0c0 3 0 5 1 7z" class="w"/><path d="M10 20a2 2 0 004 0M12 3v2"/>'
};
function icon(name){ return '<svg class="cc-ico" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || ICON.doc) + '</svg>'; }
var TAB = [
  '<path d="M9.5 9a2.5 2.5 0 115 .5c0 1.7-2.5 2-2.5 4M12 17.5v.5"/>',
  '<circle cx="8.5" cy="9" r="2.6"/><circle cx="15.5" cy="9" r="2.6"/><path d="M3.5 19c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6M10.5 19c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6"/>',
  '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
  '<path d="M4 6h16v10H10l-4 3v-3H4z"/>',
  '<path d="M13 3l-5 9h5l-2 9 7-11h-5l2-7z"/>',
  '<circle cx="12" cy="12" r="8"/><path d="M8 12.5l2.6 2.5L16 9.5"/>',
  '<circle cx="5.5" cy="7" r="2"/><circle cx="18.5" cy="17" r="2"/><path d="M7 8.5c4 2 6 5 10 7"/>',
  '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  '<rect x="5" y="14" width="14" height="5" rx="1"/><path d="M9 14V9a3 3 0 016 0v5"/>'
];
function svg(paths, cls){ return '<svg viewBox="0 0 24 24" class="' + (cls || '') + '" aria-hidden="true">' + paths + '</svg>'; }
var SPEAKER_SVG = '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6M17.8 6.5a7.5 7.5 0 010 11"/></svg>';
function evCardHtml(id, o){
  var d = evDef(id) || {id:id, name:id}, st = evStage(id), m = man('ev-' + id);
  var art = m && m.ready ? '<img src="' + esc(artUrl(m)) + '" alt="" draggable="false">' : icon(st.icon);
  return '<div class="cc-ev" data-ev="' + esc(id) + '" role="button" tabindex="0" aria-label="' + esc(T(d.name)) + '"><div class="cc-evart" style="--evc:' + esc(st.c || '#f3e3c8') + '">' + art +
    (st.stamp ? '<span class="cc-evstamp" lang="' + G.lang + '">' + esc(T(st.stamp)) + '</span>' : '') + '</div><b lang="' + G.lang + '">' + esc(T(d.name)) + '</b></div>';
}

/* ============================== sound + speech ============================== */
var actx = null;
function actxGet(){ try{ if(!actx) actx = new (W.AudioContext || W.webkitAudioContext)(); if(actx.state === 'suspended') actx.resume().catch(function(){}); return actx; }catch(e){ return null; } }
function tone(c, type, f0, f1, t, dur, peak){
  var o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.6, 0.0002), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(c, t, dur, peak, freq, q){
  var len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for(var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var s = c.createBufferSource(); s.buffer = buf;
  var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 2000; bp.Q.value = q || 1.1;
  var g = c.createGain(); g.gain.value = peak * 0.6;
  s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
}
function muted(){ try{ return G && G.host.muted ? !!G.host.muted() : false; }catch(e){ return false; } }
// the app's own names first (tick / correct / reveal / combo / stamp); the rest are small synth stand-ins until sfx/*.mp3 (GDD 11)
function sfx(name, o){
  if(!G || muted()) return;
  try{ if(G.host.sfx && G.host.sfx(name, o) === true) return; }catch(e){}
  var c = actxGet(); if(!c) return;
  var t = c.currentTime + 0.01, k = (o && o.rate) || 1;
  if(name === 'pluck'){ try{ tone(c,'triangle',392 * k,0,t,.25,.12); tone(c,'sine',784 * k,0,t,.18,.05); }catch(e){} return; }
  try{
    switch(name){
      case 'correct': tone(c,'sine',523.25,0,t,.11,.14); tone(c,'sine',659.25,0,t+.07,.11,.14); break;
      case 'combo': [523.25,659.25,784].forEach(function(f,i){ tone(c,'sine',f,0,t+i*.06,.11,.14); }); break;
      case 'reveal': [523.25,659.25,784,1046.5].forEach(function(f,i){ tone(c,'sine',f,0,t+i*.07,.14,.12); }); break;
      case 'tick': case 'paper': noise(c,t,.04,.05,2400); break;
      case 'type': noise(c,t,.012,.05,3200 + Math.random() * 400, 2); break;
      case 'bell': tone(c,'sine',1568,0,t,.4,.05); break;
      case 'stamp': tone(c,'triangle',140,70,t,.12,.3); noise(c,t,.08,.2,800); break;
      case 'softstamp': tone(c,'triangle',180,110,t,.09,.16); noise(c,t,.05,.09,900); tone(c,'sine',880,0,t+.08,.12,.05); break;
      case 'crack': noise(c,t,.06,.14,3600, 3); tone(c,'triangle',1200,600,t,.05,.05); break;
      case 'flip': noise(c,t,.09,.06,1600); break;
      case 'flutter': noise(c,t,.22,.04,1200); break;
      case 'ting': tone(c,'sine',2093,0,t,.35,.07); tone(c,'sine',3136,0,t+.03,.25,.03); break;
      case 'whirr': noise(c,t,.32,.04,900); break;
      case 'pop': tone(c,'sine',520,880,t,.08,.08); break;
    }
  }catch(e){}
}
// CC12 interview room tone: a 1 s tail of the place under the typewriter, made in code (no files), ducked to 40 % while the line speaks.
// Rooms: cafe (cups), pier / harbour (gulls, water), gallery (hum, clock), office (hum, clock), archive (clock, paper), home (kettle hush), bakery (oven hum, tray).
function roomTone(kind){
  var none = {duck:function(){}, stop:function(){}};
  if(!G || muted() || !kind) return none;
  try{ if(G.host.sfx && G.host.sfx('room-' + kind) === true) return none; }catch(e){}
  var c = actxGet(); if(!c) return none;
  try{
    var t = c.currentTime + 0.02, out = c.createGain(); out.gain.value = 1; out.connect(c.destination);
    var bed = function(freq, q, peak, dur){
      var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), last = 0;
      for(var i = 0; i < len; i++){ last = last * .97 + (Math.random() * 2 - 1) * .03; d[i] = last * 8 * Math.min(1, i / (c.sampleRate * .2), (len - i) / (c.sampleRate * .45)); }
      var s = c.createBufferSource(); s.buffer = buf; var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      var g = c.createGain(); g.gain.value = peak; s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur);
    };
    var ping = function(f, at, dur, peak, type){ var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t + at); g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(peak, t + at + .006); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur); o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + dur + .02); };
    var gull = function(at){ var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1500, t + at); o.frequency.exponentialRampToValueAtTime(950, t + at + .22); g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(.018, t + at + .03); g.gain.exponentialRampToValueAtTime(.0001, t + at + .24); o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + .26); };
    var hum = function(f, peak){ var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + 1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.05); };
    switch(kind){
      case 'cafe': bed(900, .7, .5, 1); ping(2600, .18, .18, .02); ping(3100, .52, .14, .014); break;
      case 'pier': case 'harbour': bed(420, .5, .7, 1); gull(.2); gull(.55); break;
      case 'gallery': case 'office': hum(110, .012); bed(1600, .8, .2, 1); ping(1800, .25, .05, .012, 'square'); ping(1500, .75, .05, .01, 'square'); break;
      case 'archive': bed(2400, 1, .25, 1); ping(1700, .15, .04, .01, 'square'); ping(1400, .65, .04, .009, 'square'); break;
      case 'bakery': hum(160, .01); bed(700, .6, .35, 1); ping(2200, .4, .2, .012); break;
      default: bed(600, .6, .3, 1); break;
    }
    return {duck:function(){ try{ out.gain.setTargetAtTime(.4, c.currentTime, .05); }catch(e){} }, stop:function(){ try{ out.gain.setTargetAtTime(0, c.currentTime, .05); }catch(e){} }};
  }catch(e){ return none; }
}
var synthVoice = {};
function defaultSpeak(text, o){
  return new Promise(function(res){
    var g = G, est = (420 + 330 * words(text)) * (g ? g.pace : 1);
    var t = setTimeout(res, Math.max(60, est * 1.6));
    if(!g || g.tts === false || !W.speechSynthesis || !W.SpeechSynthesisUtterance){ clearTimeout(t); setTimeout(res, Math.max(40, est)); return; }
    try{
      var ss = W.speechSynthesis;
      if(o.interrupt) ss.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var lang = o.lang === 'es' ? 'es-ES' : 'en-GB';
      u.lang = lang; u.rate = o.rate || 0.92;
      var v = synthVoice[lang];
      if(v === undefined){ v = (ss.getVoices() || []).filter(function(x){ return x.lang && x.lang.replace('_', '-').indexOf(lang.slice(0, 2)) === 0; })[0] || null; if(v) synthVoice[lang] = v; }
      if(v) u.voice = v;
      u.onend = u.onerror = function(){ clearTimeout(t); res(); };
      ss.speak(u);
    }catch(e){ clearTimeout(t); res(); }
  });
}
function speak(text, o){
  o = o || {};
  if(!G || !text) return Promise.resolve();
  var rate = o.rate || (G.band === 'A1' ? 0.88 : 0.92);
  var p;
  try{ p = G.host.speak ? G.host.speak(text, {lang:G.lang, who:o.who, rate:rate, interrupt:o.interrupt !== false}) : defaultSpeak(text, {lang:G.lang, rate:rate, interrupt:o.interrupt !== false}); }catch(e){ p = null; }
  return Promise.resolve(p).catch(function(){});
}
function stopSpeech(){ try{ if(G && G.host.stopSpeech) G.host.stopSpeech(); else if(W.speechSynthesis) W.speechSynthesis.cancel(); }catch(e){} }

/* ============================== time ============================== */
function wait(ms, keep){
  return new Promise(function(res, rej){
    var g = G; if(!g || g.dead) return rej(ABORT);
    ms = (ms || 0) * g.pace;
    if(!keep && RM()) ms = Math.min(ms, 120 * g.pace);
    if(ms <= 0) return setTimeout(function(){ g.dead ? rej(ABORT) : res(); }, 0);
    var t, done = function(){ clearTimeout(t); g.waits.delete(done); g.dead ? rej(ABORT) : res(); };
    t = setTimeout(done, ms); g.waits.add(done);
  });
}
function run(node, frames, opts){
  return new Promise(function(res){
    if(!node || !node.animate || RM() || !G) return res();
    var a; try{ a = node.animate(frames, Object.assign({easing:'ease-out', fill:'none'}, opts, {duration:Math.max(1, (opts.duration || 300) * Math.max(G.pace, .25))})); }catch(e){ return res(); }
    var g = G; g.anims.add(a);
    a.onfinish = a.oncancel = function(){ g.anims.delete(a); res(); };
  });
}
function untilClick(node, sel){
  return new Promise(function(res, rej){
    var g = G;
    var h = function(e){ var t = sel ? e.target.closest(sel) : node; if(!t) return; node.removeEventListener('click', h); g.waits.delete(stop); res(t); };
    var stop = function(){ node.removeEventListener('click', h); rej(ABORT); };
    g.waits.add(stop);
    node.addEventListener('click', h);
  });
}

/* ============================== effects: stamps, sparks, flash, flip ============================== */
function sparks(x, y, col, n){
  if(RM() || !G) return;
  var f = rect(G.root);
  for(var i = 0; i < (n || 10); i++){
    var d = el('i'); var a = Math.PI * 2 * i / n + Math.random() * .4, r = 30 + Math.random() * 34, s = 5 + Math.random() * 5;
    d.style.cssText = 'position:absolute;z-index:70;pointer-events:none;width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:' + col + ';left:' + (x - f.left - s / 2) + 'px;top:' + (y - f.top - s / 2) + 'px;box-shadow:0 0 0 1.5px #14332e';
    G.root.appendChild(d);
    (function(d){ var an = d.animate([{transform:'translate(0,0) scale(1)', opacity:1}, {transform:'translate(' + Math.cos(a) * r + 'px,' + Math.sin(a) * r + 'px) scale(.3)', opacity:0}], {duration:520 + Math.random() * 200, easing:'cubic-bezier(.2,.8,.3,1)'}); an.onfinish = function(){ d.remove(); }; })(d);
  }
}
async function stampOn(host, text, kind, big){
  var s = el('div', 'cc-stamp' + (kind === 'ok' ? ' cc-ok' : '') + (big ? ' cc-big' : ''), esc(text));
  s.setAttribute('lang', G.lang);
  host.appendChild(s);
  sfx(kind === 'ok' ? 'softstamp' : 'stamp');
  buzz([12]);
  await run(s, [{transform:'rotate(-12deg) scale(1.6)', opacity:0}, {transform:'rotate(-12deg) scale(1)', opacity:1}], {duration:220, easing:'cubic-bezier(.3,1.5,.6,1)'});
  var c = center(rect(s));
  sparks(c.x, c.y, kind === 'ok' ? '#5F8455' : '#E44736', kind === 'ok' ? 8 : 12);
  await run(host, [{transform:'translateX(0)'}, {transform:'translateX(-2px)'}, {transform:'translateX(2px)'}, {transform:'translateX(-2px)'}, {transform:'translateX(0)'}], {duration:240});
  return s;
}
function folderGlow(){ sfx('combo'); if(RM()) return; G.flashEl.style.opacity = 0; run(G.flashEl, [{opacity:0}, {opacity:.75}, {opacity:0}], {duration:520}); run(G.head, [{transform:'none'}, {transform:'translateY(-3px)'}, {transform:'none'}], {duration:420, easing:SPRING}); }
async function flashFx(){ if(RM()) return; G.flashEl.style.opacity = 1; sfx('whirr'); await run(G.flashEl, [{opacity:1}, {opacity:0}], {duration:420}); G.flashEl.style.opacity = 0; }
async function folderFlip(){
  // the folder cover turns on its top hinge and shows the next page (GDD 11)
  if(RM()) return;
  var c = el('div', 'cc-cover', '<b>' + esc(U('steps')[G.round.step] || '') + '</b>');
  G.main.appendChild(c);
  sfx('flip');
  await run(c, [{transform:'perspective(800px) rotateX(0deg)', opacity:1}, {transform:'perspective(800px) rotateX(-110deg)', opacity:1, offset:.7}, {transform:'perspective(800px) rotateX(-160deg)', opacity:0}], {duration:600, easing:'ease-in-out'});
  c.remove();
}
function develop(pol){
  if(RM()) return;
  var d = el('i', 'cc-dev'); pol.appendChild(d);
  run(d, [{opacity:1}, {opacity:0}], {duration:2200}).then(function(){ d.remove(); });
  run(pol, [{transform:'translateX(0) rotate(-2deg)'}, {transform:'translateX(-3px) rotate(-2deg)'}, {transform:'translateX(3px) rotate(-2deg)'}, {transform:'translateX(-3px) rotate(-2deg)'}, {transform:'translateX(0) rotate(-2deg)'}], {duration:900});
}

/* ============================== the dock: who is speaking ============================== */
function showGloss(){ return G.band === 'A1'; }
function bubble(who, text, gloss, o){
  o = o || {};
  var face = G.dock.querySelector('.cc-dockface');
  var hasFace = who && who !== 'narr' && who !== 'card' && who !== 'fact' && who !== 'tts' && who !== 'ui';
  face.innerHTML = hasFace ? faceHtml(who, o.expr, o.y70) : '';
  face.style.display = hasFace ? '' : 'none';
  var name = o.name != null ? o.name : (hasFace ? castShort(who) : '');
  var b = G.bubble;
  G.dock.classList.add('cc-has-b');
  b.innerHTML = (name ? '<span class="cc-n">' + esc(name) + '</span>' : '') + '<span class="cc-t" lang="' + G.lang + '" dir="ltr">' + wordify(text) + '</span>' +
    (gloss ? '<span class="cc-gl" dir="' + uiDir() + '"' + (showGloss() || G.glossOn ? '' : ' hidden') + '>' + esc(gloss) + '</span>' + (showGloss() ? '' : '<button type="button" class="cc-tr" aria-label="' + esc(U('tr')) + '">' + esc(U('tr')) + '</button>') : '');
  if(!RM()) run(b, [{transform:'translateY(6px) scale(.97)', opacity:.4}, {transform:'none', opacity:1}], {duration:220, easing:SPRING});
}
function sayLine(line, o){
  // shows a line in the dock and speaks it; a tap on the dock skips it
  o = o || {};
  return new Promise(function(res, rej){
    var g = G; if(!g || g.dead) return rej(ABORT);
    if(!line) return res();
    var who = o.who || line.who || 'moss';
    var text = o.text || T(line); if(!text) return res();
    bubble(who, text, o.gloss != null ? o.gloss : GL(line), o);
    g.dock.classList.add('cc-talking');
    var prev = g.status; g.status = {kind:'line', step:SPINE[g.round.step], skip:'.cc-dock'};
    var done = false;
    var fin = function(){ if(done) return; done = true; g.lineSkip = null; g.dock.classList.remove('cc-talking'); if(g.status && g.status.kind === 'line') g.status = prev; g.waits.delete(abort); setTimeout(function(){ g.dead ? rej(ABORT) : res(); }, 0); };
    var abort = function(){ done = true; rej(ABORT); };
    g.waits.add(abort);
    g.lineSkip = function(){ stopSpeech(); fin(); };
    speak(text, {who:o.voice || who}).then(function(){ if(!done) setTimeout(fin, 260 * g.pace); });
  });
}
// content faces: calm / rattled / open (worried reads as rattled)
function exprOf(f){ return f === 'worried' || f === 'rattled' ? 'rattled' : f === 'open' ? 'open' : null; }
function cue(text){ G.cueEl.innerHTML = text ? '<span dir="' + uiDir() + '">' + esc(text) + '</span>' : ''; }
function clearDock(){ G.bubble.innerHTML = ''; G.dock.classList.remove('cc-has-b'); var f = G.dock.querySelector('.cc-dockface'); f.innerHTML = ''; f.style.display = 'none'; }

/* ============================== hints: 15 s soft hint, 45 s guide (GDD 5.5) ============================== */
function hints(o, mult){
  var g = G, h = {t15:null, t45:null, off:false, w:[], guide:false};
  var ms = (g.hintMs || 15000) * (mult || 1);
  function clear(){ clearTimeout(h.t15); clearTimeout(h.t45); }
  function f15(){ if(g.dead || h.off || h.did15) return; h.did15 = true; try{ o.h15 && o.h15(); }catch(e){} }
  function f45(){ if(g.dead || h.off) return; h.guide = true; try{ o.h45 && o.h45(); }catch(e){} }
  h.start = function(){ clear(); if(h.off) return; h.t15 = setTimeout(f15, ms); h.t45 = setTimeout(f45, ms * 3); };
  h.reset = function(){ h.did15 = false; h.guide = false; h.w = []; clearFx(); h.start(); };
  h.wrong = function(){ var now = Date.now(); h.w = h.w.filter(function(t){ return now - t < 20000; }); h.w.push(now); if(h.w.length >= 3 && !h.did15){ h.w = []; f15(); } };
  h.force = function(level){ if(level >= 45){ f15(); f45(); } else f15(); };
  h.stop = function(){ h.off = true; clear(); clearFx(); };
  if(g.hint) g.hint.stop();
  g.hint = h;
  return h;
}
function clearFx(){ if(!G) return; G.root.querySelectorAll('.cc-shim').forEach(function(n){ n.classList.remove('cc-shim'); }); G.root.querySelectorAll('.cc-arrow').forEach(function(n){ n.remove(); }); }
function shim(n){ if(!n) return; n.classList.remove('cc-shim'); void n.offsetWidth; n.classList.add('cc-shim'); }
function arrowBetween(a, b){
  // a dotted --accent arrow from a to b (GDD 5.5 guided drop)
  var f = rect(G.root), p = center(rect(a)), q = center(rect(b));
  var x1 = p.x - f.left, y1 = p.y - f.top, x2 = q.x - f.left, y2 = q.y - f.top;
  var s = el('div', 'cc-arrow');
  s.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:46';
  s.innerHTML = '<svg width="100%" height="100%" style="overflow:visible"><defs><marker id="cc-ah" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ff7a59"/></marker></defs>' +
    '<path d="M' + x1 + ' ' + y1 + ' Q ' + ((x1 + x2) / 2 + 30) + ' ' + ((y1 + y2) / 2) + ' ' + x2 + ' ' + y2 + '" stroke="#ff7a59" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" fill="none" marker-end="url(#cc-ah)"/></svg>';
  G.root.appendChild(s);
}

/* ============================== layout ============================== */
function build(box){
  box.innerHTML = '';
  var root = el('div', 'cc-root');
  if(G.forceReduced) root.classList.add('cc-rm');
  root.setAttribute('data-ui', G.ui);
  box.appendChild(root);
  var head = el('div', 'cc-head',
    '<div class="cc-tabs" role="list">' + SPINE.map(function(s, i){ return '<span class="cc-tab" role="listitem" data-i="' + i + '" aria-label="' + esc(U('steps')[i]) + '">' + svg(TAB[i]) + '</span>'; }).join('') + '</div>' +
    '<div class="cc-title" lang="' + G.lang + '" title="' + esc(T(C().series)) + '">' + esc(T(C().title)) + '</div>' +
    '<div class="cc-tools"><button type="button" class="cc-tool cc-boardbtn" aria-label="' + esc(U('board')) + '">' + svg('<rect x="3" y="4" width="18" height="15" rx="1.5"/><circle cx="8" cy="9" r="1.3"/><circle cx="16" cy="13" r="1.3"/><path d="M8 9l8 4"/>') + '</button>' +
    '<button type="button" class="cc-tool cc-bagbtn" aria-label="' + esc(U('evidence')) + '">' + svg('<path d="M4 9h16l-1.5 11h-13z"/><path d="M8 9V7a4 4 0 018 0v2M4 13h16"/>') + '<i class="cc-count-dot"></i></button></div>');
  var main = el('div', 'cc-main');
  var dock = el('div', 'cc-dock', '<div class="cc-cue"></div><span class="cc-dockface" style="display:none"></span><div class="cc-bubble" aria-live="polite"></div>');
  var sheet = el('div', 'cc-bagsheet', '<div class="cc-tray"><div class="cc-tray-h"><span>' + esc(U('evidence')) + '</span><button type="button" class="cc-btn cc-x" style="min-height:32px;padding:0 12px;font-size:13px">' + esc(U('close')) + '</button></div><div class="cc-tray-row"></div><div class="cc-sheetfact"></div></div>');
  var modal = el('div', 'cc-modal'), flash = el('div', 'cc-flash');
  root.appendChild(head); root.appendChild(main); root.appendChild(dock); root.appendChild(sheet); root.appendChild(modal); root.appendChild(flash);
  G.root = root; G.head = head; G.main = main; G.dock = dock; G.bubble = dock.querySelector('.cc-bubble'); G.cueEl = dock.querySelector('.cc-cue');
  G.sheet = sheet; G.modal = modal; G.flashEl = flash; G.bagBtn = head.querySelector('.cc-bagbtn'); G.boardBtn = head.querySelector('.cc-boardbtn');
  G.bagBtn.addEventListener('click', function(e){ e.stopPropagation(); openBag(); });
  G.boardBtn.addEventListener('click', function(e){ e.stopPropagation(); openBoardPeek(); });
  sheet.querySelector('.cc-x').addEventListener('click', function(){ sheet.classList.remove('cc-open'); });
  sheet.addEventListener('click', function(e){
    var c = e.target.closest('.cc-ev'); if(!c) return;
    var d = evDef(c.dataset.ev); if(!d) return;
    var f = sheet.querySelector('.cc-sheetfact');
    f.innerHTML = '<p class="cc-st" style="margin:10px 4px 0;padding:0"><span lang="' + G.lang + '" dir="ltr">' + esc(T(d.fact)) + '</span>' + (GL(d.fact) ? '<span class="cc-gl" dir="' + uiDir() + '">' + esc(GL(d.fact)) + '</span>' : '') + '</p>';
    speak(T(d.fact), {who:'fact'});
  });
  root.addEventListener('click', function(e){ var w = e.target.closest && e.target.closest('.cc-w'); if(w && G){ e.stopPropagation(); collectWord(w); } }, true);
  dock.addEventListener('click', function(e){
    if(e.target.closest('.cc-tr')){ var gl = G.bubble.querySelector('.cc-gl'); if(gl){ gl.hidden = !gl.hidden; G.glossOn = !gl.hidden; } return; }
    if(G.lineSkip){ var f = G.lineSkip; G.lineSkip = null; f(); }
  });
  G.ro = W.ResizeObserver ? new ResizeObserver(function(){ fitFrames(); redrawThreads(); }) : null;
  if(G.ro) G.ro.observe(main);
}
function renderTabs(){
  // inside the hub (steps 2-4) the three tabs ink in spine order of what is established (GDD 15 CC1)
  var st = G.round.step, hs = st >= 1 && st <= 3 ? hubState() : null, cur = -1;
  G.head.querySelectorAll('.cc-tab').forEach(function(t, i){
    var done = i < st || !!(hs && i >= 1 && i <= 3 && hs[i - 1]);
    if(!done && cur < 0) cur = i;
    t.classList.toggle('cc-done', done); t.classList.toggle('cc-cur', i === cur);
  });
}
function page(){ G.main.innerHTML = ''; var p = el('div', 'cc-page'); G.main.appendChild(p); G.page = p; G.thread = null; return p; }
function frameIn(p){
  var cell = el('div', 'cc-framecell'), fr = el('div', 'cc-frame');
  fr.setAttribute('dir', 'ltr');
  cell.appendChild(fr); p.appendChild(cell);
  fitFrames();
  return fr;
}
function fitFrames(){
  if(!G || !G.main) return;
  G.main.querySelectorAll('.cc-framecell').forEach(function(cell){
    var fr = cell.querySelector('.cc-frame'); if(!fr) return;
    var cw = cell.clientWidth, ch = cell.clientHeight; if(!cw || !ch) return;
    var w = Math.min(cw - 4, ch * 0.8); fr.style.width = Math.round(w) + 'px'; fr.style.height = Math.round(w * 1.25) + 'px';
  });
}
function actions(p, html){ var a = el('div', 'cc-actions', html); p.appendChild(a); return a; }
function trayIn(p, ids){
  var t = el('div', 'cc-tray', '<div class="cc-tray-h"><span>' + esc(U('evidence')) + '</span></div><div class="cc-tray-row">' + ids.map(function(id){ return evCardHtml(id); }).join('') + '</div>');
  p.appendChild(t);
  return t;
}
function collected(){ var r = G.round; return (C().evidence || []).map(function(e){ return e.id; }).filter(function(id){ return r.found.indexOf(id) >= 0 || r.given.indexOf(id) >= 0; }); }
function openBag(){
  var row = G.sheet.querySelector('.cc-tray-row');
  var ids = collected(); if(G.round.secret && C().secret) ids = ids.concat([C().secret.id]);
  row.innerHTML = ids.map(function(id){ return evCardHtml(id); }).join('');
  G.sheet.querySelector('.cc-sheetfact').innerHTML = '';
  G.sheet.classList.add('cc-open'); sfx('paper');
  G.bagBtn.classList.remove('cc-new');
  if(G.bagShim){ var c = row.querySelector('[data-ev="' + G.bagShim + '"]'); shim(c); G.bagShim = null; }
}
function openBoardPeek(){
  // a read-only look at the board: who said what (any step)
  var ov = el('div', 'cc-archive');
  ov.innerHTML = '<h2>' + esc(U('board')) + '</h2>';
  var b = el('div', 'cc-board'); b.innerHTML = '<div class="cc-grid">' + boardPins({said:true, evidence:true}) + '</div>';
  ov.appendChild(b);
  chipWords();
  var mine = (G.chipList || []).filter(function(x){ return G.round.words.indexOf(x.key) >= 0; });
  if(mine.length) ov.insertAdjacentHTML('beforeend', '<div class="cc-wordstrip"><b dir="' + uiDir() + '">' + esc(U('words')) + '</b>' + mine.map(function(x){ return '<span class="cc-chip" data-t="' + esc(x.type) + '" lang="' + G.lang + '">' + esc(x.t) + '</span>'; }).join('') + '</div>');
  var a = el('div', 'cc-actions', '<button type="button" class="cc-btn">' + esc(U('close')) + '</button>');
  ov.appendChild(a);
  G.root.appendChild(ov);
  a.firstChild.addEventListener('click', function(){ ov.remove(); });
}

/* ============================== board pieces ============================== */
function polHtml(who, o){
  o = o || {};
  var cleared = isCleared(who);
  var said = '';
  if(o.said){
    said = '<ul class="cc-said">' + stmts().filter(function(s){ return s.by === who && G.round.heard.indexOf(s.id) >= 0 && (o.allSaid || s.breaks || s.confirms); }).map(function(s){
      var broke = G.round.broken.indexOf(s.id) >= 0, chk = G.round.confirmed.indexOf(s.id) >= 0;
      var nw = broke ? thenPin(s) : null;
      return '<li class="' + (broke ? 'cc-broke' : '') + '" data-stmt="' + esc(s.id) + '" lang="' + G.lang + '">' + (broke ? '<s>' + esc(T(s)) + '</s>' + (nw ? '<br>' + esc(T(nw)) : '') : esc(T(s))) + (chk ? ' ✓' : '') + '</li>';
    }).join('') + '</ul>';
  }
  return '<button type="button" class="cc-pin' + (cleared ? ' cc-cleared' : '') + (o.cls ? ' ' + o.cls : '') + '" data-pin="' + esc(who) + '" data-who="' + esc(who) + '"><div class="cc-polaroid">' + faceHtml(who, o.expr) +
    '<p>' + esc(castShort(who)) + '</p><div class="cc-back" lang="' + G.lang + '">' + esc(clearedWord()) + '</div></div>' + said + '</button>';
}
function clearedWord(){ var r = (C().reevaluation || []).filter(function(l){ return l.id === 're.cleared' || l.who === 'card'; })[0]; return r ? T(r) : (G.lang === 'es' ? 'Descartado' : 'Cleared'); }
function pinHtml(id){
  var p = (G.S.pins || {})[id] || {};
  return '<div class="cc-ev cc-scenepin" data-ev="' + esc(id) + '"><div class="cc-evart" style="--evc:' + esc(p.c || '#e5eaff') + '">' + icon(p.icon || 'frame') + '</div><b lang="' + G.lang + '">' + esc(G.ui !== G.lang && p.name && p.name[G.ui] ? T(p.name) : T(p.name || id)) + '</b></div>';
}
function boardPins(o){
  o = o || {};
  var sus = suspects(), still = sus.filter(function(w){ return !isCleared(w); }), clr = sus.filter(isCleared);
  var h = still.concat(clr).map(function(w){ return polHtml(w, o); }).join('');
  if(o.evidence){
    var ids = collected();
    if(ids.length) h += '<span class="cc-rowlabel">' + esc(U('evidence')) + '</span>' + ids.map(function(id){ return '<button type="button" class="cc-pin" data-pin="' + esc(id) + '">' + evCardHtml(id) + '</button>'; }).join('');
    var pins = Object.keys(G.S.pins || {});
    if(pins.length) h += '<span class="cc-rowlabel">' + esc(U('places')) + '</span>' + pins.map(function(id){ return '<button type="button" class="cc-pin" data-pin="' + esc(id) + '">' + pinHtml(id) + '</button>'; }).join('');
  }
  return h;
}
// a suspect is cleared (polaroid face down) only when every one of their confirmable lines is checked (C1 Jack has two)
function isCleared(who){ var cs = confirmables().filter(function(s){ return s.by === who; }); return cs.length > 0 && cs.every(function(s){ return G.round.confirmed.indexOf(s.id) >= 0; }); }
// the new version of a broken line that is pinned under it: the owner's then-line, else the first one (C1: Moss speaks first, nobody retracts)
function thenPin(s){ if(!s || !s.then) return null; var ls = ((C().thenLines || {})[s.then] || []).filter(cond); return ls.filter(function(l){ return l.who === s.by || l.who === s.who; })[0] || ls[0] || null; }

/* ============================== evidence drag (long-press 120 ms) + tap-then-tap ============================== */
function dragCards(scope, o){
  // o.targets() -> [element with data-stmt], o.drop(evId, stmtId) -> Promise, o.tap(evId, cardEl)
  var offs = [];
  scope.querySelectorAll('.cc-ev').forEach(function(card){
    var h = function(e){
            if(G.busy || (e.button != null && e.button > 0)) return;
      e.preventDefault();
      var id = card.dataset.ev, pid = e.pointerId, sx = e.clientX, sy = e.clientY, started = false, ghost = null, hot = null, offX = 0, offY = 0, ox = 0, oy = 0;
      var tm = setTimeout(begin, 120);
      function begin(){
        if(started || !G || G.busy) return; started = true;
        var r = rect(card); offX = sx - r.left; offY = sy - r.top;
        var R0 = rect(G.root); ox = R0.left; oy = R0.top;
        ghost = card.cloneNode(true); ghost.classList.add('cc-ghost'); ghost.style.left = (r.left - ox) + 'px'; ghost.style.top = (r.top - oy) + 'px'; ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
        G.root.appendChild(ghost); card.classList.add('cc-ghostsrc'); sfx('paper');
        select(null); G.dragInside = false;
        G.status.dragging = true;
      }
      function mv(ev){
        if(ev.pointerId !== pid) return;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if(!started && dx * dx + dy * dy > 36){ clearTimeout(tm); begin(); }
        if(!started) return;
        ghost.style.left = (ev.clientX - offX - ox) + 'px'; ghost.style.top = (ev.clientY - offY - oy) + 'px';
        var c = center(rect(ghost)), nh = null;
        o.targets().forEach(function(t){ var r = rect(t); if(c.x >= r.left - 8 && c.x <= r.right + 8 && c.y >= r.top - 8 && c.y <= r.bottom + 8) nh = t; });
        if(nh !== hot){ if(hot) hot.classList.remove('cc-hot'); hot = nh; if(hot) hot.classList.add('cc-hot'); }
        autoScroll(c);
      }
      function up(ev){
        if(ev.pointerId !== pid) return;
        clearTimeout(tm); W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up);
        if(G) G.status.dragging = false;
        if(!started){ o.tap(id, card); return; }
        if(hot) hot.classList.remove('cc-hot');
        if(hot){ var g2 = ghost; o.drop(id, hot.dataset.stmt, g2).then(function(ok){ if(ok) fadeGhost(g2, card); else springBack(g2, card); }); }
        else springBack(ghost, card);
      }
      W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
    };
    card.addEventListener('pointerdown', h);
    offs.push(function(){ card.removeEventListener('pointerdown', h); });
  });
  return function(){ offs.forEach(function(f){ f(); }); };
}
function autoScroll(c){
  // edge scrolling starts only once the card has been well inside the list (dragging up out of the tray must not scroll it)
  var sc = G.page && G.page.querySelector('.cc-testi, .cc-board'); if(!sc) return;
  var r = rect(sc);
  if(c.y > r.top + 50 && c.y < r.bottom - 50) G.dragInside = true;
  if(!G.dragInside) return;
  if(c.y < r.top + 36) sc.scrollTop -= 10; else if(c.y > r.bottom - 36 && c.y < r.bottom) sc.scrollTop += 10;
}
function springBack(ghost, card){
  if(!ghost) return;
  sfx('tick');
  var a = rect(ghost), b = rect(card);
  if(RM()){ ghost.remove(); card.classList.remove('cc-ghostsrc'); return; }
  var an = ghost.animate([{transform:'rotate(-4deg) scale(1.08)'}, {transform:'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) rotate(0) scale(1)'}], {duration:300, easing:SPRING, fill:'forwards'});
  an.onfinish = function(){ ghost.remove(); card.classList.remove('cc-ghostsrc'); };
}
function fadeGhost(ghost, card){
  if(!ghost) return;
  if(RM()){ ghost.remove(); card.classList.remove('cc-ghostsrc'); return; }
  var an = ghost.animate([{opacity:1, transform:'rotate(-4deg) scale(1.08)'}, {opacity:0, transform:'rotate(0) scale(.6)'}], {duration:260, fill:'forwards'});
  an.onfinish = function(){ ghost.remove(); card.classList.remove('cc-ghostsrc'); };
}
function select(id){
  G.sel = id;
  if(G.page) G.page.querySelectorAll('.cc-ev').forEach(function(c){ c.classList.toggle('cc-sel', c.dataset.ev === id); });
}

/* ============================== save / resume (GDD 12) ============================== */
var LS_ROUND = 'farinCaseRound', LS_CASES = 'farinCases';
function hostLoadRound(host){ try{ if(host && host.loadRound) return host.loadRound(); return JSON.parse(localStorage.getItem(LS_ROUND) || 'null'); }catch(e){ return null; } }
function save(){
  if(!G) return;
  try{ if(G.host.saveRound) G.host.saveRound(G.round); else localStorage.setItem(LS_ROUND, JSON.stringify(G.round)); }catch(e){}
}
function loadCases(host){
  var c = null;
  try{ c = host.loadCases ? host.loadCases() : JSON.parse(localStorage.getItem(LS_CASES) || 'null'); }catch(e){}
  return c && typeof c === 'object' ? c : {};
}
function saveCases(c){ try{ if(G.host.saveCases) G.host.saveCases(c); else localStorage.setItem(LS_CASES, JSON.stringify(c)); }catch(e){} }
function houseMem(){ try{ var h = G.host.loadHouse ? G.host.loadHouse() : JSON.parse(localStorage.getItem('farinCozyHouse') || 'null'); return (h && h.mem) || {}; }catch(e){ return {}; } }
function placeName(){ var p = C().place || (typeof C().town === 'string' ? C().town : ''); return T(p) || (G.lang === 'es' ? 'Cudillero' : 'Whitby'); }
function townKeys(){ var t = C().town; if(!t || typeof t !== 'object') t = G.S.town; return t && typeof t === 'object' ? t : {}; }
function newRound(S, lang){ return {v:2, episode:S.id, lang:lang, step:0, met:[], words:[], found:[], given:[], heard:[], broken:[], confirmed:[], links:[], deduction:{}, dedSet:[], panel:0, secret:false, souvenir:null, startedAt:Date.now()}; }

/* ============================== 1 · QUESTION ============================== */
async function stepQuestion(){
  var p = page(), fr = frameIn(p);
  var q = (C().question || []).filter(cond);
  if(G.S.coldOpen && !G.round.coldSeen){
    // CC5: one wordless panel from the crime, 3 s, a tap skips it
    fr.innerHTML = '<div class="cc-plate">' + plateHtml(G.S.coldOpen.plate) + '</div>';
    G.status = {kind:'cold', step:'question', skip:'.cc-frame'};
    await Promise.race([wait(3000, true), untilClick(fr).catch(function(){})]);
    G.round.coldSeen = true; save();
    sfx('flip');
  }
  fr.innerHTML = '<div class="cc-plate">' + plateHtml(G.S.open.plate) + '</div>';
  if(!RM()) run(fr.firstChild, [{opacity:0}, {opacity:1}], {duration:500});
  var card = q.filter(function(l){ return l.who === 'card'; })[0];
  var take = q.filter(function(l){ return l.who === 'ui' || l.id === 'q.take'; })[0];
  await wait(350);
  if(card){
    var cc = el('div', 'cc-casecard', '<small>' + esc(T(C().series)) + '</small><b lang="' + G.lang + '">' + esc(T(card)) + '</b>');
    fr.appendChild(cc);
    sfx('stamp'); buzz([12]);
    await run(cc, [{transform:'rotate(-2deg) scale(1.5)', opacity:0}, {transform:'rotate(-2deg) scale(1)', opacity:1}], {duration:240, easing:'cubic-bezier(.3,1.5,.6,1)'});
  }
  for(var i = 0; i < q.length; i++){ if(q[i].who !== 'card' && q[i].who !== 'ui' && q[i].id !== 'q.take') await sayLine(q[i], {who:q[i].who, expr:exprOf(q[i].face)}); }
  var label = take ? (G.ui === G.lang ? T(take) : (take[G.ui] || U('take'))) : U('take');
  var a = actions(p, '<button type="button" class="cc-btn cc-primary cc-take">' + esc(label) + '</button>');
  G.status = {kind:'button', step:'question', sel:'.cc-take'};
  if(!RM()) a.firstChild.classList.add('cc-pulse');
  await untilClick(a, '.cc-take');
  sfx('correct');
}

/* ============================== 2-4 · THE HUB: possibilities, investigation and evidence on one screen (GDD 15 CC1) ============================== */
function typeInto(node, text, msPer){
  return new Promise(function(res){
    var g = G;
    if(RM() || !g){ node.textContent = text; return res(); }
    var i = 0, caret = el('span', 'cc-caret');
    var ms = Math.max(3, (msPer || 28) * g.pace);
    var t = setInterval(function(){
      if(!G || G !== g || g.dead){ clearInterval(t); return res(); }
      i += 1; node.textContent = text.slice(0, i); node.appendChild(caret);
      if(i % 2 === 0 && text.charAt(i - 1) !== ' ') sfx('type');
      if(i >= text.length){ clearInterval(t); caret.remove(); g.typeSkip = null; sfx('bell'); res(); }
    }, ms);
    g.typeSkip = function(){ clearInterval(t); node.textContent = text; g.typeSkip = null; res(); };
  });
}
function leftFor(k){ var c = (C().mossLeft || []).filter(function(l){ return l.id && l.id.slice(-('.left.' + k).length) === '.left.' + k; })[0]; return c || lx('moss.left.' + k); }
function stmtVisible(s){ return !s.needs || s.needs.every(function(id){ return G.round.found.indexOf(id) >= 0 || G.round.given.indexOf(id) >= 0; }); }
function hubState(){
  var r = G.round;
  var met = suspects().every(function(w){ return r.met.indexOf(w) >= 0; });
  var found = (G.S.finds || []).every(function(f){ return r.found.indexOf(f.id) >= 0; });
  var heard = stmts().every(function(s){ return r.heard.indexOf(s.id) >= 0; });
  return [met, met && found, met && found && heard];
}
function canTalk(who){ return stmts().some(function(s){ return s.by === who && stmtVisible(s) && G.round.heard.indexOf(s.id) < 0; }); }
function personState(who){ var r = G.round; if(r.met.indexOf(who) < 0 && suspects().indexOf(who) >= 0) return 'new'; if(canTalk(who)) return 'talk'; return 'done'; }
function taught(){ try{ if(G.host.loadTaught) return !!G.host.loadTaught(); return localStorage.getItem('farinCaseTaught') === '1'; }catch(e){ return true; } }
function setTaught(){ try{ if(G.host.saveTaught) G.host.saveTaught(true); else localStorage.setItem('farinCaseTaught', '1'); }catch(e){} }
async function stepHub(){
  var S = G.S, views = S.views || [], r = G.round;
  var need = function(){ return (S.finds || []).filter(function(f){ return r.found.indexOf(f.id) < 0; }); };
  var p = page(), fr = frameIn(p);
  var vi = 0;
  var Rpct = 17, mag = 1.25, warmAfter = (G.band === 'B2' || G.band === 'C1') ? 20000 : 0, viewSince = Date.now();
  var lensPos = {x:50, y:46}, spotted = null;
  var lensEl, lensIn, handle, spotEl, warmEl;
  var nav = '<button type="button" class="cc-viewnav cc-prev" aria-label="prev">' + svg('<path d="M15 5l-7 7 7 7"/>') + '</button><button type="button" class="cc-viewnav cc-next" aria-label="next">' + svg('<path d="M9 5l7 7-7 7"/>') + '</button>';
  function findsIn(vid){ return (S.finds || []).concat(S.secret ? [Object.assign({secret:true}, S.secret)] : []).filter(function(f){ return f.view === vid; }); }
  function viewClear(vid){ return (S.finds || []).filter(function(f){ return f.view === vid; }).every(function(f){ return r.found.indexOf(f.id) >= 0; }); }
  function detailHtml(vid){
    return findsIn(vid).map(function(f){
      var got = f.secret ? r.secret : r.found.indexOf(f.id) >= 0;
      var st = evStage(f.id), m = man('find-' + f.id);
      var inner = m && m.ready ? '<img src="' + esc(artUrl(m)) + '" alt="" style="width:100%;height:100%;object-fit:contain">' : icon(st.icon);
      return '<div class="cc-find' + (got ? ' cc-got' : '') + '" data-find="' + esc(f.id) + '" style="left:' + f.box[0] + '%;top:' + f.box[1] + '%;width:' + f.box[2] + '%;height:' + f.box[3] + '%">' + inner + '</div>';
    }).join('');
  }
  function peopleHtml(v){
    return (v.people || []).map(function(pp){
      var st = personState(pp.who);
      return '<button type="button" class="cc-person cc-ps-' + st + '" data-who="' + esc(pp.who) + '" style="left:' + pp.x + '%;top:' + pp.y + '%;width:' + (pp.w || 20) + '%" aria-label="' + esc(castShort(pp.who)) + '">' + faceHtml(pp.who) +
        '<b lang="' + G.lang + '">' + esc(castShort(pp.who)) + '</b><i class="cc-pmark">' + (st === 'done' ? svg('<path d="M6 12.5l4 4L18 8"/>') : st === 'talk' ? svg('<path d="M5 6h14v9h-8l-4 3v-3H5z"/>') : '') + '</i></button>';
    }).join('');
  }
  function mount(){
    var v = views[vi];
    viewSince = Date.now();
    fr.innerHTML = '<div class="cc-plate">' + plateHtml(v.plate) + '</div>' +
      '<div class="cc-lens-handle"></div><div class="cc-lens"><div class="cc-lens-in"><div class="cc-plate">' + plateHtml(v.detail || v.plate) + '</div><div class="cc-detail">' + detailHtml(v.id) + '</div></div><i class="cc-warm"></i></div>' +
      '<div class="cc-people">' + peopleHtml(v) + '</div>' +
      '<div class="cc-viewdots">' + views.map(function(w, i){ return '<span class="' + (i === vi ? 'cc-on' : '') + (viewClear(w.id) ? ' cc-clear' : '') + '" lang="' + G.lang + '">' + esc(T(w.label)) + '</span>'; }).join('') + '</div>' + (views.length > 1 ? nav : '');
    lensEl = fr.querySelector('.cc-lens'); lensIn = fr.querySelector('.cc-lens-in'); handle = fr.querySelector('.cc-lens-handle'); warmEl = fr.querySelector('.cc-warm');
    spotEl = null; spotted = null;
    place();
  }
  function paintPeople(){ var pl = fr.querySelector('.cc-people'); if(pl) pl.innerHTML = peopleHtml(views[vi]); }
  function fsize(){ return {w:fr.clientWidth, h:fr.clientHeight}; }
  function place(){
    var s = fsize(); if(!s.w || !lensEl) return;
    var R = s.w * Rpct / 100, cx = lensPos.x / 100 * s.w, cy = lensPos.y / 100 * s.h;
    lensEl.style.width = lensEl.style.height = (2 * R) + 'px';
    lensEl.style.left = (cx - R) + 'px'; lensEl.style.top = (cy - R) + 'px';
    lensIn.style.width = s.w + 'px'; lensIn.style.height = s.h + 'px';
    lensIn.style.transform = 'translate(' + (R - cx * mag) + 'px,' + (R - cy * mag) + 'px) scale(' + mag + ')';
    handle.style.left = (cx + R * .62) + 'px'; handle.style.top = (cy + R * .62) + 'px'; handle.style.transform = 'rotate(-45deg)';
    var hit = null, tol = Rpct * 0.45, warm = null, warmD = 1e9;
    findsIn(views[vi].id).forEach(function(f){
      var got = f.secret ? r.secret : r.found.indexOf(f.id) >= 0; if(got) return;
      var b = f.box, fx = b[0] + b[2] / 2, fy = b[1] + b[3] / 2;
      var dx = Math.abs(lensPos.x - fx) - b[2] / 2, dy = (Math.abs(lensPos.y - fy) - b[3] / 2) * 0.8;
      if(dx < tol && dy < tol && !hit) hit = f;
      // CC4: warm when the glass is near a required find (B2-C1 only after 20 s in the view)
      if(!f.secret){ var d = Math.sqrt(Math.pow((lensPos.x - fx) / 100 * s.w, 2) + Math.pow((lensPos.y - fy) / 100 * s.h, 2)); var fr2 = Math.max(b[2] / 100 * s.w, b[3] / 100 * s.h) / 2; if(d < R + 1.5 * fr2 + R * .6 && d < warmD){ warmD = d; warm = {x:fx, y:fy}; } }
    });
    if(warm && !hit && (Date.now() - viewSince >= warmAfter)){
      var ang = Math.atan2((warm.y - lensPos.y) * s.h, (warm.x - lensPos.x) * s.w);
      warmEl.style.display = 'block'; warmEl.style.left = (R + Math.cos(ang) * (R - 6) - 9) + 'px'; warmEl.style.top = (R + Math.sin(ang) * (R - 6) - 9) + 'px';
    } else warmEl.style.display = 'none';
    if(hit !== spotted){
      spotted = hit;
      if(spotEl){ spotEl.remove(); spotEl = null; }
      if(hit){
        var b = hit.box, z = Math.max(b[2], b[3] * .8) + 6;
        spotEl = el('div', 'cc-spot'); spotEl.style.cssText = 'left:' + (b[0] + b[2] / 2 - z / 2) + '%;top:' + (b[1] + b[3] / 2 - z * .4) + '%;width:' + z + '%;height:' + (z * .8) + '%';
        fr.appendChild(spotEl);
        var gl = el('i', 'cc-glint'); gl.style.left = (b[0] + b[2] / 2) + '%'; gl.style.top = (b[1] + b[3] / 2) + '%'; fr.appendChild(gl);
        if(!RM()) run(gl, [{transform:'scale(0) rotate(0)', opacity:1}, {transform:'scale(1) rotate(45deg)', opacity:1, offset:.5}, {transform:'scale(0) rotate(90deg)', opacity:0}], {duration:500}).then(function(){ gl.remove(); }); else gl.remove();
        sfx('ting'); cue(U('tapFind'));
        G.status.spotted = hit.id;
      } else { cue(hubCue()); G.status.spotted = null; }
    }
  }
  function hubCue(){ var t = hubState(); if(!t[0]) return U('tapEach'); return RM() ? U('lensRM') : U('lens'); }
  function leftLine(){
    // Moss points at what is left (CC1): a person not met or not heard, else the finds
    var who = interviewOrder().filter(function(w){ return personState(w) !== 'done'; })[0];
    if(who){ var own = leftFor(who); if(own) return {line:own, who:who}; var l = tl('notYet'); return {line:l, text:T(l).replace('{name}', castShort(who)), gloss:GL(l).replace('{name}', castShort(who)), who:who}; }
    if(need().length) return {line:need()[0].view !== views[vi].id ? tl('lensElse') : (leftFor('finds') || tl('lensH15'))};
    return null;
  }
  mount();
  cue(hubCue());
  clearDock();
  renderTabs();
  var hn = hints({
    h15:function(){
      var l = leftLine(); if(!l) return;
      sayLine(l.line, l.text ? {who:'moss', text:l.text, gloss:l.gloss} : {who:'moss'}).catch(function(){});
      if(l.who){ var vix = views.findIndex(function(v){ return (v.people || []).some(function(pp){ return pp.who === l.who; }); }); if(vix !== vi) shim(fr.querySelector('.cc-next')); else shim(fr.querySelector('.cc-person[data-who="' + l.who + '"]')); }
      else if(need()[0] && need()[0].view !== views[vi].id) shim(fr.querySelector('.cc-next'));
    },
    h45:function(){
      var nx = need()[0];
      if(!nx){ var who = interviewOrder().filter(function(w){ return personState(w) !== 'done'; })[0]; if(who){ var vix = views.findIndex(function(v){ return (v.people || []).some(function(pp){ return pp.who === who; }); }); if(vix >= 0 && vix !== vi){ vi = vix; mount(); } shim(fr.querySelector('.cc-person[data-who="' + who + '"]')); } return; }
      if(nx.view !== views[vi].id){ vi = views.findIndex(function(v){ return v.id === nx.view; }); mount(); }
      glide({x:nx.box[0] + nx.box[2] / 2, y:nx.box[1] + nx.box[3] / 2}, 900);
    }
  }, 2);
  function glide(to, ms){
    return new Promise(function(res){
      if(RM()){ lensPos = to; place(); return res(); }
      var from = {x:lensPos.x, y:lensPos.y}, t0 = performance.now();
      (function step(t){ var k = Math.min(1, (t - t0) / (ms * Math.max(G ? G.pace : 1, .2))); k = 1 - Math.pow(1 - k, 3); lensPos = {x:from.x + (to.x - from.x) * k, y:from.y + (to.y - from.y) * k}; place(); if(k < 1 && G && fr.isConnected) requestAnimationFrame(step); else res(); })(t0);
    });
  }
  G.status = {kind:'hub', step:'investigation', frame:'.cc-frame', next:'.cc-viewnav.cc-next', view:function(){ return views[vi].id; },
    need:function(){ return need().map(function(f){ return {id:f.id, view:f.view, x:f.box[0] + f.box[2] / 2, y:f.box[1] + f.box[3] / 2}; }); },
    people:function(){ return interviewOrder().filter(function(w){ return personState(w) !== 'done'; }).map(function(w){ var v = views.filter(function(x){ return (x.people || []).some(function(pp){ return pp.who === w; }); })[0]; return {who:w, view:v && v.id, state:personState(w)}; }); },
    secret:S.secret ? {id:S.secret.id, view:S.secret.view, x:S.secret.box[0] + S.secret.box[2] / 2, y:S.secret.box[1] + S.secret.box[3] / 2} : null};
  var hubStatus = G.status;
  var busy = false;
  await new Promise(function(resolve, reject){
    var g = G, pid = null, sx = 0, sy = 0, moved = false, touch = false;
    var abort = function(){ reject(ABORT); }; g.waits.add(abort);
    function toPct(ev){ var b = rect(fr); return {x:(ev.clientX - b.left) / b.width * 100, y:(ev.clientY - b.top) / b.height * 100}; }
    function finish(){ if(hubState()[2]){ g.waits.delete(abort); hn.stop(); resolve(); return true; } return false; }
    fr.addEventListener('click', function(e){
      if(busy) return;
      var nb = e.target.closest('.cc-viewnav');
      if(nb){ e.stopPropagation(); vi = (vi + (nb.classList.contains('cc-next') ? 1 : views.length - 1)) % views.length; sfx('paper'); mount(); if(!RM()) run(fr.querySelector('.cc-plate'), [{opacity:.3}, {opacity:1}], {duration:240}); hn.reset(); return; }
      var pe = e.target.closest('.cc-person');
      if(pe){ e.stopPropagation(); person(pe.dataset.who).catch(function(err){ if(err === ABORT) reject(err); else console.error(err); }); }
    });
    fr.addEventListener('pointerdown', function(e){
      if(busy || e.target.closest('.cc-viewnav, .cc-person')) return;
      e.preventDefault();
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; touch = e.pointerType === 'touch';
      try{ fr.setPointerCapture(pid); }catch(err){}
    });
    fr.addEventListener('pointermove', function(e){
      if(e.pointerId !== pid || busy) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if(!moved && dx * dx + dy * dy > 64) moved = true;
      if(!moved || RM()) return;
      var q = toPct(e), s = fsize();
      var lift = touch ? (s.w * Rpct / 100 + 16) / s.h * 100 : 0;
      lensPos = {x:clamp(q.x, 4, 96), y:clamp(q.y - lift, 4, 96)};
      place();
    });
    fr.addEventListener('pointerup', function(e){
      if(e.pointerId !== pid) return; pid = null;
      if(busy) return;
      if(moved && !RM()){ hn.reset(); return; }
      var q = toPct(e);
      if(spotted){ var b = spotted.box, pad = 6; if(q.x >= b[0] - pad && q.x <= b[0] + b[2] + pad && q.y >= b[1] - pad && q.y <= b[1] + b[3] + pad){ collect(spotted).catch(function(err){ if(err === ABORT) reject(err); }); return; } }
      lensPos = {x:clamp(q.x, 4, 96), y:clamp(q.y, 4, 96)}; place(); hn.reset();
    });
    async function person(who){
      if(busy) return;
      busy = true; hn.stop();
      var st = personState(who);
      if(st === 'new'){
        r.met.push(who); save(); sfx('pop');
        var s0 = (C().suspects || []).filter(function(x){ return x.id === who; })[0];
        G.status = {kind:'line', step:'investigation', skip:'.cc-dock'};
        if(s0 && s0.intro) await sayLine(s0.intro, {who:who, voice:s0.intro.who && s0.intro.who !== who ? s0.intro.who : who});
      } else if(st === 'talk'){
        await interview(who, p);
      } else {
        var s1 = stmts().filter(function(x){ return x.by === who; }).pop();
        if(s1) await sayLine(s1, {who:who, voice:voiceOf(s1), y70:isFile(s1)});
      }
      G.status = hubStatus;
      renderTabs(); paintPeople(); mount();
      busy = false;
      if(!finish()) hn.reset();
    }
    async function collect(f){
      busy = true; hn.stop();
      var fEl = fr.querySelector('.cc-lens [data-find="' + f.id + '"]');
      if(f.secret) r.secret = true; else r.found.push(f.id);
      save();
      sfx('ting'); sfx('paper');
      var src = fEl ? rect(fEl) : rect(lensEl), bb = rect(G.bagBtn), f0 = rect(G.root);
      var fly = el('div', '', evCardHtml(f.id)).firstChild; fly.style.cssText = 'position:absolute;z-index:60;left:' + (src.left - f0.left) + 'px;top:' + (src.top - f0.top) + 'px;margin:0';
      G.root.appendChild(fly);
      if(fEl) fEl.classList.add('cc-got');
      spotted = null; if(spotEl){ spotEl.remove(); spotEl = null; }
      var d = evDef(f.id);
      try{
        await run(fly, [{transform:'scale(.4)', opacity:0}, {transform:'scale(1.15)', opacity:1, offset:.4}, {transform:'scale(1)', opacity:1}], {duration:420, easing:SPRING});
        if(f.secret) await sayLine(tl('secret'));
        if(d && d.fact) await sayLine(d.fact, {who:'fact', name:T(d.name)});
        var c = rect(fly);
        await run(fly, [{transform:'none', opacity:1}, {transform:'translate(' + (bb.left - c.left) + 'px,' + (bb.top - c.top) + 'px) scale(.3)', opacity:.2}], {duration:460, easing:'cubic-bezier(.5,0,.3,1)'});
      }finally{ fly.remove(); }
      G.bagBtn.classList.add('cc-new');
      if(!RM()) run(G.bagBtn, [{transform:'scale(1)'}, {transform:'scale(1.18)'}, {transform:'scale(1)'}], {duration:280, easing:SPRING});
      busy = false;
      renderTabs(); mount();
      if(!finish()) hn.reset();
    }
    // CC6: in the learner's first-ever episode Moss makes the first find herself, then hands over
    (async function(){
      if(taught() || !need().length) return;
      var nx = need().filter(function(f){ return f.view === views[vi].id; })[0] || need()[0];
      if(nx.view !== views[vi].id){ vi = views.findIndex(function(v){ return v.id === nx.view; }); mount(); }
      busy = true;
      var line = lx('moss.demo', 'likeThis');
      var sp = sayLine(line);
      await glide({x:nx.box[0] + nx.box[2] / 2, y:nx.box[1] + nx.box[3] / 2}, 1500);
      await sp; busy = false;
      setTaught();
      if(spotted) await collect(spotted);
    })().catch(function(err){ if(err === ABORT) reject(err); });
  });
  cue('');
  if(C().findsDone) await sayLine(C().findsDone);
}
function roomOf(who){ var v = (G.S.views || []).filter(function(x){ return (x.people || []).some(function(pp){ return pp.who === who; }); })[0]; return (v && v.room) || G.S.room || null; }
function fileTag(s){ return isFile(s) ? '<span class="cc-filetag" lang="' + G.lang + '">' + esc(stampText('file')) + '</span>' : ''; }
async function interview(who, p){
  var r = G.round;
  var sh = el('div', 'cc-ivsheet');
  sh.innerHTML = '<div class="cc-iv"><div class="cc-iv-face">' + faceHtml(who) + '</div><p class="cc-iv-name" lang="' + G.lang + '">' + esc(castName(who)) + '</p>' +
    (G.ui !== G.lang || G.band === 'A1' ? '<p class="cc-iv-role" dir="' + uiDir() + '">' + esc(castRole(who)) + '</p>' : '') + '<div class="cc-transcript" dir="ltr"></div></div>';
  p.appendChild(sh);
  if(!RM()) run(sh, [{transform:'translateY(24px)', opacity:0}, {transform:'none', opacity:1}], {duration:300, easing:EASE});
  sfx('paper');
  var tr = sh.querySelector('.cc-transcript'), face = sh.querySelector('.cc-face');
  var gl = function(o){ return GL(o) ? '<span class="cc-gl" dir="' + uiDir() + '"' + (G.band === 'A1' ? '' : ' hidden') + '>' + esc(GL(o)) + '</span>' : ''; };
  cue(G.band === 'A1' ? U('listenA1') : U('listen'));
  tr.addEventListener('click', function(e){
    if(G.typeSkip){ G.typeSkip(); return; }
    if(e.target.closest('.cc-w')) return;
    var sb = e.target.closest('.cc-say'); if(sb){ var s0 = stmt(sb.dataset.stmt); if(s0) speak(T(s0), {who:s0.by}); return; }
    var ln = e.target.closest('.cc-st'); if(ln){ var g0 = ln.querySelector('.cc-gl'); if(g0) g0.hidden = !g0.hidden; }
  });
  var list = stmts().filter(function(s){ return s.by === who && stmtVisible(s); });
  var room = roomTone(roomOf(who));
  // what was already said reads straight away; the new lines type in
  list.filter(function(s){ return r.heard.indexOf(s.id) >= 0; }).forEach(function(s){
    tr.insertAdjacentHTML('beforeend', '<p class="cc-st">' + fileTag(s) + '<span class="cc-tt" lang="' + G.lang + '">' + wordify(T(s)) + '</span>' + gl(s) + '<button type="button" class="cc-say" data-stmt="' + esc(s.id) + '" aria-label="' + esc(U('hear')) + '">' + SPEAKER_SVG + '</button></p>');
  });
  var fresh = list.filter(function(s){ return r.heard.indexOf(s.id) < 0; });
  if(fresh.length) await wait(420);   // the room breathes before the first line
  room.duck();
  for(var i = 0; i < fresh.length; i++){
    var s = fresh[i];
    var ln = el('p', 'cc-st', fileTag(s) + '<span class="cc-tt" lang="' + G.lang + '"></span>');
    tr.appendChild(ln); scrollInto(ln);
    G.status = {kind:'typing', step:'investigation', skip:'.cc-transcript'};
    var talk = RM() ? null : face.animate([{transform:'translateY(0)'}, {transform:'translateY(-3px)'}, {transform:'translateY(0)'}], {duration:420, iterations:Infinity});
    var tt = ln.querySelector('.cc-tt');
    await Promise.all([typeInto(tt, T(s)), speak(T(s), {who:voiceOf(s)})]);
    if(talk) talk.cancel();
    live();
    tt.innerHTML = wordify(T(s));
    ln.insertAdjacentHTML('beforeend', gl(s) + '<button type="button" class="cc-say" data-stmt="' + esc(s.id) + '" aria-label="' + esc(U('hear')) + '">' + SPEAKER_SVG + '</button>');
    r.heard.push(s.id); save(); renderTabs();
    await wait(380);
    if(s.gives && r.given.indexOf(s.gives) < 0){
      if(s.handover){
        var hl = el('p', 'cc-st', '<em class="cc-tt" lang="' + G.lang + '"></em>'); tr.appendChild(hl); scrollInto(hl);
        await Promise.all([typeInto(hl.firstChild, T(s.handover)), speak(T(s.handover), {who:s.handover.who && s.handover.who !== 'owner' ? s.handover.who : voiceOf(s)})]);
        live();
        hl.insertAdjacentHTML('beforeend', gl(s.handover));
      }
      var ho = el('div', 'cc-handover', evCardHtml(s.gives)); tr.appendChild(ho); scrollInto(ho);
      var evc = ho.firstChild;
      if(!RM()){ var d = el('i'); d.style.cssText = 'position:absolute;inset:5px;background:#f0efe9;border-radius:3px'; evc.appendChild(d); sfx('whirr'); run(d, [{opacity:1}, {opacity:0}], {duration:2200}).then(function(){ d.remove(); }); }
      r.given.push(s.gives); save();
      await wait(1300);
      var a = rect(evc), b = rect(G.bagBtn);
      await run(evc, [{transform:'none', opacity:1}, {transform:'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(.3)', opacity:.2}], {duration:480, easing:'cubic-bezier(.5,0,.3,1)'});
      ho.remove(); G.bagBtn.classList.add('cc-new'); sfx('paper');
      var d2 = evDef(s.gives); if(d2 && d2.fact) await sayLine(d2.fact, {who:'fact', name:T(d2.name)});
    }
  }
  var a2 = el('div', 'cc-actions', '<button type="button" class="cc-btn cc-primary cc-ivnext">' + esc(U('back')) + '</button>');
  sh.appendChild(a2);
  G.status = {kind:'button', step:'investigation', sel:'.cc-ivnext'};
  await untilClick(a2, '.cc-ivnext');
  sfx('paper');
  sh.remove();
}
function scrollInto(n){
  // scroll only the nearest scrolling box inside the game (scrollIntoView would also scroll the Theatre stage)
  if(!n) return;
  var sc = n.parentElement;
  while(sc && sc !== G.root){ var cs = getComputedStyle(sc); if(/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight) break; sc = sc.parentElement; }
  if(!sc || sc === G.root) return;
  var a = rect(n), b = rect(sc);
  if(a.top < b.top + 8 || a.bottom > b.bottom - 8) sc.scrollTop += (a.top - b.top) - (b.height - a.height) / 2;
}

/* ============================== CC2 · collect the words: every deduction chip word in the text is underlined in its gap colour ============================== */
function chipWords(){
  if(G.chipRe !== undefined) return G.chipRe;
  var list = [];
  (G.gaps || []).forEach(function(gp, gi){ gp.pool.forEach(function(c){ var t = chipT(c); if(t && t.length > 1) list.push({t:t, key:gi + ':' + c.id, type:gt(gp.type)}); }); });
  list.sort(function(a, b){ return b.t.length - a.t.length; });
  G.chipList = list;
  G.chipRe = list.length ? new RegExp('(?<![\\p{L}\\p{N}])(' + list.map(function(x){ return x.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![\\p{L}\\p{N}])', 'giu') : null;
  return G.chipRe;
}
function wordify(text){
  var re = chipWords(); text = String(text || '');
  if(!re) return esc(text);
  var out = '', last = 0, m; re.lastIndex = 0;
  while((m = re.exec(text))){
    var hit = G.chipList.filter(function(x){ return x.t.toLowerCase() === m[1].toLowerCase(); })[0];
    out += esc(text.slice(last, m.index)) + '<span class="cc-w' + (G.round.words.indexOf(hit.key) >= 0 ? ' cc-got' : '') + '" data-w="' + esc(hit.key) + '" data-t="' + esc(hit.type) + '">' + esc(m[1]) + '</span>';
    last = m.index + m[1].length;
  }
  return out + esc(text.slice(last));
}
function collectWord(span){
  var k = span.dataset.w, r = G.round;
  if(r.words.indexOf(k) >= 0) return;
  r.words.push(k); save();
  G.root.querySelectorAll('.cc-w[data-w="' + k + '"]').forEach(function(n){ n.classList.add('cc-got'); });
  sfx('tick');
  if(RM()) return;
  var a = rect(span), b = rect(G.boardBtn), f = rect(G.root);
  var c = el('span', 'cc-wfly', esc(span.textContent)); c.style.left = (a.left - f.left) + 'px'; c.style.top = (a.top - f.top) + 'px';
  G.root.appendChild(c);
  var an = c.animate([{transform:'none', opacity:1}, {transform:'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(.4)', opacity:.2}], {duration:520, easing:'cubic-bezier(.5,0,.3,1)'});
  an.onfinish = function(){ c.remove(); };
}

/* ============================== 5 · CONTRADICTION + 6 · RE-EVALUATION: drop evidence on a line ============================== */
function breakOpen(s){
  // a "then" line with its own break opens only after the first break (GDD 5.2 rule 6)
  if(!s) return false;
  var parent = stmts().filter(function(x){ return x.then && (C().thenLines[x.then] || []).some(function(l){ return l.id === s.id; }); })[0];
  return !parent || G.round.broken.indexOf(parent.id) >= 0;
}
function breakables(){
  var list = stmts().filter(function(s){ return s.breaks; });
  var t = C().thenLines || {};
  Object.keys(t).forEach(function(k){ (t[k] || []).forEach(function(l){ if(l.breaks) list.push(Object.assign({by:l.who}, l)); }); });
  return list.filter(breakOpen);
}
function confirmables(){ return stmts().filter(function(s){ return s.confirms; }); }
function lineHtml(s, o){
  o = o || {};
  var broke = G.round.broken.indexOf(s.id) >= 0, chk = G.round.confirmed.indexOf(s.id) >= 0;
  var text = esc(T(s));
  if(o.under && s.keyWords) s.keyWords.forEach(function(k){ text = text.split(esc(k)).join('<u>' + esc(k) + '</u>'); });
  var note = s.who === 'moss' || s.who === 'narr';
  return '<div role="button" tabindex="0" class="cc-line' + (broke ? ' cc-broken' : '') + (chk ? ' cc-checked' : '') + (o.isNew ? ' cc-new' : '') + (note ? ' cc-note' : '') + '" data-stmt="' + esc(s.id) + '">' +
    (note ? '<span class="cc-notewho" lang="' + G.lang + '">' + esc(castShort(s.who) || '') + '</span>' : '') + '<span class="cc-t" lang="' + G.lang + '" dir="ltr">' + text + '</span>' +
    (GL(s) ? '<span class="cc-gl" dir="' + uiDir() + '"' + (G.band === 'A1' ? '' : ' hidden') + '>' + esc(GL(s)) + '</span>' : '') +
    (broke ? crackSvg() + '<div class="cc-stamp" lang="' + G.lang + '">' + esc(stampText('contradiction')) + '</div>' : '') +
    (chk ? '<div class="cc-stamp cc-ok" lang="' + G.lang + '">' + esc(stampText('checked')) + '</div>' : '') + '</div>';
}
function crackSvg(){ return '<svg class="cc-crack" viewBox="0 0 100 14" preserveAspectRatio="none"><path d="M0 7 L12 4 L20 10 L31 5 L40 9 L52 3 L61 10 L72 5 L83 9 L92 4 L100 7" pathLength="100"/></svg>'; }
function testimonyHtml(o){
  o = o || {};
  var r = G.round, h = '';
  interviewOrder().forEach(function(who){
    var all = stmts().filter(function(s){ return s.by === who && r.heard.indexOf(s.id) >= 0; });
    // C1: lines read from the 1970 file sit under the owner's 1970 polaroid with the FILE 1970 tag; today's words under today's face
    [all.filter(isFile), all.filter(function(s){ return !isFile(s); })].forEach(function(list, gi){
      if(!list.length) return;
      var y70 = gi === 0;
      h += '<div class="cc-who' + (isCleared(who) ? ' cc-clr' : '') + (y70 ? ' cc-whofile' : '') + '" data-clr="' + esc(clearedWord()) + '">' + faceHtml(who, null, y70) + '<b lang="' + G.lang + '">' + esc(castShort(who)) + '</b>' +
        (y70 ? '<span class="cc-filetag" lang="' + G.lang + '">' + esc(stampText('file')) + '</span>' : '') + '</div>';
      list.forEach(function(s){
        h += lineHtml(s, {under:o.under === s.id});
        var l = r.broken.indexOf(s.id) >= 0 ? thenPin(s) : null;
        if(l) h += lineHtml(Object.assign({by:s.by}, l), {under:o.under === l.id, isNew:true});
      });
    });
  });
  return h;
}
async function dropStep(mode){
  // mode 'break' (CONTRADICTION) or 'confirm' (RE-EVALUATION)
  var r = G.round;
  var need = function(){ return mode === 'break' ? breakables().filter(function(s){ return r.broken.indexOf(s.id) < 0; }) : confirmables().filter(function(s){ return r.confirmed.indexOf(s.id) < 0; }); };
  if(!need().length) return;
  var p = page();
  var list = el('div', 'cc-testi');
  var under = null;
  function paint(){ list.innerHTML = testimonyHtml({under:under}); }
  paint(); p.appendChild(list);
  var tray = trayIn(p, collected());
  cue(RM() ? U('dropRM') : U('press'));
  if(mode === 'confirm') cue(U('confirm'));
  clearDock();
  var guide = null;
  var hn = hints({
    h15:function(){
      var s = need()[0]; if(!s) return;
      var ev = (mode === 'break' ? s.breaks : s.confirms)[0];
      var line = s.h15 || (mode === 'confirm' ? tl('confirmH15') : null);
      if(line) sayLine(line).catch(function(){});
      shim(tray.querySelector('[data-ev="' + ev + '"]'));
    },
    h45:function(){
      var s = need()[0]; if(!s) return;
      var ev = (mode === 'break' ? s.breaks : s.confirms)[0];
      guide = {ev:ev, stmt:s.id};
      under = s.id; paint();
      var d = evDef(ev); if(d && d.fact) sayLine(d.fact, {who:'fact', name:T(d.name)}).catch(function(){});
      var lnEl = list.querySelector('[data-stmt="' + s.id + '"]'), cEl = tray.querySelector('[data-ev="' + ev + '"]');
      if(lnEl) scrollInto(lnEl);
      setTimeout(function(){ if(lnEl && cEl && G) arrowBetween(cEl, lnEl); }, 380);
      shim(cEl);
    }
  });
  hn.start();
  G.status = {kind:'drop', step:SPINE[r.step], mode:mode, list:'.cc-testi', tray:'.cc-tray',
    pairs:function(){ return need().map(function(s){ return {ev:(mode === 'break' ? s.breaks : s.confirms)[0], stmt:s.id}; }); }};
  var lastReply = -1;
  async function attempt(ev, sid){
    var s = stmt(sid); if(!s) return false;
    if(r.broken.indexOf(sid) >= 0 || r.confirmed.indexOf(sid) >= 0) return false;
    G.busy = true;
    try{
      if(s.breaks && s.breaks.indexOf(ev) >= 0 && breakOpen(s)){ hn.stop(); await doBreak(s, ev, list, paint); guide = null; under = null; paint(); if(need().length) hn.reset(); return true; }
      if(s.confirms && s.confirms.indexOf(ev) >= 0){ hn.stop(); await doConfirm(s, ev, list, paint); guide = null; under = null; paint(); if(need().length) hn.reset(); return true; }
      // a wrong drop is never marked wrong: the card goes home, its fact line shows once, the owner shrugs
      hn.wrong();
      var d = evDef(ev);
      var fp = el('div', 'cc-factpop', '<small dir="' + uiDir() + '">' + esc(U('thisToldYou')) + '</small><p lang="' + G.lang + '" dir="ltr">' + esc(T(d && d.fact)) + '</p>' + (GL(d && d.fact) ? '<p class="cc-gl" dir="' + uiDir() + '">' + esc(GL(d.fact)) + '</p>' : ''));
      tray.appendChild(fp);
      if(!RM()) run(fp, [{opacity:0, transform:'translateY(8px)'}, {opacity:1, transform:'none'}], {duration:220});
      await speak(T(d && d.fact), {who:'fact'});
      // an authored near miss (s.near[cardId]) answers first; lines from the 1970 file get Moss's filePool; else the owner's band pool
      var near = s.near && s.near[ev];
      if(near){ var nw = near.who && near.who !== 'owner' ? near.who : voiceOf(s); await sayLine(near, nw === 'moss' ? {who:'moss'} : {who:s.by, voice:nw, y70:isFile(s)}); }
      else {
        var file = isFile(s) && (C().filePool || []).length, pool = file ? C().filePool : (C().wrongDropPool || []);
        if(pool.length){ var i; do{ i = Math.floor(Math.random() * pool.length); }while(pool.length > 1 && i === lastReply); lastReply = i; await sayLine(pool[i], file ? {who:'moss'} : {who:s.by, voice:voiceOf(s), y70:isFile(s)}); }
      }
      fp.remove();
      return false;
    }catch(e){ if(e === ABORT) throw e; return false; }
    finally{ if(G) G.busy = false; }
  }
  await new Promise(function(resolve, reject){
    var g = G; var abort = function(){ reject(ABORT); }; g.waits.add(abort);
    var off = dragCards(tray, {
      targets:function(){ return Array.prototype.slice.call(list.querySelectorAll('.cc-line:not(.cc-broken):not(.cc-checked):not(.cc-note)')); },
      drop:function(ev, sid){ return attempt(ev, sid).then(function(ok){ check(); return ok; }, function(e){ reject(e); return false; }); },
      tap:function(ev){
        if(guide && guide.ev === ev){ var gs = guide.stmt; select(null); attempt(ev, gs).then(check, reject); return; }
        select(G.sel === ev ? null : ev); sfx('tick');
      }
    });
    list.addEventListener('click', function(e){
      var ln = e.target.closest('.cc-line'); if(!ln || G.busy || ln.classList.contains('cc-note')) return;
      if(G.sel){ var ev = G.sel; select(null); if(ln.classList.contains('cc-broken') || ln.classList.contains('cc-checked')) return; attempt(ev, ln.dataset.stmt).then(check, reject); return; }
      if(mode === 'break') press(ln.dataset.stmt).catch(function(err){ if(err === ABORT) reject(err); });
      else { var gl = ln.querySelector('.cc-gl'); if(gl) gl.hidden = !gl.hidden; }
    });
    async function press(sid){
      // CC3: a tap presses the statement: the owner answers with one more line and its key words get a pencil underline
      var s = stmt(sid); if(!s || G.busy) return;
      G.busy = true;
      try{
        under = sid; paint();
        var gl2 = list.querySelector('[data-stmt="' + sid + '"] .cc-gl'); if(gl2) gl2.hidden = false;
        var pool = (C().pressPool || ['press.pool.1', 'press.pool.2']).map(function(k){ return typeof k === 'string' ? lx(k) : k; }).filter(Boolean);
        var pl = lx('press.' + sid) || s.press || ((G.S.press || {})[sid] ? (G.S.press[sid][G.lang] || null) : null) || (pool.length ? pool[Math.floor(Math.random() * pool.length)] : tl('pressPool'));
        await sayLine(pl, {who:s.by, voice:pl && pl.who && pl.who !== 'owner' ? pl.who : voiceOf(s), y70:isFile(s)});
      } finally { if(G) G.busy = false; }
    }
    function check(){ if(!need().length){ off(); g.waits.delete(abort); hn.stop(); resolve(); } }
  });
  cue('');
}
async function doBreak(s, ev, list, paint){
  var r = G.round;
  var lnEl = list.querySelector('[data-stmt="' + s.id + '"]');
  r.broken.push(s.id);
  if(!r.souvenir) r.souvenir = {statement:s.id, evidence:ev};
  save();
  if(lnEl){
    lnEl.insertAdjacentHTML('beforeend', crackSvg());
    var path = lnEl.querySelector('.cc-crack path');
    sfx('crack');
    if(!RM() && path){ path.style.strokeDasharray = '100'; await run(path, [{strokeDashoffset:100}, {strokeDashoffset:0}], {duration:300}); }
    lnEl.classList.add('cc-broken');
    await stampOn(lnEl, stampText('contradiction'));
  }
  clearFx();
  var lines = ((C().thenLines || {})[s.then] || []).filter(cond), pin = thenPin(s);
  for(var i = 0; i < lines.length; i++){
    var l = lines[i], own = l.who === s.by || l.who === s.who;
    await sayLine(l, {who:own ? s.by : l.who, voice:l.who, expr:own ? (exprOf(l.face) || 'rattled') : exprOf(l.face)});
    if(l === pin){ paint(); var nl = list.querySelector('[data-stmt="' + l.id + '"]'); if(nl){ scrollInto(nl); if(!RM()) run(nl, [{opacity:0, transform:'translateY(-6px)'}, {opacity:1, transform:'none'}], {duration:300}); } }
  }
  paint();
}
async function doConfirm(s, ev, list, paint){
  var r = G.round;
  var lnEl = list && list.querySelector('[data-stmt="' + s.id + '"]');
  r.confirmed.push(s.id); save();
  if(lnEl){ lnEl.classList.add('cc-checked'); await stampOn(lnEl, stampText('checked'), 'ok'); }
  clearFx();
  var who = s.by;
  if(paint) paint();
  // the re-evaluation lines play once the suspect is fully cleared (C1 Jack: after his second confirmation)
  if(!isCleared(who)) return;
  var re = reLines(who);
  for(var i = 0; i < re.length; i++) await sayLine(re[i], {who:re[i].who, expr:exprOf(re[i].face)});
}
function reLines(who){
  return (C().reevaluation || []).filter(function(l){ return cond(l) && l.who !== 'card' && l.id !== 're.cleared' && (!who || !l.about || l.about === who); });
}
async function stepReevaluation(){
  var r = G.round;
  if(confirmables().some(function(s){ return r.confirmed.indexOf(s.id) < 0; })) await dropStep('confirm');
  // the board: broken lines with their new versions, cleared suspects flip face down and slide to the bottom row
  var p = page();
  var b = el('div', 'cc-board');
  var sus = suspects();
  b.innerHTML = '<div class="cc-grid">' + sus.map(function(w){ return polHtml(w, {said:true}).replace(' cc-cleared', ''); }).join('') + '</div>';
  p.appendChild(b);
  clearDock();
  await wait(500);
  var grid = b.firstChild;
  for(var i = 0; i < sus.length; i++){
    if(!isCleared(sus[i])) continue;
    var pin = grid.querySelector('[data-pin="' + sus[i] + '"]'), pol = pin.querySelector('.cc-polaroid');
    sfx('flip');
    await run(pol, [{transform:'rotateY(0)'}, {transform:'rotateY(90deg)'}], {duration:225, easing:'ease-in'});
    pin.classList.add('cc-cleared');
    await run(pol, [{transform:'rotateY(90deg)'}, {transform:'rotateY(0)'}], {duration:225, easing:'ease-out'});
  }
  // FLIP reshuffle: still suspects to the top, cleared to the bottom
  var pins = Array.prototype.slice.call(grid.children), first = pins.map(function(n){ return rect(n); });
  pins.filter(function(n){ return n.classList.contains('cc-cleared'); }).forEach(function(n){ grid.appendChild(n); });
  if(!RM()) pins.forEach(function(n, i){ var a = first[i], z = rect(n); var dx = a.left - z.left, dy = a.top - z.top; if(dx || dy) run(n, [{transform:'translate(' + dx + 'px,' + dy + 'px)'}, {transform:'none'}], {duration:500, easing:'ease-in-out'}); });
  sfx('tick');
  if(!confirmables().length){ var ml = reLines(null); for(var k = 0; k < ml.length; k++) await sayLine(ml[k], {who:ml[k].who}); }
  await wait(900);
  var a = actions(p, '<button type="button" class="cc-btn cc-primary cc-go">' + esc(U('next')) + '</button>');
  G.status = {kind:'button', step:'reevaluation', sel:'.cc-go'};
  await untilClick(a, '.cc-go');
}

/* ============================== 7 · CONNECTION: red thread ============================== */
function pinCenter(board, pin){ var b = rect(board), r = rect(pin.querySelector('.cc-polaroid, .cc-ev') || pin); return {x:r.left - b.left + board.scrollLeft + r.width / 2, y:r.top - b.top + board.scrollTop + 6}; }
function redrawThreads(){
  var t = G && G.thread; if(!t || !t.board.isConnected) return;
  var b = t.board, svgEl = t.svg;
  svgEl.setAttribute('width', b.scrollWidth); svgEl.setAttribute('height', b.scrollHeight);
  svgEl.style.width = b.scrollWidth + 'px'; svgEl.style.height = b.scrollHeight + 'px';
  svgEl.querySelectorAll('.cc-made').forEach(function(n){ n.remove(); });
  G.round.links.forEach(function(k){
    var pa = b.querySelector('[data-pin="' + k[0] + '"]'), pb = b.querySelector('[data-pin="' + k[1] + '"]'); if(!pa || !pb) return;
    var A = pinCenter(b, pa), B = pinCenter(b, pb);
    svgEl.insertAdjacentHTML('beforeend', '<g class="cc-made"><line class="cc-thread" x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '"/><circle class="cc-tagdot" cx="' + ((A.x + B.x) / 2) + '" cy="' + ((A.y + B.y) / 2) + '" r="5"/></g>');
  });
}
async function stepConnection(){
  var r = G.round, links = C().links || [];
  var key = function(a, b){ return [a, b].sort().join('|'); };
  var made = function(l){ return r.links.some(function(k){ return key(k[0], k[1]) === key(l.a, l.b); }); };
  var need = function(){ return links.filter(function(l){ return !made(l); }); };
  if(!need().length) return;
  var p = page();
  var b = el('div', 'cc-board cc-threadmode');
  b.innerHTML = '<div class="cc-grid">' + boardPins({evidence:true}) + '</div><svg class="cc-threads"></svg><div class="cc-tags"></div>';
  p.appendChild(b);
  var svgEl = b.querySelector('.cc-threads'), tags = b.querySelector('.cc-tags');
  G.thread = {board:b, svg:svgEl};
  function tagHtml(l){ return '<div class="cc-tagline" lang="' + G.lang + '">' + esc(T(l.tag)) + (GL(l.tag) ? '<span class="cc-gl" dir="' + uiDir() + '">' + esc(GL(l.tag)) + '</span>' : '') + '</div>'; }
  links.filter(made).forEach(function(l){ tags.insertAdjacentHTML('beforeend', tagHtml(l)); });
  requestAnimationFrame(redrawThreads);
  cue(RM() ? U('threadRM') : U('thread'));
  clearDock();
  var guide = null, selPin = null;
  var hn = hints({
    h15:function(){ var l = need()[0]; if(!l) return; if(l.h15) sayLine(l.h15).catch(function(){}); shim(b.querySelector('[data-pin="' + l.a + '"]')); },
    h45:function(){ var l = need()[0]; if(!l) return; guide = l; var pa = b.querySelector('[data-pin="' + l.a + '"]'), pb = b.querySelector('[data-pin="' + l.b + '"]'); if(pa && pb){ scrollInto(pa); arrowBetween(pa, pb); shim(pa); } }
  });
  hn.start();
  G.status = {kind:'thread', step:'connection', board:'.cc-board', pairs:function(){ return need().map(function(l){ return [l.a, l.b]; }); }};
  await new Promise(function(resolve, reject){
    var g = G, abort = function(){ reject(ABORT); }; g.waits.add(abort);
    var busy = false;
    async function tryLink(a, c){
      if(!a || !c || a === c || busy) return;
      var l = need().filter(function(x){ return key(x.a, x.b) === key(a, c); })[0];
      if(!l){
        hn.wrong(); sfx('flutter');
        var pa = b.querySelector('[data-pin="' + a + '"]'), pc = b.querySelector('[data-pin="' + c + '"]');
        if(pa && pc && !RM()){
          var A = pinCenter(b, pa), B = pinCenter(b, pc);
          svgEl.insertAdjacentHTML('beforeend', '<path class="cc-thread cc-slack cc-fall" d="M' + A.x + ' ' + A.y + ' Q ' + ((A.x + B.x) / 2) + ' ' + (Math.max(A.y, B.y) + 60) + ' ' + B.x + ' ' + B.y + '"/>');
          var f = svgEl.querySelector('.cc-fall:last-child');
          run(f, [{opacity:1, transform:'translateY(0)'}, {opacity:0, transform:'translateY(40px)'}], {duration:400}).then(function(){ f.remove(); });
        }
        return;
      }
      busy = true; hn.stop(); guide = null; clearFx();
      r.links.push([l.a, l.b]); save();
      // CC11: each required link plucks two semitones higher than the last; the last one also flashes the folder
      redrawThreads(); sfx('pluck', {rate:Math.pow(2, 2 * (r.links.length - 1) / 12), n:r.links.length}); buzz([8]);
      if(!need().length){ folderGlow(); }
      var last = svgEl.querySelector('.cc-made:last-child line');
      if(last && !RM()){ last.style.strokeDasharray = '600'; run(last, [{strokeDashoffset:600}, {strokeDashoffset:0}], {duration:260}); }
      tags.insertAdjacentHTML('beforeend', tagHtml(l));
      var tg = tags.lastChild; if(!RM()) run(tg, [{transform:'rotate(-6deg)', opacity:0}, {transform:'rotate(3deg)', opacity:1, offset:.6}, {transform:'none', opacity:1}], {duration:400});
      scrollInto(tg);
      try{ await sayLine(l.tag); }catch(e){ return reject(e); }
      busy = false;
      if(!need().length){ g.waits.delete(abort); resolve(); } else hn.reset();
    }
    function pinAt(x, y){ var hit = null; b.querySelectorAll('.cc-pin').forEach(function(pn){ var q = rect(pn.querySelector('.cc-polaroid, .cc-ev') || pn); if(x >= q.left - 10 && x <= q.right + 10 && y >= q.top - 10 && y <= q.bottom + 10) hit = pn; }); return hit; }
    function setSel(pn){ if(selPin) selPin.classList.remove('cc-pinsel'); selPin = pn; if(pn) pn.classList.add('cc-pinsel'); }
    b.addEventListener('pointerdown', function(e){
      var pn = e.target.closest('.cc-pin'); if(!pn || busy) return;
      e.preventDefault();
      var pid = e.pointerId, sx = e.clientX, sy = e.clientY, moved = false, liveLine = null, over = null;
      var A = pinCenter(b, pn);
      function mv(ev){
        if(ev.pointerId !== pid) return;
        if(!moved && (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy)) > 8 && !RM()){ moved = true; setSel(null); svgEl.insertAdjacentHTML('beforeend', '<line class="cc-thread cc-live" x1="' + A.x + '" y1="' + A.y + '" x2="' + A.x + '" y2="' + A.y + '"/>'); liveLine = svgEl.querySelector('.cc-live'); sfx('tick'); }
        if(!moved) return;
        var br = rect(b); liveLine.setAttribute('x2', ev.clientX - br.left + b.scrollLeft); liveLine.setAttribute('y2', ev.clientY - br.top + b.scrollTop);
        var o2 = pinAt(ev.clientX, ev.clientY); if(o2 === pn) o2 = null;
        if(o2 !== over){ if(over) over.classList.remove('cc-pinsel'); over = o2; if(over) over.classList.add('cc-pinsel'); }
      }
      function up(ev){
        if(ev.pointerId !== pid) return;
        W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up);
        if(liveLine) liveLine.remove();
        if(over) over.classList.remove('cc-pinsel');
        if(moved){ if(over) tryLink(pn.dataset.pin, over.dataset.pin); return; }
        // tap: guided link, or tap-then-tap
        if(guide && (pn.dataset.pin === guide.a || pn.dataset.pin === guide.b)){ setSel(null); tryLink(guide.a, guide.b); return; }
        if(selPin && selPin !== pn){ var a0 = selPin.dataset.pin; setSel(null); tryLink(a0, pn.dataset.pin); return; }
        setSel(selPin === pn ? null : pn); sfx('tick');
      }
      W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
    });
  });
  cue('');
  G.thread = null;
  await wait(700);
}

/* ============================== 8 · DEDUCTION (Golden Idol ladder GDD 6.3; CC7 clauses lock one by one at B1+) ============================== */
// content.deduction is {text, gaps} (one clause, A1-A2) or {clauses:[{text, gaps, set}]} (B1 2+2, B2 2+3, C1 3+3). Gaps are numbered across
// the clauses (G.gaps, data-g); each clause has its own Check and its own ladder; a correct clause "sets": its words retype in Courier Prime
// and cannot change again, and Moss says the clause's `set` line. Chips carry a gloss ({en,tr,fa}); form:true gaps test the verb form.
function dedPrep(){
  var D8 = C().deduction || {}, cl = D8.clauses && D8.clauses.length ? D8.clauses : [{text:D8.text, gaps:D8.gaps || []}];
  G.clauses = cl; G.gaps = []; G.gapClause = [];
  cl.forEach(function(c, ci){ (c.gaps || []).forEach(function(gp){ G.gaps.push(gp); G.gapClause.push(ci); }); });
}
// a chip's words: content shapes are {text:"…"} per language, or {text:{en,es}}, or (A1 ES) {text:"key 3", es:"la llave 3"}
function chipT(c){ if(!c) return ''; if(typeof c[G.lang] === 'string') return c[G.lang]; return T(c.text) || ''; }
function chipGloss(c){
  var g = c && c.gloss; if(!g) return '';
  var t = typeof g === 'string' ? g : (g[G.ui] || (G.ui === G.lang ? '' : g.en) || '');
  return t && String(t).toLowerCase() !== String(chipT(c)).toLowerCase() ? t : '';
}
function clauseGaps(ci){ var o = []; G.gapClause.forEach(function(c, gi){ if(c === ci) o.push(gi); }); return o; }
async function stepDeduction(){
  var r = G.round, D8 = C().deduction || {}, gaps = G.gaps, clauses = G.clauses, lad = D8.ladder || {};
  if(!r.dedSet) r.dedSet = [];
  var pick = r.deduction || {}; r.deduction = pick;
  var multi = clauses.length > 1;
  var p = page();
  var box = el('div', 'cc-ded' + (multi ? ' cc-multi' : ''));
  function chipText(gi, id){ var c = gaps[gi].pool.filter(function(x){ return x.id === id; })[0]; return c ? (chipT(c)) : ''; }
  function setText(ci){ var parts = T(clauses[ci].text).split(/\[[^\]]*\]/), ids = clauseGaps(ci), out = ''; parts.forEach(function(t, i){ out += t; if(i < ids.length) out += chipText(ids[i], gaps[ids[i]].answer); }); return out; }
  function setHtml(ci){
    var parts = T(clauses[ci].text).split(/\[[^\]]*\]/), ids = clauseGaps(ci), out = '';
    parts.forEach(function(t, i){ out += esc(t); if(i < ids.length) out += '<span class="cc-setw" data-t="' + gt(gaps[ids[i]].type) + '">' + esc(chipText(ids[i], gaps[ids[i]].answer)) + '</span>'; });
    return out;
  }
  function clauseHtml(ci){
    var c = clauses[ci], ids = clauseGaps(ci), done = r.dedSet.indexOf(ci) >= 0;
    var parts = T(c.text).split(/\[[^\]]*\]/);
    var sent = '<div class="cc-sentence" lang="' + G.lang + '" dir="ltr">';
    if(done) sent += setHtml(ci);
    else parts.forEach(function(t, i){ sent += esc(t); if(i < ids.length){ var gp = gaps[ids[i]]; sent += '<button type="button" class="cc-gap' + (gp.form ? ' cc-form' : '') + '" data-g="' + ids[i] + '" data-t="' + gt(gp.type) + '">&nbsp;</button>'; } });
    sent += '</div>';
    var pools = done ? '' : '<div class="cc-pools">' + ids.map(function(gi){
      var gp = gaps[gi];
      return '<div class="cc-pool" data-g="' + gi + '"><i style="--gc:var(--cc-' + (gt(gp.type) === 'how' ? 'what' : gt(gp.type)) + ')"></i>' + shuffle(gp.pool).map(function(ch){
        var gl = chipGloss(ch);
        return '<button type="button" class="cc-chip' + (gp.form ? ' cc-formchip' : '') + '" data-g="' + gi + '" data-c="' + esc(ch.id) + '" data-t="' + gt(gp.type) + '" lang="' + G.lang + '"' + (r.words.indexOf(gi + ':' + ch.id) >= 0 ? ' data-mine="1"' : '') + '>' +
          '<span class="cc-ct">' + esc(chipT(ch)) + '</span>' + (gl ? '<small class="cc-cg" dir="' + uiDir() + '">' + esc(gl) + '</small>' : '') + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
    return '<section class="cc-clause' + (done ? ' cc-set' : '') + '" data-ci="' + ci + '">' + (multi ? '<span class="cc-clausen" aria-hidden="true">' + (ci + 1) + '</span>' : '') + sent + '<div class="cc-ribbonslot"></div>' + pools +
      (done ? '' : '<div class="cc-clauseact"><button type="button" class="cc-btn cc-primary cc-check" data-ci="' + ci + '" disabled>' + esc(U('check')) + '</button></div>') + '</section>';
  }
  box.innerHTML = clauses.map(function(c, ci){ return clauseHtml(ci); }).join('');
  p.appendChild(box);
  var acts = actions(p, '');
  cue(U('ded'));
  clearDock();
  function paint(){
    gaps.forEach(function(gp, gi){
      var gEl = box.querySelector('.cc-gap[data-g="' + gi + '"]'); if(!gEl) return;
      gEl.textContent = pick[gi] ? chipText(gi, pick[gi]) : ' ';
      gEl.classList.toggle('cc-filled', !!pick[gi]);
      box.querySelectorAll('.cc-chip[data-g="' + gi + '"]').forEach(function(c){ c.classList.toggle('cc-used', pick[gi] === c.dataset.c); });
    });
    box.querySelectorAll('.cc-check').forEach(function(b){ var ci = +b.dataset.ci; b.disabled = clauseGaps(ci).some(function(gi){ return !pick[gi]; }); });
  }
  paint();
  var rung = clauses.map(function(){ return 0; });
  var sel = function(gi, id){ return '.cc-chip[data-g="' + gi + '"][data-c="' + id + '"]'; };
  G.status = {kind:'ded', step:'deduction', clauses:clauses.length, set:function(){ return r.dedSet.slice(); },
    check:function(ci){ return '.cc-check[data-ci="' + (ci || 0) + '"]'; },
    answers:function(ci){ return gaps.map(function(gp, gi){ return gi; }).filter(function(gi){ return ci == null || G.gapClause[gi] === ci; }).map(function(gi){ return sel(gi, gaps[gi].answer); }); },
    wrong:function(ci){ return gaps.map(function(gp, gi){ return gi; }).filter(function(gi){ return ci == null || G.gapClause[gi] === ci; }).map(function(gi){ var w = gaps[gi].pool.filter(function(c){ return c.id !== gaps[gi].answer; })[0]; return sel(gi, w.id); }); }};
  async function setClause(ci){
    var sec = box.querySelector('.cc-clause[data-ci="' + ci + '"]'), ids = clauseGaps(ci);
    for(var i = 0; i < ids.length; i++){ var gEl = sec.querySelector('.cc-gap[data-g="' + ids[i] + '"]'); if(gEl) gEl.classList.add('cc-solid'); sfx('pop'); await wait(80); }
    r.dedSet.push(ci); save();
    var pools = sec.querySelector('.cc-pools'), act = sec.querySelector('.cc-clauseact'), rib = sec.querySelector('.cc-ribbonslot');
    if(rib) rib.innerHTML = '';
    if(multi){
      // the clause "sets": the pencil words retype in Courier Prime (30 ms a character, bell at the end), then it cannot change again
      if(pools && !RM()) await run(pools, [{opacity:1, transform:'none'}, {opacity:0, transform:'translateY(6px)'}], {duration:200});
      if(pools) pools.remove(); if(act) act.remove();
      sec.classList.add('cc-set');
      var se = sec.querySelector('.cc-sentence');
      se.textContent = '';
      await typeInto(se, setText(ci), 30);
      se.innerHTML = setHtml(ci);
      sfx('softstamp');
      var c = clauses[ci];
      if(c.set && cond(c.set) && r.dedSet.length < clauses.length) await sayLine(c.set, {who:c.set.who || 'moss'});
      var nx = box.querySelector('.cc-clause:not(.cc-set)'); if(nx) scrollInto(nx);
    } else {
      if(pools) pools.querySelectorAll('.cc-chip').forEach(function(ch){ ch.disabled = true; });
      if(act) act.remove();
      sec.classList.add('cc-set');
    }
  }
  await new Promise(function(resolve, reject){
    var g = G, abort = function(){ reject(ABORT); }; g.waits.add(abort);
    var busy = false;
    async function finale(){
      sfx('combo');
      cue('');
      // the full sentence is read aloud (A1 has no authored solved line: read the filled-in clauses)
      if(D8.solved) await sayLine(D8.solved, {who:'narr'});
      else await sayLine({who:'narr'}, {who:'narr', text:clauses.map(function(c, ci){ return setText(ci); }).join(' '), gloss:''});
      // CC9: the accusation in the learner's own voice, then the stamp
      var sl = lx('ui.sayIt', 'sayIt');
      await sayLine(sl, {who:'moss'});
      var lab = function(k){ var o = lx('ui.' + k); return o && G.ui !== G.lang && o[G.ui] ? o[G.ui] : (o && G.ui === G.lang ? T(o) : U(k)); };
      acts.innerHTML = '<button type="button" class="cc-btn cc-said">' + esc(lab('skip')) + '</button><button type="button" class="cc-btn cc-primary cc-said">' + esc(lab('saidIt')) + '</button>';
      G.status = {kind:'button', step:'deduction', sel:'.cc-said.cc-primary'};
      await untilClick(acts, '.cc-said');
      acts.innerHTML = '';
      var stp = await stampOn(G.page, stampText('closed'), null, true);
      stp.style.left = '50%'; stp.style.top = '34%'; stp.style.transform = 'translate(-50%,-50%) rotate(-12deg)';
      sfx('reveal');
      await wait(1200);
    }
    if(r.dedSet.length >= clauses.length){ busy = true; finale().then(function(){ g.waits.delete(abort); resolve(); }, reject); return; }
    box.addEventListener('click', async function(e){
      if(busy) return;
      var ch = e.target.closest('.cc-chip');
      if(ch){
        if(ch.disabled || ch.classList.contains('cc-out')) return;
        var i = +ch.dataset.g; if(r.dedSet.indexOf(G.gapClause[i]) >= 0) return;
        if(pick[i] === ch.dataset.c){ delete pick[i]; } else { pick[i] = ch.dataset.c; flyChip(ch, box.querySelector('.cc-gap[data-g="' + i + '"]')); speak(ch.querySelector('.cc-ct').textContent, {who:'ui'}); }
        sfx('tick'); save(); paint(); return;
      }
      var gp = e.target.closest('.cc-gap');
      if(gp && pick[+gp.dataset.g] != null){ delete pick[+gp.dataset.g]; gp.classList.remove('cc-mark'); sfx('tick'); save(); paint(); return; }
      var cb = e.target.closest('.cc-check'); if(!cb || cb.disabled) return;
      var ci = +cb.dataset.ci, ids = clauseGaps(ci), sec = box.querySelector('.cc-clause[data-ci="' + ci + '"]');
      busy = true;
      try{
        var wrong = ids.filter(function(gi){ return pick[gi] !== gaps[gi].answer; });
        sec.querySelectorAll('.cc-gap').forEach(function(x){ x.classList.remove('cc-mark'); });
        if(!wrong.length){
          await setClause(ci);
          if(r.dedSet.length >= clauses.length){ await finale(); g.waits.delete(abort); resolve(); return; }
          busy = false; return;
        }
        rung[ci]++;
        var slot = sec.querySelector('.cc-ribbonslot');
        if(rung[ci] === 1){
          // a clause of 2-3 gaps only says "Not yet." (a count would give the answer away)
          var msg = ids.length >= 4 ? (wrong.length <= 2 ? U('closeOne') : U('someWrong')) : (lad.notYet && G.ui === G.lang ? T(lad.notYet) : U('notYet'));
          slot.innerHTML = '<div class="cc-ribbon" dir="' + uiDir() + '">' + esc(msg) + '</div>';
          sfx('tick');
          if(!RM()) run(slot.firstChild, [{transform:'scale(.9)', opacity:0}, {transform:'none', opacity:1}], {duration:240, easing:SPRING});
        } else if(rung[ci] === 2){
          // Moss points at the evidence behind one wrong gap, never at the gap
          var ev = gaps[wrong[0]].ev, nudge = lad.nudge && lad.nudge[ev];
          slot.innerHTML = '';
          if(nudge) await sayLine(nudge, {who:nudge.who || 'moss'});
          G.bagShim = ev; shim(G.bagBtn);
        } else if(rung[ci] === 3){
          wrong.forEach(function(gi){
            var gp2 = gaps[gi], keep = [gp2.answer, (gp2.strong || gp2.pool.filter(function(c){ return c.id !== gp2.answer; })[0].id)];
            box.querySelectorAll('.cc-chip[data-g="' + gi + '"]').forEach(function(c){ if(keep.indexOf(c.dataset.c) < 0){ c.classList.add('cc-out'); if(pick[gi] === c.dataset.c) delete pick[gi]; } });
          });
          save(); paint();
          sfx('flip');
        } else {
          wrong.forEach(function(gi){ box.querySelector('.cc-gap[data-g="' + gi + '"]').classList.add('cc-mark'); });
          sfx('tick');
        }
      }catch(err){ if(err === ABORT) return reject(err); console.error('[case-closed] deduction', err); }
      busy = false;
    });
  });
  cue('');
}
function flyChip(chip, gap){
  if(RM()) return;
  var a = rect(chip), b = rect(gap), f = rect(G.root);
  var c = chip.cloneNode(true); c.style.cssText = 'position:absolute;z-index:60;margin:0;left:' + (a.left - f.left) + 'px;top:' + (a.top - f.top) + 'px;width:' + a.width + 'px;pointer-events:none';
  G.root.appendChild(c);
  var an = c.animate([{transform:'none'}, {transform:'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(.92)', opacity:.4}], {duration:260, easing:EASE});
  an.onfinish = function(){ c.remove(); };
}

/* ============================== 9 · TRUTH ============================== */
async function stepTruth(){
  var r = G.round, panels = C().truth || [];
  clearDock(); G.dock.classList.add('cc-hidden');
  for(var i = r.panel || 0; i < panels.length; i++){
    var P9 = panels[i];
    var p = page();
    var t = el('div', 'cc-truth'); p.appendChild(t);
    var fr = frameIn(t);
    var ps = (G.S.truth || {})[P9.panel] || {};
    fr.innerHTML = '<div class="cc-plate">' + plateHtml(ps.plate || ('panel-' + P9.panel)) + '</div>' + (P9.caption ? '<div class="cc-panelcap" lang="' + G.lang + '">' + esc(T(P9.caption)) + '</div>' : '');
    var bals = el('div', 'cc-balloons'); t.appendChild(bals);
    if(!RM()){ sfx('flip'); run(fr, [{transform:'translateX(12%)', opacity:0}, {transform:'none', opacity:1}], {duration:420, easing:EASE}); }
    if(P9.caption) speak(T(P9.caption), {who:'narr'});
    G.status = {kind:'truth', step:'truth', panel:i, skip:'.cc-truth'};
    var plines = (P9.lines || []).filter(cond);
    for(var k = 0; k < plines.length; k++){
      var l = plines[k], narr = l.who === 'narr';
      var bl = el('div', 'cc-bal' + (narr ? ' cc-narr' : ''), (narr ? '' : '<span class="cc-n">' + esc(castShort(l.who)) + '</span>') + '<span lang="' + G.lang + '" dir="ltr">' + esc(T(l)) + '</span>' +
        (GL(l) ? '<span class="cc-gl" dir="' + uiDir() + '"' + (G.band === 'A1' ? '' : ' hidden') + '>' + esc(GL(l)) + '</span>' : ''));
      bals.appendChild(bl);
      if(!RM()) run(bl, [{transform:'translateY(8px) scale(.96)', opacity:0}, {transform:'none', opacity:1}], {duration:240, easing:SPRING});
      bl.addEventListener('click', function(e){ e.stopPropagation(); var gl = this.querySelector('.cc-gl'); if(gl) gl.hidden = !gl.hidden; });
      await Promise.race([speak(T(l), {who:l.who}), untilClick(t).catch(function(){})]);
      stopSpeech(); live();
      await wait(300);
    }
    if(i === panels.length - 1 && Object.keys(townKeys()).length){
      // CC10: one pencil line on the last panel; the change lasts (no list or count of cases anywhere)
      var tn = el('div', 'cc-townnote', '<span dir="' + uiDir() + '">' + esc(U('town').replace('{place}', placeName())) + '</span>');
      bals.appendChild(tn); scrollInto(tn); sfx('softstamp');
      if(!RM()) run(tn, [{transform:'rotate(-3deg) scale(.8)', opacity:0}, {transform:'rotate(-3deg)', opacity:1}], {duration:360, easing:SPRING});
      await wait(900);
    }
    r.panel = i + 1; save();
    if(i < panels.length - 1){
      var a = actions(t, '<button type="button" class="cc-btn cc-truthnext" aria-label="' + esc(U('next')) + '">' + esc(U('next')) + ' ›</button>');
      G.status = {kind:'button', step:'truth', sel:'.cc-truthnext'};
      await untilClick(a, '.cc-truthnext');
    }
  }
  // CASE CLOSED comes down on the folder
  await wait(400);
  sfx('reveal');
  if(!RM()) run(G.page, [{filter:'brightness(1.25)'}, {filter:'none'}], {duration:500});
  await wait(1400);
  G.dock.classList.remove('cc-hidden');
}

/* ============================== souvenir + the record ============================== */
async function souvenir(){
  // the planned souvenir (content.souvenir) wins; the first break the learner made is only the fallback (gamification review, 2026-10-29)
  var r = G.round, sv = C().souvenir || {}, planned = sv.statement && stmt(sv.statement);
  var sid = planned ? sv.statement : (r.souvenir && r.souvenir.statement), evid = planned ? sv.evidence : (r.souvenir && r.souvenir.evidence);
  var s = stmt(sid) || {}, d = evDef(evid) || {};
  r.souvenir = {statement:sid, evidence:evid};
  var back = sv.statement === sid && sv.back ? sv.back : null;
  var backText = back ? T(back) : (U('thisToldYou') + ' ' + T(d.fact)), backGl = back ? GL(back) : GL(d.fact);
  var o = el('div', 'cc-souv');
  o.innerHTML = '<div class="cc-souv-card"><div class="cc-souv-face cc-souv-front"><small lang="' + G.lang + '">' + esc(castShort(s.by)) + (isFile(s) ? ' · ' + esc(stampText('file')) : '') + '</small><p lang="' + G.lang + '" dir="ltr">“' + esc(T(s)) + '”</p>' +
    (GL(s) ? '<p class="cc-gl" dir="' + uiDir() + '">' + esc(GL(s)) + '</p>' : '') + '<div class="cc-stamp" lang="' + G.lang + '">' + esc(stampText('contradiction')) + '</div>' +
    '<button type="button" class="cc-souv-say" aria-label="' + esc(U('hear')) + '">' + SPEAKER_SVG + '</button></div>' +
    '<div class="cc-souv-face cc-souv-back">' + evCardHtml(evid) + '<p lang="' + G.lang + '" dir="ltr">' + esc(backText) + '</p>' + (backGl ? '<p class="cc-gl" dir="' + uiDir() + '">' + esc(backGl) + '</p>' : '') +
    '<p class="cc-gl" dir="' + uiDir() + '">' + esc(U('kept')) + '</p></div></div><p class="cc-souv-hint" dir="' + uiDir() + '">' + esc(U('flip')) + '</p>' +
    '<div class="cc-actions"><button type="button" class="cc-btn cc-primary cc-finish">' + esc(U('finish')) + '</button></div>';
  G.root.appendChild(o);
  var card = o.querySelector('.cc-souv-card');
  sfx('reveal');
  if(!RM()) run(card, [{transform:'translateY(40px) scale(.85) rotate(-4deg)', opacity:0}, {transform:'none', opacity:1}], {duration:520, easing:SPRING});
  card.addEventListener('click', function(e){
    if(e.target.closest('.cc-souv-say')){ e.stopPropagation(); speak(T(s), {who:voiceOf(s)}); return; }
    card.classList.toggle('cc-flipped'); sfx('flip');
  });
  try{ if(G.host.keep) G.host.keep({kind:'mystery', episode:G.S.id, text:T(s), say:T(s), note:backText}); }catch(e){}
  G.status = {kind:'done', finish:'.cc-finish'};
  await untilClick(o, '.cc-finish');
}

/* ============================== leave (x / Escape) ============================== */
function confirmLeave(){
  if(!G || G.leaving || G.modal.classList.contains('cc-open')) return;
  save();
  G.modal.innerHTML = '<div class="cc-modal-card" role="alertdialog" aria-modal="true" dir="' + uiDir() + '"><p>' + esc(U('leaveQ')) + '</p><div class="cc-actions"><button type="button" class="cc-btn cc-stay">' + esc(U('stay')) + '</button><button type="button" class="cc-btn cc-primary cc-leave">' + esc(U('leave')) + '</button></div></div>';
  G.modal.classList.add('cc-open');
  G.prevStatus = G.status; G.status = {kind:'confirm', stay:'.cc-stay', leave:'.cc-leave'};
  G.modal.querySelector('.cc-stay').addEventListener('click', function(){ G.modal.classList.remove('cc-open'); G.status = G.prevStatus; });
  G.modal.querySelector('.cc-leave').addEventListener('click', leaveNow);
  try{ G.modal.querySelector('.cc-stay').focus({preventScroll:true}); }catch(e){}
}
function leaveNow(){
  var g = G; if(!g) return;
  g.leaving = true; save();
  var cb = g.onLeave;
  destroy();
  if(cb) cb(); else if(W.Theatre && W.Theatre.isOpen && W.Theatre.isOpen()) W.Theatre.exit();
}
function guardExit(g){
  var onClick = function(e){
    if(!G || G !== g || g.leaving) return;
    var x = e.target && e.target.closest && e.target.closest('.th-x'); if(!x) return;
    e.preventDefault(); e.stopImmediatePropagation(); confirmLeave();
  };
  var onKey = function(e){
    if(!G || G !== g || g.leaving || e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    var ov = g.root.querySelector('.cc-archive');
    if(g.modal.classList.contains('cc-open')){ g.modal.classList.remove('cc-open'); g.status = g.prevStatus; }
    else if(ov) ov.remove();
    else if(g.sheet.classList.contains('cc-open')) g.sheet.classList.remove('cc-open');
    else confirmLeave();
  };
  D.addEventListener('click', onClick, true); W.addEventListener('keydown', onKey, true);
  return function(){ D.removeEventListener('click', onClick, true); W.removeEventListener('keydown', onKey, true); };
}

/* ============================== start / main / destroy ============================== */
var STEPS = [stepQuestion, stepHub, null, null, function(){ return dropStep('break'); }, stepReevaluation, stepConnection, stepDeduction, stepTruth];
function start(o){
  if(G) destroy();
  o = o || {};
  var data = o.data, S = data.stage, lang = o.lang === 'es' ? 'es' : 'en', host = o.host || {};
  var saved = o.resume ? hostLoadRound(host) : null;
  if(saved && (saved.episode !== S.id || saved.lang !== lang || saved.v !== 2)) saved = null;
  var g = G = {
    v:VERSION, data:data, S:S, C:data.content[lang], M:data.manifest || {items:{}}, lang:lang, ui:o.ui || lang, band:S.band || 'A2', host:host,
    appRoot:o.appRoot || '', name:o.name || '', pace:o.pace || 1, tts:o.tts, hintMs:o.hintMs || null, forceReduced:!!o.reduced,
    onDone:o.onDone, onLeave:o.onLeave, round:saved || newRound(S, lang), waits:new Set(), anims:new Set(), dead:false, status:{kind:'boot'},
    box:o.root || (W.Theatre && W.Theatre.stageEl && W.Theatre.stageEl()) || D.body, glossOn:false
  };
  if(!g.C) throw new Error('case-closed: no ' + lang + ' content for ' + S.id);
  dedPrep();
  g.house = houseMem();
  g.cases = loadCases(host);
  build(g.box);
  g.unguard = guardExit(g);
  g.mo = new MutationObserver(function(){ if(G === g && !g.box.isConnected) destroy(); });
  g.mo.observe(D.body, {childList:true});
  main(g);
  return api(g);
}
async function main(g){
  try{
    for(var i = g.round.step; i < SPINE.length; i++){
      if(i === 2 || i === 3) i = 1;   // the hub runs steps 2-4 together
      g.round.step = i; renderTabs(); save();
      if(i > 0) await folderFlip();
      await STEPS[i]();
      if(i === 1) i = 3;
      live();
      if(g.hint) g.hint.stop();
      g.round.step = i + 1; renderTabs(); save();
      sfx('correct');
    }
    var cases = loadCases(g.host); cases[g.S.id] = {date:new Date().toISOString().slice(0, 10)};
    // CC10 the town remembers: lasting keys other games read (progress.cases.town; Cozy Chores / Your Call plates swap their cut-outs)
    var tk = townKeys(); if(Object.keys(tk).length) cases.town = Object.assign({}, cases.town || {}, tk);
    saveCases(cases); g.cases = cases;
    await souvenir();
    live();
    var result = {episode:g.S.id, band:g.band, souvenir:g.round.souvenir, secret:g.round.secret};
    try{ if(g.host.saveRound) g.host.saveRound(null); else localStorage.removeItem(LS_ROUND); }catch(e){}
    g.finished = true;
    var cb = g.onDone;
    destroy({keepDom:true});
    if(cb) cb(result);
  }catch(e){ if(e !== ABORT) console.error('[case-closed]', e); }
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
  D.querySelectorAll('.cc-ghost').forEach(function(n){ n.remove(); });
  G = null;
  if(!(o && o.keepDom) && g.root && g.root.parentNode) g.root.remove();
}
function api(g){ return {destroy:function(){ if(G === g) destroy(); }, leave:function(){ if(G === g) confirmLeave(); }, get round(){ return g.round; }}; }

/* ============================== archive (poster drawer + shelf): solved folders, two-page spread ============================== */
function openArchive(o){
  // o: {root, lang, ui, host, episodes:{id:data}, onClose}
  o = o || {};
  var lang = o.lang === 'es' ? 'es' : 'en', ui = o.ui || lang, cases = loadCases(o.host || {});
  var prevG = G, fake = {lang:lang, ui:ui, band:'A2', S:{cast:{}}, C:{cast:{}}, M:{items:{}}, appRoot:o.appRoot || '', host:o.host || {}, pace:1};
  G = G || fake;
  var ov = el('div', 'cc-root');
  var inner = el('div', 'cc-archive');
  var ids = Object.keys(o.episodes || {}).filter(function(id){ return cases[id]; });
  inner.innerHTML = '<h2 dir="' + uiDir() + '">' + esc(U('archive')) + '</h2>' + (ids.length ? '<div class="cc-drawer">' + ids.map(function(id){
    var c = o.episodes[id].content[lang];
    return '<button type="button" class="cc-folder" data-ep="' + esc(id) + '" lang="' + lang + '">' + esc(T.call(null, c.title) || id) + '<br><span class="cc-stamp">' + esc(c.stamps ? (c.stamps.closed[lang] || c.stamps.closed.en) : STAMPS[lang].closed) + '</span></button>';
  }).join('') + '</div>' : '<p dir="' + uiDir() + '">' + esc(U('empty')) + '</p>') + '<div class="cc-actions"><button type="button" class="cc-btn cc-arch-x">' + esc(U('close')) + '</button></div>';
  ov.appendChild(inner); (o.root || D.body).appendChild(ov);
  G = prevG;
  inner.addEventListener('click', function(e){
    if(e.target.closest('.cc-arch-x')){ ov.remove(); if(o.onClose) o.onClose(); return; }
    var f = e.target.closest('.cc-folder'); if(!f) return;
    var dat = o.episodes[f.dataset.ep], c = dat.content[lang], sv = c.souvenir || {};
    var st = (c.statements || []).filter(function(s){ return s.id === sv.statement; })[0] || {};
    var ev = (c.evidence || []).filter(function(x){ return x.id === sv.evidence; })[0] || {};
    var q = (c.question || []).filter(function(l){ return l.who === 'moss'; }).map(function(l){ return l[lang]; }).join(' ');
    var sp = el('div', 'cc-spread', '<section><h3>' + esc(UI.question[ui] || UI.question.en) + '</h3><p lang="' + lang + '">' + esc(q) + '</p><h3>' + esc(UI.broken[ui] || UI.broken.en) + '</h3><p lang="' + lang + '"><s>' + esc(st[lang] || '') + '</s></p><p lang="' + lang + '">' + esc(ev.fact ? ev.fact[lang] : '') + '</p></section>' +
      '<section><h3>' + esc(UI.truthH[ui] || UI.truthH.en) + '</h3><p lang="' + lang + '">' + esc(c.deduction && c.deduction.solved ? c.deduction.solved[lang] : '') + '</p>' + (c.truth || []).map(function(pn){ return (pn.lines || []).map(function(l){ return '<p lang="' + lang + '">' + esc(l[lang]) + '</p>'; }).join(''); }).join('') + '</section>');
    var old = inner.querySelector('.cc-spread'); if(old) old.remove();
    inner.insertBefore(sp, inner.querySelector('.cc-actions'));
    sp.scrollIntoView({block:'start'});
  });
  return ov;
}

/* ============================== loading ============================== */
function getJSON(url){ return fetch(url, {cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
function load(o){
  o = o || {};
  var base = (o.appRoot || '') + 'games/case-closed/';
  var id = o.episode || EPISODES.A2;
  if(W.CASE_DATA && W.CASE_DATA[id]) return Promise.resolve(W.CASE_DATA[id]);
  return getJSON(base + 'episodes/' + id + '.json').then(function(stage){
    return Promise.all([getJSON(base + stage.content), getJSON(base + 'art/manifest.json').catch(function(){ return {items:{}}; })]).then(function(r){ return {stage:stage, content:r[0], manifest:r[1]}; });
  });
}

W.CaseClosed = {
  version:VERSION, EPISODES:EPISODES, SPINE:SPINE, UI:UI,
  load:load, start:start, openArchive:openArchive,
  episodeFor:function(level){ return EPISODES[level] || EPISODES[String(level || '').slice(0, 2).toUpperCase()] || EPISODES.A2; },
  savedRound:function(host, id){ var r = hostLoadRound(host || {}); return r && (!id || r.episode === id) ? r : null; },
  clearRound:function(host){ try{ if(host && host.saveRound) host.saveRound(null); else localStorage.removeItem(LS_ROUND); }catch(e){} },
  solved:function(host){ return loadCases(host || {}); },
  debug:{
    status:function(){ return G ? G.status : null; },
    game:function(){ return G; },
    hint:function(level){ if(G && G.hint) G.hint.force(level || 15); },
    skipLine:function(){ if(G && G.lineSkip){ var f = G.lineSkip; G.lineSkip = null; f(); } if(G && G.typeSkip) G.typeSkip(); }
  }
};
})();
