# Sight Reading Trainer — Goals & Plan

> Phase 1 (Notation) is **shipped** — Milestones 0 through 1d are complete. Their
> detail and the resolved design notes live in [HISTORY.md](./HISTORY.md). This
> file is the forward-looking plan.

## Vision
A simple, low-friction web app for learning to sight-read music using spaced
repetition. Primary user: the author. Designed to be shareable, but not
multi-user.

## Non-Functional Requirements
- Works on mobile (iOS/Android), tablet (iPad), and desktop browsers
- Hosted at `sightreading.adityasule.com` (Cloudflare Workers, free tier)
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
- **Hosting**: Cloudflare Workers (static-assets-only Worker), custom domain via
  Cloudflare DNS
- **Deploy**: git push → Cloudflare auto-builds (`npm run build`) and deploys
  (`wrangler deploy`)

---

## Phases

### Phase 0 — Basics (new feature — M2)
A gentle, multiple-choice on-ramp *before* note recall. Where Phase 1 reads
*pitch* (Letters/Piano) with ledger lines, accidentals and scale progression,
Phase 0 is *symbol* recognition — durations, rests, and clefs — by multiple
choice, for the absolute beginner. Note naming is pitch reading, so it belongs
to Phase 1, not here.

**In scope**
- **Note time-value cards** ✅ (M2c) — render a single note of a given duration
  on a *clef-less* staff at a fixed position; user picks the duration name. The
  note's pitch is never shown or named (that is Phase 1). Coverage: sixteenth →
  double whole (6 values).
- **Rest time-value cards** ✅ (M2d) — render a rest glyph; user picks its
  duration name. Same 6 values.
- **Clef-symbol cards** ✅ (M2d) — render a lone clef; user identifies treble vs
  bass. (The only Basics cards that show a clef in isolation.)
- **Dotted notes** ✅ (M2d) — the common three (dotted half/quarter/eighth); a
  note card's options mix dotted + plain. Every note/rest option also shows its
  length in beats, so the symbol is tied to its duration.
- **Accidental-symbol cards** ✅ (M5i) — render a lone accidental glyph;
  user names it. The common three: sharp, flat, natural. Pure *symbol*
  recognition — the glyph names an accidental, never which pitch it alters (that
  is Phase 1). Names are universal, so the British/American setting doesn't apply.
- All answers are **multiple choice**.
- **Naming-convention setting** — British or American duration names, **default
  American** (see the table in Design Notes). Affects duration + rest cards only
  (accidental names are universal).
- Reuses the generic Leitner scheduler. Route id `phase0`, storage `srt:phase0`,
  user-facing name **Basics**.

**Out of scope (Phase 0)**
- Pitch reading / note naming (incl. *which* note an accidental alters), tied
  durations, time signatures, and recall/typed input (all Phase 1 or later).
  Accidental *symbol* naming is in scope (above); accidentals-as-pitch is Phase 1.

### Phase 1 — Single notes, treble & bass clef ✅ shipped
Single-note reading on both clefs, naturals + accidentals, Letters/Piano answer
modes, configurable range, Leitner SR, and scale-based curriculum progression.
Full scope and design in [HISTORY.md](./HISTORY.md).

### Phase 2 — Major / minor triads (next feature — M5)
**In scope**
- Render a 3-note major or minor triad on a single staff, in a **randomised
  voicing** each showing — root position + 1st/2nd inversion, at a varied
  register (bounded to ~2–3 ledger lines of the staff)
- User identifies **root + quality** (e.g. "C major", "A minor") by **multiple
  choice** — the chord is recognised regardless of how it's voiced/inverted
- Coverage: every circle-of-fifths key's tonic-major + relative-minor triad
  (11 levels), **introduced in circle-of-fifths order**, paired into levels like
  the Notation scale curriculum
- Render on the enabled clefs (reuses the treble/bass setting); a card per
  `(clef, root, quality)`, voicing chosen at render time
