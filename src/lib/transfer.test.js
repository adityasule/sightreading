import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildExport,
  parseAndValidate,
  applyImport,
  EXPORT_VERSION,
} from './transfer.js';
import { STATE_VERSION } from './spaced-repetition.js';
import { SETTINGS_VERSION } from './settings.svelte.js';

const APP_ID = 'sight-reading-trainer';
const PHASE_KEYS = ['srt:phase0', 'srt:phase1', 'srt:phase2', 'srt:phase3', 'srt:phase4'];
const ALL_KEYS = [...PHASE_KEYS, 'srt:settings', 'srt:theme'];

// Back the global `localStorage` with an in-memory Map (vitest runs in node).
function stubStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

// A well-formed envelope; tests clone + mutate it to exercise each path.
const goodEnvelope = () => ({
  app: APP_ID,
  version: EXPORT_VERSION,
  exportedAt: '2026-06-04T00:00:00.000Z',
  data: {
    'srt:phase1': { version: STATE_VERSION, cards: { 'treble:60': { box: 2, dueAt: 0 } } },
    'srt:settings': { version: SETTINGS_VERSION, treble: true },
    'srt:theme': 'dark',
  },
});

// Validate an envelope object (the common shape under test).
const validate = (env) => parseAndValidate(JSON.stringify(env));

// ===========================================================================
// buildExport
// ===========================================================================
describe('buildExport', () => {
  it('produces a stamped envelope with parsed blobs and a raw theme string', () => {
    stubStorage({
      'srt:phase1': JSON.stringify({ version: STATE_VERSION, cards: {} }),
      'srt:settings': JSON.stringify({ version: SETTINGS_VERSION, treble: false }),
      'srt:theme': 'light',
    });
    const env = buildExport();
    expect(env.app).toBe(APP_ID);
    expect(env.version).toBe(EXPORT_VERSION);
    expect(env.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/); // ISO timestamp
    expect(env.data['srt:phase1']).toEqual({ version: STATE_VERSION, cards: {} }); // parsed object
    expect(env.data['srt:theme']).toBe('light'); // raw string, not JSON
  });

  it('includes every present phase key', () => {
    const seed = {};
    for (const k of PHASE_KEYS) seed[k] = JSON.stringify({ version: STATE_VERSION, cards: {} });
    stubStorage(seed);
    const env = buildExport();
    expect(Object.keys(env.data).sort()).toEqual([...PHASE_KEYS].sort());
  });

  it('omits absent keys (no nulls in data)', () => {
    stubStorage({ 'srt:theme': 'system' });
    const env = buildExport();
    expect(env.data).toEqual({ 'srt:theme': 'system' });
  });

  it('returns an empty data map for a pristine (empty) store', () => {
    stubStorage({});
    expect(buildExport().data).toEqual({});
  });

  it('skips an unparseable blob rather than shipping junk', () => {
    stubStorage({ 'srt:phase0': '{not json', 'srt:theme': 'dark' });
    const env = buildExport();
    expect('srt:phase0' in env.data).toBe(false);
    expect(env.data['srt:theme']).toBe('dark');
  });

  it('skips a parseable-but-non-object blob (export stays re-importable)', () => {
    stubStorage({
      'srt:phase0': '42',
      'srt:phase1': '[1,2,3]',
      'srt:phase2': 'null',
      'srt:phase3': '"a string"',
      'srt:settings': JSON.stringify({ version: SETTINGS_VERSION }),
    });
    const env = buildExport();
    expect(Object.keys(env.data)).toEqual(['srt:settings']); // only the real object survives
    // and what it emits round-trips cleanly
    expect(parseAndValidate(JSON.stringify(env)).ok).toBe(true);
  });
});

