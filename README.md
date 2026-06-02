# Sight Reading Trainer

A static, client-side web app for learning to sight-read music with spaced
repetition. See [GOALS.md](./GOALS.md) for the full plan, scope, and phases.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173 (also exposed on your LAN)
npm run build    # outputs ./dist
npm run preview  # serve ./dist locally on :4173 (also exposed on your LAN)
```

## Testing on your phone / iPad (same Wi-Fi)

The dev and preview servers bind to all interfaces, so any device on the
**same Wi-Fi network** can open the app. Because this Mac's IP is handed out
by DHCP and changes, use its **Bonjour hostname** instead of a raw IP — that
name stays stable across reconnects.

1. Connect the phone/iPad to the **same Wi-Fi** as this Mac.
2. Start the server: `npm run dev` (it prints a `Network:` URL too).
3. On the device, open:

   ```
   http://Aluminium-Tome.local:5173
   ```

   `Aluminium-Tome` is this Mac's LocalHostName. If you ever rename the Mac,
   re-check it with `scutil --get LocalHostName` and use `<name>.local`.

To test a production build the same way, run `npm run preview` and use port
**4173** instead of 5173.

### If `.local` doesn't resolve

Some networks (or Android, which lacks built-in mDNS) won't resolve the
`.local` name. Fall back to the current IP address — look at the `Network:`
line Vite prints, or run:

```bash
ipconfig getifaddr en0    # Wi-Fi IP, e.g. 192.168.178.253
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

```
GOALS.md                  full plan + scope
index.html                Vite entry
src/
  main.js                 Svelte 5 mount
  app.css                 global styles, dark-mode tokens
  App.svelte              shell with nav + view switching
  views/                  one component per nav section
    Home.svelte
    Phase1.svelte         single-note quiz (VexFlow render + answer input + SRS)
    Phase2.svelte
    Phase3.svelte
    Settings.svelte       theme, answer mode, clefs, new-cards-per-day
  lib/
    music.js              MIDI↔note helpers + the hardcoded Phase 1 deck
    spaced-repetition.js  Leitner-box scheduler (due-first + daily new budget)
    settings.svelte.js    reactive, persisted quiz settings
    Piano.svelte          one-octave piano input (white keys interactive)
    theme.svelte.js       light/dark/system theme state
    ThemeToggle.svelte
```
