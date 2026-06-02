// Music helpers + the Phase 1 note deck.
//
// Phase 1 trains note-name recall: naturals *and* accidentals. A "card" is one
// rendered note with a stable id. Naturals keep their bare id (`treble:60`) so
// progress saved before accidentals existed still counts; accidentals append
// the spelling (`treble:61:#` for C♯, `treble:61:b` for D♭ — the same piano
// key, but two distinct prompts because they read differently on the staff).

// Natural pitch classes only. Index 0 = C. `null` = a black key.
const NATURAL = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

// Black-key pitch class → its two spellings: the sharp of the natural below,
// and the flat of the natural above. Both spellings share the same octave as
// the raw MIDI number (no B♯/C♭ here, so there's never an octave crossing).
const ACCIDENTAL_SPELLINGS = {
  1: [{ letter: 'C', accidental: '#' }, { letter: 'D', accidental: 'b' }],
  3: [{ letter: 'D', accidental: '#' }, { letter: 'E', accidental: 'b' }],
  6: [{ letter: 'F', accidental: '#' }, { letter: 'G', accidental: 'b' }],
  8: [{ letter: 'G', accidental: '#' }, { letter: 'A', accidental: 'b' }],
  10: [{ letter: 'A', accidental: '#' }, { letter: 'B', accidental: 'b' }],
};

// The staff's outer lines per clef, as natural MIDI notes. The deck range
// extends a configurable number of ledger lines above the top line and below
// the bottom line. Ledger lines sit a third apart (two letter steps), so the
// range is found by walking the natural scale, not by counting semitones.
const STAFF_LINES = {
  treble: { bottom: 64, top: 77 }, // E4 .. F5
  bass: { bottom: 43, top: 57 }, // G2 .. A3
};

// Default ledger lines above/below each staff when settings don't specify.
export const DEFAULT_LEDGER_LINES = 2;

// Natural pitch classes in letter order (C D E F G A B), for diatonic stepping.
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

// Move a natural MIDI note by `steps` diatonic (letter) steps — positive up,
// negative down. Used to find the note sitting on the Nth ledger line.
function stepNatural(midi, steps) {
  let block = Math.floor(midi / 12);
  let idx = NATURAL_PCS.indexOf(midi % 12) + steps;
  block += Math.floor(idx / 7);
  idx = ((idx % 7) + 7) % 7;
  return block * 12 + NATURAL_PCS[idx];
}

// Inclusive MIDI range for a clef at a given ledger-line depth. The endpoints
// are the naturals on the Nth ledger line above the top line and below the
// bottom line; notes in the spaces between are included automatically.
function rangeFor(clef, ledgerLines) {
  const { bottom, top } = STAFF_LINES[clef];
  return {
    lo: stepNatural(bottom, -2 * ledgerLines),
    hi: stepNatural(top, 2 * ledgerLines),
  };
}

const ACC_SYMBOL = { '': '', '#': '♯', b: '♭' };

/** Scientific octave for a MIDI number (MIDI 60 → C4). */
export function midiOctave(midi) {
  return Math.floor(midi / 12) - 1;
}

/** Natural letter name for a MIDI number, or null for accidentals. */
export function midiLetter(midi) {
  return NATURAL[midi % 12] ?? null;
}

/** Display name for a spelling, e.g. ('C', '#') → "C♯", ('E', '') → "E". */
export function noteName(letter, accidental) {
  return letter + ACC_SYMBOL[accidental];
}

/** VexFlow key string for a spelling, e.g. ('c', '#', 4) → "c#/4". */
function vexKeyFor(letter, accidental, octave) {
  return `${letter.toLowerCase()}${accidental}/${octave}`;
}

/** VexFlow key string for a natural MIDI number, e.g. 60 → "c/4". */
export function midiToVexKey(midi) {
  const letter = midiLetter(midi);
  if (!letter) return null;
  return vexKeyFor(letter, '', midiOctave(midi));
}

