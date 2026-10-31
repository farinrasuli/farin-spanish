# Mini Radio v2: build notes (spec Claude/specs/mini-radio-2026-10-21.md v2; gamification HRlPCC2r; episodes dsbVN6AH). Engine 0.3.0.

farin-app, 2026-10-29. Byte-identical in both apps. Not wired into either app file yet.

| File | What it is |
|---|---|
| `episode.js` | pure builder: `RadioEpisode.fromStory(story, ctx)` / `fromAuthored(ep, ctx)` / `ok()` (radioOk). The roadmap needs `ok()` at build time, so the wiring pass pastes this file into both app files as one byte-identical block |
| `radio.js` | the engine: plays one episode object in the Theatre stage (kind `radio`). Dial with generated static + sting, ON AIR lamp, parts + check-ins, gist, order, Off air read-along. No digits on screen |
| `radio.css` | look, real token values, light only |

Tools: `Claude/specs/mini-radio-tools/` (`sweep.mjs` content sweep + clip coverage, `build-demo.mjs` single-file demo). QA: `Claude/qa/mini-radio-check.mjs`.

## Decisions applied 2026-10-29 (spec v2 updates)
- **Art (spec 5.1, GAME-ART-STYLE):** the radio is rendered art: `art/radio-body.webp`, `art/radio-knob.webp`, `art/radio-sill.webp` +
  `art/radio-body.json` ({dial, lamp, knob} boxes in % of the body), dropped by the GPU agent. Then run
  `node Claude/specs/mini-radio-tools/build-art-manifest.mjs` (writes `art/manifest.json` ready:true and mirrors to ES). The engine draws only
  the live controls on the art (ticks, station mark, needle, ON AIR pill, the knob cut-out turning). Until then: **no drawn stand-in**, the
  controls show alone as plain app UI. `MiniRadio.loadArt(appRoot)` reads the manifest.
- **Fonts (GAME-ART-STYLE 5):** Alfa Slab One (titles) and Archivo Black (labels), bundled in `fonts/` (latin + latin-ext WOFF2, SIL OFL,
  licences `fonts/OFL-*.txt`). Persian text falls back to Vazirmatn.
- **Decoys (spec 2):** the level's non-slang VOCAB_SETS words only, never heard anywhere in the story; a story's own vocab is for check-ins only.
  Sweep (accepted by gamification): EN A1 10/15, A2 6/15, B1 7/15, B2 6/15, C1 4/15; ES 13-15/15.
- **Episode per page (spec 9):** `RadioEpisode.pickAuthored({episodes, lang, level, page, completed})` gives radio-<lang>-<level>-1 / -2,
  null when already played (then a story passage, then Listen & Type). refId = `RadioEpisode.refId(id)` = id + '-radio'.
- Two-voice shows get a speaker dot per line in the Off-air transcript (a = --cat-lis, b = --cat-story).

## App wiring
Step 4 of the serialized pass plan: `Claude/specs/app-wiring-pass-2026-10-29/PATCH-PLAN.md`.

## Waiting on
- TTS owner: clips for the 20 authored episodes (voice by `who`), the ident and the 4 sign-offs; EN A2 story coverage is 58 %, ES A2 31 %.
- Poster art (spec §5.3).
