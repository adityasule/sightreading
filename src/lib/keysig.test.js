import { describe, it, expect } from 'vitest';
import {
  KEY_SEQUENCE,
  KEYSIG_POOL,
  keySigLabel,
  keySigOptionLabel,
  buildKeySigDeck,
  keySigLevelsFor,
} from './keysig.js';
import { choices } from './music.js';

describe('KEY_SEQUENCE — the 15 keys in circle-of-fifths order', () => {
  it('covers all 15 keys, alternating sharp/flat outward from C', () => {
    expect(KEY_SEQUENCE).toHaveLength(15);
    expect(KEY_SEQUENCE.map((l) => l.key)).toEqual([
      'C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db', 'F#', 'Gb', 'C#', 'Cb',
    ]);
    expect(KEY_SEQUENCE.map((l) => l.index)).toEqual([...Array(15).keys()]);
  });

  it('words each signature by its accidental tally', () => {
    const by = Object.fromEntries(KEY_SEQUENCE.map((l) => [l.key, l.keySig]));
    expect(by.C).toBe('no sharps or flats');
    expect(by.G).toBe('1 sharp');
    expect(by.F).toBe('1 flat');
    expect(by.D).toBe('2 sharps');
    expect(by.Bb).toBe('2 flats');
    expect(by['F#']).toBe('6 sharps');
    expect(by['C#']).toBe('7 sharps');
    expect(by.Cb).toBe('7 flats');
  });

  it('carries the VexFlow spec identical to the grading key', () => {
    for (const lvl of KEY_SEQUENCE) expect(lvl.spec).toBe(lvl.key);
  });
});

describe('labels & option pool', () => {
  it('labels keys with proper accidental symbols', () => {
    expect(keySigLabel('C')).toBe('C major');
    expect(keySigLabel('Bb')).toBe('B♭ major');
    expect(keySigLabel('F#')).toBe('F♯ major');
    expect(keySigLabel('Cb')).toBe('C♭ major');
    expect(keySigOptionLabel('Eb')).toBe('E♭ major');
  });

  it('KEYSIG_POOL holds all 15 distinct keys', () => {
    expect(KEYSIG_POOL).toHaveLength(15);
    expect(new Set(KEYSIG_POOL).size).toBe(15);
    expect(KEYSIG_POOL).toContain('C');
    expect(KEYSIG_POOL).toContain('Cb');
  });

  it('choices over the pool yields 4 distinct options including the answer', () => {
    const opts = choices('D', KEYSIG_POOL, 4);
    expect(opts).toHaveLength(4);
    expect(opts).toContain('D');
    expect(new Set(opts).size).toBe(4);
  });
});

describe('buildKeySigDeck', () => {
  it('builds 15 cards per enabled clef', () => {
    expect(buildKeySigDeck({ treble: true, bass: false })).toHaveLength(15);
    expect(buildKeySigDeck({ treble: false, bass: true })).toHaveLength(15);
    expect(buildKeySigDeck({ treble: true, bass: true })).toHaveLength(30);
    expect(buildKeySigDeck({ treble: false, bass: false })).toHaveLength(0);
  });

  it('keys are clef-independent; ids are per-clef; spec is the VexFlow name', () => {
    const deck = buildKeySigDeck({ treble: true, bass: true });
    const tG = deck.find((c) => c.id === 'treble:G');
    const bG = deck.find((c) => c.id === 'bass:G');
    expect(tG.key).toBe('G');
    expect(bG.key).toBe('G'); // same answer on both clefs
    expect(tG.spec).toBe('G');
    expect(tG.name).toBe('G major');
  });
});

describe('keySigLevelsFor — circle-of-fifths curriculum', () => {
  const deck = buildKeySigDeck({ treble: true, bass: true });
  const levels = keySigLevelsFor(deck);

  it('has 15 levels in order with metadata', () => {
    expect(levels).toHaveLength(15);
    expect(levels[0].label).toBe('C major');
    expect(levels[0].keySig).toBe('no sharps or flats');
    expect(levels[1].label).toBe('G major');
    expect(levels.map((l) => l.index)).toEqual([...Array(15).keys()]);
  });

  it('orders each level treble-before-bass', () => {
    expect(levels[1].cards.map((c) => c.id)).toEqual(['treble:G', 'bass:G']);
  });

  it('drops no levels for a single clef (one card each)', () => {
    const trebleOnly = keySigLevelsFor(buildKeySigDeck({ treble: true, bass: false }));
    expect(trebleOnly).toHaveLength(15);
    expect(trebleOnly[0].cards.map((c) => c.id)).toEqual(['treble:C']);
  });
});