function makeCard({ clef, midi, letter, accidental }) {
  const octave = midiOctave(midi);
  return {
    id: `${clef}:${midi}${accidental ? `:${accidental}` : ''}`,
    clef,
    midi,
    pc: midi % 12, // pitch class — what the Piano grades by (octave-agnostic)
    letter,
    accidental, // '' | '#' | 'b'
    name: noteName(letter, accidental),
    octave,
    vexKey: vexKeyFor(letter, accidental, octave),
  };
}

function cardsForClef(clef, ledgerLines) {
  const { lo, hi } = rangeFor(clef, ledgerLines);
  const out = [];
  for (let midi = lo; midi <= hi; midi++) {
    const natural = midiLetter(midi);
    if (natural) {
      out.push(makeCard({ clef, midi, letter: natural, accidental: '' }));
    } else {
      for (const sp of ACCIDENTAL_SPELLINGS[midi % 12]) {
        out.push(makeCard({ clef, midi, letter: sp.letter, accidental: sp.accidental }));
      }
    }
  }
  return out;
}

/**
 * Build the active deck from settings. Only the enabled clefs are included,
 * so toggling a clef in Settings reshapes the deck immediately.
 */
export function buildDeck(settings) {
  const ledgerLines = settings.ledgerLines ?? DEFAULT_LEDGER_LINES;
  const deck = [];
  if (settings.treble) deck.push(...cardsForClef('treble', ledgerLines));
  if (settings.bass) deck.push(...cardsForClef('bass', ledgerLines));
  return deck;
}

// ── Curriculum: scale-based learning progression (M1d) ──────────────────────
//
// New cards are introduced grouped by scale, in circle-of-fifths order, one
// level at a time. Each level adds the fewest new accidentals (the natural
// difficulty gradient for a reader). A natural minor shares its relative
// major's note set, so the two pair onto one level for free — hence the
// "X major / Y minor" labels. Full rationale in GOALS.md → Design Notes →
// Learning progression.
//
// Level 1 (C major / A minor) is the naturals foundation, large enough to split
// by register: on-staff naturals first (quick wins), then the harder ledger
// lines. Levels 2–11 each introduce one black-key spelling in its home key.
// Each level's `index` is its stable canonical position (0–11), used for
// persistence and migration; this array is the single source of truth.
const SEQUENCE = [
  { key: 'C', label: 'C major / A minor', sub: 'On-staff naturals', foundation: 'onstaff', keySig: 'no sharps or flats' },
  { key: 'C', label: 'C major / A minor', sub: 'Ledger lines', foundation: 'ledger', keySig: 'no sharps or flats' },
  { key: 'G', label: 'G major / E minor', newSpelling: 'F#', keySig: '1 sharp' },
  { key: 'F', label: 'F major / D minor', newSpelling: 'Bb', keySig: '1 flat' },
  { key: 'D', label: 'D major / B minor', newSpelling: 'C#', keySig: '2 sharps' },
  { key: 'Bb', label: 'B♭ major / G minor', newSpelling: 'Eb', keySig: '2 flats' },
  { key: 'A', label: 'A major / F♯ minor', newSpelling: 'G#', keySig: '3 sharps' },
  { key: 'Eb', label: 'E♭ major / C minor', newSpelling: 'Ab', keySig: '3 flats' },
  { key: 'E', label: 'E major / C♯ minor', newSpelling: 'D#', keySig: '4 sharps' },
  { key: 'Ab', label: 'A♭ major / F minor', newSpelling: 'Db', keySig: '4 flats' },
  { key: 'B', label: 'B major / G♯ minor', newSpelling: 'A#', keySig: '5 sharps' },
  { key: 'Db', label: 'D♭ major / B♭ minor', newSpelling: 'Gb', keySig: '5 flats' },
];

/** The ordered scale curriculum, each entry stamped with its canonical index. */
export const SCALE_SEQUENCE = SEQUENCE.map((lvl, index) => ({ index, ...lvl }));

// Black-key spelling (`letter+accidental`, e.g. "F#") → the level that
// introduces it, derived from SEQUENCE so the mapping never drifts from it.
const SPELLING_LEVEL = {};
for (const lvl of SCALE_SEQUENCE) {
  if (lvl.newSpelling) SPELLING_LEVEL[lvl.newSpelling] = lvl.index;
}

