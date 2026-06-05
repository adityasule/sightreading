import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';
import { initTheme } from './lib/theme.svelte.js';

initTheme();

const app = mount(App, { target: document.getElementById('app') });

// PWA service worker (M7e). With registerType:'autoUpdate' the helper applies a
// new worker and reloads on its own. In dev (SW disabled) this is a no-op, so
// HMR is untouched.
registerSW({ immediate: true });

export default app;
