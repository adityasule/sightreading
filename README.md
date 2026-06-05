# Sight Reading Trainer

A static, client-side web app for learning to sight-read music with spaced
repetition. Open source under the [MIT License](./LICENSE). See
[GOALS.md](./GOALS.md) for the full plan, scope, and phases.

**Disclaimer: This is a purely vibe coded project to test the limits of LLMs. I assume no responsibility for any generated code or text in this project**

## Local development

```bash
npm install
npm run dev      # http://localhost:5173 (also exposed on your LAN)
npm run build    # outputs ./dist
npm run preview  # build, then serve ./dist via the Workers runtime (wrangler dev) on :8787
npm run deploy   # build, then deploy to Cloudflare Workers (wrangler deploy)
npm test         # run the unit tests once
npm run render   # (dev-only) render staff glyphs to ./render-out/*.svg
```

`npm run render` is a dev tool for fast iteration on the music rendering: it
draws the project's staff glyphs (Basics note/rest/clef/accidental cards, Phase 1
notes, chords, key signatures, and interval pairs) to self-contained SVGs through
the same `src/lib/render.js` the app uses, so the output can't drift from what
ships. `-- note|rest|clef|accidental|phase1|chord|keysig|interval` narrows by
kind; a second arg filters by key/value/id; `-- --feedback` tints. The browser is
still the source of truth — this just shortens the loop.

- **LAN / phone testing:** the dev server can be accessed over the local network
  — any device on the same Wi-Fi can open the `Network:` URL `npm run dev` prints.

## Tests

[Vitest](https://vitest.dev) unit-tests the pure-logic modules (`music.js`,
`spaced-repetition.js`, `progression.js`, `chords.js`, `keysig.js`,
`intervals.js`) — range math, deck building, the Leitner scheduler, interval
spelling, and curriculum/level bucketing. Tests live next to the code as
`src/lib/*.test.js`.

```bash
npm test            # run once (CI-style)
npm run test:watch  # re-run on change while developing
```

Vitest is a dev dependency and never ships in the build; the UI/Svelte
components are verified manually by running the app.

## Deploying to Cloudflare Workers

The app ships as a **static-assets-only Worker** — `wrangler.jsonc` has no `main`
(no server code), just an `assets` binding with single-page-app fallback — so the
no-backend constraint still holds; this is static hosting on the Workers platform.
Two ways to ship:

- **Git-connected (recommended)** — the Cloudflare dashboard builds on each push.
  In the connected project's build settings:
  - Build command: `npm run build`
  - Deploy command: `npx wrangler deploy`
  - Node version: pinned by `.nvmrc` (22) — no dashboard env var needed.
- **Locally** — `npm run deploy` (`wrangler deploy`) after a one-time
  `wrangler login`.

After the first deploy, add the custom domain under the Worker's **Settings →
Domains & Routes** — this app runs at `sightreading.adityasule.com`. If the apex
domain's DNS is already on Cloudflare, it's one click.

Caching is configured in-repo by [`public/_headers`](./public/_headers) (Vite
copies it to the build root, where Workers static assets honors it): the
content-hashed `/assets/*` are cached immutably for a year, while `index.html`
is served `no-cache` so a new deploy propagates immediately. Unknown paths fall
back to `index.html` via `not_found_handling` in `wrangler.jsonc`.

No backend, no environment secrets, no API keys. The free Workers tier covers
this app's expected usage by orders of magnitude.

## Offline / install (PWA)

The production build is an installable, offline-capable PWA (`vite-plugin-pwa` +
Workbox — a **dev-only build dependency**; it emits a static, versioned service
worker, so there's no runtime third-party call and the no-backend constraint
holds). The worker precaches the app shell and the lazy `vexflow-bravura` chunk
(fonts inlined since the music-font self-hosting work), so the app **and its
staff rendering work fully offline** once loaded. It's network-first for
navigations and `autoUpdate`, and `/sw.js` is served `no-cache` (see
[`public/_headers`](./public/_headers)) so a deploy is never pinned by a stale
cached worker. The icons + web manifest are generated from `public/icon.svg` by
`@vite-pwa/assets-generator`. `npm run dev` registers **no** service worker (to
keep HMR clean) — verify the PWA via `npm run build` + `npm run preview`.

## Project structure

View files keep the dev shorthand `PhaseN`; users see musical names (Phase 0 →
Basics, Phase 1 → Notation, Phase 2 → Chords, Phase 3 → Key Signatures, Phase 4 →
Intervals — the mapping lives in `src/lib/phases.js`).

```
GOALS.md                  vision, requirements, architecture decision + scope
HISTORY.md                shipped milestones + resolved design notes
CLAUDE.md                 working guidance for this repo
index.html                Vite entry
wrangler.jsonc            Cloudflare Workers config (static assets + SPA fallback)
pwa-assets.config.js      PWA icon generation config (dev-only; one source SVG → all sizes)
public/_headers           Cloudflare cache-control rules (immutable assets, no-cache HTML + SW)
public/icon.svg           app icon source (treble clef) → generated PWA icons + favicon
scripts/render.mjs        dev-only staff-glyph SVG renderer (npm run render)
scripts/drive.mjs         dev-only headless-Chrome CDP driver (npm run drive)
src/
  main.js                 Svelte 5 mount + service-worker registration
  app.css                 global styles, dark-mode tokens
  App.svelte              shell: nav, view switching, footer, error boundary
  views/                  one component per nav section
    Home.svelte           today's due/new/learned snapshot + quick actions
    Phase0.svelte         Basics — multiple-choice duration/rest/clef/accidental quiz
    Phase1.svelte         Notation — single-note quiz (VexFlow + answer input + SRS)
    Phase2.svelte         Chords — major/minor triad recognition quiz
    Phase3.svelte         Key Signatures — name-the-major-key quiz
    Phase4.svelte         Intervals — name-the-interval quiz
    Progress.svelte       cross-phase progress bars + per-card stats drill-down
    Settings.svelte       theme, answer mode, clefs, new-cards-per-day, naming, backup
  lib/
    music.js              MIDI↔note helpers, buildDeck/buildBasicsDeck, curriculum
    chords.js             Chords engine — deck + circle-of-fifths curriculum
    keysig.js             Key Signatures engine — deck + circle-of-fifths curriculum
    intervals.js          Intervals engine — deck + difficulty curriculum
    spaced-repetition.js  generic, card-agnostic Leitner scheduler + per-card stats
    progression.js        curriculum layer on top of the scheduler (pluggable levelsFn)
    render.js             shared VexFlow staff renderer (app + render script)
    cardRender.js         shared VexFlow boot + draw dispatch (Progress drill-down + dev gallery)
    transfer.js           state export/import (versioned JSON backup file)
    phases.js             phase id ↔ display-name single source of truth
    settings.svelte.js    reactive, persisted quiz settings
    nav.svelte.js         nav/drawer + drill-down state
    theme.svelte.js       light/dark/system theme state
    Choices.svelte        reusable multiple-choice answer pad
    Piano.svelte          one-octave piano input
    QuizSettings.svelte   field-driven in-quiz quick settings
    ThemeButton.svelte    header theme-cycle button
    ThemeToggle.svelte    Settings theme segmented control
    *.test.js             colocated Vitest unit tests (dev-only)
  dev/
    CardGallery.svelte    dev-only "Cards" gallery (import.meta.env.DEV-gated)
```

## License

[MIT](./LICENSE) © 2026 Aditya Sule
