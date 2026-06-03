/**
 * Phase 1 quiz settings — reactive state, persisted to localStorage.
 *
 * Mirrors theme.svelte.js: a `$state` object the UI binds to, plus an
 * explicit setter that persists. No backend; this is per-device.
 *
 *   answerMode      'letters' | 'piano'    how the user inputs an answer (Phase 1)
 *   treble / bass   booleans               which clefs are in the deck
 *   newCardsPerDay  number                 new-card introduction budget / day
 *   ledgerLines     number                 ledger lines above/below each staff
 *                                          (deck range size)
 *   durationNames   'british' | 'american' note-value naming for Basics cards
 *                                          (default American)
 */

import { DEFAULT_LEDGER_LINES } from './music.js';

const STORAGE_KEY = 'srt:settings';

// Persisted-blob schema version (see spaced-repetition.js for the rationale): a
// blob from a newer app falls back to defaults rather than being misread.
const SETTINGS_VERSION = 1;

export const LEDGER_MIN = 0;
export const LEDGER_MAX = 4;

const DEFAULTS = {
  answerMode: 'letters',
  treble: true,
  bass: true,
  newCardsPerDay: 5,
  ledgerLines: DEFAULT_LEDGER_LINES,
  durationNames: 'american',
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Ignore non-objects and blobs from a newer app — fall back to defaults.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULTS };
    if (typeof raw.version === 'number' && raw.version > SETTINGS_VERSION) {
      return { ...DEFAULTS };
    }
    // Drop the on-disk `version` key; missing settings fall back to defaults.
    const { version, ...saved } = raw;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = $state(read());

function persist() {
  try {
    // Stamp the version on disk only — keep the in-memory `settings` clean.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SETTINGS_VERSION, ...settings })
    );
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

/** Clamp + persist the ledger-line depth (controls the deck's note range). */
export function setLedgerLines(n) {
  const v = Math.max(LEDGER_MIN, Math.min(LEDGER_MAX, Math.round(Number(n) || 0)));
  setSetting('ledgerLines', v);
}
