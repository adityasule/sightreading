import { describe, it, expect } from 'vitest';
import {
  chordTones,
  chordVoicing,
  chordPlacements,
  pickVoicing,
  INVERSIONS,
  CHORD_SEQUENCE,
  CHORD_POOL,
  chordLabel,
  chordOptionLabel,
  buildChordDeck,
  chordLevelsFor,
} from './chords.js';
import { choices } from './music.js';

// Map a tones array to compact "letter+accidental" strings for readable asserts.
const spell = (tones) => tones.map((t) => `${t.letter}${t.accidental}`);

describe('chordTones — correct triad spelling', () => {
  it('spells naturals with no accidentals', () => {
    expect(spell(chordTones('C', 'major'))).toEqual(['C', 'E', 'G']);
    expect(spell(chordTones('A', 'minor'))).toEqual(['A', 'C', 'E']);
    expect(spell(chordTones('G', 'major'))).toEqual(['G', 'B', 'D']);
  });

  it('spells sharps on the right letters', () => {
    expect(spell(chordTones('E', 'major'))).toEqual(['E', 'G#', 'B']);
    expect(spell(chordTones('F#', 'minor'))).toEqual(['F#', 'A', 'C#']);
    expect(spell(chordTones('G#', 'minor'))).toEqual(['G#', 'B', 'D#']);
    expect(spell(chordTones('B', 'major'))).toEqual(['B', 'D#', 'F#']);
  });

  it('spells flats on the right letters', () => {
    expect(spell(chordTones('Bb', 'major'))).toEqual(['Bb', 'D', 'F']);
    expect(spell(chordTones('Db', 'major'))).toEqual(['Db', 'F', 'Ab']);
    expect(spell(chordTones('Bb', 'minor'))).toEqual(['Bb', 'Db', 'F']);
    expect(spell(chordTones('Eb', 'major'))).toEqual(['Eb', 'G', 'Bb']);
  });

  it('never needs a double accidental anywhere in the curriculum', () => {
    for (const lvl of CHORD_SEQUENCE) {
      for (const { root, quality } of lvl.chords) {
        // chordTones throws if a single accidental can't spell a tone.
        const tones = chordTones(root, quality);
        expect(tones).toHaveLength(3);
        for (const t of tones) expect(['', '#', 'b']).toContain(t.accidental);
      }
    }
  });
});

describe('chordVoicing — inversions & register', () => {
  it('stacks root position low→high', () => {
    const v = chordVoicing({ root: 'C', quality: 'major' }, 0, 4);
    expect(v.keys).toEqual(['c/4', 'e/4', 'g/4']);
    expect(v.midis).toEqual([60, 64, 67]);
    expect(v.accidentals).toEqual([]);
  });

  it('lifts the root to the top for 1st inversion', () => {
    const v = chordVoicing({ root: 'C', quality: 'major' }, 1, 4);
    expect(v.keys).toEqual(['e/4', 'g/4', 'c/5']);
  });

  it('puts the fifth in the bass for 2nd inversion', () => {
    const v = chordVoicing({ root: 'C', quality: 'major' }, 2, 4);
    expect(v.keys).toEqual(['g/4', 'c/5', 'e/5']);
  });

  it('emits an accidental glyph per altered note, by key index', () => {
    const v = chordVoicing({ root: 'E', quality: 'major' }, 0, 4);
    expect(v.keys).toEqual(['e/4', 'g#/4', 'b/4']);
    expect(v.accidentals).toEqual([{ index: 1, type: '#' }]);
  });

  it('always lists keys and midis in ascending order', () => {
    for (const inv of INVERSIONS) {
      const { midis } = chordVoicing({ root: 'C', quality: 'major' }, inv, 4);
      expect([...midis].sort((a, b) => a - b)).toEqual(midis);
    }
  });
});

