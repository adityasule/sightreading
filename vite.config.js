import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    svelte(),
    // PWA: offline-capable install (M7e). A *build-time* dependency only — it
    // emits a static, versioned service worker + precache manifest, so the
    // no-backend / no-runtime-third-party-call constraint still holds. Its
    // prerequisite (no runtime CDN font fetch) was satisfied by M5e, so offline
    // is genuinely offline (the font-bundled vexflow-bravura chunk is precached).
    VitePWA({
      // New SW + its precache take over on the next load (implies skipWaiting +
      // clientsClaim), so a deploy is never pinned by a stale cached worker.
      registerType: 'autoUpdate',
      // We self-register in src/main.js (keeps it in source, not an inline script).
      injectRegister: null,
      // Generate icons from pwa-assets.config.js (one source SVG → all sizes).
      pwaAssets: { config: true },
      manifest: {
        name: 'Sight Reading Trainer',
        short_name: 'SightRead',
        description:
          'Sight reading trainer — learn to read music notation with spaced repetition.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Match the index.html theme-color (light --bg) for the splash/title bar.
        theme_color: '#fbfbfa',
        background_color: '#fbfbfa',
        lang: 'en',
        categories: ['education', 'music'],
      },
      workbox: {
        // Precache the app shell (index.html + hashed js/css) and the lazy
        // vexflow-bravura chunk (711 KB, under Workbox's 2 MiB default limit),
        // plus the generated icons. Source maps (*.map) are excluded by the glob.
        // `webmanifest` is intentionally omitted — vite-plugin-pwa already adds
        // the manifest to the precache, so globbing it too is a conflicting
        // duplicate that makes the worker throw on evaluation.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        // Fold the Workbox runtime into sw.js so there are no extra unhashed
        // workbox-*.js files at the dist root needing their own cache rule.
        inlineWorkboxRuntime: true,
        // Network-first for the HTML (per GOALS) — always try the live page,
        // fall back to the precache when offline; short timeout keeps it snappy.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      // devOptions stays disabled: no service worker under `npm run dev`, so HMR
      // is never shadowed by a cached SW. Verify the SW via build + preview.
    }),
    cloudflare(),
  ],
  // Bind to 0.0.0.0 so the dev/preview server is reachable from other devices
  // on the same Wi-Fi (phone, iPad). Reach it via this Mac's Bonjour name
  // (e.g. http://<LocalHostName>.local:5173) so a changing DHCP IP doesn't
  // matter. See README → "Testing on your phone / iPad".
  server: {
    host: true,
    port: 5173,
    // Vite blocks requests whose Host header isn't localhost/an IP (DNS-rebind
    // protection). Allow the Mac's Bonjour name so http://<name>.local works
    // from phones/iPads. A leading dot allows the domain and any subdomain.
    allowedHosts: ['.local'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.local'],
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});