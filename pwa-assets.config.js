import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// PWA icon generation (M7e). One source SVG → favicon, apple-touch-icon, and the
// 64/192/512 + maskable PWA icons; vite-plugin-pwa injects the <link> tags and
// merges the icons into the web manifest. Dev-only build tooling — never shipped.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