/**
 * Is this card's note within the staff's outer lines (on-staff), as opposed to
 * out on a ledger line above/below? Drives the foundation's register split and
 * the on-staff-before-ledger introduction order within every level.
 */
export function isOnStaff(card) {
  const { bottom, top } = STAFF_LINES[card.clef];
  return card.midi >= bottom && card.midi <= top;
}

// The middle-C anchor cluster (M2b): middle C (MIDI 60) and its immediate
// natural neighbours B3 (59) and D4 (62). Middle C is a *ledger* note on both
// clefs, so on-staff-first ordering would normally defer it — but it is the
// canonical reading reference, so the cluster anchors the very start of the
// foundation, introduced before the rest of the on-staff naturals. See
// GOALS.md → Design Notes → Middle C anchor.
const ANCHOR_MIDIS = new Set([59, 60, 62]);

/** Is this card part of the middle-C anchor cluster (natural B3 / C4 / D4)? */
export function isAnchor(card) {
  return card.accidental === '' && ANCHOR_MIDIS.has(card.midi);
}

// Sort key floating the anchor cluster to the front of its level, middle C
// leading (distance from MIDI 60: C4→0, B3→1, D4→2). Non-anchor cards share a
// large constant so they keep their on-staff-then-pitch order untouched.
function anchorRank(card) {
  return isAnchor(card) ? Math.abs(card.midi - 60) : 100;
}

// The canonical level index a card belongs to: naturals go to the foundation
// (split by register, but the anchor cluster joins the on-staff sub-level even
// though it is on ledger lines), each black-key spelling to its home key.
function levelIndexFor(card) {
  if (card.accidental === '') return isOnStaff(card) || isAnchor(card) ? 0 : 1;
  return SPELLING_LEVEL[card.letter + card.accidental];
}

/**
 * Bucket a live deck into its ordered scale levels. Returns only the levels
 * that have at least one in-range card (so narrowing the range or disabling a
 * clef simply drops the levels that lose all their cards), each carrying its
 * `SCALE_SEQUENCE` metadata plus a `cards` array sorted anchor-then-on-staff-
 * then-pitch — the order new cards are introduced within the level. The anchor
 * cluster only ever lands in the foundation (level 0), so the extra key is a
 * no-op everywhere else.
 */
export function levelsFor(deck) {
  const byIndex = new Map();
  for (const card of deck) {
    const idx = levelIndexFor(card);
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx).push(card);
  }
  const levels = [];
  for (const meta of SCALE_SEQUENCE) {
    const cards = byIndex.get(meta.index);
    if (!cards || cards.length === 0) continue;
    cards.sort(
      (a, b) =>
        anchorRank(a) - anchorRank(b) || isOnStaff(b) - isOnStaff(a) || a.midi - b.midi
    );
    levels.push({ ...meta, cards });
  }
  return levels;
}

/** The seven note-name buttons, in alphabetical order. */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Sharp/flat modifiers for the Letters answer pad. */
export const ACCIDENTALS = [
  { value: '#', symbol: '♯', label: 'Sharp' },
  { value: 'b', symbol: '♭', label: 'Flat' },
];

// Pitch class for each letter name (used to grade Letters input by key too,
// so keyboard letters still work in Piano mode).
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class for a (letter, accidental) spelling. */
export function pcOf(letter, accidental) {
  const base = LETTER_PC[letter];
  if (accidental === '#') return (base + 1) % 12;
  if (accidental === 'b') return (base + 11) % 12;
  return base;
}

// Display name per pitch class, for Piano feedback ("you picked …"). Black
// keys show both enharmonic spellings since one key serves both.
const PC_NAMES = {
  0: 'C',
  1: 'C♯/D♭',
  2: 'D',
  3: 'D♯/E♭',
  4: 'E',
  5: 'F',
  6: 'F♯/G♭',
  7: 'G',
  8: 'G♯/A♭',
  9: 'A',
  10: 'A♯/B♭',
  11: 'B',
};

