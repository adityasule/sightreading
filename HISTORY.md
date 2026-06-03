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

### Milestone 2a — Test harness + code review & simplify ✅
Added **Vitest** (dev-only, never shipped) covering the three pure-logic modules
via colocated `src/lib/*.test.js`:
- `music.js` — MIDI/note helpers, `buildDeck` range math (the 80-card default
  deck), `isOnStaff`, and `SCALE_SEQUENCE`/`levelsFor` curriculum bucketing.
- `spaced-repetition.js` — `introduce`/`recordAnswer`, `pickNext` (`newPool`
  gating), `masteredCount`/`boxAtLeast`, `summary`/`stats`, and the
  `loadState`/`saveState` round-trip.
- `progression.js` — level resolution, the `advance` gate, and pre-M1d migration.

55 tests at ship (59 after M2b's anchor tests). `npm test` documented in README +
CLAUDE.md. Cleanup surfaced while writing them: dropped the duplicated local
`.muted` style from the Phase 2/3 placeholders (the global rule in `app.css` is
identical). These tests are the safety net for the rest of Milestone 2.

### Milestone 2b — Middle C anchor (cluster-first) ✅
A curriculum tweak in `music.js` only — the scheduler and progression layers are
untouched. Middle C is a *ledger* note on both clefs, so on-staff-first ordering
would normally defer it; but it is the canonical reading reference, so it now
anchors the very start of the foundation:
- `isAnchor(card)` identifies the natural cluster B3/C4/D4 (MIDI 59/60/62).
- `levelIndexFor` routes the anchor cluster into the foundation's on-staff
  sub-level (index 0) instead of the ledger sub-level (1), the one place
  on-staff-first is overridden.
- `levelsFor`'s sort gained a leading `anchorRank` key (distance from MIDI 60, so
  middle C leads, then B3, then D4); it is a no-op outside the foundation, where
  no anchor cards land. New cards are introduced in `cards` order, so the quiz
  now serves middle C → B3 → D4 before the rest of the on-staff naturals.
- A returning user who had mastered level 0 but not the (formerly level-1)
  middle-C cards simply re-opens level 0 until they reach box ≥ 2 — the same
  self-correcting behaviour as a range/clef change.
Covered by the M2a tests (`music.test.js` → "Middle C anchor"). The anchor is a
Phase 1 concept: M2c later pivoted Phase 0 to duration cards with no note-name
cards (see M2c below).