- Spaced repetition per chord card; circle-of-fifths progression with the same
  gate as Notation (reuses the generic scheduler + the now curriculum-pluggable
  `progression.js`)

**Out of scope (Phase 2)**
- Naming the inversion (inversions are shown for recognition, not quizzed)
- 7th chords or extensions
- Diminished / augmented qualities
- Chords spanning both clefs
- Diatonic triads within a key (see Future ideas)

### Phase 3 — Key signature recognition ✅ shipped
**In scope**
- Render a key signature (sharps or flats) on a clef
- User identifies the major key
- Full 15-key coverage (7♯ to 7♭ plus C), introduced in circle-of-fifths order
- Spaced repetition per key signature card

**Out of scope (Phase 3)**
- Relative minor identification
- Modes
- Atonal / non-Western signatures

### Interval training ✅ shipped (route id `phase4`, user-facing **Intervals**)
**In scope**
- Render two notes a fixed interval apart on a clef, drawn left→right so the pair
  reads ascending or descending; the user names the interval by multiple choice
- Coverage: the 12 simple intervals within an octave — minor/major 2nd·3rd·6th·7th,
  perfect 4th/5th/octave, and the tritone — introduced by difficulty/consonance
  (perfects → thirds/sixths → seconds/sevenths → tritone last)
- Render on the enabled clefs (reuses the treble/bass setting); a card per
  `(clef, interval)`, the note pair (register + direction) chosen at render time
- Spaced repetition per interval card; difficulty-gated progression (reuses the
  generic scheduler + the curriculum-pluggable `progression.js`)

**Out of scope (Intervals)**
- Compound intervals (beyond an octave) and the unison
- Quality of the tritone beyond a single "tritone" answer (aug 4th / dim 5th)
- Naming the two notes, or grading the direction (direction is shown, not quizzed)
- Audio / ear-training (a Future idea — this is purely visual reading)

### Out of scope for v1 entirely
- User accounts, cloud sync, leaderboards
- Audio / ear training
- Rhythm training
- Sheet music import or composition
- Server-side anything

---

## Design Notes
Reusable conventions for Phase 2/3. Phase-1-specific design (the full SR rules
and scale-progression curriculum) is recorded in [HISTORY.md](./HISTORY.md).

### Spaced repetition (reused across phases)
- Leitner box variant, 5 boxes; intervals 1d/3d/7d/14d/30d. Correct → advance a
  box, incorrect → back to box 1. New cards capped by a per-day budget that
  resets at local midnight.
- The SR module (`spaced-repetition.js`) is **generic and card-agnostic** — it
  knows nothing about notes, chords, or "levels". Keep it that way so each phase
  reuses it and the documented SM-2 swap stays a local change.
- State is one JSON blob in `localStorage` per phase (`srt:phase1`, …).

### UI
- Single-page app, view-switching driven by simple state (no router lib in v1).
- Views: Home/Today, Basics, Notation, Chords, Key Signatures, Intervals,
  Progress, Settings.
- **User-facing names vs. internal ids.** "Phase 0/1/2/3" is developer shorthand
  and must never appear in the UI. The user sees musical names; the code keeps
  the short route ids (single source of truth in `src/lib/phases.js`):
  - Phase 0 → **Basics** (route id `phase0`, storage key `srt:phase0`)
  - Phase 1 → **Notation** (route id `phase1`, storage key `srt:phase1`)
  - Phase 2 → **Chords** (route id `phase2`)
  - Phase 3 → **Key Signatures** (route id `phase3`)
  - **Intervals** (route id `phase4`, storage key `srt:phase4`) — a 5th quiz; the
    "Phase N" numbering stopped at 3, so this carries only its route id, not a
    "Phase 4" label
- Navigation: side nav on wide screens (≥760px); a hamburger-driven off-canvas
  drawer on narrow screens (the bottom tab bar tested poorly on mobile).
- Letter input via on-screen A–G buttons (touch-friendly, min 44px targets);
  hardware keyboard A–G also accepted on desktop.
