# Sight Reading Trainer — Goals & Plan

## Vision
A simple, low-friction web app for learning to sight-read music using spaced
repetition. Primary user: the author. Designed to be shareable, but not
multi-user.

## Non-Functional Requirements
- Works on mobile (iOS/Android), tablet (iPad), and desktop browsers
- Hosted under `adityasule.com` (final URL TBD — see Open Questions)
- Minimal hosting cost — target $0/month indefinitely on free tier
- Strict cost-cap: app must not be able to accrue unexpected charges
- Fast first load (target <200KB initial JS, <1s TTI on 4G)
- Works offline once loaded (PWA — nice-to-have, not blocking)

## Architecture Decision: Fully Client-Side Static App
No backend, no database, no APIs called at runtime.

Why this satisfies the NFRs:
- **Cost**: free static hosting tier covers it indefinitely
- **Rate limits**: not applicable — there is no per-request server cost vector
- **Reliability**: no server to go down, no DB to migrate
- **Privacy**: progress data never leaves the user's device

Trade-off accepted: no cross-device sync in v1. Progress is local to the
browser. (Future option: opt-in export/import a JSON blob.)

## Tech Stack
- **Build**: Svelte 5 + Vite
- **Music rendering**: VexFlow 5 (SVG output, scales cleanly on retina)
- **Styling**: hand-rolled CSS (no Tailwind / UI library — keeps bundle small)
- **Spaced repetition**: client-side Leitner box variant (see Design Notes)
- **Persistence**: `localStorage` (single JSON blob) — migrate to IndexedDB
  only if size becomes a problem
- **Hosting**: Cloudflare Pages, custom domain via Cloudflare DNS
- **Deploy**: git push → Cloudflare auto-builds and deploys

---

## Phases

