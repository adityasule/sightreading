// Phase 4 (Intervals): name the interval between two notes.
//
// The user is shown two notes a fixed interval apart — drawn left→right so the
// pair reads ascending or descending — and picks the interval by name (e.g.
// "Major 3rd", "Perfect 5th", "Tritone") by multiple choice. The *direction* and
// register are randomised each showing; only the interval is graded. Coverage:
// the 12 simple intervals within an octave (minor/major 2nd·3rd·6th·7th, the
// perfect 4th/5th/octave, and the tritone), introduced by difficulty/consonance
// — perfect intervals first, then thirds & sixths, then seconds & sevenths, the
// tritone last.
//
// Layering mirrors Chords: this module is the curriculum model + deck (pure,
// card-agnostic data); the generic Leitner scheduler (spaced-repetition.js) and
// the pluggable progression layer (progression.js, handed `intervalLevelsFor`)
// do the scheduling. Rendering lives in render.js (`drawInterval`), fed the vex
// keys + accidentals this module computes. The note pair is the interval
// analogue of a chord's voicing: chosen at render time, frozen per presentation.

// Natural pitch class per letter, and the diatonic letter order starting at C
// (octave boundary between B and the next C — scientific pitch notation).
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_INDEX = Object.fromEntries(LETTER_ORDER.map((l, i) => [l, i]));
// Natural pitch class → letter (the white keys), for picking natural base notes.
const NATURAL_LETTER = Object.fromEntries(
  Object.entries(LETTER_PC).map(([l, pc]) => [pc, l])
);

/** Scientific octave for a MIDI number (MIDI 60 → C4). */
function midiOctave(midi) {
  return Math.floor(midi / 12) - 1;
}

/** VexFlow key string, e.g. ('e','b',4) → "eb/4". */
function vexKey(letter, accidental, octave) {
  return `${letter.toLowerCase()}${accidental}/${octave}`;
}

// The 12 simple intervals. `value` is the stable grading key (and id suffix);
// `semitones` sizes the pitch gap; `steps` is the diatonic letter-step count, so
// the second note is spelled correctly (a major/minor 3rd both span 2 letters; a
// tritone is an augmented 4th — 3 letters — not a diminished 5th). `label` is
// the multiple-choice display name (universal — no British/American split).
const INTERVALS = [
  { value: 'm2', semitones: 1, steps: 1, label: 'Minor 2nd' },
  { value: 'M2', semitones: 2, steps: 1, label: 'Major 2nd' },
  { value: 'm3', semitones: 3, steps: 2, label: 'Minor 3rd' },
  { value: 'M3', semitones: 4, steps: 2, label: 'Major 3rd' },
  { value: 'P4', semitones: 5, steps: 3, label: 'Perfect 4th' },
  { value: 'TT', semitones: 6, steps: 3, label: 'Tritone' }, // augmented 4th spelling
  { value: 'P5', semitones: 7, steps: 4, label: 'Perfect 5th' },
  { value: 'm6', semitones: 8, steps: 5, label: 'Minor 6th' },
  { value: 'M6', semitones: 9, steps: 5, label: 'Major 6th' },
  { value: 'm7', semitones: 10, steps: 6, label: 'Minor 7th' },
  { value: 'M7', semitones: 11, steps: 6, label: 'Major 7th' },
  { value: 'P8', semitones: 12, steps: 7, label: 'Perfect octave' },
];

const INTERVAL_BY_VALUE = Object.fromEntries(INTERVALS.map((iv) => [iv.value, iv]));

// Curriculum: difficulty / consonance order, the tritone last. Perfect
// consonances (octave/5th/4th) read most distinctly, then the imperfect
// consonances (thirds & sixths), then the dissonances (seconds & sevenths), with
// the tritone — the hardest to place — on its own final level.
const SEQUENCE = [
  { label: 'Perfect intervals', intervals: ['P8', 'P5', 'P4'] },
  { label: 'Thirds & sixths', intervals: ['M3', 'm3', 'M6', 'm6'] },
  { label: 'Seconds & sevenths', intervals: ['M2', 'm2', 'M7', 'm7'] },
  { label: 'Tritone', intervals: ['TT'] },
];

/** The ordered interval curriculum, each level stamped with its canonical index. */
export const INTERVAL_SEQUENCE = SEQUENCE.map((lvl, index) => ({ index, ...lvl }));

// Interval value → the level that introduces it, derived from SEQUENCE so the
// mapping never drifts from it.
const INTERVAL_LEVEL = {};
for (const lvl of INTERVAL_SEQUENCE) {
  for (const v of lvl.intervals) INTERVAL_LEVEL[v] = lvl.index;
}

/** The option pool for `choices`: every interval value (curriculum order). */
export const INTERVAL_POOL = INTERVALS.map((iv) => iv.value);

/** Display label for an interval value, e.g. 'm3' → "Minor 3rd". */
export function intervalOptionLabel(value) {
  return INTERVAL_BY_VALUE[value]?.label ?? value;
}

// Comfortable MIDI window per clef — both notes of a pair must fall inside it, so
// the interval stays within ~3 ledger lines of the staff (shared with the chord
// engine's bounds). An octave (12 semitones) fits comfortably in each window.
const CLEF_WINDOW = {
  treble: { lo: 57, hi: 81 }, // A3 .. A5
  bass: { lo: 40, hi: 64 }, // E2 .. E4
};

