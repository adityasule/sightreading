// Phase 2 (Chords): major / minor triad recognition.
//
// The user is shown a three-note triad on a single staff and picks its name —
// root + quality only (e.g. "C major", "A minor") — by multiple choice. The
// chord is drawn in a *randomised* voicing each time (root position, first or
// second inversion, at a varied register), so a card is mastered by recognising
// the chord regardless of how it's stacked. Introduction is ordered by the
// circle of fifths, paired into levels like Notation's scale curriculum.
//
// Layering mirrors Phase 1: this module is the curriculum *model* + deck (pure,
// card-agnostic data); the generic Leitner scheduler (spaced-repetition.js) and
// the pluggable progression layer (progression.js, handed `chordLevelsFor`) do
// the scheduling. Rendering lives in render.js (`drawChord`), fed the vex keys +
// accidentals this module computes.

import { pcOf, noteName } from './music.js';

// Natural pitch class per letter, and the diatonic letter order starting at C
// (so an octave boundary falls between B and the next C — matching scientific
// pitch notation, where the octave number increments at C).
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_INDEX = Object.fromEntries(LETTER_ORDER.map((l, i) => [l, i]));

// Semitones above the root for each triad tone, per quality. The fifth is
// perfect (7) for both; only the third differs (major 4, minor 3).
const THIRD_SEMITONES = { major: 4, minor: 3 };
const FIFTH_SEMITONES = 7;

// Split a root spelling string ('C', 'F#', 'Bb') into letter + accidental.
function parseRoot(root) {
  return { letter: root[0], accidental: root.slice(1) }; // '' | '#' | 'b'
}

// The accidental ('' | '#' | 'b') that turns `letter`'s natural pitch class into
// `pc`. Triads in scope only ever need a natural, a single sharp or a single
// flat (verified across all 22 curriculum chords — no double accidentals), so a
// diff of ±1 / 0 is exhaustive; anything else is a bug in the chord data.
function accidentalFor(letter, pc) {
  const diff = (((pc - LETTER_PC[letter]) % 12) + 12) % 12;
  if (diff === 0) return '';
  if (diff === 1) return '#';
  if (diff === 11) return 'b';
  throw new Error(`No single accidental spells pc ${pc} on letter ${letter}`);
}

/**
 * The three tones of a triad, lowest-first in root position: root, third, fifth.
 * Each carries its correct spelling — `letter`, `accidental` ('' | '#' | 'b')
 * and pitch class `pc`. Letters stack by thirds (root, +2, +4 letter steps); the
 * accidental on each is whatever hits the major/minor interval. Octave-free; the
 * voicing layer assigns octaves.
 */
export function chordTones(root, quality) {
  const { letter, accidental } = parseRoot(root);
  const rootPc = pcOf(letter, accidental);
  const r = LETTER_INDEX[letter];
  const semis = [0, THIRD_SEMITONES[quality], FIFTH_SEMITONES];
  return semis.map((semi, step) => {
    const toneLetter = LETTER_ORDER[(r + step * 2) % 7];
    const pc = (rootPc + semi) % 12;
    return { letter: toneLetter, accidental: accidentalFor(toneLetter, pc), pc };
  });
}

// MIDI number for a tone at a scientific octave (MIDI 60 = C4). No B♯/C♭ in the
// chord set, so the spelled pitch class never crosses an octave boundary and
// `12*(octave+1) + pc` is exact.
function toneMidi(tone, octave) {
  return 12 * (octave + 1) + tone.pc;
}

// VexFlow key string for a tone at an octave, e.g. ('b','b',3) → "bb/3".
function toneVexKey(tone, octave) {
  return `${tone.letter.toLowerCase()}${tone.accidental}/${octave}`;
}

// Where each tone sits for a given inversion, as [toneIndex, diatonicSteps] from
// the root: root position stacks 0/+2/+4 letter steps; each inversion lifts the
// lowest note(s) up an octave (+7 steps). Always listed low→high (what VexFlow
// expects for a chord's keys).
const INVERSION_LAYOUT = {
  0: [[0, 0], [1, 2], [2, 4]], // root position
  1: [[1, 2], [2, 4], [0, 7]], // 1st inversion — third in the bass, root on top
  2: [[2, 4], [0, 7], [1, 9]], // 2nd inversion — fifth in the bass
};

/** The three supported inversions: 0 root, 1 first, 2 second. */
export const INVERSIONS = [0, 1, 2];