- Dark mode via `prefers-color-scheme` + a manual theme toggle.

### Music rendering
- VexFlow renders to SVG. Minimal — no time signatures, no measure bars.
- Single staff: one note (Phase 1), 3 stacked notes (Phase 2), a clef-borne key
  signature (Phase 3), or two side-by-side notes (Intervals).
- Phase 0 also renders, in isolation: a single clef-less note of a given
  duration (note time-value cards), a rest glyph (rest time-value cards), a
  lone clef (clef-symbol cards), and a lone accidental glyph (accidental cards,
  drawn via a notehead-less `GlyphNote`).
- **Music font:** the app dynamic-imports the **font-bundled `vexflow/bravura`**
  build (Bravura + Academico embedded as data URIs), so no glyph asset is fetched
  from a CDN at runtime — works offline, and removes the M1c first-paint race at
  its root (M5e). Gate the first render on `document.fonts.load("1em 'Bravura'")`
  (+ Academico), **not** `VexFlow.loadFonts(...)` — the latter would re-fetch the
  font from the CDN the bundled build exists to avoid.

### Phase 0 — Basics (design)
- **Answer input:** a reusable multiple-choice component (4 options, one
  correct), distinct from the Phase 1 Letters/Piano pads. Touch-friendly, 44px
  targets, keyboard-selectable on desktop.
- **Card types** share one `srt:phase0` deck through the generic scheduler:
  note-duration (M2c), rest-duration, clef-symbol, accidental-symbol. Each card
  carries its `type` so the renderer and the option set can branch.
- **Clef-less, fixed-position rendering** for duration/rest/accidental cards: the
  glyph sits at a fixed staff position with no clef drawn, since pitch is
  irrelevant here and clef symbols aren't introduced until the clef-symbol cards.
- **Duration naming** honours the British/American setting (default American):

  | American          | British      |
  |-------------------|--------------|
  | double whole note | breve        |
  | whole note        | semibreve    |
  | half note         | minim        |
  | quarter note      | crotchet     |
  | eighth note       | quaver       |
  | sixteenth note    | semiquaver   |

  Rests use the same names with "rest" appended. The setting changes both the
  prompt copy and the multiple-choice option labels; it does not change which
  cards exist or how they're scheduled.

### Middle C anchor (cluster-first)
"Start at the very beginning with middle C" reinforces middle C as the reading
reference. Middle C is a *ledger* note on both clefs, which would normally be
deferred by the on-staff-first ordering — so it is an explicit exception. In
Phase 1's foundation level, middle C plus its immediate on-staff neighbours (the
B3/D4 region) are introduced as the **first small cluster**, overriding
on-staff-first for that cluster only; the rest of the on-staff naturals follow,
then ledger lines as before. (Phase 0 has no note-name cards, so the anchor is a
Phase 1 concept only.)

### Progress view
A dedicated nav view (route id `progress`) showing progress across every phase,
read from each phase's `srt:phaseN` blob (no new persistence). A completion bar
per phase, except the curriculum phases (Notation, Chords, Key Signatures,
Intervals) show **two** bars — level progression + individual-card mastery —
since each carries both dimensions. Basics shows one (a flat deck). All phases
are now built; an unbuilt phase would render a locked/empty bar (driven by the
`PHASES` `ready` flag).

### Cost & rate-limit safeguards
- No backend in v1 — primary defense. No third-party APIs called at runtime.
- Cloudflare Pages free tier (500 builds/mo, generous bandwidth) is far beyond
  expected usage.
- If a backend is ever added: enforce a hard daily quota (e.g. Cloudflare Worker
  + KV counter returning 429 above N requests/day) before exposing it publicly.

---

## Productionization Plan

> ✅ **Milestones 0 – 6 complete** — Phase 1 (Notation), Phase 0 (Basics),
> Phase 2 (Chords), Phase 3 (Key Signatures) and Interval training shipped, plus
> the progress view, productionization hardening, the OSS publish prep, the first
> production deploy (Cloudflare Workers, live at `sightreading.adityasule.com`),
> the music-font self-hosting, the contrast a11y fix, and the committed CDP dev
> helper. See [HISTORY.md](./HISTORY.md).