/** Friendly name for a pitch class, e.g. 1 → "C♯/D♭". */
export function pcName(pc) {
  return PC_NAMES[pc];
}

// ── Phase 0 (Basics) ─────────────────────────────────────────────────────────
//
// The gentle, multiple-choice on-ramp before Phase 1's pitch reading. Basics is
// symbol recognition, not note naming: the user identifies a *time value* — a
// note's duration (plain or dotted) or a rest's — or a clef symbol. Pitch is
// deliberately out of scope here (reading note names is Phase 1 / Notation), so
// note/rest cards render on a *clef-less* staff at a fixed position and the note
// is never named; clef cards are the only ones that show a clef in isolation.
// Each card carries a `type` ('note' | 'rest' | 'clef') so the renderer and the
// option set branch on it. Phase 0 persists under its own blob (srt:phase0) and
// reuses the generic scheduler + the multiple-choice answer pad.

/** In-place Fisher–Yates shuffle; returns the same array for chaining. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * A shuffled multiple-choice set for a Basics card: the `correct` value plus
 * distinct distractors drawn from `pool`, `count` entries total (clamped to the
 * pool size). Generic over the card kind so every Basics type — note name and,
 * from M2d, duration / rest / clef — shares one option builder. The correct
 * answer's slot is randomised so its position never gives it away.
 */
export function choices(correct, pool, count = 4) {
  const distractors = shuffle(pool.filter((v) => v !== correct));
  return shuffle([correct, ...distractors.slice(0, Math.max(0, count - 1))]);
}

// The six note durations, sixteenth → double whole (GOALS Phase 0 scope). Each
// seeds a note card and a rest card; `value` is the stable, naming-independent
// grading key (and id suffix), `vex` the VexFlow duration code, and british/
// american the display labels picked by the Settings naming convention. Ordered
// longest-common-first (the order new cards are introduced); the rare breve
// comes last.
const DURATIONS = [
  { value: 'whole', vex: 'w', beats: 4, british: 'Semibreve', american: 'Whole note' },
  { value: 'half', vex: 'h', beats: 2, british: 'Minim', american: 'Half note' },
  { value: 'quarter', vex: 'q', beats: 1, british: 'Crotchet', american: 'Quarter note' },
  { value: 'eighth', vex: '8', beats: 0.5, british: 'Quaver', american: 'Eighth note' },
  { value: 'sixteenth', vex: '16', beats: 0.25, british: 'Semiquaver', american: 'Sixteenth note' },
  { value: 'breve', vex: '1/2', beats: 8, british: 'Breve', american: 'Double whole note' },
];

const DURATION_BY_VALUE = Object.fromEntries(DURATIONS.map((d) => [d.value, d]));

/** The duration grading keys, in teaching order — also the `choices` pool. */
export const DURATION_VALUES = DURATIONS.map((d) => d.value);

// The durations that also get a dotted variant (a dot adds half the note's
// length). The common three a beginner meets first — dotted breve/whole/
// sixteenth are rare and left out (GOALS M2d). Dotted rests are out of scope.
const DOTTED_VALUES = ['half', 'quarter', 'eighth'];

// A dotted note's grading key is the base value with a trailing dot ('half.'),
// keeping it distinct from the plain note in the same option pool.
const dottedKey = (value) => `${value}.`;

/** Note-card option pool: the 6 plain durations plus the 3 dotted variants. */
export const NOTE_KEYS = [...DURATION_VALUES, ...DOTTED_VALUES.map(dottedKey)];

/** Rest-card option pool — the same six duration values, labelled as rests. */
export const REST_VALUES = DURATION_VALUES;

/** Clef-card option pool — the two clefs the user distinguishes. */
export const CLEF_VALUES = ['treble', 'bass'];

/** The `choices` pool for a Basics card type. */
export function optionPoolFor(type) {
  if (type === 'rest') return REST_VALUES;
  if (type === 'clef') return CLEF_VALUES;
  return NOTE_KEYS;
}

