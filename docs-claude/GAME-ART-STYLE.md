# FEschool game art style — the signature look

The one visual style for every in-app game: Your Call, Cozy Chores, Case Closed, Mini Radio and any future game. Every game agent reads this before making or judging art. If a new game seems to need a different look, ask Farin first; don't invent one.

**Farin confirmed on 2026-10-29 that this is the signature style for ALL in-app games** (100 DOORS stays separate, in realistic 3D). Each game keeps its own mood through its palette and places, always in daylight with the same clear-line drawing. The style was first approved on 2026-10-23, on the Your Call clear-line sample (https://claude.ai/artifact/8td8wUnTHqNEnkj7K8eWpb). The full working recipe is in `Claude/specs/your-call-v2/art3/README.md`.

## 1. The look in one line

**A clear-line European adventure comic album that comes alive on a phone.** Even black ink outlines, flat bright colours, richly drawn real places, simple readable faces. Bright daylight, warm and cheerful.

## 2. Must have

| Rule | What it means |
|---|---|
| Clear line (ligne claire) | Thin, even black outlines of the same weight everywhere. Every shape is closed by its outline. |
| Flat colour | Flat, unshaded fills: no gradients, no hatching, no painterly texture. At most one hard shadow step. |
| Bright and light | Daylight, cheerful palette. Background plates have mean relative luminance ≥ 0.55. **Never dark, never moody-black.** |
| Rich places | Backgrounds are detailed, real-feeling places: a real town, a real kitchen, a real harbour. Never empty or "vector-sparse". |
| Simple faces | Cartoon faces with small dot eyes, readable at phone size. Each character has a fixed look: hair, outfit, colours. |
| Real type | All words are set in real fonts as vector or text. AI-generated lettering is always painted out. |
| Phone first | Judge every image at 390 px wide on a phone, not zoomed in. |

## 3. Never

- **Never copy Tintin.** The style is inspired by Tintin, never a copy. No Tintin, Snowy or Haddock look-alikes, no quiff, no Hergé lettering, covers or album plots, and no places Tintin already used for a story.
- **No "3D look".** No glossy 3D, clay or toy renders. Farin rejected the clay look twice and said "not at all just 3D look, very very well designed".
- **No CSS/SVG drawings shown as art.** A hand-drawn code comp was "not even close". Show real rendered art or nothing.
- **No dark scenes and no line sketches.**
- **No Higgsfield and no paid image tools.** Use free tools only. Ask Farin before using any AI image service.
- **No mixed styles** within one game, such as painted realism next to clear line.
- **No cute or anime faces.** No big shiny eyes, blush cheeks, or thin sketchy "kawaii" lines. Characters use small dot eyes and the same bold outline weight as the backgrounds. Farin flagged Your Call's young Jean (1970, yellow dress, `art3/out/cast/young-jean-1970.png`) as off-style on 2026-10-29. Re-render her before she ships.

## 4. How it's made (free pipeline)

1. **Render**: FLUX.1-schnell (Q4_0 GGUF) through stable-diffusion.cpp on the Vulkan GPU: 4 steps, euler, cfg 1. Run it with `node Claude/specs/your-call-v2/art3/tools/local.mjs <jobs.json> <outDir> vulkan`.
   - **Only one sd-cli at a time.** Book a line in `Claude/GPU-QUEUE.md` and check `tasklist` for `sd-cli.exe` before each launch.
2. **Prompt wording** (from `art3/tools/jobs/prompts.mjs`):
   - Prefix `PRE3`: `clear line comic art, classic European adventure comic album style: clean thin uniform black outlines, flat unshaded colour fills, simple cartoon face with small dot eyes, no hatching, no gradients, no texture, no shading: `
   - Suffix `POST3`: `. Clean flat colouring like a printed 1960s comic album, bright cheerful flat colours, crisp uniform black outlines, ligne claire, no text`
   - For characters and cut-outs, add `ISO3`: `. Full body, standing on a plain pure white background, nothing else in the picture, centered`
3. **Hard shapes FLUX can't draw**, such as landmarks or exact geometry: model them in Blender, give them a clear-line pass (`clearpass.mjs`), then composite them in.
4. **Cut-outs**: use `cutline.mjs`, a line-art cutter that keeps whites solid, then `tidy.mjs`. For Cozy Chores, use `FEschool/social/tools/segment/cut.mjs`.
5. **Lettering**: run `fix-text.mjs` to paint out fake letters, then set real type.
6. **Variations of the same scene** (before/after, day changes): composite them from **one base image**. Never generate the same scene twice.
7. **Faces**: FLUX keeps drawing lashes, big eyes and blush even when told not to (2026-10-31, on Mrs Bell and Farin). Don't re-roll for it. Flatten the face interior to skin colour and redraw dot eyes, brows, nose and mouth as vector, one body per character with only the features swapped per expression. Examples: `english app/app/games/cozy-chores-visual-sample/tools/faces.mjs` and `Claude/specs/farin-character-game/jobs/faces.mjs`.
8. **White cut-outs**: flood-fill the white paper in from the open edges (`flood` in the sample's `tools/process.mjs`). The imgly cutter turned tins and knobs semi-transparent.

### Sizes (in-app games)
- **Background plates**: 864×1080 WebP q80, ≤ 150 KB. Render at 704×880, then upscale with lanczos.
- **Cut-outs**: WebP with alpha, ≤ 30 KB.
- **Portraits**: half-body, 600 px tall, with a set of expressions (calm / warm / oh). No hands are drawn when objects move under the finger.
- **Posters**: 864×1080, one per game with a scenario, skippable with one button.

## 5. Type and UI on top of the art

- **Game titles and comic lettering**: Alfa Slab One (title) and Archivo Black (labels). Both are under the SIL Open Font License.
- **Comic look**: speech balloons and comic panels.
- **App chrome** (buttons, menus, HUD) keeps the app design system: Fredoka + Nunito, the orange pill CTA and light tokens. See the app design guide.

## 6. Motion — how the art comes alive

The style is a **living comic**: every frame keeps the clear-line look, but it moves.

- **World**: slow camera push-ins and pans with parallax across layered cut-outs, and a cinematic intro shot. Done with PixiJS, loaded only inside the game that uses it.
- **Light and air**: glow, light sweeps, steam, dust and sparkles at success moments. Effects stay flat and graphic, never photoreal blur.
- **Characters**: they blink, breathe and react by swapping expressions. Later, Rive rigs if Farin approves an editor account.
- **Taps**: juicy feedback with squash/stretch, a snap, particles and a sound.
- **Accessibility**: respect `prefers-reduced-motion`. DOM UI moves with transform and opacity only.

## 7. Quality check before anyone sees it

1. View it at phone size and compare it with the approved Your Call sample. Does it read as the same family?
2. Check for: dark areas, hatching or shading creep, gradients, a 3D or clay feel, fake lettering, extra fingers or artefacts, characters off-model, anything that looks like Tintin.
3. Re-roll weak renders yourself. Never send Farin a "good enough" image.
4. Licences: FLUX.1-schnell is Apache 2.0, stable-diffusion.cpp is MIT and the fonts are OFL. Blender output belongs to us.

## 8. Known weak spots (keep improving)

- Backgrounds can get more texture or hatching than the cast. Keep prompts strict and re-roll.
- FLUX doesn't keep a character identical across images. Reuse the cut-out cast layers instead of baking people into each panel.
- Composited Blender pieces can look more "vector" than their surroundings. Match their line weight.
