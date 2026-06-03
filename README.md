# Sight Reading Trainer

A static, client-side web app for learning to sight-read music with spaced
repetition. Open source under the [MIT License](./LICENSE). See
[GOALS.md](./GOALS.md) for the full plan, scope, and phases.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173 (also exposed on your LAN)
npm run build    # outputs ./dist
npm run preview  # serve ./dist locally on :4173 (also exposed on your LAN)
npm test         # run the unit tests once
npm run render   # (dev-only) render staff glyphs to ./render-out/*.svg
```

`npm run render` is a dev tool for fast iteration on the music rendering: it
draws the project's staff glyphs (Basics note/rest/clef cards and Phase 1 notes)
to self-contained SVGs through the same `src/lib/render.js` the app uses, so the
output can't drift from what ships. `-- note|rest|clef|phase1` narrows by kind;
a second arg filters by key/value/id; `-- --feedback` tints. The browser is
still the source of truth — this just shortens the loop.

## Tests

[Vitest](https://vitest.dev) unit-tests the pure-logic modules (`music.js`,
`spaced-repetition.js`, `progression.js`) — range math, deck building, the
Leitner scheduler, and curriculum/level bucketing. Tests live next to the code
as `src/lib/*.test.js`.

```bash
npm test            # run once (CI-style)
npm run test:watch  # re-run on change while developing
```

Vitest is a dev dependency and never ships in the build; the UI/Svelte
components are verified manually by running the app.

## Testing on your phone / iPad (same Wi-Fi)

The dev and preview servers bind to all interfaces, so any device on the
**same Wi-Fi network** can open the app. Because a Mac's IP is handed out by
DHCP and changes, use its **Bonjour hostname** instead of a raw IP — that name
stays stable across reconnects.

1. Find the Mac's hostname: `scutil --get LocalHostName` (call it `<name>`).
2. Connect the phone/iPad to the **same Wi-Fi** as the Mac.
3. Start the server: `npm run dev` (it prints a `Network:` URL too).
4. On the device, open:

   ```
   http://<name>.local:5173
   ```

To test a production build the same way, run `npm run preview` and use port
**4173** instead of 5173.

### If `.local` doesn't resolve

Some networks (or Android, which lacks built-in mDNS) won't resolve the
`.local` name. Fall back to the current IP address — look at the `Network:`
line Vite prints, or run:

```bash
ipconfig getifaddr en0    # Wi-Fi IP, e.g. 192.168.1.42
```

Then browse to `http://<that-ip>:5173`. This IP can change after a reconnect,
so re-check it if the page stops loading.

### Troubleshooting

- **Can't connect at all** — confirm both devices are on the same Wi-Fi (not a
  "guest" network, and not one with *client isolation* enabled). The first
  time, macOS may prompt to allow incoming connections — accept it.
- **Page loads but looks stale** — hard-refresh on the device; the dev server
  hot-reloads, but a cached service worker (added later) can interfere.

## Deploying to Cloudflare Pages

Once the repo is on GitHub:

1. Cloudflare dashboard → **Workers & Pages** → **Create application** →
   **Pages** → **Connect to Git**, pick this repo.
2. Build settings:
   - Framework preset: **None** (or Svelte, either is fine)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20 (set via env var `NODE_VERSION=20` if needed)
3. After first deploy, **Custom domains** → add the subdomain
   (recommendation: `sightread.adityasule.com`). If the apex domain's DNS is
   already on Cloudflare, the CNAME is one click.

No backend, no environment secrets, no API keys. The free Pages tier covers
this app's expected usage by orders of magnitude.

## Project structure

View files keep the dev shorthand `PhaseN`; users see musical names (Phase 0 →
Basics, Phase 1 → Notation, Phase 2 → Chords, Phase 3 → Key Signatures — the
mapping lives in `src/lib/phases.js`).

```
GOALS.md                  forward-looking plan + scope
HISTORY.md                shipped milestones + resolved design notes
CLAUDE.md                 working guidance for this repo
index.html                Vite entry
scripts/render.mjs        dev-only staff-glyph SVG renderer (npm run render)
src/
  main.js                 Svelte 5 mount
  app.css                 global styles, dark-mode tokens
  App.svelte              shell: nav, view switching, error boundary
  views/                  one component per nav section
    Home.svelte           today's due/new/learned snapshot + quick actions
    Phase0.svelte         Basics — multiple-choice duration/rest/clef quiz
    Phase1.svelte         Notation — single-note quiz (VexFlow + answer input + SRS)
    Phase2.svelte         Chords (placeholder)
    Phase3.svelte         Key Signatures (placeholder)
    Progress.svelte       cross-phase completion bars
    Settings.svelte       theme, answer mode, clefs, new-cards-per-day, naming
  lib/
    music.js              MIDI↔note helpers, buildDeck/buildBasicsDeck, curriculum
    spaced-repetition.js  generic, card-agnostic Leitner scheduler
    progression.js        scale-based curriculum layer on top of the scheduler
    render.js             shared VexFlow staff renderer (app + render script)
    phases.js             phase id ↔ display-name single source of truth
    settings.svelte.js    reactive, persisted quiz settings
    nav.svelte.js         nav/drawer state
    theme.svelte.js       light/dark/system theme state
    Choices.svelte        reusable multiple-choice answer pad
    Piano.svelte          one-octave piano input
    QuizSettings.svelte   field-driven in-quiz quick settings
    ThemeButton.svelte    theme cycle button
    ThemeToggle.svelte    theme toggle control
    *.test.js             colocated Vitest unit tests (dev-only)
```

## License

[MIT](./LICENSE) © 2026 Aditya Sule
