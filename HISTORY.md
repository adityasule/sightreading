# History — completed milestones & resolved design

Archive of detail moved out of `GOALS.md` once shipped, kept for reference. The
forward-looking plan lives in `GOALS.md`; this file is the record of *how* the
Phase 1 work landed and the design decisions behind it.

---

## Completed milestones

### Milestone 0 — Scaffold ✅
- Vite + Svelte project skeleton
- Placeholder views for Home, Phase 1/2/3, Settings
- VexFlow wired in with a "hello world" render to prove the toolchain
- Cloudflare Pages build config documented in README

### Milestone 1 — Phase 1 quiz ✅
- Single-note rendering on both clefs (hardcoded naturals deck)
- Two answer modes — **Letters** pad (+ hardware keyboard) and **Piano** —
  toggled in Settings
- Correctness check, note recolouring, reveal-on-miss, auto-advance
- Leitner scheduler wired up: due-first, daily new-card budget, `localStorage`
  persistence, caught-up + keep-practicing states
- Settings: answer mode, clef toggle (treble/bass), new-cards-per-day

### Milestone 1b — Phase 1 depth ✅
- Accidentals (sharps/flats) — both spellings per black key, Letters pad gets
  ♯/♭ modifiers, Piano gets interactive black keys
- Configurable note range — N ledger lines above/below each staff
  (Settings → Note range, default 2), replacing the fixed starter range
- In-session re-test of missed cards — a miss re-appears after 3 other cards
  (session-only relearning queue); the re-test is reinforcement only and
  doesn't touch the scheduler or first-attempt accuracy (see SR notes below)
- "Today" counts surfaced on the Home view — due / new-left / learned for
  Phase 1, with an adaptive primary action (Review / Learn / Practice)

### Milestone 1 review — feedback incorporated (2026-06-02)
After Milestone 1 shipped, a review surfaced four items, all since addressed:
- **Terminology** — "Phase 1/2/3" is dev jargon and shouldn't be user-facing.
  Use musical names (Notation / Chords / Key Signatures). → M1c.
- **Scale-based note order** — introduce notes grouped by scale, in
  circle-of-fifths order, with a "ready for the next level?" gate. → M1d.
- **Mobile nav** — the bottom tab bar is distracting on phones; replace it with
  a hamburger menu that stays out of the way. → M1c.
- **Stem bug** — on the very first note render the stem is detached and shifted
  right (correct after a reload). VexFlow music-font load race: glyph metrics
  are wrong before Bravura loads. → M1c.

### Milestone 1c — Bugfixes & UX polish ✅
- **Rename UI terminology** — Notation / Chords / Key Signatures everywhere the
  user can see (nav, Home cards, today snapshot, view headers, Settings copy);
  internal route ids and storage keys (`srt:phase1`) unchanged
- **Mobile hamburger nav** — the narrow-screen bottom tab bar is now a
  hamburger-driven off-canvas drawer (scrim backdrop, closes on Escape /
  backdrop / selection); the side nav stays on wide screens (≥760px)