// ===========================================================================
// parseAndValidate — envelope-level
// ===========================================================================
describe('parseAndValidate — envelope', () => {
  it('accepts a well-formed envelope and returns only recognised keys', () => {
    const res = validate(goodEnvelope());
    expect(res.ok).toBe(true);
    expect(Object.keys(res.data).sort()).toEqual(['srt:phase1', 'srt:settings', 'srt:theme']);
  });

  it('rejects invalid JSON', () => {
    expect(parseAndValidate('{not json').ok).toBe(false);
    expect(parseAndValidate('').ok).toBe(false);
  });

  it.each([['null', 'null'], ['number', '7'], ['string', '"hi"'], ['boolean', 'true'], ['array', '[]']])(
    'rejects a top-level %s',
    (_label, text) => {
      expect(parseAndValidate(text).ok).toBe(false);
    }
  );

  it('rejects a missing or mismatched app id', () => {
    const a = goodEnvelope();
    delete a.app;
    expect(validate(a).ok).toBe(false);
    const b = goodEnvelope();
    b.app = 'some-other-app';
    expect(validate(b).ok).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['a string', '1'],
    ['null', null],
    ['newer', EXPORT_VERSION + 1],
  ])('rejects an envelope version that is %s', (_label, version) => {
    const env = goodEnvelope();
    if (version === undefined) delete env.version;
    else env.version = version;
    expect(validate(env).ok).toBe(false);
  });

  it('accepts the current envelope version (boundary)', () => {
    const env = goodEnvelope();
    env.version = EXPORT_VERSION;
    expect(validate(env).ok).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['an array', []],
    ['a string', 'nope'],
    ['a number', 5],
  ])('rejects a data field that is %s', (_label, data) => {
    const env = goodEnvelope();
    if (data === undefined) delete env.data;
    else env.data = data;
    expect(validate(env).ok).toBe(false);
  });

  it('rejects an envelope with no recognisable data (empty or only-unknown keys)', () => {
    const empty = goodEnvelope();
    empty.data = {};
    expect(validate(empty).ok).toBe(false);

    const unknown = goodEnvelope();
    unknown.data = { 'srt:bogus': { x: 1 }, other: 2 };
    expect(validate(unknown).ok).toBe(false);
  });

  it('always returns a non-empty error string on failure', () => {
    for (const text of ['{bad', 'null', '{}', JSON.stringify({ app: 'x' })]) {
      const res = parseAndValidate(text);
      expect(res.ok).toBe(false);
      expect(typeof res.error).toBe('string');
      expect(res.error.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// parseAndValidate — per-blob (every phase key + settings)
// ===========================================================================
describe('parseAndValidate — blobs', () => {
  it.each(PHASE_KEYS)('recognises a valid %s blob', (key) => {
    const env = { app: APP_ID, version: EXPORT_VERSION, data: { [key]: { version: STATE_VERSION, cards: {} } } };
    const res = validate(env);
    expect(res.ok).toBe(true);
    expect(res.data[key]).toEqual({ version: STATE_VERSION, cards: {} });
  });

  it.each(PHASE_KEYS)('rejects a future-version %s blob', (key) => {
    const env = { app: APP_ID, version: EXPORT_VERSION, data: { [key]: { version: STATE_VERSION + 1 } } };
    expect(validate(env).ok).toBe(false);
  });

  it('accepts a phase blob whose version equals the ceiling (boundary)', () => {
    const env = goodEnvelope();
    env.data['srt:phase1'].version = STATE_VERSION;
    expect(validate(env).ok).toBe(true);
  });

  it('validates settings against its own (different) version ceiling', () => {
    const ok = goodEnvelope();
    ok.data['srt:settings'].version = SETTINGS_VERSION; // boundary — accept
    expect(validate(ok).ok).toBe(true);

    const bad = goodEnvelope();
    bad.data['srt:settings'].version = SETTINGS_VERSION + 1; // newer — reject
    expect(validate(bad).ok).toBe(false);
  });

  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'corrupt'],
    ['an array', [1, 2, 3]],
    ['a boolean', true],
  ])('rejects a %s where a blob object is expected', (_label, value) => {
    const env = goodEnvelope();
    env.data['srt:phase1'] = value;
    expect(validate(env).ok).toBe(false);
  });

  it('accepts a blob with no version stamp (legacy / pre-version blob)', () => {
    const env = goodEnvelope();
    delete env.data['srt:phase1'].version;
    expect(validate(env).ok).toBe(true);
  });

  it('accepts a blob with a non-numeric version (treated as unversioned, like loadState)', () => {
    const env = goodEnvelope();
    env.data['srt:phase1'].version = '3';
    expect(validate(env).ok).toBe(true);
  });

  it('rejects the whole import if any one blob is invalid (atomic, no partial)', () => {
    const env = goodEnvelope(); // phase1 + settings valid
    env.data['srt:phase2'] = { version: STATE_VERSION + 99 }; // one rotten apple
    const res = validate(env);
    expect(res.ok).toBe(false);
    expect(res.data).toBeUndefined(); // nothing handed back to write
  });
});

// ===========================================================================
// parseAndValidate — theme + result safety
// ===========================================================================
describe('parseAndValidate — theme & safety', () => {
  it.each(['system', 'light', 'dark'])('accepts the valid theme %s', (mode) => {
    const env = goodEnvelope();
    env.data['srt:theme'] = mode;
    const res = validate(env);
    expect(res.ok).toBe(true);
    expect(res.data['srt:theme']).toBe(mode);
  });

  it.each([
    ['an unknown string', 'neon'],
    ['an empty string', ''],
    ['a number', 1],
    ['null', null],
    ['an object', {}],
    ['a boolean', true],
  ])('rejects a theme that is %s', (_label, value) => {
    const env = goodEnvelope();
    env.data['srt:theme'] = value;
    expect(validate(env).ok).toBe(false);
  });

  it('omits theme from the result when it is absent', () => {
    const env = goodEnvelope();
    delete env.data['srt:theme'];
    const res = validate(env);
    expect(res.ok).toBe(true);
    expect('srt:theme' in res.data).toBe(false);
  });

  it('drops unknown keys and is not vulnerable to prototype pollution', () => {
    // Build via raw JSON so "__proto__" is an own property (an object literal
    // would set the prototype instead).
    const text = JSON.stringify({ app: APP_ID, version: EXPORT_VERSION }).slice(0, -1) +
      ',"data":{"__proto__":{"polluted":true},"constructor":{"x":1},"srt:evil":{"y":1},"srt:theme":"dark"}}';
    const res = parseAndValidate(text);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ 'srt:theme': 'dark' }); // only the recognised key
    expect(Object.getPrototypeOf(res.data)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined(); // global Object.prototype untouched
  });
});

// ===========================================================================
// applyImport
// ===========================================================================
describe('applyImport', () => {
  it('writes blobs as JSON strings and theme raw', () => {
    const store = stubStorage();
    applyImport({ 'srt:phase1': { version: STATE_VERSION, cards: {} }, 'srt:theme': 'dark' });
    expect(JSON.parse(store.get('srt:phase1'))).toEqual({ version: STATE_VERSION, cards: {} });
    expect(store.get('srt:theme')).toBe('dark');
  });

  it('writes all five phase keys plus settings', () => {
    const store = stubStorage();
    const data = { 'srt:settings': { version: SETTINGS_VERSION } };
    for (const k of PHASE_KEYS) data[k] = { version: STATE_VERSION, cards: {} };
    applyImport(data);
    for (const k of PHASE_KEYS) expect(JSON.parse(store.get(k))).toEqual({ version: STATE_VERSION, cards: {} });
    expect(JSON.parse(store.get('srt:settings'))).toEqual({ version: SETTINGS_VERSION });
  });

  it('replaces, not merges: removes managed keys absent from the import', () => {
    const store = stubStorage({
      'srt:phase2': JSON.stringify({ version: STATE_VERSION, cards: { stale: {} } }),
      'srt:theme': 'light',
    });
    applyImport({ 'srt:phase1': { version: STATE_VERSION, cards: {} } });
    expect(JSON.parse(store.get('srt:phase1'))).toEqual({ version: STATE_VERSION, cards: {} });
    expect(store.has('srt:phase2')).toBe(false); // stale phase wiped
    expect(store.has('srt:theme')).toBe(false); // stale theme wiped
  });

  it('never touches non-managed localStorage keys', () => {
    const store = stubStorage({ 'unrelated:key': 'keep-me' });
    applyImport({ 'srt:phase1': { version: STATE_VERSION, cards: {} } });
    expect(store.get('unrelated:key')).toBe('keep-me');
  });

  it('does not throw on empty import data', () => {
    stubStorage({ 'srt:phase1': 'x' });
    expect(() => applyImport({})).not.toThrow();
  });
});

// ===========================================================================
// Round-trip integrity — the headline guarantee
// ===========================================================================
describe('round-trip integrity', () => {
  // Realistic, deeply-nested full state across all seven keys.
  const fullState = () => ({
    'srt:phase0': { version: STATE_VERSION, cards: { 'dur:quarter': { box: 4, dueAt: 1717459200000, seen: 12, correct: 11, timeMs: 31000 } }, daily: { day: '2026-06-04', introduced: 3 }, history: { '2026-06-04': { seen: 12, correct: 11 } }, lifetime: { seen: 40, correct: 33 } },
    'srt:phase1': { version: STATE_VERSION, cards: { 'treble:60': { box: 2, dueAt: 0, seen: 5, correct: 4, timeMs: 9000 }, 'bass:48': { box: 0, dueAt: 1, seen: 1, correct: 0, timeMs: 4200 } }, daily: { day: '2026-06-04', introduced: 2 }, history: {} },
    'srt:phase2': { version: STATE_VERSION, cards: {}, daily: { day: '2026-06-04', introduced: 0 } },
    'srt:phase3': { version: STATE_VERSION, cards: { 'treble:G': { box: 3, dueAt: 99, seen: 8, correct: 8, timeMs: 16000 } }, daily: { day: '2026-06-04', introduced: 1 } },
    'srt:phase4': { version: STATE_VERSION, cards: { 'treble:P5': { box: 1, dueAt: 5, seen: 2, correct: 1, timeMs: 6000 } }, daily: { day: '2026-06-04', introduced: 1 } },
    'srt:settings': { version: SETTINGS_VERSION, answerMode: 'piano', treble: true, bass: false, newCardsPerDay: 7, ledgerLines: 3, durationNames: 'british' },
    'srt:theme': 'dark',
  });

  it('export → file → validate → import reproduces every key exactly', () => {
    const source = fullState();
    const seed = {};
    for (const k of PHASE_KEYS.concat('srt:settings')) seed[k] = JSON.stringify(source[k]);
    seed['srt:theme'] = source['srt:theme'];
    stubStorage(seed);

    // Export, serialize the way triggerDownload does (pretty-printed).
    const text = JSON.stringify(buildExport(), null, 2);

    // Fresh device: validate the file, then write it back.
    const dest = stubStorage({});
    const res = parseAndValidate(text);
    expect(res.ok).toBe(true);
    applyImport(res.data);

    for (const k of PHASE_KEYS.concat('srt:settings')) {
      expect(JSON.parse(dest.get(k))).toEqual(source[k]); // deep, exact — no loss/mangle
    }
    expect(dest.get('srt:theme')).toBe(source['srt:theme']);
  });

  it('is idempotent: re-exporting an imported device yields the same data', () => {
    const source = fullState();
    const seed = {};
    for (const k of PHASE_KEYS.concat('srt:settings')) seed[k] = JSON.stringify(source[k]);
    seed['srt:theme'] = source['srt:theme'];

    // First export from the source store.
    stubStorage(seed);
    const data1 = buildExport().data;

    // Import into a fresh store, then export again — the second export must match.
    stubStorage({});
    const res = parseAndValidate(JSON.stringify({ app: APP_ID, version: EXPORT_VERSION, data: data1 }));
    expect(res.ok).toBe(true);
    applyImport(res.data);
    const data2 = buildExport().data;

    expect(data2).toEqual(data1);
  });
});
