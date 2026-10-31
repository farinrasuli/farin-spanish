/* Mini Radio episode builder (spec Claude/specs/mini-radio-2026-10-21.md v2, section 2). Byte-identical in both apps.
   Pure data, no DOM: the roadmap needs radioOk() at build time, so the app pastes this block into its own file (wiring pass) and the
   lazy engine (radio.js) only plays the episode object it gets. The Node demo builder and the harness load this same file.

   RadioEpisode.fromStory(story, ctx)      -> episode | {fail: reason}
   RadioEpisode.fromAuthored(ep, ctx)      -> episode | {fail: reason}
   RadioEpisode.ok(story, ctx)             -> boolean (radioOk)
   ctx = {lang:'en'|'es', level, split: splitSentences, stories: [same-level free stories], storyPick: id of the page's story node,
          pool: [words of the level's non-slang VOCAB_SETS cards], gloss(word) -> meaning in the UI language, rand: () => [0,1)}
   episode = {id, kind:'story'|'authored', storyId, level, rate, title, lines:[{who,text}], parts:[[first,last],…],
              checkins:[{word, decoys:[2]}], titles:[3], answer, moments:[3 line idx], gloss:{word: meaning}} */
(function(root){
'use strict';
var BUDGET = {A1:50, A2:70, B1:90, B2:110, C1:130};
var LONG = {A1:16, A2:16, B1:22, B2:22, C1:22};
function wc(s){ return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function fold(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function base(word, lang){
  var w = String(word || '').split('/')[0].trim().toLowerCase();
  if(lang === 'es') w = w.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
  return w;
}
// the Story Hunt match rule (huntMatches): EN word + up to 3 letters (or the stem without a final e); ES the hunt stem rule
function matches(target, tok, lang){
  var t = fold(tok), w = fold(target);
  if(!t || !w) return false;
  if(lang === 'es'){ var b = w.replace(/(a|e|i)rse$/, '$1r'), n = Math.max(4, b.length - 3); return b.length >= 4 && t.slice(0, n) === b.slice(0, n); }
  if(t === w) return true;
  if(t.length > w.length && t.length - w.length <= 3 && t.slice(0, w.length) === w) return true;
  if(w.slice(-1) === 'e'){ var st = w.slice(0, -1); return t.length >= st.length && t.length - st.length <= 3 && t.slice(0, st.length) === st; }
  return false;
}
function toks(text){ return String(text || '').split(/\s+/).map(function(t){ return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); }).filter(Boolean); }
function heardIn(word, text, lang){ return toks(text).some(function(t){ return matches(word, t, lang); }); }
function okWord(w){ return /^\p{L}{3,12}$/u.test(w); }
function shuffle(a, rnd){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function uniq(a){ var s = {}; return a.filter(function(x){ var k = fold(x); if(s[k]) return false; s[k] = 1; return true; }); }

function cutLines(all, level){
  var budget = BUDGET[level] || 70, out = [], n = 0;
  for(var i = 0; i < all.length; i++){ out.push(all[i]); n += wc(all[i].text); if(n >= budget && out.length >= 4) break; }
  return out;
}
function cutParts(lines, level){
  var P = (level === 'A1' || level === 'A2') ? 2 : 3;
  if(lines.length < 6) P = 2;
  var cum = [0]; lines.forEach(function(l, i){ cum.push(cum[i] + wc(l.text)); });
  var total = cum[lines.length], parts = [], start = 0;
  for(var k = 1; k < P; k++){
    var target = total * k / P, best = -1, bd = 1e9;
    for(var b = start + 2; b <= lines.length - 2 * (P - k); b++){ var d = Math.abs(cum[b] - target); if(d < bd){ bd = d; best = b; } }
    if(best < 0) return null;
    parts.push([start, best - 1]); start = best;
  }
  parts.push([start, lines.length - 1]);
  return parts.every(function(p){ return p[1] - p[0] >= 1; }) ? parts : null;
}
function partText(lines, p){ return lines.slice(p[0], p[1] + 1).map(function(l){ return l.text; }).join(' '); }
function pickCheckins(lines, parts, pool, whole, lang, rnd, prefer, extra){
  var taken = [], out = [];
  for(var i = 0; i < parts.length; i++){
    var here = partText(lines, parts[i]);
    var cand = (prefer || []).filter(function(w){ return heardIn(w, here, lang) && taken.indexOf(w) < 0; });
    if(!cand.length){
      var heard = pool.filter(function(w){ return heardIn(w, here, lang) && taken.indexOf(w) < 0; });
      if(!heard.length) heard = (extra || []).filter(function(w){ return heardIn(w, here, lang) && taken.indexOf(w) < 0; });
      var alone = heard.filter(function(w){ return !parts.some(function(q, j){ return j !== i && heardIn(w, partText(lines, q), lang); }); });
      cand = shuffle(alone.length ? alone : heard, rnd);
    }
    if(!cand.length) return null;
    taken.push(cand[0]); out.push({word:cand[0], decoys:[]});
  }
  // decoys: never heard anywhere in the whole story; prefer a length within 2 letters of the part's word
  // decoys (spec 2, clarified 2026-10-29): the level's non-slang VOCAB_SETS words only, never heard anywhere in the story
  var free = shuffle(uniq(extra && extra.length ? extra : pool).filter(function(w){ return !heardIn(w, whole, lang) && taken.indexOf(w) < 0; }), rnd);
  var used = [];
  for(var c = 0; c < out.length; c++){
    var L = out[c].word.length;
    var near = free.filter(function(w){ return used.indexOf(w) < 0 && Math.abs(w.length - L) <= 2; });
    var any = free.filter(function(w){ return used.indexOf(w) < 0; });
    var two = near.concat(any.filter(function(w){ return near.indexOf(w) < 0; })).slice(0, 2);
    if(two.length < 2) return null;
    used = used.concat(two); out[c].decoys = two;
  }
  return out;
}
function pickMoments(lines, level){
  // first, middle, last line; a line over the length cap swaps for the nearest shorter line in the same third
  var n = lines.length, max = LONG[level] || 22, idx = [0, Math.floor(n / 2), n - 1];
  var thirds = [[0, Math.floor(n / 3)], [Math.floor(n / 3), Math.floor(2 * n / 3)], [Math.floor(2 * n / 3), n - 1]];
  var out = idx.map(function(i, k){
    if(wc(lines[i].text) <= max) return i;
    var best = i, bd = 1e9;
    for(var j = thirds[k][0]; j <= thirds[k][1]; j++){ if(wc(lines[j].text) <= max && Math.abs(j - i) < bd){ bd = Math.abs(j - i); best = j; } }
    return best;
  });
  return out.filter(function(v, i, a){ return a.indexOf(v) === i; }).length === 3 ? out : idx;
}
function titleOf(story, lang){ var t = story.title || {}; return lang === 'es' ? (t.es || t.en || '') : (t.en || ''); }
function poolOf(story, ctx){
  var v = (story.vocab || []).map(function(x){ return base(x.word, ctx.lang); }).filter(okWord);
  var src = v.length >= 3 ? v : (ctx.pool || []).map(function(w){ return base(w, ctx.lang); }).filter(okWord);
  return uniq(src);
}
function glossOf(words, story, ctx){
  var g = {};
  words.forEach(function(w){
    var hit = (story && story.vocab || []).filter(function(x){ return base(x.word, ctx.lang) === w; })[0];
    g[w] = (hit && ctx.ui && hit[ctx.ui]) || (ctx.gloss ? ctx.gloss(w) : '') || '';
  });
  return g;
}
function finish(o, ctx, lines, parts, checkins, titles, answer, moments, story){
  var words = checkins.map(function(c){ return c.word; });
  return {id:o.id, kind:o.kind, storyId:o.storyId || null, level:ctx.level, rate:(ctx.level === 'A1' || ctx.level === 'A2') ? 0.8 : 0.92, title:o.title,
    lines:lines, parts:parts, checkins:checkins, titles:titles, answer:answer, moments:moments, gloss:glossOf(words, story, ctx)};
}
function fromStory(story, ctx){
  var rnd = ctx.rand || Math.random;
  if(!story || !story.text) return {fail:'no text'};
  var all = [].concat.apply([], story.text.split('\n\n').map(ctx.split)).map(function(t){ return {who:'a', text:t}; });
  var lines = cutLines(all, ctx.level);
  if(lines.length < 4) return {fail:'lines < 4'};
  var parts = cutParts(lines, ctx.level); if(!parts) return {fail:'parts'};
  var level = uniq((ctx.pool || []).map(function(w){ return base(w, ctx.lang); }).filter(okWord));
  var checkins = pickCheckins(lines, parts, poolOf(story, ctx), story.text, ctx.lang, rnd, null, level);
  if(!checkins) return {fail:'a part without a check-in word, or decoys < 2P'};
  var others = (ctx.stories || []).filter(function(s){ return s.id !== story.id && s.id !== ctx.storyPick && titleOf(s, ctx.lang); });
  var diff = shuffle(others.filter(function(s){ return s.genre !== story.genre; }), rnd), same = shuffle(others.filter(function(s){ return s.genre === story.genre; }), rnd);
  var two = diff.concat(same).slice(0, 2).map(function(s){ return titleOf(s, ctx.lang); });
  if(two.length < 2) return {fail:'titles < 2'};
  var titles = shuffle([titleOf(story, ctx.lang)].concat(two), rnd);
  return finish({id:story.id + '-radio', kind:'story', storyId:story.id, title:titleOf(story, ctx.lang)}, ctx, lines, parts, checkins, titles, titles.indexOf(titleOf(story, ctx.lang)), pickMoments(lines, ctx.level), story);
}
function fromAuthored(ep, ctx){
  var rnd = ctx.rand || Math.random;
  var lines = (ep.lines || []).map(function(l){ return {who:l.who === 'b' ? 'b' : 'a', text:l.text}; });
  if(lines.length < 4) return {fail:'lines < 4'};
  var parts = cutParts(lines, ep.level || ctx.level); if(!parts) return {fail:'parts'};
  var whole = lines.map(function(l){ return l.text; }).join(' ');
  // farin-lxd's files: words[i] is said only in part i and decoys[2i..2i+1] belong to part i; use that when it holds
  var W = (ep.words || []).map(function(w){ return base(w, ctx.lang); }), Dc = (ep.decoys || []).map(function(w){ return base(w, ctx.lang); });
  if(W.length === parts.length && Dc.length >= 2 * parts.length && W.every(function(w, i){ return heardIn(w, partText(lines, parts[i]), ctx.lang); }) && Dc.every(function(d){ return !heardIn(d, whole, ctx.lang); })){
    var direct = W.map(function(w, i){ return {word:w, decoys:[Dc[2 * i], Dc[2 * i + 1]]}; });
    var tt = shuffle(ep.titles.slice(0, 3), rnd);
    return finish({id:ep.id, kind:'authored', title:ep.titles[0]}, ctx, lines, parts, direct, tt, tt.indexOf(ep.titles[0]), (ep.moments || pickMoments(lines, ctx.level)).slice(0, 3), null);
  }
  var pool = uniq((ep.decoys || []).concat((ctx.pool || []).map(function(w){ return base(w, ctx.lang); }).filter(okWord)));
  var checkins = pickCheckins(lines, parts, pool, whole, ctx.lang, rnd, (ep.words || []).map(function(w){ return base(w, ctx.lang); }));
  if(!checkins) return {fail:'a part without a check-in word, or decoys < 2P'};
  var titles = shuffle(ep.titles.slice(0, 3), rnd);
  return finish({id:ep.id, kind:'authored', title:ep.titles[0]}, ctx, lines, parts, checkins, titles, titles.indexOf(ep.titles[0]), (ep.moments || pickMoments(lines, ctx.level)).slice(0, 3), null);
}
// spec 9 (decided 2026-10-29): page 1 takes radio-<lang>-<level>-1, page 2 takes -2; refId = <episode id>-radio.
// Returns the authored episode for that page, or null when it is missing or already played (then: a story passage, then Listen & Type).
function pickAuthored(o){
  var id = 'radio-' + o.lang + '-' + o.level + '-' + (o.page === 2 ? 2 : 1);
  var ep = (o.episodes || []).filter(function(e){ return e.id === id; })[0];
  var done = o.completed || [];
  if(!ep || done.indexOf(id + '-radio') >= 0 || done.indexOf(id) >= 0) return null;
  return ep;
}
root.RadioEpisode = {pickAuthored:pickAuthored, refId:function(epId){ return epId + '-radio'; }, fromStory:fromStory, fromAuthored:fromAuthored, ok:function(story, ctx){ return !fromStory(story, ctx).fail; }, matches:matches, heardIn:heardIn, BUDGET:BUDGET};
})(typeof window !== 'undefined' ? window : globalThis);