- **Fix the first-render stem bug** — root cause was VexFlow 5 lazily fetching
  its music font (Bravura) from a CDN mid-render, so the first paint used wrong
  glyph metrics. Fixed by awaiting `VexFlow.loadFonts('Bravura', 'Academico')`
  before the first render (more reliable than `document.fonts.ready`, which
  resolves early if the FontFace isn't registered yet)
- **Dark mode pass** — nav drawer, scrim, hamburger, and dashboard badges all
  use theme tokens; audited at 390/500/1100px in light + dark
- **"Today" dashboard polish** — per-day answer log persisted in SR state; Home
  surfaces cards due, a day streak (🔥, with a one-day grace), and lifetime
  accuracy; phase cards gained Now/Soon status badges
- **Responsive audit** — verified phone (390), tablet/desktop; fixed a latent
  header overflow on phones (the implicit grid column sized to max-content;
  constrained with `minmax(0, 1fr)`)

### Milestone 1d — Scale-based learning progression ✅
A *curriculum layer* on top of the existing deck + scheduler — nothing was
rewritten. `spaced-repetition.js` stayed generic (preserving the SM-2 swap
path); the curriculum lives in `music.js` / `progression.js`, and the scheduler
is handed a pre-filtered pool of introducible cards via an optional `newPool`
param. As shipped:
1. **Curriculum model (`music.js`)** — the 12-entry `SCALE_SEQUENCE` (11
   circle-of-fifths levels, level 1 C major / A minor split into on-staff then
   ledger sub-levels) and `levelsFor(deck)` bucketing the live deck into ordered
   level groups; each card maps to the earliest level that introduces its
   spelling. `isOnStaff(card)` register test added.
2. **Scheduler level-awareness (`spaced-repetition.js`)** — optional `newPool`
   param on `pickNext` (default = whole deck, so existing callers are
   unaffected); `boxAtLeast(state, cards, 2)` completion helper.
3. **Progression state + migration (`progression.js`)** — current level index
   persisted in the `srt:phase1` blob; on load, pre-M1d progress migrates
   (current level = first not yet complete at box ≥ 2).
4. **Quiz wiring + gate UI (`Phase1.svelte`)** — current level derived from the
   live deck, only its un-introduced cards fed as `newPool`, completion → inline
   "Start [next level]?" gate, current level + progress in the quiz header.
5. **Home surfacing (`Home.svelte`)** — current level name + progress.

---

## Resolved design notes

### Spaced repetition (as implemented)
- Leitner box variant, 5 boxes. Each card = one prompt (a note in Phase 1).
- Correct → advance one box; incorrect → return to box 1.
- Review intervals per box: 1d, 3d, 7d, 14d, 30d.
- New cards introduced at a user-configurable rate (default 5/day), tracked by a
  per-day counter that resets at local midnight.
- `pickNext` serves the most-overdue due card first, else introduces a fresh
  card if the budget allows, else reports "caught up" (the quiz then offers an
  ahead-of-schedule "keep practicing" path).
- State persists as a single JSON blob in `localStorage` keyed by phase
  (`srt:phase1`); the SR module is generic and card-agnostic.

**In-session re-test of misses.** A session-only relearning queue in
`Phase1.svelte` (`RELEARN_GAP = 3`): a missed card still drops to box 0 in the
persistent scheduler, but also re-appears after 3 other cards within the
session. The re-test is reinforcement only — it doesn't call `recordAnswer`
again or count toward first-attempt session accuracy.

Future tuning (not done): make the relearning gap configurable, or gate the
box-0 scheduling behind passing the relearning step (true learning steps). If
Leitner feels too coarse, swap in SM-2 — the SR module is behind a small
interface, so the swap stays local.

### Learning progression — scale-based note introduction (as implemented, M1d)
New cards are introduced **grouped by scale**, mastering one level before
unlocking the next. Major and natural-minor scales only; other modes are out of
scope until everything in the plan ships.

**Order — circle of fifths, alternating outward from C.** Each step adds the
fewest possible new accidentals. A natural minor shares its *relative* major's
key signature and note set, so the two pair onto one level for free:

| #  | Level                 | Key sig | New note to read |
|----|-----------------------|---------|------------------|
| 1  | C major / A minor     | 0       | all 7 naturals (foundation) |
| 2  | G major / E minor     | 1♯      | F♯ |
| 3  | F major / D minor     | 1♭      | B♭ |
| 4  | D major / B minor     | 2♯      | C♯ |
| 5  | B♭ major / G minor    | 2♭      | E♭ |
| 6  | A major / F♯ minor    | 3♯      | G♯ |
| 7  | E♭ major / C minor    | 3♭      | A♭ |
| 8  | E major / C♯ minor    | 4♯      | D♯ |
| 9  | A♭ major / F minor    | 4♭      | D♭ |
| 10 | B major / G♯ minor    | 5♯      | A♯ |
| 11 | D♭ major / B♭ minor   | 5♭      | G♭ |

After level 11 every card is introduced: all 7 naturals plus both spellings of
each of the 5 black keys. Each black-key spelling is introduced in its *home*
key (F♯ at G major, G♭ at D♭ major). Keys past 5♯/5♭ only add enharmonic
naturals (E♯, C♭, …) not in the deck, so the sequence stops at 11 levels. C
minor lands at level 7 as the relative of E♭ major — stepping straight to
parallel C minor would jump to 3 flats and break the gradient.

**Scale model.** A scale's group is its full note set within the current range
and enabled clefs. Scales overlap heavily; a card is introduced once and shared.
Advancing a level means mastering the one new accidental that level adds.

**Decisions:**
- *Minor scales:* paired, not separate. Each level is one gate "X major / Y
  minor"; the relative minor adds no new cards so it gets no separate gate.
- *Foundation split:* C major splits by register — on-staff naturals first
  (between the staff's outer lines), then ledger-line naturals. Ledger lines are
  the hard part; this gives quicker early wins. Within every level, introduction
  is on-staff before ledger; only the foundation is large enough to warrant a
  checkpoint *between* its two sub-levels.
- *Completion bar:* box ≥ 2 ("reviewed twice"). A level is complete when every
  card in it (in range, enabled clefs) has reached Leitner box 2. Since a card
  goes to a 1-day interval after its first correct answer, box 2 requires a
  next-day review → each level spans ≥2 calendar days (intended: a multi-week
  drip, not a single-session blitz).
- *Progression gate:* when the current level is complete, *ask the user* before
  unlocking the next — an explicit "Start [next level]?" prompt, never an
  automatic jump. One level at a time, no skipping.
- *Global across clefs:* a pitch class is the same reading skill on either clef,
  so a level is judged complete across all enabled clefs at once.

**Mechanics & edge cases (implemented defaults):**
- The scheduler introduces new cards only from the current level (still capped by
  the daily budget); reviews of already-learned cards continue normally.
- The scale sequence + current level persist alongside SR state.
- *Settings change mid-progression:* completion is evaluated against the live
  deck, so enabling a clef or widening the range can re-open a previously
  complete level when new in-range cards appear. Self-correcting.
- *"Keep practicing" (caught-up):* draws only from already-introduced cards.
- *Migrating pre-M1d progress:* cards introduced in the old MIDI order map to
  their level on load; current level = furthest one fully at box ≥ 2, else the
  first incomplete level.
