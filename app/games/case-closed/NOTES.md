# Case Closed "Harbour Files": build notes (Trello gOW8oVsO)

farin-app, 2026-10-29. Engine v0.1 built to GDD v2 (§15 CC1–CC12). All 5 season openers are playable: A1 "Where Is Captain?",
A2 "The Regatta Cup", B1 "The Lamp at the End of the Pier", B2 "Boats at Dawn", C1 "The Sea Swallow, 1970".
Byte-identical in both apps: edit the English copy, then run
`node Claude/specs/games-expansion-2026-10-22/case-closed-tools/sync.mjs` (content + manifest + episode index + mirror to ES).
Not wired into either app file yet.

## Files
| File | What it is |
|---|---|
| `engine.js` | spine runner, hub (lens, people, interviews), testimony drop + press, re-evaluation board, thread board, deduction (clauses), truth panels, souvenir, archive |
| `case.css` | all UI, light only. Fonts are bundled in `fonts/` (no Google Fonts): Alfa Slab One = titles, Archivo Black = stamps / captions / labels / tabs, Courier Prime = typed paper only, Patrick Hand = pencil notes (OFL licences beside them) |
| `episodes/<id>.json` | the stage: cast (hue, short names, `as` alias, `face` art id, `young` 1970 portrait, `sepia`), views + people + `room` (interview room tone), find boxes, evidence art + live stamps, truth panels, cold open, `town` keys, placeholder recipes |
| `episodes/index.json` | which openers exist (written by sync.mjs) |
| `content/<id>.json` | farin-lxd's content (en + es) + `lines` merged from `lines/case-closed/lines-<lang>.json` |
| `art/manifest.json` | art ids; `ready:true` when `art/<id>.webp` exists, else the stand-in recipe is drawn. Ids are global: A1/B1/B2/C1 plates carry the episode prefix (`a1-plate-…`, `b1-cold-1`, …) to match the art jobs; sync.mjs warns if two stages share an id |
| `dev.html` | harness: `?ep=&lang=&ui=&rm=1&pace=0.2&tts=0&open=1&fresh=1&hints=1500` |

## Content features the engine reads (2026-10-29 openers pass)
- `deduction.clauses[]` (B1 2+2, B2 2+3, C1 3+3): each clause has its own Check and ladder; a right clause sets (retypes in Courier, 30 ms/char + bell) and Moss says its `set` line. `form:true` gaps get an "Aa" mark; chips show their `gloss` in the UI language (en/tr/fa). One-clause `{text, gaps}` (A1/A2) still works. No `solved` line → the filled sentence is read.
- Statements: `near:{cardId: line}` = authored near-miss reply; `confirms` may list 2 cards (either works); a suspect's polaroid flips only when all their confirmable lines are checked (C1 Jack has 2). `who` = the voice (C1 Arthur's lines are voiced by `pike`), `by` = the polaroid.
- `source:"file1970"`: shown under the owner's 1970 polaroid (sepia; cast `young` for Arthur) with the `stamps.file` tag; wrong drops answer from `filePool` in Moss's voice. Then-lines: the owner's line is pinned under the broken one, else the first line (a Moss note: not a drop target).
- `if` on any line: Cozy memory (`cat.keptIn`, `!cat.keptIn`, `laundry.called`, `party.delivered`, read from progress.house.mem), `case:<episodeId>` (progress.cases), town keys (`lamp.mended`, `gallery.saved`, `cup.1970.official`, `cup.engraved`).
- CC10 the town remembers: on TRUTH the episode's `town` keys (content `town` object, else stage `town`) are merged into `progress.cases.town`; the last panel shows one pencil line ("Whitby will remember this."). Cozy Chores / Your Call read `progress.cases.town` (or `CaseClosed.solved(host).town`).
- CC11 the thread board plays a rising tune (+2 semitones per required link, `sfx('pluck', {rate})`); the last link flashes the folder.
- CC12 interview room tone made in code (`roomTone(kind)`: cafe, pier/harbour, gallery/office, archive, bakery, home), 1 s, ducked to 40 % under the line. A host `sfx('room-<kind>')` returning true replaces it with a file.
- Souvenir = the planned `souvenir.statement` (the first break is only a fallback).

## Checks
- `node Claude/qa/case-closed-check.mjs` plays every opener to the end, 4 runs each: EN phone touch (UI en, wrong drop, ladder on clause 1), ES desk (UI tr, leave + resume), EN phone reduced motion (UI fa, tap-only), ES phone (UI es, ladder on the last clause). Also checks the planned souvenir, town keys, clause count, FILE 1970 tags, no early polaroid flip, bundled fonts, no ancestor scroll, 0 console errors. `--mute-audio`.
- `case-closed-tools/ep-lint.mjs` (Q2–Q4, Q17–Q19, Q21 + stage) and `case-closed-tools/simulate-drops.mjs` (Q6) over all episodes.
- Demo: `case-closed-tools/build-demo.mjs` (any episode, `?ep=`; fonts inlined).

## App wiring (serialized app-file pass; about 2 KB per app)
- Lazy-load `games/case-closed/case.css` + `engine.js` like the Theatre; `CaseClosed.load({appRoot:'', episode:CaseClosed.episodeFor(level)})`.
- In the Theatre `onPlay` for kind `mystery` (roadmap node): `CaseClosed.start({root:Theatre.stageEl(), data, lang:TTS_LANG.slice(0,2), ui:LANG, name, host, resume, onDone, onLeave})`.
  host: `speak` = Promise around `ttsSpeak` (stopAllSpeech on interrupt); `stopSpeech:stopAllSpeech`; `sfx(name, opts)`; `muted`; `reduced`; `buzz`;
  `loadRound/saveRound` = `state.viewParams.round`; `loadCases/saveCases` = `state.progress.cases` (save-merge guard, default {}, keep `town`);
  `loadTaught/saveTaught` = `state.progress.cases._taught` or a profile flag; `loadHouse` = `state.progress.house`; `keep(s)` = `gameKeep('mystery', …)`.
- `onDone`: `scoreGameCompletion(refId, true)` then `markGameComplete(refId)`, `backToRoadmap()`.
- If the episode for the level fails to load: fall back to a Cold Cases round (the existing generator) and log it.
- SW: `GAMES_RE` must also cover `games/**/*.json` and `games/**/*.woff2`.

## Waiting on
- Art (GPU agent): plates, detail layers, portraits, evidence cards, cold-open + truth panels for every opener (`art/manifest.json` lists every id).
- farin-lxd: Q18 chip words not shown before step 8 in A1/A2 (+ C1 ES "revisar el nudo"), A1 ES keyWords still English, A2 EN "why" chip vs ES "grabar el nombre de su padre" (ep-lint.mjs output).
- TTS owner: clips for every content line (+ `lines`).
