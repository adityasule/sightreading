/**
 * State export / import — the opt-in cross-device transfer escape hatch (M7c).
 *
 * The app is intentionally backend-less, so progress otherwise lives only in one
 * browser. This bundles every `localStorage` key (the five phase SR blobs +
 * settings + theme) into one versioned JSON file the user can download and
 * re-import on another device. No backend — `Blob` download + file read are
 * client-side browser APIs.
 *
 * The pure cores (`buildExport`, `parseAndValidate`, `applyImport`) are unit
 * tested; `triggerDownload` is the thin DOM wrapper, manual-verified in the
 * browser (the repo's "pure logic tested, UI manual-verified" convention).
 */

import { STATE_VERSION } from './spaced-repetition.js';
import { SETTINGS_VERSION } from './settings.svelte.js';

// Bump if the envelope shape changes in a way older builds can't read. The
// per-blob `version` stamps (STATE_VERSION / SETTINGS_VERSION) are validated
// separately on import, so this only versions the outer wrapper.
export const EXPORT_VERSION = 1;

const APP_ID = 'sight-reading-trainer';

// The localStorage keys we round-trip. The phase + settings keys hold versioned
// JSON; the theme key is a bare string ('system' | 'light' | 'dark').
const PHASE_KEYS = ['srt:phase0', 'srt:phase1', 'srt:phase2', 'srt:phase3', 'srt:phase4'];
const SETTINGS_KEY = 'srt:settings';
const THEME_KEY = 'srt:theme';
const BLOB_KEYS = [...PHASE_KEYS, SETTINGS_KEY]; // JSON-encoded, version-stamped
// Mirrors the (private, unversioned) MODES in theme.svelte.js — duplicated here
// to avoid importing the reactive theme module just for a three-item allow-list.
const THEME_MODES = ['system', 'light', 'dark'];

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function fail(error) {
  return { ok: false, error };
}

/**
 * Gather every present storage key into one export envelope. Blob keys are
 * JSON-parsed so the file is human-readable nested JSON (not escaped strings);
 * the theme key stays a raw string. An unreadable blob is skipped, not fatal.
 */
export function buildExport() {
  const data = {};
  for (const key of BLOB_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      const parsed = JSON.parse(raw);
      // Only emit plain-object blobs, so anything we export can be re-imported
      // (parseAndValidate rejects non-objects). A corrupt/hand-edited blob is
      // left out rather than shipped as un-importable junk.
      if (isPlainObject(parsed)) data[key] = parsed;
    } catch {
      /* unparseable blob — skip it */
    }
  }
  const theme = localStorage.getItem(THEME_KEY);
  if (theme != null) data[THEME_KEY] = theme;
  return {
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Parse + validate an import file's text. Returns { ok: true, data } with only
 * the recognised, in-version keys, or { ok: false, error } with a user-facing
 * message. Atomic: any present-but-invalid blob rejects the whole import (no
 * half-write). Mirrors the per-blob load-defence in spaced-repetition.js /
 * settings.svelte.js — reject blobs from a newer app rather than misread them.
 */
export function parseAndValidate(text) {
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    return fail('That file is not valid JSON.');
  }

  if (!isPlainObject(env)) return fail('This is not a recognised backup file.');
  if (env.app !== APP_ID) return fail('This backup is from a different app.');
  if (typeof env.version !== 'number' || env.version > EXPORT_VERSION) {
    return fail('This backup was made by a newer version of this app.');
  }
  if (!isPlainObject(env.data)) return fail('This backup file contains no data.');

  const data = {};
  for (const key of BLOB_KEYS) {
    const v = env.data[key];
    if (v === undefined) continue;
    if (!isPlainObject(v)) return fail(`Backup entry "${key}" is corrupt.`);
    const ceiling = key === SETTINGS_KEY ? SETTINGS_VERSION : STATE_VERSION;
    if (typeof v.version === 'number' && v.version > ceiling) {
      return fail('This backup was made by a newer version of this app.');
    }
    data[key] = v;
  }

  const theme = env.data[THEME_KEY];
  if (theme !== undefined) {
    if (!THEME_MODES.includes(theme)) return fail(`Backup entry "${THEME_KEY}" is corrupt.`);
    data[THEME_KEY] = theme;
  }

  if (Object.keys(data).length === 0) {
    return fail('This backup file has no recognisable progress data.');
  }
  return { ok: true, data };
}

/**
 * Replace this device's managed state with the validated import data (blobs
 * re-stringified). A *replace*, not a merge: any managed key absent from the
 * backup is removed, so the device ends up exactly matching the backup and no
 * stale leftover state survives — matching the "replace all on this device"
 * confirmation. Non-managed localStorage keys are never touched.
 */
export function applyImport(data) {
  for (const key of BLOB_KEYS) {
    if (key in data) localStorage.setItem(key, JSON.stringify(data[key]));
    else localStorage.removeItem(key);
  }
  if (THEME_KEY in data) localStorage.setItem(THEME_KEY, data[THEME_KEY]);
  else localStorage.removeItem(THEME_KEY);
}

function dateStamp() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Download an export envelope as a JSON file (Blob + anchor; no backend). */
export function triggerDownload(envelope) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_ID}-backup-${dateStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