### Milestone 2c — Basics phase scaffold + note time-value cards ✅
Phase 0 (user-facing **Basics**): the gentle multiple-choice on-ramp before
Phase 1's pitch reading. **Pivoted mid-build from note-name to note time-value
cards** — Basics is symbol recognition, not pitch reading (reading note names
*is* Phase 1, so it doesn't belong here).
- **Card model + deck (`music.js`)** — `buildBasicsDeck()` returns the six
  duration cards (sixteenth → double whole), in teaching order; each carries a
  `value`/`vex`/labels. `durationLabel(value, convention)` + `DURATION_VALUES`
  drive the British/American option labels; generic `choices(correct, pool,
  count)` builds the shuffled 4-option set (reused by every Basics card type to
  come).
- **Basics view (`Phase0.svelte`)** — renders a single note of the card's
  duration on a *clef-less* staff at a fixed position (treble e4; pitch hidden
  and never named — clefs aren't introduced yet), asks "What kind of note is
  this?", grades by duration value. Reuses the generic scheduler + in-session
  relearning (RELEARN_GAP 3) + auto-advance + caught-up/practice, minus
  progression and the Letters/Piano answer modes.
- **Multiple-choice pad (`Choices.svelte`)** — reusable and card-agnostic (the
  view grades; the pad renders states + reports a pick); 1–N hardware keys;
  correct/wrong colouring on reveal.
- **Quick settings** — `QuizSettings.svelte` generalised to a `fields` prop:
  Basics surfaces a British/American **Duration names** toggle that relabels the
  current card live (option labels derived, not frozen), Notation keeps its
  input-method control. `durationNames` setting (British default) added to the
  store + Settings tab.
- **Wiring** — `phases.js` `phase0` entry (`ready: true`); `App.svelte` map; nav
  + Home pick it up automatically. Order: Home · Basics · Notation · Chords ·
  Key Signatures · Settings.
- **Shared renderer + dev tool** — the staff drawing was extracted to
  `src/lib/render.js` (`drawDurationNote`), shared by the view and a new
  `npm run render:basics` script (Node + jsdom, dev-only) that emits
  self-contained SVGs (Bravura font embedded as a data URI) through the *same*
  code path — fast iteration without launching a browser, with the browser still
  the source of truth. VexFlow `'1/2'` renders the breve; SOFT voice mode lets a
  single note of any duration format.
- 67 unit tests (up from 59): duration deck + `durationLabel` + `choices`.

### Milestone 2d — Basics phase: rests, clef cards & dotted notes ✅
Completed Phase 0 (Basics): the symbol-recognition on-ramp now covers rests,
clefs and dotted notes alongside M2c's plain note durations, with the staff
rendering polished and the dev render script generalised beyond Phase 0.
- **Card model (`music.js`)** — `buildBasicsDeck()` returns 17 cards, each tagged
  with a `type` ('note' | 'rest' | 'clef') and a grading `key`: 6 plain notes + 3
  dotted (half/quarter/eighth) + 6 rests (same 6 values) + 2 clefs. The original
  `dur:*` ids are unchanged, so saved `srt:phase0` progress carries over and new
  cards just drip in via the daily budget — no migration. Option pools
  (`NOTE_KEYS`/`REST_VALUES`/`CLEF_VALUES`, `optionPoolFor`) and labels
  (`noteLabel`/`restLabel`/`clefLabel`/`basicsLabel`) drive the per-type option
  sets. American rests take the natural form ("Quarter rest", "Double whole
  rest"); a note card's pool mixes dotted + plain so the dot is the thing tested.
- **Length in beats** — every note/rest option shows its length alongside the
  name ("Crotchet · 1 beat", "Dotted minim · 3 beats", "Quaver rest · ½ beat"):
  quarter = 1 beat reference, a dot = ×1.5, sub-beats as vulgar fractions
  (`beatsForKey`/`beatsLabel`). Clefs carry no beat value.
- **Rendering (`render.js`)** — added `drawRest` and `drawClef`, extended
  `drawDurationNote` with a dot (`Dot.buildAndAttach`), and the note/rest glyph is
  now horizontally **centred** on the clef-less staff (it previously sat hard
  left). Centering needs `note.setStave(stave)` before `getBoundingBox()`, which
  otherwise throws "NoStave". Clefs draw at the staff start, as in real notation,
  with no feedback tint — VexFlow 5 renders the clef as a `<text>` glyph the
  context can't recolour, so clef cards convey correct/wrong via the answer pad.
- **View (`Phase0.svelte`)** — branches render / grade / options / prompt on the
  card's `type` ("What kind of note/rest is this?", "Which clef is this?");
  reuses the `Choices` pad and in-session relearning unchanged.
- **Shared renderer + generic dev script** — Phase 1's note rendering was
  extracted into `render.js` as `drawNote` (Phase1.svelte calls it; first-render
  font-race fix intact), and the M2c `render:basics` script was generalised and
  renamed to `render`: it dispatches over card types (`-- note|rest|clef|phase1`,
  optional key/value/id filter), still drawing through the same `render.js` so the
  SVG output can't drift from the app. Gotcha recorded: VexFlow 5 draws glyphs as
  `<text>`, not `<path>`, so check the output by counting `<text>`.
- 81 unit tests (up from 67): the expanded deck, the three option pools, the
  note/rest/clef labels, the beats helpers, and `choices` over the new pools.

### Milestone 2e — Progress view & manual deck top-up ✅
The last *feature* slice of Milestone 2: a cross-phase Progress view and an
escape hatch for the two "no new cards left" dead-ends.
- **Progress view (`Progress.svelte`, route `progress`)** — a completion bar per
  phase, read straight from each `srt:phaseN` blob (no new persistence) and
  derived against the live deck so Notation tracks the clef/range settings.
  "Mastered" everywhere means box ≥ 2 (`MASTER_BOX`), the same bar the curriculum
  uses for level completion. Basics shows one bar (symbols mastered / 17);
  Notation shows two — scale-level progression (fully-mastered levels / total,
  captioned with the current level) and note mastery (mastered / deck). Unbuilt
  phases (Chords, Key Signatures) render a locked/empty bar driven by the `PHASES`
  `ready` flag. Wired into `App.svelte`'s `views` between Key Signatures and
  Settings (order: Home · Basics · Notation · Chords · Key Signatures · Progress ·
  Settings).
- **Manual deck top-up** — two opt-in buttons in the caught-up screen:
  - *Daily-cap bypass (both phases).* A session-scoped `bypassCap` flag lifts the
    per-day new-card budget passed to `pickNext` (→ `Infinity` once toggled), so a
    user who hits the cap but still has un-introduced cards can keep learning. The
    button only shows while the pool/deck still holds un-introduced cards
    (`poolHasNew` in Notation, `deckHasNew = learned < total` in Basics); resets
    on remount.
  - *Early next-level (Notation only).* When the current level's notes are all
    introduced but not yet mastered (so the normal mastery gate hasn't opened) and
    a next level exists, a "Start [next level]" button advances early via the
    existing `advance()` path. Basics has no levels and a finite deck, so it gets
    only the cap bypass.
- **Introduction-frontier `current` (`progression.js`)** — the enabler for the
  early advance. `progress().current` now resolves to the earliest unlocked level
  with *un-introduced* cards (else the frontier), not the earliest *unmastered*
  one. In the normal flow the two coincide (`unlocked` only ever moves past a
  level once it's mastered, and a mastered level is fully introduced), so all the
  M2a tests are unchanged; but after an early advance, bumping `unlocked` past a
  fully-introduced-but-unmastered level moves both the banner *and* the new-card
  pool to the next level, while the old level's cards keep coming due as reviews.
- 83 unit tests (up from 81): two `progression.test.js` cases — the dead-end
  (current stays put, `canAdvance` false) and the early advance (current/pool move
  to the next level once it's unlocked).

### Milestone 2f — Engineering hardening & carryover bug fixes ✅
The productionization slice of Milestone 2: two carryover bugs the M2e top-up
surfaced, then robustness hardening for a public deploy. No new user-facing
features. (Caching headers deferred to M3; the PWA, music-font self-hosting and
the CDP helper to M4 — offline waits until after the first deploy.)
- **Per-batch cap, not an unlimited bypass (`Phase1.svelte`, `Phase0.svelte`).**
  The M2e "Add more" top-up set a `bypassCap` flag that fed `pickNext` an
  `Infinity` new-card budget — one click uncapped new cards for the whole session.
  Replaced with a session-scoped `extraBatches` counter; the effective budget is
  `newCardsPerDay × (1 + extraBatches)`, so each click grants exactly one more
  batch of the daily size and the setting stays a hard cap (the daily counter
  still resets at local midnight). The `newCardsPerDay` key/label were kept (the
  daily cap is still the primary meaning); the Settings helper text now notes the
  top-up draws a batch of this size.
- **New cards fan out across clefs (`music.js`).** `levelsFor` ended its per-level
  sort on `a.midi - b.midi`; since bass MIDI (43–57) all sorts below treble
  (64–77), the foundation introduced *every* bass on-staff natural before any
  treble (both clefs on by default → out of the box). Replaced the inline sort
  with `orderForIntroduction`: a deterministic clef round-robin within each
  introduction tier (`tierOf`: anchor → on-staff → ledger), ranking each card in
  its (tier, clef) group and interleaving by round number then a fixed clef order.
  Anchor-first and on-staff-before-ledger still hold across clefs; pure and stable
  across calls (no shuffle); single-clef decks unaffected.
- **Versioned, fault-tolerant persistence (`spaced-repetition.js`,
  `settings.svelte.js`).** Every blob (`srt:phase0`/`srt:phase1`, `srt:settings`)
  is stamped with a schema `version` on save. On load, a non-object/array, a blob
  from a newer app (`version` greater than current), or corrupt JSON falls back to
  defaults instead of throwing or half-reading; an unversioned legacy blob migrates
  forward with progress intact. Settings keeps `version` on disk only, out of the
  reactive object.
- **Production error boundary (`App.svelte`).** The active view is wrapped in
  Svelte 5's `<svelte:boundary>` with a "Try again" fallback, so a render throw
  (e.g. a VexFlow failure) no longer blanks the app — the header + nav stay live to
  navigate away. Wraps only the view, not the shell.
- **Performance budget — confirmed, no change.** Audit only: VexFlow stays a
  separate dynamic-`import('vexflow')` chunk (~691KB gz) loaded only when a quiz
  opens; the initial entry chunk is ~32KB gz, far under the <200KB initial-JS NFR.
  No static VexFlow import in `src`.
- 88 unit tests (up from 83): the clef round-robin interleave case, plus four
  persistence-robustness cases (version stamping, future-version and non-object
  fallback, legacy migration).

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
