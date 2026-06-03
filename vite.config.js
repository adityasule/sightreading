import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [svelte(), cloudflare()],
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