/**
 * Display label for a duration `value` under a naming convention. Defaults to
 * British (semibreve, minim, crotchet, …); 'american' gives whole/half/quarter.
 */
export function durationLabel(value, convention = 'british') {
  const d = DURATION_BY_VALUE[value];
  return convention === 'american' ? d.american : d.british;
}

/**
 * Label for a note-card key: a plain duration ('half' → "Minim" / "Half note")
 * or a dotted one ('half.' → "Dotted minim" / "Dotted half note").
 */
export function noteLabel(key, convention = 'british') {
  if (key.endsWith('.')) {
    return `Dotted ${durationLabel(key.slice(0, -1), convention).toLowerCase()}`;
  }
  return durationLabel(key, convention);
}

/**
 * Label for a rest card: the natural rest name in either convention — British
 * "Crotchet rest", American "Quarter rest" (the American note labels end in
 * " note", which is dropped before appending " rest"; British never do, so the
 * strip is a no-op there). "Double whole note" → "Double whole rest".
 */
export function restLabel(value, convention = 'british') {
  return `${durationLabel(value, convention).replace(/ note$/, '')} rest`;
}

/** Label for a clef card, e.g. 'treble' → "Treble clef". */
export function clefLabel(clef) {
  return `${clef[0].toUpperCase()}${clef.slice(1)} clef`;
}

/**
 * Length in beats of a note/rest `key`, with the quarter note as the reference
 * (1 beat) — the de-facto teaching default. A dot adds half the value, so the
 * dotted keys ('half.') are ×1.5. Rests share their note's length.
 */
export function beatsForKey(key) {
  if (key.endsWith('.')) return DURATION_BY_VALUE[key.slice(0, -1)].beats * 1.5;
  return DURATION_BY_VALUE[key].beats;
}

// Tidy vulgar fractions for the sub-beat lengths, so labels read "½ beat" not
// "0.5 beats".
const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** Human beat-count label, e.g. 1 → "1 beat", 1.5 → "1½ beats", 0.5 → "½ beat". */
export function beatsLabel(beats) {
  const whole = Math.floor(beats);
  const frac = FRACTIONS[beats - whole] ?? '';
  const num = whole > 0 ? `${whole}${frac}` : frac || '0';
  return `${num} ${beats > 1 ? 'beats' : 'beat'}`;
}

/**
 * Display label for a Basics card's option `key`, dispatched on `type`. Note and
 * rest options carry their length in beats alongside the name (e.g. "Crotchet ·
 * 1 beat") so the student associates the symbol with its duration; clefs have no
 * beat value.
 */
export function basicsLabel(type, key, convention = 'british') {
  if (type === 'clef') return clefLabel(key);
  const name = type === 'rest' ? restLabel(key, convention) : noteLabel(key, convention);
  return `${name} · ${beatsLabel(beatsForKey(key))}`;
}

/**
 * Build the Phase 0 deck: note cards (6 plain + 3 dotted), rest cards (6), and
 * clef cards (2), in teaching order. Clef- and range-independent (pitch is out
 * of scope here), so unlike the Phase 1 deck it takes no settings — the answer
 * *labels*, not the cards, follow the British/American naming convention. Each
 * card's `key` is its grading value; render data is `vex` (+ `dotted`) for
 * note/rest glyphs and `clef` for clef cards.
 */
export function buildBasicsDeck() {
  const notes = DURATIONS.map((d) => ({
    type: 'note', id: `dur:${d.value}`, key: d.value, vex: d.vex, dotted: false,
  }));
  const dotted = DOTTED_VALUES.map((v) => ({
    type: 'note', id: `dur:${v}:dot`, key: dottedKey(v), vex: DURATION_BY_VALUE[v].vex, dotted: true,
  }));
  const rests = DURATIONS.map((d) => ({
    type: 'rest', id: `rest:${d.value}`, key: d.value, vex: d.vex,
  }));
  const clefs = CLEF_VALUES.map((clef) => ({
    type: 'clef', id: `clef:${clef}`, key: clef, clef,
  }));
  return [...notes, ...dotted, ...rests, ...clefs];
}