### Milestone 2 — Basics phase, progress view, polish & productionization ✅ complete
Adds the new user-facing features (Phase 0, progress view, middle-C anchor) and
the engineering hardening to ship publicly. Sequenced **feature / bugfix /
cleanup first, productionization last**, in small submilestones.

**M2a — Test harness + code review & simplify** ✅ shipped — see HISTORY.md.

**M2b — Middle C anchor (cluster-first)** ✅ shipped — see HISTORY.md.

**M2c — Basics phase scaffold + note time-value cards** ✅ shipped — see HISTORY.md.

**M2d — Basics phase: rests, clef cards & dotted notes** ✅ shipped — see HISTORY.md.

**M2e — Progress view & manual deck top-up** ✅ shipped — see HISTORY.md.

**M2f — Engineering hardening & carryover bug fixes** ✅ shipped — see HISTORY.md.

### Milestone 3 — Publish as OSS ✅ complete
Shipped — see [HISTORY.md](./HISTORY.md). MIT license added (year/owner line),
the README's machine-specific hostname/IP scrubbed to placeholders, and a
secrets/history audit confirmed the static app ships and tracks none. Git
identity (`Aditya Sule <me@adityasule.com>`, a public domain alias) kept as the
intended publish identity — no history rewrite.

### Milestone 4 — First production deploy ✅ complete
Shipped — see [HISTORY.md](./HISTORY.md). Deployed to **Cloudflare Workers**
(static-assets-only Worker, not Pages — auto-configured by Cloudflare's git
integration) at `sightreading.adityasule.com`; `public/_headers` cache rules live
(immutable hashed assets, `no-cache` HTML); HTTPS + HTTP/3; Lighthouse 100 / 94 /
100 / 91 (perf / a11y / best-practices / SEO), all above the >90 target. A
`robots.txt` was added to clear the lone SEO flag; the Home-view color-contrast
a11y flag is carried to M5.

### Milestone 5 — Phase 2 (chords) + carried-over tasks ✅ complete
Phase 2 (Chords) shipped, plus the carried-over M2 tasks (music-font
self-hosting, the contrast a11y fix, the committed CDP dev helper) and a Basics
polish pass (American default + accidental cards). Sequenced feature-first,
productionization last (the M2 precedent). See [HISTORY.md](./HISTORY.md).

**M5a — Chord engine** ✅ shipped — see HISTORY.md.

**M5b — Chord rendering** ✅ shipped — see HISTORY.md.

**M5c — Dev card gallery** ✅ shipped — see HISTORY.md.

**M5d — Chords quiz view** ✅ shipped — see HISTORY.md.

**M5e — Self-host the music font** ✅ shipped — see HISTORY.md.

**M5f — Accessibility: fix Home-view contrast** ✅ shipped — see HISTORY.md.

**M5h — Dev tooling: committed CDP helper** ✅ shipped — see HISTORY.md.

**M5i — Basics: American default + accidental cards** ✅ shipped — see HISTORY.md.

*(M5g — PWA — moved to Milestone 7; its M5e prerequisite is now satisfied.)*

### Milestone 6 — Phase 3 (key signatures) + interval training ✅ complete
Phase 3 (Key Signatures) and a new Intervals quiz shipped, both built on the
Phase 0–2 shell (the card-agnostic Leitner scheduler + the pluggable
`progression.js`, the `Choices` pad, the shared `render.js`) — each is just an
engine module + a view + a render fn + wiring, the Chords (M5a–d) precedent. See
[HISTORY.md](./HISTORY.md).

**M6a — Key signatures quiz (Phase 3)** ✅ shipped — see HISTORY.md.

**M6b — Interval training** ✅ shipped — see HISTORY.md.

