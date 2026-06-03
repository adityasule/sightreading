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
- All answers are **multiple choice**.
- **Naming-convention setting** — British or American duration names, **default
  British** (see the table in Design Notes). Affects duration + rest cards only.
- Reuses the generic Leitner scheduler. Route id `phase0`, storage `srt:phase0`,
  user-facing name **Basics**.

**Out of scope (Phase 0)**
- Pitch reading / note naming, accidentals, tied durations, time signatures, and
  recall/typed input (all Phase 1 or later).

### Phase 1 — Single notes, treble & bass clef ✅ shipped
Single-note reading on both clefs, naturals + accidentals, Letters/Piano answer
modes, configurable range, Leitner SR, and scale-based curriculum progression.
Full scope and design in [HISTORY.md](./HISTORY.md).

### Phase 2 — Major / minor triads (next feature — M5)
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

### Phase 3 — Key signature recognition (M6)
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
- Views: Home/Today, Basics, Notation, Chords, Key Signatures, Progress, Settings.
- **User-facing names vs. internal ids.** "Phase 0/1/2/3" is developer shorthand
  and must never appear in the UI. The user sees musical names; the code keeps
  the short route ids (single source of truth in `src/lib/phases.js`):
  - Phase 0 → **Basics** (route id `phase0`, storage key `srt:phase0`)
  - Phase 1 → **Notation** (route id `phase1`, storage key `srt:phase1`)
  - Phase 2 → **Chords** (route id `phase2`)
  - Phase 3 → **Key Signatures** (route id `phase3`)
- Navigation: side nav on wide screens (≥760px); a hamburger-driven off-canvas
  drawer on narrow screens (the bottom tab bar tested poorly on mobile).
- Letter input via on-screen A–G buttons (touch-friendly, min 44px targets);
  hardware keyboard A–G also accepted on desktop.
- Dark mode via `prefers-color-scheme` + a manual theme toggle.

### Music rendering
- VexFlow renders to SVG. Minimal — no time signatures, no measure bars.
- Single staff: one note (Phase 1) or 3 stacked notes (Phase 2).
- Phase 0 also renders, in isolation: a single clef-less note of a given
  duration (note time-value cards), a rest glyph (rest time-value cards), and a
  lone clef (clef-symbol cards).
- **Font race:** await `VexFlow.loadFonts('Bravura', 'Academico')` before the
  first render, or glyph metrics are wrong on first paint (see M1c in HISTORY).

### Phase 0 — Basics (design)
- **Answer input:** a reusable multiple-choice component (4 options, one
  correct), distinct from the Phase 1 Letters/Piano pads. Touch-friendly, 44px
  targets, keyboard-selectable on desktop.
- **Card types** share one `srt:phase0` deck through the generic scheduler:
  note-duration (M2c), rest-duration, clef-symbol. Each card carries its `type`
  so the renderer and the option set can branch.
- **Clef-less, fixed-position rendering** for duration/rest cards: the glyph
  sits at a fixed staff position with no clef drawn, since pitch is irrelevant
  here and clef symbols aren't introduced until the clef-symbol cards.
- **Duration naming** honours the British/American setting (default British):

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
per phase. The **Notation** phase shows **two** bars — scale-level progression
and individual-note mastery — since it carries both dimensions. Phases not yet
built (Chords, Key Signatures) show as locked/empty; Chords gains its own bar
split when it ships in M5.

### Cost & rate-limit safeguards
- No backend in v1 — primary defense. No third-party APIs called at runtime.
- Cloudflare Pages free tier (500 builds/mo, generous bandwidth) is far beyond
  expected usage.
- If a backend is ever added: enforce a hard daily quota (e.g. Cloudflare Worker
  + KV counter returning 429 above N requests/day) before exposing it publicly.

---

## Productionization Plan

> ✅ **Milestones 0 – 3 complete** — Phase 1 (Notation) and Phase 0 (Basics)
> shipped, plus the progress view, productionization hardening, and the OSS
> publish prep (license, privacy scrub, secrets audit). See
> [HISTORY.md](./HISTORY.md).

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

### Milestone 4 — First production deploy
- Create Cloudflare Pages project, connect to git
- Configure custom domain (see Open Questions)
- **Cache headers** via a Cloudflare Pages `_headers` file — long-lived immutable
  caching for Vite's content-hashed assets, `no-cache` for `index.html` so deploys
  propagate (extend the `no-cache` rule to the service worker once M5's PWA ships).
  *Moved here from M2f: the headers can only be set and verified once the Pages
  project serves the site.*
- Verify HTTPS, run Lighthouse, ensure score >90 across the board

### Milestone 5 — Phase 2 (chords) + carried-over tasks
- **Phase 2 (chords)** — the feature; full scope under Phases → Phase 2 above.
- **Self-host the music font** *(moved from M2f; offline prerequisite).* The app
  dynamic-imports the default `vexflow` build, which fetches the Bravura music font
  from a third-party CDN mid-render (root cause of the M1c first-paint bug) — a
  runtime third-party call at odds with the no-runtime-API constraint, *and* the
  reason note rendering breaks offline (the `loadFonts` catch blocks in
  `Phase0.svelte`/`Phase1.svelte` already degrade to wrong glyph metrics when the
  fetch fails). Switch to the font-bundled build (`vexflow/bravura`, which
  `scripts/render.mjs` already uses) or self-host the woff2, so no glyph asset is
  fetched at runtime. The font weight lands in the already-lazy VexFlow chunk, not
  the initial bundle, so the <200KB initial-JS budget is unaffected. Until this
  lands the deployed app fetches the font from a CDN (fine online, broken offline)
  — acceptable through M4, since offline isn't considered until after the first
  deploy. **Prerequisite for the PWA task below.**
- **PWA (manifest + service worker)** *(moved from M2f; nice-to-have per NFRs, not
  blocking).* Web app manifest + a service worker that precaches the app shell and
  the lazy VexFlow chunk for offline use. Relies on the font self-hosting task
  above (no runtime CDN fetch), so offline is genuinely offline by the time this
  lands. Keep the worker conservative about staleness (versioned precache or
  network-first for the HTML) so a deploy is never pinned by a stale cached worker.
- **Dev tooling — committed CDP helper** *(moved from M2f; independent of feature
  work).* Promote the throwaway headless-Chrome / CDP script used to smoke-test M2e
  into a small, committed dev-only helper (e.g. `scripts/drive.mjs`, beside the
  `render` script): a reusable connect → seed `localStorage` → click-by-text →
  screenshot / eval API over the installed Chrome. No new heavyweight deps (Node's
  global `WebSocket`); the browser stays the source of truth for UI checks.
  (Considered Playwright — rejected the browser-binary weight + a standing e2e
  suite as a mismatch with the project's "verify manually, no UI tests" stance;
  revisit `playwright-core` only if a regression suite is later wanted.)

### Milestone 6 — Phase 3 (key signatures)

### Future ideas (not committed)
- Audio playback of the rendered note (Web Audio API — free, client-side)
- Optional MIDI input (Web MIDI API)
- Progress export/import as JSON
- Relative-minor identification in Phase 3

---

## Open Questions
- **Subdomain vs path**: `sightread.adityasule.com` vs `adityasule.com/sightread`?
  Recommendation: subdomain — cleaner separation from anything else hosted on
  the apex, easier to rebuild or retire independently.
- **VexFlow version pin**: pinned to `^5.0.0` for now; revisit on each minor bump.

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
