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
- Render one note at a time on either clef — naturals and accidentals
  (sharps/flats). Each black key appears as two cards (e.g. C♯ and D♭), since
  they read differently on the staff; graded by spelling in Letters mode and
  by key (pitch class) in Piano mode.
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
- Naturals + accidentals, generated per clef from a configurable range:
  N ledger lines above and below each staff (Settings → Note range, default
  N=2, allowed 0–4). Lives in `src/lib/music.js`. Each in-range black key
  contributes two cards (sharp and flat spelling). At the default N=2 the
  treble spans A3–C6 and the bass C2–E4 (~80 cards with both clefs).

**Out of scope (Phase 1)**
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
- **In-session re-test of misses.** ✅ Implemented as a session-only
  relearning queue in `Phase1.svelte` (`RELEARN_GAP = 3`): a missed card still
  drops to box 0 in the persistent scheduler, but also re-appears after 3 other
  cards within the session. The re-test is reinforcement only — it doesn't call
  `recordAnswer` again or count toward first-attempt session accuracy. The SR
  module itself is unchanged. Future tuning: make the gap configurable, or gate
  the box-0 scheduling behind passing the relearning step (true learning steps).
- **Algorithm.** If Leitner feels too coarse, swap in SM-2 (Anki's). The SR
  module is behind a small interface, so the swap stays local.

### Learning progression — scale-based note introduction (planned, M1d)
Today new cards are introduced in raw deck (MIDI) order, which is arbitrary and
not very musical. Instead, introduce notes **grouped by scale**, mastering one
level before unlocking the next.

**Scope (decided):** major and natural-minor scales only. Other modes (harmonic
/ melodic minor, church modes, exotic scales) are explicitly out of scope until
every feature in this plan ships — see Future ideas.

**Order — circle of fifths, alternating outward from C.** Each step adds the
fewest possible new accidentals, which is the natural difficulty gradient for a
reader. Because a natural minor shares its *relative* major's key signature (and
exact note set), the two pair onto one level for free:

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
key (F♯ at G major, G♭ at D♭ major), which is the correct reading context and
maps cleanly onto the existing two-cards-per-black-key deck. Keys past 5♯/5♭
(6♯, 7♭, …) only add enharmonic naturals (E♯, C♭, …) that aren't in the deck,
so the sequence stops at 11 levels. Note "C minor" lands at level 7 as the
relative of E♭ major — stepping straight from C major to *parallel* C minor
would jump to 3 flats and break the gradient, so the circle-of-fifths rule wins.

**Scale model.** A scale's group is its full note set within the current range
and enabled clefs (e.g. G major = F♯ G A B C D E). Scales overlap heavily; a
card is introduced once and is then shared. In practice, advancing a level means
mastering the one new accidental that level adds, since the rest is inherited.

**Minor scales (decided): paired, not separate.** Each level is one gate
labeled "X major / Y minor". The relative minor adds no new cards to read, so it
gets no separate gate — it rides along as a second name on the same level.

