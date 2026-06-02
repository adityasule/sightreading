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
