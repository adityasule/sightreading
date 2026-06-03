# CLAUDE.md

Guidance for working in this repo. Read [GOALS.md](./GOALS.md) for the plan and
scope; [HISTORY.md](./HISTORY.md) for shipped work and resolved design decisions.

## What this is
A fully client-side, static web app for sight-reading practice with spaced
repetition. **No backend, no database, no runtime APIs** — this is a hard
architectural constraint (see GOALS → Architecture Decision), not an accident.
Don't introduce a server, fetch, or third-party runtime call without flagging it.

## Commands
```bash
npm install
npm run dev      # vite dev server on :5173 (also on LAN — see README for phone testing)
npm run build    # production build → ./dist
npm run preview  # serve ./dist on :4173
npm test         # run the Vitest unit tests once (npm run test:watch to watch)
npm run render   # render staff glyphs (Basics + Phase 1/2) to ./render-out/*.svg (dev-only)
npm run drive    # drive the app in a headless Chrome over CDP (dev-only smoke tests)
```
**Vitest** (dev-only, never shipped) covers the pure-logic modules — `music.js`,
`spaced-repetition.js`, `progression.js` — via colocated `src/lib/*.test.js`
files. Run `npm test` after touching those. There is **no linter** configured,
and the Svelte/UI components have no tests: "verify" the UI by running the app
(`npm run dev`) and exercising the change in the browser.

**`render`** (dev-only, never shipped) draws the project's staff glyphs to
self-contained SVGs via Node + jsdom, going through the same `src/lib/render.js`
the app uses (so output can't drift) and embedding the Bravura font so each SVG
opens anywhere. It's for *fast iteration* on the rendering — the browser is
still the source of truth for correctness. `npm run render` emits all Basics
cards (notes/rests/clefs/accidentals); `-- note|rest|clef|accidental|phase1|chord`
narrows by kind, an optional second arg filters by key/value/id (`-- rest
quarter`, `-- phase1 treble:60`), and `-- --feedback` tints. Output dir is
git-ignored.

**`drive`** (dev-only, never shipped) launches the *installed* Chrome headless
and talks CDP over Node's global `WebSocket`/`fetch` (no Puppeteer/Playwright) —
the committed form of the M2e smoke-test. CLI: `npm run drive -- shot <url>
[out.png]` and `npm run drive -- eval <url> "<expr>"`; imported, it exports
`connect()` → a driver (`navigate`/`seedLocalStorage`/`clickByText`/`eval`/
`waitFor`/`screenshot`/`close`) for scripted scenarios. Needs a running dev
server; `$CHROME` overrides the binary. The browser stays the source of truth
for UI checks.

## Architecture
Svelte 5 + Vite SPA. View-switching by simple state, no router.

- `src/main.js` — Svelte mount; `src/App.svelte` — shell, nav + view switching.
- `src/views/` — one component per nav section: `Home`, `Phase1` (the only
  built quiz), `Phase2`, `Phase3` (placeholders), `Settings`.
- `src/lib/`
  - `music.js` — MIDI↔note helpers, `buildDeck(settings)`, and the scale
    curriculum (`SCALE_SEQUENCE`, `levelsFor`, `isOnStaff`).
  - `spaced-repetition.js` — generic Leitner scheduler. **Keep it
    card-agnostic** (no knowledge of notes/chords/levels) so every phase reuses
    it and the SM-2 swap stays local. Key fns: `pickNext` (takes an optional
    `newPool`), `recordAnswer`, `boxAtLeast`, `summary`.
  - `progression.js` — the curriculum layer on top of the scheduler
    (`progress`, `advance`, `MASTER_BOX`).
  - `settings.svelte.js` — reactive, persisted quiz settings.
  - `phases.js` — single source of truth for phase id↔display-name mapping.
  - `Piano.svelte`, `QuizSettings.svelte`, `theme.svelte.js`, `nav.svelte.js`.
- `src/app.css` — global styles + dark-mode theme tokens.

## Conventions that matter
- **"Phase 1/2/3" is dev shorthand — never show it in the UI.** Users see
  musical names (Notation / Chords / Key Signatures); the mapping lives in
  `phases.js`. Internal route ids (`phase1`) and storage keys (`srt:phase1`)
  stay as-is.
- **State** persists as one JSON blob per phase in `localStorage` (`srt:phase1`).
- **VexFlow font race:** await `VexFlow.loadFonts('Bravura', 'Academico')`
  before the first render or first-paint glyph metrics are wrong.
- Hand-rolled CSS only — no Tailwind / UI library (keeps the bundle small).
- Mobile-first: side nav ≥760px, hamburger drawer below; 44px min touch targets.

## Workflow
- Commit only when asked. Match the existing concise, milestone-tagged commit
  style (`git log` for examples). When a milestone ships, move its detail from
  GOALS.md into HISTORY.md to keep the plan lean.