### Milestone 7 — Refinement
A polish/refinement pass: a richer Progress (stats) view backed by new
per-card analytics, state export/import, an attribution footer, the PWA, and a
docs cleanup. Sequenced **feature/enabler first, productionization last** (the
M2/M5 precedent): the analytics enabler unblocks the Progress stats redesign, then
export/import, footer, PWA, and the docs close-out.

**M7a — Per-card stats instrumentation (enabler) ✅ shipped.** The behaviour page
(M7b) needs per-card accuracy and time-to-answer, neither of which is captured today:
the SR state per card is only `{ box, dueAt }`, and `history` is a per-day
aggregate. This slice adds the data:
- Extend each card's state with **compact running aggregates** — `seen`,
  `correct`, and total answer `timeMs` (average = total ÷ count, so no per-answer
  event log; keep it small per the in-memory-efficiency NFR).
- Capture elapsed time (card shown → answer) in all five quiz views and thread it
  through the one choke point, `recordAnswer(state, id, correct, elapsedMs)` —
  the scheduler stays card-agnostic; views just time their own `showCard`→`answer`.
- Per-phase aggregate helpers (average accuracy, average time) for M7b's general
  metrics, derived from the per-card aggregates.
- Bump `STATE_VERSION` with a forward migration (existing cards default the new
  fields to 0/absent — go-forward only, no backfill). Unit tests.

**M7b — Progress stats redesign + Cards merge ✅ shipped.** Reworked the Progress
view to surface the M7a per-card aggregates (nav tab stays "Progress"):
- **Overview** keeps the per-phase progress bars and adds an **app-wide metrics
  band** — **average accuracy** and **average time to answer** summed from each
  phase's raw totals (so the figure weights by answer volume, not by averaging the
  five per-phase percentages). New `rawTotals`/`statsFromTotals` in
  `spaced-repetition.js`, with `aggregateStats` refactored onto them.
- **Drill-down**: clicking a phase card opens a detail view of **every possible
  card** in it; each shows whether it's been **introduced to the deck**, its
  **average accuracy** and **average time to answer**, as a **glyph + stats grid**
  (un-introduced cards dimmed), plus the phase aggregate and a **Practice** jump.
  Each card's real staff glyph draws via the shared `render.js`.