**Foundation split (decided): C major splits by register.** The naturals
foundation is large (~30+ cards), so it's two sub-levels: **on-staff naturals
first** (notes between the staff's outer lines), then **ledger-line naturals**
(everything above/below). Ledger lines are the genuinely hard part, so this
gives quicker early wins on a solid base. Within every level, introduction is
ordered on-staff before ledger; only the foundation is large enough to warrant a
checkpoint *between* its two sub-levels — accidental levels (~6–8 cards) unlock
as a single step.

**Completion bar (decided): box ≥ 2 ("reviewed twice").** A level is complete
when every card in it (in range, enabled clefs) has reached Leitner box 2 — i.e.
answered correctly on two separate reviews. Implication: since a card goes to a
1-day interval after its first correct answer, box 2 requires a next-day review,
so each level spans ≥2 calendar days. This is intended — it makes the curriculum
a multi-week drip rather than a single-session blitz.

**Progression gate.** When the current level is complete, *ask the user if
they're ready* before unlocking the next — an explicit "Start [next level]?"
prompt (shown inline in the quiz and reflected on Home), never an automatic
jump. One level at a time, no skipping ahead.

**Progression is global across clefs (decided).** A pitch class is the same
reading skill on either clef, so a level is judged complete across all enabled
clefs at once; the level is one unit, not per-clef.

**Mechanics & edge cases (defaults — flag if any should change):**
- The scheduler introduces new cards only from the current level (still capped
  by the daily new-card budget); reviews of already-learned cards continue
  normally regardless of level.
- The scale sequence + the user's current level persist alongside SR state.
- *Settings change mid-progression:* completion is always evaluated against the
  live deck, so enabling a clef or widening the range can re-open a previously
  complete level when new in-range cards appear. Self-correcting; no special
  handling.
- *"Keep practicing" (caught-up state):* draws only from already-introduced
  (unlocked) cards, never from notes the user hasn't reached yet.
- *Migrating existing progress:* cards introduced before M1d (in MIDI order) are
  mapped to their level on load; the current level is the furthest one fully at
  box ≥ 2, else the first incomplete level.

### UI
- Single-page app, view-switching driven by simple state (no router lib in v1)
- Four views: Home/Today, Notation, Chords, Key Signatures, Settings
- **User-facing names vs. internal ids.** "Phase 1/2/3" is developer shorthand
  and must never appear in the UI. The user sees musical names; the code keeps
  the short route ids. Mapping:
  - Phase 1 → **Notation** (route id `phase1`, storage key `srt:phase1`)
  - Phase 2 → **Chords** (route id `phase2`)
  - Phase 3 → **Key Signatures** (route id `phase3`)
- Navigation: **side nav on wide screens; a hamburger menu on narrow screens**
  (the bottom tab bar tested poorly on mobile — it was distracting and got in
  the way of the answer pad). The hamburger opens an overlay/drawer and stays
  out of the way until summoned.
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

### Milestone 1b — Phase 1 depth ✅ complete
- Accidentals (sharps/flats) ✅ — both spellings per black key, Letters pad
  gets ♯/♭ modifiers, Piano gets interactive black keys
- Configurable note range ✅ — N ledger lines above/below each staff
  (Settings → Note range, default 2), replacing the fixed starter range
- In-session re-test of missed cards ✅ — a miss re-appears after 3 other
  cards (session-only relearning queue); the re-test is reinforcement only and
  doesn't touch the scheduler or first-attempt accuracy (see Design Notes)
- "Today" counts surfaced on the Home view ✅ — due / new-left / learned for
  Phase 1, with an adaptive primary action (Review / Learn / Practice)

### Milestone 1 review — feedback incorporated (2026-06-02)
After Milestone 1 shipped, a review surfaced four items, now folded into the
plan below:
- **Terminology** — "Phase 1/2/3" is dev jargon and shouldn't be user-facing.
  Use musical names (Notation / Chords / Key Signatures). → M1c.
- **Scale-based note order** — introduce notes grouped by scale, in
  circle-of-fifths order (C major → G major → F major → D major → …), with a
  "ready for the next level?" gate. More musical, more valuable. → M1d
  (full design resolved 2026-06-02; see Design Notes → Learning progression).
- **Mobile nav** — the bottom tab bar is distracting on phones; replace it with
  a hamburger menu that stays out of the way. → M1c.
- **Stem bug** — on the very first note render the stem is detached and shifted
  right (correct after a reload). Almost certainly a VexFlow music-font load
  race: glyph metrics are wrong before Bravura loads. Fix by gating the first
  render on `document.fonts.ready` (or re-rendering once fonts resolve). → M1c.

### Milestone 1c — Bugfixes & UX polish ✅ complete
User-facing fixes and polish surfaced by the Milestone 1 review, done before the
scale-progression feature so the app feels right first.
- **Rename UI terminology** ✅ — Notation / Chords / Key Signatures everywhere
  the user can see (nav, Home cards, today snapshot, view headers, Settings
  copy); internal route ids and storage keys (`srt:phase1`) unchanged
- **Mobile hamburger nav** ✅ — the narrow-screen bottom tab bar is now a
  hamburger-driven off-canvas drawer (scrim backdrop, closes on Escape /
  backdrop / selection); the side nav stays on wide screens (≥760px)
- **Fix the first-render stem bug** ✅ — root cause was VexFlow 5 lazily
  fetching its music font (Bravura) from a CDN mid-render, so the first paint
  used wrong glyph metrics. Fixed by awaiting `VexFlow.loadFonts('Bravura',
  'Academico')` before the first render (more reliable than `document.fonts
  .ready`, which resolves early if the FontFace isn't registered yet)
- Dark mode pass ✅ — new nav drawer, scrim, hamburger, and dashboard badges all
  use theme tokens; audited at 390/500/1100px in light + dark
- "Today" dashboard polish ✅ — per-day answer log persisted in SR state; Home
  surfaces cards due, a day streak (🔥, with a one-day grace), and lifetime
  accuracy; phase cards gained Now/Soon status badges
- Responsive audit ✅ — verified phone (390), tablet/desktop; fixed a latent
  header overflow on phones (the implicit grid column sized to max-content;
  constrained with `minmax(0, 1fr)`)

### Milestone 1d — Scale-based learning progression
Full design in Design Notes → Learning progression. Decided: major + natural
minor only; circle-of-fifths order (11 levels, C through 5♯/5♭); minors paired
onto each level; C-major foundation split by register (on-staff, then ledger);
a level completes at Leitner box ≥ 2; progression is global across clefs.

**Approach.** M1d adds a *curriculum layer* on top of the existing deck +
scheduler — nothing is rewritten. `buildDeck` already emits stable card ids and
the SR module is already card-agnostic, so the work is to (a) group the deck into
levels and (b) constrain which fresh cards get introduced. Guiding principle:
**`spaced-repetition.js` stays generic** — it never learns what a "level" or
"scale" is (preserves the documented SM-2 swap path). The curriculum lives in
`music.js`; the scheduler is handed a pre-filtered pool of introducible cards via
an optional `newPool` param. Built in roughly this order — model first (1–3,
pure and testable; commit), then UI (4–5; commit), then verify (6).

1. **Curriculum model (`music.js`)** — the keystone, pure/no-UI. Define the
   12-entry sequence (11 circle-of-fifths levels, with level 1 C major / A minor
   split into on-staff then ledger sub-levels) and a `levelsFor(deck)` that
   buckets the *live* deck into ordered level groups. Each card maps to the
   earliest level that introduces its spelling: naturals → the register-split
   foundation, each black-key spelling → its home key. Needs an `isOnStaff(card)`
   register test (expose the currently-private `STAFF_LINES`). Each level carries
   its display label ("G major / E minor") + key-sig count.
2. **Scheduler level-awareness (`spaced-repetition.js`)** — add an optional
   `newPool` param to `pickNext` (due cards still come from the full deck; fresh
   cards only from the passed pool, default = whole deck so existing callers are
   unaffected). Add a `boxAtLeast(state, cards, 2)` completion helper (empty
   group = complete, skip it).
3. **Progression state + migration** — persist the current level index in the
   `srt:phase1` blob alongside SR state. On load, migrate pre-M1d progress:
   current level = first level not yet complete at box ≥ 2 (cards introduced in
   the old MIDI order fall into their natural levels for free).
4. **Quiz wiring + gate UI (`Phase1.svelte`)** — derive the current level from
   the live deck, feed only its un-introduced cards as `newPool`, detect
   completion → render the inline "Start [next level]?" gate, and surface the
   current level + per-level progress in the quiz header. Practice mode draws only
   from introduced cards.
5. **Home surfacing (`Home.svelte`)** — current level name + progress in the
   "Today" snapshot.
6. **Verify** — run the app: a fresh deck, mid-level completion → gate → unlock,
   and migration against an existing `srt:phase1` blob.

Deciding by default (per "flag only if it should change"): curriculum lives in
`music.js` (per the design note above), and the scheduler stays generic via the
`newPool` param rather than learning about levels.

### Milestone 2 — Engineering polish, PWA & productionization
Purely engineering-side hardening; no new user-facing features.
- Web app manifest + service worker for offline use (PWA)
- Performance budget verification against the NFRs (<200KB initial JS, <1s TTI
  on 4G) — code-split audit, confirm VexFlow stays lazy-loaded
- Asset/build optimization (caching headers, hashing) and a production error
  boundary so a render failure never blanks the app
- localStorage robustness — versioned state blob + safe migration/fallback
- **Publish to GitHub as a public open-source repo** (fleshed out in detail when
  we reach M2; captured here so it isn't lost):
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
- **Subdomain vs path**: `sightread.adityasule.com` vs
  `adityasule.com/sightread`? Recommendation: subdomain — cleaner separation
  from anything else hosted on the apex, easier to rebuild or retire
  independently.
- **VexFlow version pin**: pin to `^5.0.0` for now; revisit on each minor
  bump.
- **Scale progression (M1d)**: all major decisions resolved (2026-06-02) — see
  Design Notes → Learning progression. Scope (major + natural minor), order
  (circle of fifths, 11 levels), minor pairing, register-split foundation,
  box ≥ 2 completion, and global-across-clefs progression are all settled. The
  remaining items are low-stakes implementation defaults documented in that
  section (settings-change re-evaluation, practice-mode card pool, pre-M1d
  progress migration); flag during M1d only if any should change.
