# Farin learner app — rules for Claude sessions (cloud or local)

Owner: Farin (FEschool). Two repos form ONE app: `farinrasuli/farin-english` (English side)
and `farinrasuli/farin-spanish` (Spanish side). Every engine/feature change must land on
BOTH sides at the same time (content differs per language, features don't).

Agent roles you can follow: `.claude/agents/farin-app.md` (engineering),
`farin-lxd.md` (lesson quality), `farin-gamification.md` (game design). Paths in them
that start with `D:\farin\` refer to Farin's PC and are not available here.
Read `LESSON-ENGINE.md` and the `NOTES.md` inside each game folder before editing.

## Shipping
- Pushing `main` deploys the app live (GitHub Pages workflow). Work on a branch, test,
  then merge to `main` only when it works with no console errors.
- Never break the existing Home roadmap, logins or saved progress (Firestore `progress`).
- Mute audio in any headless browser test (`--mute-audio`).
- No Python assumed; use Node for scripts.

## Design (applies everywhere)
- Keep the app's design system: its colours, Fredoka + Nunito, pill buttons, orange CTA,
  cards, generous free space ("Course Report" look). Light backgrounds, never dark.
- Gamification lives in the experience, not in XP labels/pills on cards.
- Companion bubbles: 5 s, once per action; no heavy motion.
- Persian strings use informal تو, never شما. Check tr/fa/es accuracy yourself.
- Never use Higgsfield or other AI image tools without Farin's OK; no video work.

## Games (app/games/)
- Big-game standard: poster intro, full screen, real game feel, small motions.
- Art = clear-line comic style in `docs-claude/GAME-ART-STYLE.md`. Dot eyes + one bold
  outline. NO anime/kawaii faces. Objects and props must look real/solid.
- Games must have content for every level A1, A2, B1, B2, C1 and roadmap slots at each.
- Current plan: Cozy Chores (oven sample approved — roll that art style out to all
  chores, long hands-on projects), Your Call (Tintin-style adventure saga, clear-line
  comic, a new country per level, each level a different genre story — finish it),
  Case Closed, Mini Radio. Spot the Slip / Four of a Kind are dropped.

## Premium courses (app/courses/, app/ielts/)
- Premium courses come first and must be world-class.
- Every lesson: objective → explain (point + teaching with the why + before/after) →
  practise → check, and it states the result. No vocab/grammar test steps.
- Lessons teach directly — NO running story/cast. Only exception: HR keeps its story.
- IELTS = close copies of recent Cambridge tests (11–20 style): each chapter = one exam
  copy, 10 lessons; context → technique → practice, part by part. No scoring lessons.
- Courses: HR, IELTS, Copywriting & Content English, Business (flagship), AI course, etc.
- Courses are sold by WhatsApp + password ("I want this course" button). No payment
  gateway, no refunds/outage-extension promises.
- Never invent testimonials or proof. Keep existing "%97" and testimonials as they are.
- New TTS audio (Kokoro/Piper) can't be generated in the cloud: leave a clear
  `AUDIO-TODO.md` list instead of fake audio.

## When done
Leave a short summary in the PR/commit message: what changed, what's left, anything
Farin must decide.
