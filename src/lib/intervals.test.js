import { describe, it, expect } from 'vitest';
import {
  INTERVAL_SEQUENCE,
  INTERVAL_POOL,
  intervalOptionLabel,
  intervalPlacements,
  pickIntervalNotes,
  buildIntervalDeck,
  intervalLevelsFor,
} from './intervals.js';
import { choices } from './music.js';

// Semitone span per interval value (the eye/ear distance the card teaches).
const SEMIS = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
};
const CLEF_WINDOW = { treble: [57, 81], bass: [40, 64] };

describe('INTERVAL_SEQUENCE — difficulty/consonance curriculum', () => {
  it('has 4 levels, perfects first and the tritone alone last', () => {
    expect(INTERVAL_SEQUENCE).toHaveLength(4);
    expect(INTERVAL_SEQUENCE.map((l) => l.label)).toEqual([
      'Perfect intervals', 'Thirds & sixths', 'Seconds & sevenths', 'Tritone',
    ]);
    expect(INTERVAL_SEQUENCE[0].intervals).toEqual(['P8', 'P5', 'P4']);
    expect(INTERVAL_SEQUENCE[3].intervals).toEqual(['TT']);
    expect(INTERVAL_SEQUENCE.map((l) => l.index)).toEqual([0, 1, 2, 3]);
  });

  it('covers all 12 intervals exactly once across its levels', () => {
    const all = INTERVAL_SEQUENCE.flatMap((l) => l.intervals);
    expect(all).toHaveLength(12);
    expect(new Set(all)).toEqual(new Set(INTERVAL_POOL));
  });
});

describe('labels & option pool', () => {
  it('labels intervals by name', () => {
    expect(intervalOptionLabel('m3')).toBe('Minor 3rd');
    expect(intervalOptionLabel('P5')).toBe('Perfect 5th');
    expect(intervalOptionLabel('TT')).toBe('Tritone');
    expect(intervalOptionLabel('P8')).toBe('Perfect octave');
  });

  it('INTERVAL_POOL holds all 12 distinct intervals', () => {
    expect(INTERVAL_POOL).toHaveLength(12);
    expect(new Set(INTERVAL_POOL).size).toBe(12);
  });

  it('choices over the pool yields 4 distinct options including the answer', () => {
    const opts = choices('M3', INTERVAL_POOL, 4);
    expect(opts).toHaveLength(4);
    expect(opts).toContain('M3');
    expect(new Set(opts).size).toBe(4);
  });
});

describe('buildIntervalDeck', () => {
  it('builds 12 cards per enabled clef', () => {
    expect(buildIntervalDeck({ treble: true, bass: false })).toHaveLength(12);
    expect(buildIntervalDeck({ treble: false, bass: true })).toHaveLength(12);
    expect(buildIntervalDeck({ treble: true, bass: true })).toHaveLength(24);
    expect(buildIntervalDeck({ treble: false, bass: false })).toHaveLength(0);
  });

  it('keys are clef-independent; ids are per-clef', () => {
    const deck = buildIntervalDeck({ treble: true, bass: true });
    const t = deck.find((c) => c.id === 'treble:m3');
    const b = deck.find((c) => c.id === 'bass:m3');
    expect(t.key).toBe('m3');
    expect(b.key).toBe('m3'); // same answer on both clefs
    expect(t.name).toBe('Minor 3rd');
  });
});

describe('intervalPlacements — spelling, span, register', () => {
  const deck = buildIntervalDeck({ treble: true, bass: true });

  it('gives every card valid placements in both directions', () => {
    for (const card of deck) {
      const placements = intervalPlacements(card);
      expect(placements.length).toBeGreaterThan(0);
      const dirs = new Set(placements.map((p) => p.direction));
      expect(dirs).toContain('asc');
      expect(dirs).toContain('desc');
    }
  });

  it('spans exactly the interval, base note first, within the clef window', () => {
    for (const card of deck) {
      const [lo, hi] = CLEF_WINDOW[card.clef];
      for (const p of intervalPlacements(card)) {
        const [a, b] = p.midis;
        expect(Math.abs(b - a)).toBe(SEMIS[card.value]);
        // Direction reads from the base (first) note to the second.
        if (p.direction === 'asc') expect(b).toBeGreaterThan(a);
        else expect(b).toBeLessThan(a);
        for (const m of p.midis) {
          expect(m).toBeGreaterThanOrEqual(lo);
          expect(m).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('uses single accidentals only, and never on the natural base note', () => {
    for (const card of deck) {
      for (const p of intervalPlacements(card)) {
        expect(p.keys).toHaveLength(2);
        // Base is a natural: letter immediately followed by '/' (no #/b between).
        expect(p.keys[0]).toMatch(/^[a-g]\/\d/);
        for (const a of p.accidentals) {
          expect(a.index).toBe(1); // only the second note can carry one
          expect(['#', 'b']).toContain(a.type);
        }
      }
    }
  });
});

describe('pickIntervalNotes — injectable rng', () => {
  const card = buildIntervalDeck({ treble: true, bass: false }).find((c) => c.id === 'treble:M3');
  const placements = intervalPlacements(card);

  it('rng → 0 picks the first (deterministic) placement', () => {
    const v = pickIntervalNotes(card, () => 0);
    expect(v.keys).toEqual(placements[0].keys);
    expect(v.direction).toBe(placements[0].direction);
  });

  it('rng → ~1 picks the last placement', () => {
    const v = pickIntervalNotes(card, () => 0.999999);
    expect(v.keys).toEqual(placements[placements.length - 1].keys);
  });
});

describe('intervalLevelsFor — difficulty curriculum', () => {
  const deck = buildIntervalDeck({ treble: true, bass: true });
  const levels = intervalLevelsFor(deck);

  it('has 4 levels in difficulty order with metadata', () => {
    expect(levels).toHaveLength(4);
    expect(levels[0].label).toBe('Perfect intervals');
    expect(levels[3].label).toBe('Tritone');
    expect(levels.map((l) => l.index)).toEqual([0, 1, 2, 3]);
  });

  it('orders a level by its listed intervals, treble-before-bass', () => {
    // Level 0 lists P8, P5, P4 — each clef interleaved within the listed order.
    expect(levels[0].cards.map((c) => c.id)).toEqual([
      'treble:P8', 'bass:P8', 'treble:P5', 'bass:P5', 'treble:P4', 'bass:P4',
    ]);
  });

  it('drops no levels for a single clef', () => {
    const trebleOnly = intervalLevelsFor(buildIntervalDeck({ treble: true, bass: false }));
    expect(trebleOnly).toHaveLength(4);
    expect(trebleOnly[3].cards.map((c) => c.id)).toEqual(['treble:TT']);
  });
});