- **Shared render harness** — the dev gallery's VexFlow boot + draw dispatch moved
  to `src/lib/cardRender.js` (`loadVex`, the `staff` action, representative
  voicing/interval pickers, `drawForCard`), so the production drill-down and the
  dev **Cards (dev)** gallery draw through the *same* path (output can't drift).
  VexFlow boots lazily on the first drill-down. The dev gallery stays
  `import.meta.env.DEV`-gated for raw render iteration (still useful, never shipped).

**M7c — Export / import state + state-efficiency audit ✅ shipped.** The opt-in
export/import escape hatch GOALS reserved for cross-device transfer, plus the
history-growth audit:
- **Export / import** (`src/lib/transfer.js`): `buildExport` bundles all `srt:*`
  keys (five phases + settings + theme) into one versioned JSON file (Blob +
  anchor; no backend; emits only re-importable plain-object blobs);
  `parseAndValidate` rejects bad JSON, app/version mismatches and per-blob
  future-versions **atomically** (the M2f load-defence); `applyImport` *replaces*
  this device's managed keys (a clean replace, not a stale merge); the Settings
  view confirms then reloads. 64 transfer unit tests — incl. a full round-trip,
  idempotency, atomicity, and prototype-pollution.
- **Efficiency audit (NFR)**: the unbounded per-day `history` map now prunes to a
  90-day window, folding older days into a `lifetime: { seen, correct }` roll-up
  so lifetime accuracy stays exact (the streak display caps at the window).
  `STATE_VERSION` 2→3, go-forward (no backfill). The M7a per-card aggregates were
  confirmed compact (five numbers/card, bounded by deck size, not answer count).

**M7d — Attribution footer ✅ shipped.** A copyright/license footer in the app
shell (`© 2026 Aditya Sule · MIT License`) with a **GitHub** link
(`github.com/adityasule/sightreading`) and a **LinkedIn** link
(`https://www.linkedin.com/in/aditya-sule/`).

**M7e — PWA (manifest + service worker + icons)** *(was M5g; nice-to-have per
NFRs, not blocking).* Offline-capable install:
- **`vite-plugin-pwa` (Workbox)** generates a **versioned** service worker +
  precache manifest from the build (handles hashed asset names), precaching the
  app shell and the lazy `vexflow-bravura` chunk. A dev-only build dependency —
  no runtime third-party call, so the no-backend constraint holds. Its
  prerequisite (no runtime CDN font fetch) is satisfied by M5e, so offline is
  genuinely offline.
- Add **app icons** (none exist today) — at least 192/512 + maskable — and the
  web app manifest (name, theme/background colors matching the existing
  `theme-color`, display `standalone`).
- Keep the worker conservative about staleness (**network-first for the HTML** /
  versioned precache) so a deploy is never pinned by a stale cached worker; add
  the SW path to `public/_headers` with `no-cache` (the header file already notes
  this).

**M7f — Docs cleanup & simplification.** The close-out: collapse the already-
shipped Phase 2/3/Intervals in-scope detail in this file to one-liners pointing
at HISTORY (the detail now lives there), simplify the README/CLAUDE overlaps, and
correct stale notes. Per the workflow, move M7's own detail here → HISTORY once it
ships.

### Future ideas (not committed)
- Audio playback of the rendered note (Web Audio API — free, client-side)
- Optional MIDI input (Web MIDI API)
- Relative-minor identification in Phase 3
- Diatonic triads within a key (Phase 2 extension — the I/ii/iii/IV/V/vi triads
  per key, teaching chords-in-context rather than isolated triad recognition)

---

## Open Questions
- **VexFlow version pin**: pinned to `^5.0.0` for now; revisit on each minor bump.

### Resolved (2026-06-03, Milestone 4)
- **Subdomain vs path** → **subdomain**: deployed at `sightreading.adityasule.com`
  (cleaner to retire/rebuild independently than a path on the apex).
- **Hosting platform** → **Cloudflare Workers** (static-assets-only Worker), not
  Pages: Cloudflare's git integration auto-configured the Workers path
  (`@cloudflare/vite-plugin` + `wrangler.jsonc`). Still no backend — assets-only,
  no server code.

### Resolved (2026-06-02, Milestone 2 planning)
- **Phase 0 name** → **Basics** (route id `phase0`, storage `srt:phase0`).
- **"Phase 2 progress bars for scales/notes"** → meant the **Notation** phase;
  it gets two bars (scale-level progression + note mastery).
- **Testing** → add **Vitest** for the pure-logic modules only (M2a); UI stays
  manual-verify. Dev-only, so the no-backend constraint is untouched.
- **Middle C** → **anchor cluster first**: middle C + immediate on-staff
  neighbours introduce before the rest of the on-staff naturals, in Phase 1's
  foundation (see the 2026-06-03 pivot below — this is Phase 1 only).
- **80 cards (not 88)** → the deck is notes within ±`ledgerLines` of each staff
  per enabled clef, with 2 spellings per black key — not the 88-key board. 80 is
  the default-range total; it scales with the range setting.
- **Same pitch on two clefs** → kept as distinct cards (`treble:60` vs
  `bass:60`) — different visual skill; level completion already treats the pitch
  class as one skill across clefs.

### Resolved (2026-06-03, M2c)
- **Phase 0 = symbol recognition, not note naming** → dropped the planned
  note-name cards. Reading pitch is Phase 1's job; Basics teaches the *vocabulary*
  of notation — durations (M2c), then rests / clefs / dotted notes (M2d). Duration
  cards render on a clef-less staff at a fixed position (pitch hidden, never
  named). The middle-C anchor is therefore a Phase 1 concept only.
