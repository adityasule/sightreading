// Music helpers + the Phase 1 note deck.
//
// Phase 1 trains note-name recall, so the deck is intentionally small and
// hardcoded: naturals only (no accidentals yet), across a fixed range per
// clef. A "card" is one (clef, midi) pair with a stable id like "treble:60".

// Natural pitch classes only. Index 0 = C. `null` = a black key (skipped).
const NATURAL = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

// Fixed ranges (inclusive), naturals only:
//   treble  C4 (middle C, one ledger below) .. A5
//   bass    G2 .. E4 (middle C, one ledger above)
const RANGES = {
  treble: { lo: 60, hi: 81 },
  bass: { lo: 43, hi: 64 },
};

/** Scientific octave for a MIDI number (MIDI 60 → C4). */
export function midiOctave(midi) {
  return Math.floor(midi / 12) - 1;
}

/** Natural letter name for a MIDI number, or null for accidentals. */
export function midiLetter(midi) {
  return NATURAL[midi % 12] ?? null;
}

/** VexFlow key string, e.g. 60 → "c/4". Naturals only. */
export function midiToVexKey(midi) {
  const letter = midiLetter(midi);
  if (!letter) return null;
  return `${letter.toLowerCase()}/${midiOctave(midi)}`;
}

function cardsForClef(clef) {
  const { lo, hi } = RANGES[clef];
  const out = [];
  for (let midi = lo; midi <= hi; midi++) {
    const letter = midiLetter(midi);
    if (!letter) continue; // skip accidentals — Phase 1 is naturals only
    out.push({
      id: `${clef}:${midi}`,
      clef,
      midi,
      letter,
      octave: midiOctave(midi),
      vexKey: midiToVexKey(midi),
    });
  }
  return out;
}

/**
 * Build the active deck from settings. Only the enabled clefs are included,
 * so toggling a clef in Settings reshapes the deck immediately.
 */
export function buildDeck(settings) {
  const deck = [];
  if (settings.treble) deck.push(...cardsForClef('treble'));
  if (settings.bass) deck.push(...cardsForClef('bass'));
  return deck;
}

/** The seven note-name buttons, in alphabetical order. */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