/**
 * Lay a chord out as VexFlow draw data for a given `inversion` and root `octave`
 * (the scientific octave the root would sit in *in root position* — the anchor
 * for the whole voicing). Pure and deterministic. Returns:
 *   keys         ['e/4','g/4','c/5']            low→high vex keys
 *   accidentals  [{ index, type }]              only the notes needing a glyph
 *   midis        [64,67,72]                     for register-bound checks
 */
export function chordVoicing({ root, quality }, inversion, octave) {
  const tones = chordTones(root, quality);
  const base = octave * 7 + LETTER_INDEX[tones[0].letter]; // root's diatonic index
  const placed = INVERSION_LAYOUT[inversion].map(([toneIndex, steps]) => {
    const abs = base + steps;
    return { tone: tones[toneIndex], octave: Math.floor(abs / 7) };
  });
  return {
    keys: placed.map((p) => toneVexKey(p.tone, p.octave)),
    accidentals: placed
      .map((p, index) => ({ index, type: p.tone.accidental }))
      .filter((a) => a.type !== ''),
    midis: placed.map((p) => toneMidi(p.tone, p.octave)),
  };
}

// Comfortable MIDI window per clef — a voicing is allowed only if all three
// notes fall inside it, so chords stay within ~2–3 ledger lines of the staff
// (treble E4–F5 = 64–77, bass G2–A3 = 43–57). This bounds the "varied register"
// so an inverted high-root chord never flies off the top.
const CLEF_WINDOW = {
  treble: { lo: 57, hi: 81 }, // A3 .. A5
  bass: { lo: 40, hi: 64 }, // E2 .. E4
};

// Root octaves to consider when searching for in-window placements (covers every
// clef's usable span; out-of-window ones are filtered out).
const CANDIDATE_OCTAVES = [2, 3, 4, 5];

/**
 * Every (inversion, octave) voicing of `card` that fits its clef's comfortable
 * window — the set the randomiser draws from, so each presentation varies the
 * inversion and the register while staying readable. Always non-empty (a triad
 * spans well under the window), so callers can pick freely.
 */
export function chordPlacements(card) {
  const win = CLEF_WINDOW[card.clef];
  const out = [];
  for (const inversion of INVERSIONS) {
    for (const octave of CANDIDATE_OCTAVES) {
      const { midis } = chordVoicing(card, inversion, octave);
      if (midis.every((m) => m >= win.lo && m <= win.hi)) out.push({ inversion, octave });
    }
  }
  return out;
}

/**
 * Pick a random in-window voicing for `card` and return it as draw data plus the
 * chosen `inversion`/`octave`. `rng` is injectable for deterministic tests. The
 * view freezes the result on the active card so the feedback re-render redraws
 * the *same* chord rather than re-rolling.
 */
export function pickVoicing(card, rng = Math.random) {
  const placements = chordPlacements(card);
  const { inversion, octave } = placements[Math.floor(rng() * placements.length)];
  return { inversion, octave, ...chordVoicing(card, inversion, octave) };
}

// ── Curriculum: circle-of-fifths chord levels ────────────────────────────────
//
// One level per key, in the same circle-of-fifths order Notation introduces the
// keys (alternating sharp/flat outward from C), each pairing the key's tonic
// major triad with its relative-minor triad — mirroring the "X major / Y minor"
// scale levels, minus the foundation's register split (a triad already spans
// three notes). Roots are stored explicitly (not parsed from the label) so the
// spelling can't drift. `keySig` matches the Notation curriculum's wording.
const SEQUENCE = [
  { key: 'C', label: 'C major / A minor', keySig: 'no sharps or flats', chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }] },
  { key: 'G', label: 'G major / E minor', keySig: '1 sharp', chords: [{ root: 'G', quality: 'major' }, { root: 'E', quality: 'minor' }] },
  { key: 'F', label: 'F major / D minor', keySig: '1 flat', chords: [{ root: 'F', quality: 'major' }, { root: 'D', quality: 'minor' }] },
  { key: 'D', label: 'D major / B minor', keySig: '2 sharps', chords: [{ root: 'D', quality: 'major' }, { root: 'B', quality: 'minor' }] },
  { key: 'Bb', label: 'B♭ major / G minor', keySig: '2 flats', chords: [{ root: 'Bb', quality: 'major' }, { root: 'G', quality: 'minor' }] },
  { key: 'A', label: 'A major / F♯ minor', keySig: '3 sharps', chords: [{ root: 'A', quality: 'major' }, { root: 'F#', quality: 'minor' }] },
  { key: 'Eb', label: 'E♭ major / C minor', keySig: '3 flats', chords: [{ root: 'Eb', quality: 'major' }, { root: 'C', quality: 'minor' }] },
  { key: 'E', label: 'E major / C♯ minor', keySig: '4 sharps', chords: [{ root: 'E', quality: 'major' }, { root: 'C#', quality: 'minor' }] },
  { key: 'Ab', label: 'A♭ major / F minor', keySig: '4 flats', chords: [{ root: 'Ab', quality: 'major' }, { root: 'F', quality: 'minor' }] },
  { key: 'B', label: 'B major / G♯ minor', keySig: '5 sharps', chords: [{ root: 'B', quality: 'major' }, { root: 'G#', quality: 'minor' }] },
  { key: 'Db', label: 'D♭ major / B♭ minor', keySig: '5 flats', chords: [{ root: 'Db', quality: 'major' }, { root: 'Bb', quality: 'minor' }] },
];

