# Sight Reading Trainer — Goals & Plan

> **All planned phases are shipped** (Milestones 0–7). This file holds the enduring
> vision, requirements, architecture decision, and scope; the per-milestone build
> record and resolved design detail live in [HISTORY.md](./HISTORY.md).

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

Every phase below is **shipped**; full per-phase scope and design are in
[HISTORY.md](./HISTORY.md). They share one shell — the card-agnostic Leitner
scheduler, the pluggable `progression.js`, the `Choices` pad, and the shared
`render.js`.

### Phase 0 — Basics ✅ shipped
A multiple-choice on-ramp *before* pitch reading: *symbol* recognition — note &
rest time-values, clefs, and accidental glyphs (British/American naming, default
American). Not pitch reading or note naming — that's Notation.

### Phase 1 — Notation ✅ shipped
Single-note reading on both clefs, naturals + accidentals, Letters/Piano answer
modes, configurable range, Leitner SR, and scale-based curriculum progression.

### Phase 2 — Chords ✅ shipped
Recognise a major/minor triad — root + quality — from a randomised voicing
(inversion + register), by multiple choice; circle-of-fifths curriculum.

### Phase 3 — Key Signatures ✅ shipped
Name the major key from its signature; all 15 keys (7♯ to 7♭ plus C) in
circle-of-fifths order.

### Intervals ✅ shipped (route id `phase4`)
Name the interval between two notes — the 12 simple intervals within an octave —
introduced by difficulty/consonance.

### Out of scope for v1 entirely
- User accounts, cloud sync, leaderboards
- Audio / ear training
- Rhythm training
- Sheet music import or composition
- Server-side anything

---

## Design Notes
The conventions every phase shares. Phase-specific design and the full SR /
scale-progression rules are recorded in [HISTORY.md](./HISTORY.md).

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
- The free Cloudflare Workers tier (static assets, generous request + bandwidth
  limits) is far beyond this app's expected usage.
- If a backend is ever added: enforce a hard daily quota (e.g. Cloudflare Worker
  + KV counter returning 429 above N requests/day) before exposing it publicly.

---

## Build status

All milestones are shipped — **0–7**: Phases 0–4, the Progress view (with per-card
analytics), state export/import, the attribution footer, productionization
hardening, the OSS publish, the production deploy (Cloudflare Workers, live at
`sightreading.adityasule.com`), the self-hosted music font, and the PWA. The
per-milestone record and resolved design decisions live in [HISTORY.md](./HISTORY.md).

## Future ideas (not committed)
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
