// Drive the app in a real (headless) Chrome over the Chrome DevTools Protocol —
// the committed version of the throwaway script used to smoke-test M2e. The
// browser stays the source of truth for UI checks (the `render` script is for
// fast glyph iteration; this is for "does the actual app behave"). No new deps:
// it launches the *installed* Chrome and talks CDP over Node's global WebSocket
// + fetch, so nothing heavyweight (Puppeteer/Playwright + a browser binary) is
// pulled in. Dev-only, never shipped.
//
//   npm run drive -- shot <url> [out.png]        # screenshot a page
//   npm run drive -- eval <url> "<expr>"         # print a JS expression's value
//   npm run drive -- shot http://localhost:5173/ home.png
//   npm run drive -- eval http://localhost:5173/ "document.title"
//
// Options (after the subcommand): --size=WxH (viewport, default 900x1400),
//   --wait=<ms> (extra settle time before acting, default 250),
//   --headed (show the window). $CHROME overrides the Chrome binary path.
//
// As a module it also exports `connect()` returning a small driver — connect →
// navigate → seedLocalStorage → clickByText → eval → setOffline → reload →
// screenshot → close — for ad-hoc scenarios:
//
//   import { connect } from './scripts/drive.mjs';
//   const b = await connect();
//   await b.seedLocalStorage('http://localhost:5173/', { 'srt:phase0': '{...}' });
//   await b.clickByText('Basics');
//   await b.screenshot('basics.png');
//   await b.close();
//
// (the `--` passes args through npm to the script.)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The installed Chrome. macOS default; override with $CHROME (e.g. a Linux
// `google-chrome` / `chromium` path) when running elsewhere.
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Launch a headless Chrome and attach to its first page target over CDP.
 * Returns a driver with navigate/eval/clickByText/seedLocalStorage/setOffline/
 * reload/waitFor/screenshot/close. `size` is the viewport "WxH"; `headed` shows
 * the window.
 */
export async function connect({ size = '900x1400', headed = false } = {}) {
  const [w, h] = size.split('x').map((n) => parseInt(n, 10));
  const userDataDir = mkdtempSync(join(tmpdir(), 'srt-drive-'));

  // Port 0 = let Chrome pick a free port; it writes the choice to
  // <userDataDir>/DevToolsActivePort (line 1 = port). Avoids fighting over 9222.
  const chrome = spawn(
    CHROME,
    [
      // Headed mode simply omits --headless (Chrome has no --headless=false).
      ...(headed ? [] : ['--headless=new']),
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      `--window-size=${w},${h}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  chrome.on('error', (e) => {
    throw new Error(`Could not launch Chrome at "${CHROME}" (set $CHROME): ${e.message}`);
  });

  // Wait for the DevToolsActivePort file, then resolve the page target's WS URL.
  const portFile = join(userDataDir, 'DevToolsActivePort');
  let port;
  for (let i = 0; i < 100; i++) {
    if (existsSync(portFile)) {
      port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (port) break;
    }
    await sleep(50);
  }
  if (!port) throw new Error('Chrome never reported a debugging port (DevToolsActivePort).');

  let wsUrl;
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {
      /* endpoint not up yet */
    }
    await sleep(50);
  }
  if (!wsUrl) throw new Error('No page target exposed by Chrome.');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket failed to open')), {
      once: true,
    });
  });

  // CDP request/response over the socket: each command gets an incrementing id;
  // the matching reply carries that id. Messages without an id are events.
  let nextId = 1;
  const pending = new Map();
  const events = new Map(); // method -> [resolvers] (one-shot waiters)
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method && events.has(msg.method)) {
      for (const r of events.get(msg.method).splice(0)) r(msg.params);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const once = (method) =>
    new Promise((resolve) => {
      if (!events.has(method)) events.set(method, []);
      events.get(method).push(resolve);
    });

  await send('Page.enable');
  await send('Runtime.enable');

  const driver = {
    /** Navigate and resolve once the load event fires. */
    async navigate(url) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url });
      await loaded;
    },

    /**
     * Evaluate a JS expression in the page and return its (JSON-able) value.
     * Awaits promises; throws on a page-side exception.
     */
    async eval(expression) {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || 'eval threw');
      }
      return r.result.value;
    },

    /**
     * Click the first visible element matching `selector` whose trimmed text
     * contains `text`. Returns true if one was found and clicked.
     */
    async clickByText(text, selector = 'button, a, [role="button"]') {
      return this.eval(
        `(() => {
          const t = ${JSON.stringify(text)};
          const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
            .find((e) => e.offsetParent !== null && e.textContent.trim().includes(t));
          if (!el) return false;
          el.click();
          return true;
        })()`
      );
    },

    /**
     * Seed `entries` ({ key: value }) into localStorage for `origin`, then reload
     * so the app boots with that state. Must be same-origin as the page seeded.
     */
    async seedLocalStorage(origin, entries) {
      await this.navigate(origin);
      await this.eval(
        `(() => { const e = ${JSON.stringify(entries)};
           for (const k in e) localStorage.setItem(k, e[k]); })()`
      );
      const loaded = once('Page.loadEventFired');
      await send('Page.reload');
      await loaded;
    },

    /**
     * Toggle network offline/online via CDP (for verifying the PWA service
     * worker serves from its precache). `true` = offline.
     */
    async setOffline(offline) {
      await send('Network.enable');
      await send('Network.emulateNetworkConditions', {
        offline,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    },

    /** Reload the current page and resolve once the load event fires. */
    async reload() {
      const loaded = once('Page.loadEventFired');
      await send('Page.reload');
      await loaded;
    },

    /** Poll `expression` until it's truthy (or `timeout` ms elapse). */
    async waitFor(expression, { timeout = 5000, interval = 100 } = {}) {
      const deadline = Date.now() + timeout;
      for (;;) {
        if (await this.eval(`!!(${expression})`)) return true;
        if (Date.now() > deadline) throw new Error(`waitFor timed out: ${expression}`);
        await sleep(interval);
      }
    },

    /** Capture a PNG screenshot of the current page to `path`. */
    async screenshot(path, { fullPage = false } = {}) {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: fullPage,
      });
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    },

    /** Tear down: close the socket, kill Chrome, remove the temp profile. */
    async close() {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      chrome.kill();
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };

  return driver;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Only runs when invoked directly (`node scripts/drive.mjs …`), not on import.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const positionals = argv.slice(1).filter((a) => !a.startsWith('--'));
  const flags = Object.fromEntries(
    argv
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? true];
      })
  );

  const usage = () => {
    console.error(
      'Usage:\n' +
        '  npm run drive -- shot <url> [out.png]\n' +
        '  npm run drive -- eval <url> "<expr>"\n' +
        'Options: --size=WxH --wait=<ms> --headed'
    );
    process.exit(1);
  };

  if ((cmd !== 'shot' && cmd !== 'eval') || !positionals[0]) usage();

  const url = positionals[0];
  const browser = await connect({ size: flags.size, headed: !!flags.headed });
  try {
    await browser.navigate(url);
    if (flags.wait) await sleep(parseInt(flags.wait, 10));
    else await sleep(250); // small default settle for SPA first paint

    if (cmd === 'shot') {
      const out = positionals[1] || 'drive-shot.png';
      await browser.screenshot(out, { fullPage: !!flags.full });
      console.log(`  screenshot → ${out}`);
    } else {
      const expr = positionals[1];
      if (!expr) usage();
      const value = await browser.eval(expr);
      console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    }
  } finally {
    await browser.close();
  }
}