### Phase 1 — Single notes, treble & bass clef
**In scope**
- Render one note at a time on either clef
- User answers via a selectable **answer mode** (Settings toggle):
  - **Letters** — on-screen A–G pad; hardware keyboard A–G also accepted.
    Doubles as both the "multiple choice" and "freeform typing" idea: all
    seven names are always present (so it's recall, not guessing), and the
    keyboard path covers typing.
  - **Piano** — tap the matching key on a one-octave on-screen keyboard.
    Builds the staff→keyboard mapping (the actual playing skill). Only the
    seven white keys are interactive in Phase 1; we grade by letter, so
    octave is ignored.
- Immediate correct/incorrect feedback (the note recolours green/red; the
  correct name is revealed on a miss)
- Auto-advance on a correct answer; a miss waits for the user (so it registers)
- Spaced repetition per `(clef, midi_note)` card, e.g. `treble:60`
- Toggle: treble only / bass only / both
- New-cards-per-day budget (Settings), resets at local midnight
- Session header: cards due, new-cards remaining today, learned/total, accuracy %

**Deck (current)**
- Hardcoded, naturals only, generated from a fixed range per clef:
  treble C4–A5, bass G2–E4 (26 cards total). Lives in `src/lib/music.js`.
  Widening to the full "2 ledger lines above/below, configurable" range is a
  later iteration — see Milestone 1b.

**Out of scope (Phase 1)**
- Accidentals (sharps/flats) — defer to a later iteration of Phase 1
- Note duration / rhythm reading
- Audio playback of the rendered note
- MIDI keyboard input

### Phase 2 — Major / minor triads
**In scope**
- Render a 3-note chord, root position, on a single clef
- User identifies root + quality (e.g. "C major", "A minor")
- Coverage: common keys (C, G, D, F major; A, E, D minor)
- Spaced repetition per chord card

**Out of scope (Phase 2)**
- Inversions
- 7th chords or extensions
- Diminished / augmented qualities
- Chords spanning both clefs

### Phase 3 — Key signature recognition
**In scope**
- Render a key signature (sharps or flats) on a clef
- User identifies the major key
- Full 15-key coverage (7♯ to 7♭ plus C)
- Spaced repetition per key signature card

**Out of scope (Phase 3)**
- Relative minor identification
- Modes
- Atonal / non-Western signatures

### Out of scope for v1 entirely
- User accounts, cloud sync, leaderboards
- Audio / ear training
- Rhythm training
- Sheet music import or composition
- Server-side anything

---

## Design Notes

### Spaced Repetition (initial design)
- Leitner box variant, 5 boxes
- Each card represents one prompt (a specific note in Phase 1, a specific
  chord in Phase 2, a specific key sig in Phase 3)
- Correct answer → card advances one box
- Incorrect answer → card returns to box 1
- Review intervals (per box): 1d, 3d, 7d, 14d, 30d
- New cards introduced at a user-configurable rate (default: 5/day), tracked
  by a per-day counter that resets at local midnight
- Scheduler (`pickNext`) serves the most-overdue due card first, else
  introduces a fresh card if the day's budget allows, else reports "caught up"
  (the quiz then offers an ahead-of-schedule "keep practicing" path)
- All state persists as a single JSON blob in `localStorage` keyed by phase
  (`srt:phase1`); the SR module is generic and card-agnostic

Worth revisiting after Phase 1 ships:
- **In-session re-test of misses.** A wrong answer currently sends the card to
  box 0 (1-day interval), so a missed note doesn't recur within the same
  session. For a drill that may be too lenient — consider a short "relearning"
  step (re-show after N cards) before the card re-enters the day-scale ladder.
- **Algorithm.** If Leitner feels too coarse, swap in SM-2 (Anki's). The SR
  module is behind a small interface, so the swap stays local.

### UI
- Single-page app, view-switching driven by simple state (no router lib in v1)
- Four views: Home/Today, Phase 1, Phase 2, Phase 3, Settings
- Bottom tab bar on narrow screens, side nav on wide screens
- Letter input via on-screen A–G buttons (touch-friendly; min 44px targets)
- Hardware keyboard A–G also accepted on desktop
- Dark mode via `prefers-color-scheme`

### Music Rendering
- VexFlow renders to SVG
- Minimal — no time signatures, no measure bars in Phase 1
- Single staff, single note (Phase 1) or 3 stacked notes (Phase 2)

### Cost & Rate-Limit Safeguards
- No backend in v1 — primary defense
- Cloudflare Pages free tier limits (500 builds/mo, generous bandwidth) are
  far beyond expected usage
- No third-party APIs called at runtime
- If a backend is ever added: enforce a hard daily quota (e.g. Cloudflare
  Worker + KV counter that returns 429 above N requests/day) before exposing
  it publicly

---

## Productionization Plan

### Milestone 0 — Scaffold (this commit)
- Vite + Svelte project skeleton
- Placeholder views for Home, Phase 1/2/3, Settings
- VexFlow wired in with a "hello world" render to prove the toolchain
- Cloudflare Pages build config documented in README

### Milestone 1 — Phase 1 quiz ✅ complete
- Single-note rendering on both clefs (hardcoded naturals deck)
- Two answer modes — **Letters** pad (+ hardware keyboard) and **Piano** —
  toggled in Settings
- Correctness check, note recolouring, reveal-on-miss, auto-advance
- Leitner scheduler wired up: due-first, daily new-card budget, `localStorage`
  persistence, caught-up + keep-practicing states
- Settings: answer mode, clef toggle (treble/bass), new-cards-per-day

### Milestone 1b — Phase 1 depth
- Widen the deck to the full configurable range (2 ledger lines above/below
  each staff) instead of the fixed starter range
- Decide & implement in-session re-test of missed cards (see Design Notes)
- "Today" counts surfaced on the Home view, not just inside Phase 1
- Optional: accidentals as a later Phase 1 iteration

### Milestone 2 — Polish & PWA
- Web app manifest + service worker for offline use
- Dark mode pass
- "Today" dashboard (cards due, streak, accuracy)
- Responsive audit on iPhone, iPad, desktop

### Milestone 3 — First production deploy
- Create Cloudflare Pages project, connect to git
- Configure custom domain (see Open Questions)
- Verify HTTPS, run Lighthouse, ensure score >90 across the board

### Milestone 4 — Phase 2 (chords)
### Milestone 5 — Phase 3 (key signatures)

### Future ideas (not committed)
- Audio playback of the rendered note (Web Audio API — free, client-side)
- Optional MIDI input (Web MIDI API)
- Progress export/import as JSON
- Sharps/flats added to Phase 1
- Relative-minor identification in Phase 3

---

## Open Questions
- **Subdomain vs path**: `sightread.adityasule.com` vs
  `adityasule.com/sightread`? Recommendation: subdomain — cleaner separation
  from anything else hosted on the apex, easier to rebuild or retire
  independently.
- **VexFlow version pin**: pin to `^5.0.0` for now; revisit on each minor
  bump.
