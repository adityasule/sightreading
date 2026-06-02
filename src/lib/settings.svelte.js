/**
 * Phase 1 quiz settings — reactive state, persisted to localStorage.
 *
 * Mirrors theme.svelte.js: a `$state` object the UI binds to, plus an
 * explicit setter that persists. No backend; this is per-device.
 *
 *   answerMode      'letters' | 'piano'   how the user inputs an answer
 *   treble / bass   booleans              which clefs are in the deck
 *   newCardsPerDay  number                new-card introduction budget / day
 */

const STORAGE_KEY = 'srt:settings';

const DEFAULTS = {
  answerMode: 'letters',
  treble: true,
  bass: true,
  newCardsPerDay: 5,
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULTS, ...(raw || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = $state(read());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings }));
  } catch {
    /* private mode / storage disabled — runtime still works, just won't persist */
  }
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = value;
  persist();
}

/** Clamp + persist the new-cards-per-day budget. */
export function setNewCardsPerDay(n) {
  const v = Math.max(0, Math.min(50, Math.round(Number(n) || 0)));
  setSetting('newCardsPerDay', v);
}
