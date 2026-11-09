# Your Call — sound credits

Every sound in Your Call is generated in code at play time with the Web Audio API, inside `your-call.js` (the `Sound` module).
No sound files are used: no recordings, no samples, no third-party audio. Nothing needs a licence.

- Per-set ambience (harbour, yard, Jean's/Carmen's kitchen, café/bar, the steps/mirador, hospital, my flat; night and Regatta /
  L'Amuravela variants): filtered noise loops and small synthesised events (gulls, birds, clock, cups, rain, monitor), made in code.
- 1970 view: the same ambience through two low-pass filters, plus a period radio tune.
- The radio tune: an original 16-bar light-pop melody (G major, 100 bpm) written for this game and synthesised in code,
  played through a simulated transistor radio (band-pass, soft overdrive, wow, hiss, crackle).
- Sound effects (shutter, tab pull, peel, pencil circle, paper rustle, print whirr, page turn, stamp and the rest): synthesised in code.
- The last-photo piano motif: an original 13-note motif, played by an additive piano voice with a generated room reverb.

Source: Farin English / FEschool, 2026 (Trello 7VO9j7xZ, GDD `Claude/specs/your-call-v2/A1-the-camera-GDD.md` §12).

# Your Call — art credits

- Panels and plates in `art/whitby/` and `art/cudillero/`: our own clear-line art, rendered on this PC with FLUX.1-schnell
  (Black Forest Labs, Apache 2.0; GGUF weights second-state/FLUX.1-schnell-GGUF, Apache 2.0) through stable-diffusion.cpp (MIT),
  then composited, face-repainted and lettered by hand-written scripts (`Claude/specs/your-call-v2/art3/`, `art4/`). Whitby Abbey is
  our own Blender model. No paid or online image service was used.
- Every word inside the art is real type: Alfa Slab One, Archivo Black and Patrick Hand (SIL Open Font License 1.1).