// Spell the second note of `interval` from a natural `base` ({letter, octave,
// midi}), stepping `direction` ('asc' | 'desc'). The second letter is `steps`
// diatonic steps from the base; its accidental is whatever single ♯/♮/♭ lands on
// the target pitch. Returns null if no single accidental fits (a double-accidental
// spelling) — those base/direction combos are simply skipped by the placer.
function spellSecond(base, interval, direction) {
  const { steps, semitones } = interval;
  const pos = base.octave * 7 + LETTER_INDEX[base.letter];
  const pos2 = direction === 'asc' ? pos + steps : pos - steps;
  const letter2 = LETTER_ORDER[((pos2 % 7) + 7) % 7];
  const octave2 = Math.floor(pos2 / 7);
  const naturalMidi2 = 12 * (octave2 + 1) + LETTER_PC[letter2];
  const targetMidi = direction === 'asc' ? base.midi + semitones : base.midi - semitones;
  const diff = targetMidi - naturalMidi2;
  const accidental = diff === 0 ? '' : diff === 1 ? '#' : diff === -1 ? 'b' : null;
  if (accidental === null) return null;
  return { letter: letter2, accidental, octave: octave2, midi: targetMidi };
}

// Build the draw data for a placement, or null if it doesn't fit the window /
// needs a double accidental. The base note is drawn first, the second note next,
// so the pair reads left→right in its direction.
function noteData(base, interval, direction, win) {
  const second = spellSecond(base, interval, direction);
  if (!second) return null;
  if (second.midi < win.lo || second.midi > win.hi) return null;
  const accidentals = [];
  if (second.accidental) accidentals.push({ index: 1, type: second.accidental });
  return {
    direction,
    keys: [vexKey(base.letter, '', base.octave), vexKey(second.letter, second.accidental, second.octave)],
    accidentals,
    midis: [base.midi, second.midi],
  };
}

/**
 * Every valid (direction, register) placement of `card`'s interval that fits its
 * clef's comfortable window with a single-accidental spelling — the set the
 * randomiser draws from, so each presentation varies the direction and register.
 * The base note is always a natural (white key); the second note takes whatever
 * single accidental the interval needs. Always non-empty (an ascending interval
 * from middle C fits both windows). Deterministic and pure (ascending placements
 * first, then by ascending base pitch), so the dev render script can take the
 * first for stable output.
 */
export function intervalPlacements(card) {
  const interval = INTERVAL_BY_VALUE[card.value];
  const win = CLEF_WINDOW[card.clef];
  const out = [];
  for (const direction of ['asc', 'desc']) {
    for (let midi = win.lo; midi <= win.hi; midi++) {
      const letter = NATURAL_LETTER[midi % 12];
      if (!letter) continue; // only natural base notes
      const data = noteData({ letter, octave: midiOctave(midi), midi }, interval, direction, win);
      if (data) out.push(data);
    }
  }
  return out;
}

/**
 * Pick a random valid placement for `card` (direction + register) and return its
 * draw data: `keys` (two vex keys, base first), `accidentals` ([{ index, type }],
 * only the second note can carry one), `midis`, and `direction`. `rng` is
 * injectable for deterministic tests / the dev render script. The view freezes
 * the result on the active card so the feedback re-render redraws the *same* pair
 * rather than re-rolling (mirroring chord voicing).
 */
export function pickIntervalNotes(card, rng = Math.random) {
  const placements = intervalPlacements(card);
  return placements[Math.floor(rng() * placements.length)];
}

function makeIntervalCard(clef, interval) {
  return {
    id: `${clef}:${interval.value}`,
    clef,
    value: interval.value,
    level: INTERVAL_LEVEL[interval.value],
    key: interval.value, // grading key (clef-independent interval)
    name: interval.label,
  };
}

/**
 * Build the interval deck from settings. Only the enabled clefs are included, so
 * toggling a clef in Settings reshapes the deck immediately (as in Phase 1/2). A
 * card exists per (clef, interval); the note pair is chosen at render time, not
 * baked into the card.
 */
export function buildIntervalDeck(settings) {
  const clefs = [];
  if (settings.treble) clefs.push('treble');
  if (settings.bass) clefs.push('bass');
  const deck = [];
  for (const interval of INTERVALS) {
    for (const clef of clefs) deck.push(makeIntervalCard(clef, interval));
  }
  return deck;
}

// Introduction order within a level: by the level's listed interval order, then
// treble before bass — a clef round-robin so new cards fan out across the enabled
// clefs (the M2f lesson) instead of front-loading one clef.
const CLEF_RANK = { treble: 0, bass: 1 };

function orderForIntroduction(cards, order) {
  return [...cards].sort(
    (a, b) =>
      order.indexOf(a.value) - order.indexOf(b.value) ||
      (CLEF_RANK[a.clef] ?? 9) - (CLEF_RANK[b.clef] ?? 9)
  );
}

/**
 * Bucket an interval deck into its ordered curriculum levels — the interval
 * analogue of `levelsFor`/`chordLevelsFor`, so the generic `progress`/`advance`
 * can drive Phase 4 unchanged (pass this as their `levelsFn`). Returns only
 * levels with at least one in-deck card, each carrying its `INTERVAL_SEQUENCE`
 * metadata plus a `cards` array in introduction order.
 */
export function intervalLevelsFor(deck) {
  const byIndex = new Map();
  for (const card of deck) {
    if (!byIndex.has(card.level)) byIndex.set(card.level, []);
    byIndex.get(card.level).push(card);
  }
  const levels = [];
  for (const meta of INTERVAL_SEQUENCE) {
    const cards = byIndex.get(meta.index);
    if (!cards || cards.length === 0) continue;
    levels.push({ ...meta, cards: orderForIntroduction(cards, meta.intervals) });
  }
  return levels;
}