describe('chordPlacements / pickVoicing — bounded variety', () => {
  const deck = buildChordDeck({ treble: true, bass: true });

  it('gives every card at least one in-window placement', () => {
    for (const card of deck) {
      const placements = chordPlacements(card);
      expect(placements.length).toBeGreaterThan(0);
    }
  });

  it('only returns placements whose notes fit the clef window', () => {
    const win = { treble: [57, 81], bass: [40, 64] };
    for (const card of deck) {
      for (const { inversion, octave } of chordPlacements(card)) {
        const { midis } = chordVoicing(card, inversion, octave);
        const [lo, hi] = win[card.clef];
        for (const m of midis) {
          expect(m).toBeGreaterThanOrEqual(lo);
          expect(m).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('pickVoicing returns one of the valid placements (rng injectable)', () => {
    const card = deck.find((c) => c.id === 'treble:C:major');
    const placements = chordPlacements(card);
    // rng → 0 selects the first placement deterministically.
    const v = pickVoicing(card, () => 0);
    expect(v.inversion).toBe(placements[0].inversion);
    expect(v.octave).toBe(placements[0].octave);
    expect(v.keys).toBeDefined();
  });
});

describe('buildChordDeck', () => {
  it('builds 22 chords per enabled clef', () => {
    expect(buildChordDeck({ treble: true, bass: false })).toHaveLength(22);
    expect(buildChordDeck({ treble: false, bass: true })).toHaveLength(22);
    expect(buildChordDeck({ treble: true, bass: true })).toHaveLength(44);
    expect(buildChordDeck({ treble: false, bass: false })).toHaveLength(0);
  });

  it('keys are clef-independent (root + quality); ids are per-clef', () => {
    const deck = buildChordDeck({ treble: true, bass: true });
    const tC = deck.find((c) => c.id === 'treble:C:major');
    const bC = deck.find((c) => c.id === 'bass:C:major');
    expect(tC.key).toBe('C:major');
    expect(bC.key).toBe('C:major'); // same answer on both clefs
    expect(tC.name).toBe('C major');
  });
});

describe('chordLevelsFor — circle-of-fifths curriculum', () => {
  const deck = buildChordDeck({ treble: true, bass: true });
  const levels = chordLevelsFor(deck);

  it('has 11 levels in circle-of-fifths order with metadata', () => {
    expect(levels).toHaveLength(11);
    expect(levels[0].label).toBe('C major / A minor');
    expect(levels[0].keySig).toBe('no sharps or flats');
    expect(levels[1].label).toBe('G major / E minor');
    expect(levels.map((l) => l.index)).toEqual([...Array(11).keys()]);
  });

  it('orders a level major-before-minor, treble-before-bass', () => {
    expect(levels[0].cards.map((c) => c.id)).toEqual([
      'treble:C:major',
      'bass:C:major',
      'treble:A:minor',
      'bass:A:minor',
    ]);
  });

  it('drops levels with no in-deck card when a clef is disabled', () => {
    const trebleOnly = chordLevelsFor(buildChordDeck({ treble: true, bass: false }));
    expect(trebleOnly).toHaveLength(11);
    expect(trebleOnly[0].cards.map((c) => c.id)).toEqual(['treble:C:major', 'treble:A:minor']);
  });
});

describe('labels & option pool', () => {
  it('labels chords with proper accidental symbols', () => {
    expect(chordLabel('Bb', 'major')).toBe('B♭ major');
    expect(chordLabel('F#', 'minor')).toBe('F♯ minor');
    expect(chordOptionLabel('Db:major')).toBe('D♭ major');
  });

  it('CHORD_POOL holds all 22 distinct chord keys', () => {
    expect(CHORD_POOL).toHaveLength(22);
    expect(new Set(CHORD_POOL).size).toBe(22);
    expect(CHORD_POOL).toContain('C:major');
    expect(CHORD_POOL).toContain('Bb:minor');
  });

  it('choices over the pool yields 4 distinct options including the answer', () => {
    const opts = choices('C:major', CHORD_POOL, 4);
    expect(opts).toHaveLength(4);
    expect(opts).toContain('C:major');
    expect(new Set(opts).size).toBe(4);
  });
});