/** The ordered chord curriculum, each entry stamped with its canonical index. */
export const CHORD_SEQUENCE = SEQUENCE.map((lvl, index) => ({ index, ...lvl }));

/** Display label for a chord, e.g. ('Bb','major') → "B♭ major". */
export function chordLabel(root, quality) {
  const { letter, accidental } = parseRoot(root);
  return `${noteName(letter, accidental)} ${quality}`;
}

/** Grading/option key for a chord (clef-independent — the answer ignores clef). */
const chordKey = (root, quality) => `${root}:${quality}`;

/** The option pool for `choices`: every distinct chord key in the curriculum. */
export const CHORD_POOL = CHORD_SEQUENCE.flatMap((lvl) =>
  lvl.chords.map((c) => chordKey(c.root, c.quality))
);

// Label per chord key, for the multiple-choice options ('Bb:major' → "B♭ major").
const KEY_LABEL = Object.fromEntries(
  CHORD_SEQUENCE.flatMap((lvl) =>
    lvl.chords.map((c) => [chordKey(c.root, c.quality), chordLabel(c.root, c.quality)])
  )
);

/** Display label for a chord option key, e.g. 'Bb:major' → "B♭ major". */
export function chordOptionLabel(key) {
  return KEY_LABEL[key] ?? key;
}

function makeChordCard(clef, root, quality, level) {
  return {
    id: `${clef}:${root}:${quality}`,
    clef,
    root,
    quality,
    level,
    key: chordKey(root, quality), // grading key (clef-independent root + quality)
    name: chordLabel(root, quality),
  };
}

/**
 * Build the chord deck from settings. Only the enabled clefs are included, so
 * toggling a clef in Settings reshapes the deck immediately (as in Phase 1). A
 * card exists per (clef, root, quality); the voicing is chosen at render time,
 * not baked into the card.
 */
export function buildChordDeck(settings) {
  const clefs = [];
  if (settings.treble) clefs.push('treble');
  if (settings.bass) clefs.push('bass');
  const deck = [];
  for (const level of CHORD_SEQUENCE) {
    for (const { root, quality } of level.chords) {
      for (const clef of clefs) deck.push(makeChordCard(clef, root, quality, level.index));
    }
  }
  return deck;
}

// Introduction order within a level: major before minor, then treble before bass
// — a clef round-robin within each quality tier, so new cards fan out across the
// enabled clefs (the M2f lesson) instead of front-loading one clef.
const QUALITY_RANK = { major: 0, minor: 1 };
const CLEF_RANK = { treble: 0, bass: 1 };

function orderForIntroduction(cards) {
  return [...cards].sort(
    (a, b) =>
      QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality] ||
      (CLEF_RANK[a.clef] ?? 9) - (CLEF_RANK[b.clef] ?? 9)
  );
}

/**
 * Bucket a chord deck into its ordered curriculum levels — the chord analogue of
 * `levelsFor`, so the generic `progress`/`advance` can drive Phase 2 unchanged
 * (pass this as their `levelsFn`). Returns only levels with at least one in-deck
 * card, each carrying its `CHORD_SEQUENCE` metadata plus a `cards` array in
 * introduction order.
 */
export function chordLevelsFor(deck) {
  const byIndex = new Map();
  for (const card of deck) {
    if (!byIndex.has(card.level)) byIndex.set(card.level, []);
    byIndex.get(card.level).push(card);
  }
  const levels = [];
  for (const meta of CHORD_SEQUENCE) {
    const cards = byIndex.get(meta.index);
    if (!cards || cards.length === 0) continue;
    levels.push({ ...meta, cards: orderForIntroduction(cards) });
  }
  return levels;
}
