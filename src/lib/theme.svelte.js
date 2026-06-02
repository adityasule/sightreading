/**
 * Theme: 'system' | 'light' | 'dark'.
 *
 * - 'system' removes the override and lets CSS `prefers-color-scheme` decide.
 * - 'light' / 'dark' pin the theme via `data-theme` on <html>.
 *
 * The very first paint is handled by a tiny inline script in index.html so
 * there's no flash; this module owns everything after hydration: reactive
 * state for the UI, persistence, and keeping the address-bar color in sync.
 */

const STORAGE_KEY = 'srt:theme';
const MODES = ['system', 'light', 'dark'];

const THEME_COLOR = {
  light: '#fbfbfa',
  dark: '#0f0f10',
};

function read() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemPrefersDark =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-color-scheme: dark)');

/** The mode the user picked. */
export const theme = $state({ mode: read() });

/** The theme actually showing right now ('light' | 'dark'), override resolved. */
export function resolved() {
  if (theme.mode !== 'system') return theme.mode;
  return systemPrefersDark && systemPrefersDark.matches ? 'dark' : 'light';
}

function applyMetaColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved()]);
}

function apply() {
  const root = document.documentElement;
  if (theme.mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme.mode);
  applyMetaColor();
}

export function setTheme(mode) {
  if (!MODES.includes(mode)) return;
  theme.mode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode / storage disabled — runtime still works, just won't persist */
  }
  apply();
}

/** Call once at startup. Reconciles the DOM and tracks system changes. */
export function initTheme() {
  apply();
  if (systemPrefersDark) {
    systemPrefersDark.addEventListener('change', () => {
      // Only the address-bar color needs a nudge; CSS handles the rest.
      if (theme.mode === 'system') applyMetaColor();
    });
  }
}
