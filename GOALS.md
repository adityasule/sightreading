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

### Phase 1 — Single notes, treble & bass clef ✅ shipped
Single-note reading on both clefs, naturals + accidentals, Letters/Piano answer
modes, configurable range, Leitner SR, and scale-based curriculum progression.
Full scope and design in [HISTORY.md](./HISTORY.md).

### Phase 2 — Major / minor triads (next feature — M4)
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

### Phase 3 — Key signature recognition (M5)
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
- Views: Home/Today, Notation, Chords, Key Signatures, Settings.
- **User-facing names vs. internal ids.** "Phase 1/2/3" is developer shorthand
  and must never appear in the UI. The user sees musical names; the code keeps
  the short route ids (single source of truth in `src/lib/phases.js`):
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
- **Font race:** await `VexFlow.loadFonts('Bravura', 'Academico')` before the
  first render, or glyph metrics are wrong on first paint (see M1c in HISTORY).

### Cost & rate-limit safeguards
- No backend in v1 — primary defense. No third-party APIs called at runtime.
- Cloudflare Pages free tier (500 builds/mo, generous bandwidth) is far beyond
  expected usage.
- If a backend is ever added: enforce a hard daily quota (e.g. Cloudflare Worker
  + KV counter returning 429 above N requests/day) before exposing it publicly.

---

## Productionization Plan

> ✅ **Milestones 0 – 1d complete** (Phase 1 / Notation shipped). See
> [HISTORY.md](./HISTORY.md).

### Milestone 2 — Engineering polish, PWA & productionization
Purely engineering-side hardening; no new user-facing features.
- Web app manifest + service worker for offline use (PWA)
- Performance budget verification against the NFRs (<200KB initial JS, <1s TTI
  on 4G) — code-split audit, confirm VexFlow stays lazy-loaded
- Asset/build optimization (caching headers, hashing) and a production error
  boundary so a render failure never blanks the app
- localStorage robustness — versioned state blob + safe migration/fallback
- **Publish to GitHub as a public open-source repo:**
  - *Licensing* — add an OSS license (e.g. MIT) + the year/owner line
  - *Privacy* — audit the repo so it leaks no personal developer info beyond
    what GitHub inherently exposes: scrub author name/email in commit history
    and config as desired, the README's machine-specific hostnames/IPs, the
    `.idea/` and any local paths, and `userEmail`-type data
  - *Secrets* — ensure no production secrets are committed or in history;
    confirm `.gitignore` covers env/secret files and that the static app
    genuinely ships none (consistent with the no-backend architecture)

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
- Relative-minor identification in Phase 3

---

## Open Questions
- **Subdomain vs path**: `sightread.adityasule.com` vs `adityasule.com/sightread`?
  Recommendation: subdomain — cleaner separation from anything else hosted on
  the apex, easier to rebuild or retire independently.
- **VexFlow version pin**: pinned to `^5.0.0` for now; revisit on each minor bump.
