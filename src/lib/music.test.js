import { describe, it, expect } from 'vitest';
import {
  midiOctave,
  midiLetter,
  noteName,
  midiToVexKey,
  pcOf,
  pcName,
  buildDeck,
  isOnStaff,
  levelsFor,
  SCALE_SEQUENCE,
  DEFAULT_LEDGER_LINES,
  LETTERS,
  ACCIDENTALS,
} from './music.js';

describe('MIDI ↔ note helpers', () => {
  it('midiOctave uses scientific pitch (C4 = 60)', () => {
    expect(midiOctave(60)).toBe(4);
    expect(midiOctave(72)).toBe(5);
    expect(midiOctave(48)).toBe(3);
    expect(midiOctave(59)).toBe(3); // B3, just below middle C
  });

  it('midiLetter names naturals and returns null for black keys', () => {
    expect(midiLetter(60)).toBe('C');
    expect(midiLetter(64)).toBe('E');
    expect(midiLetter(71)).toBe('B');
    expect(midiLetter(61)).toBeNull(); // C#/Db
    expect(midiLetter(70)).toBeNull(); // A#/Bb
  });

  it('noteName renders accidental symbols', () => {
    expect(noteName('E', '')).toBe('E');
    expect(noteName('C', '#')).toBe('C♯');
    expect(noteName('B', 'b')).toBe('B♭');
  });

  it('midiToVexKey builds keys for naturals only', () => {
    expect(midiToVexKey(60)).toBe('c/4');
    expect(midiToVexKey(64)).toBe('e/4');
    expect(midiToVexKey(43)).toBe('g/2');
    expect(midiToVexKey(61)).toBeNull();
  });

  it('pcOf maps spellings to pitch classes, wrapping at the octave', () => {
    expect(pcOf('C', '')).toBe(0);
    expect(pcOf('C', '#')).toBe(1);
    expect(pcOf('D', 'b')).toBe(1);
    expect(pcOf('C', 'b')).toBe(11); // wraps below C
    expect(pcOf('B', '#')).toBe(0); // wraps above B
    expect(pcOf('B', '')).toBe(11);
  });

  it('pcName shows both enharmonic spellings for black keys', () => {
    expect(pcName(0)).toBe('C');
    expect(pcName(1)).toBe('C♯/D♭');
    expect(pcName(6)).toBe('F♯/G♭');
  });

  it('exposes the answer-pad constants', () => {
    expect(LETTERS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(ACCIDENTALS.map((a) => a.value)).toEqual(['#', 'b']);
  });
});

describe('buildDeck — range math', () => {
  const full = { treble: true, bass: true, ledgerLines: DEFAULT_LEDGER_LINES };

  it('builds the documented 80-card default deck', () => {
    // 39 treble + 41 bass at ±2 ledger lines (see GOALS resolved notes).
    expect(buildDeck(full)).toHaveLength(80);
  });

  it('only includes enabled clefs', () => {
    expect(buildDeck({ treble: true, bass: false, ledgerLines: 2 })).toHaveLength(39);
    expect(buildDeck({ treble: false, bass: true, ledgerLines: 2 })).toHaveLength(41);
    expect(buildDeck({ treble: false, bass: false, ledgerLines: 2 })).toHaveLength(0);
  });

  it('defaults ledger lines when settings omit them', () => {
    expect(buildDeck({ treble: true, bass: true })).toHaveLength(80);
  });

  it('shrinks with fewer ledger lines and grows with more', () => {
    const zero = buildDeck({ treble: true, bass: false, ledgerLines: 0 });
    const four = buildDeck({ treble: true, bass: false, ledgerLines: 4 });
    expect(zero.length).toBeLessThan(39);
    expect(four.length).toBeGreaterThan(39);
    // On-staff only: every card sits within the staff's outer lines.
    expect(zero.every(isOnStaff)).toBe(true);
  });

  it('gives every card a unique id', () => {
    const deck = buildDeck(full);
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it('models naturals with a bare id and full metadata', () => {
    const c = buildDeck({ treble: true, bass: false, ledgerLines: 2 })
      .find((card) => card.id === 'treble:60');
    expect(c).toMatchObject({
      clef: 'treble', midi: 60, pc: 0, letter: 'C',
      accidental: '', name: 'C', octave: 4, vexKey: 'c/4',
    });
  });

  it('emits both enharmonic spellings for a black key as distinct cards', () => {
    const deck = buildDeck({ treble: true, bass: false, ledgerLines: 2 });
    const sharp = deck.find((c) => c.id === 'treble:61:#');
    const flat = deck.find((c) => c.id === 'treble:61:b');
    expect(sharp).toMatchObject({ name: 'C♯', pc: 1, midi: 61 });
    expect(flat).toMatchObject({ name: 'D♭', pc: 1, midi: 61 });
  });
});

describe('isOnStaff — register test', () => {
  it('is true between the staff outer lines, false on ledger lines', () => {
    // Treble: E4 (64) .. F5 (77) are on-staff; C4 (60) and C6 (84) are ledger.
    expect(isOnStaff({ clef: 'treble', midi: 64 })).toBe(true);
    expect(isOnStaff({ clef: 'treble', midi: 77 })).toBe(true);
    expect(isOnStaff({ clef: 'treble', midi: 60 })).toBe(false);
    expect(isOnStaff({ clef: 'treble', midi: 84 })).toBe(false);
    // Bass: G2 (43) .. A3 (57).
    expect(isOnStaff({ clef: 'bass', midi: 43 })).toBe(true);
    expect(isOnStaff({ clef: 'bass', midi: 60 })).toBe(false);
  });
});

describe('SCALE_SEQUENCE + levelsFor — curriculum bucketing', () => {
  it('stamps a canonical 0..11 index onto each of 12 levels', () => {
    expect(SCALE_SEQUENCE).toHaveLength(12);
    expect(SCALE_SEQUENCE.map((l) => l.index)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    );
    // Foundation is C, split into on-staff then ledger.
    expect(SCALE_SEQUENCE[0]).toMatchObject({ key: 'C', foundation: 'onstaff' });
    expect(SCALE_SEQUENCE[1]).toMatchObject({ key: 'C', foundation: 'ledger' });
  });

  it('buckets the full default deck into all 12 levels, in order', () => {
    const levels = levelsFor(buildDeck({ treble: true, bass: true, ledgerLines: 2 }));
    expect(levels).toHaveLength(12);
    expect(levels.map((l) => l.index)).toEqual(SCALE_SEQUENCE.map((l) => l.index));
  });

  it('drops levels that have no in-range cards', () => {
    // On-staff treble only: no ledger naturals → no foundation-ledger level (1).
    const levels = levelsFor(buildDeck({ treble: true, bass: false, ledgerLines: 0 }));
    const indices = levels.map((l) => l.index);
    expect(indices).toContain(0); // on-staff naturals present
    expect(indices).not.toContain(1); // ledger naturals absent
  });

  it('routes naturals to the foundation, split by register', () => {
    const levels = levelsFor(buildDeck({ treble: true, bass: false, ledgerLines: 2 }));
    const onstaff = levels.find((l) => l.index === 0).cards;
    const ledger = levels.find((l) => l.index === 1).cards;
    expect(onstaff.every((c) => c.accidental === '' && isOnStaff(c))).toBe(true);
    expect(ledger.every((c) => c.accidental === '' && !isOnStaff(c))).toBe(true);
  });

  it('introduces each black-key spelling in its home-key level', () => {
    const levels = levelsFor(buildDeck({ treble: true, bass: true, ledgerLines: 2 }));
    // Level 2 = G major, whose new spelling is F#.
    const g = levels.find((l) => l.index === 2);
    expect(g.cards.every((c) => c.letter === 'F' && c.accidental === '#')).toBe(true);
  });

  it('sorts each level on-staff before ledger, then by pitch', () => {
    const levels = levelsFor(buildDeck({ treble: true, bass: false, ledgerLines: 2 }));
    for (const lvl of levels) {
      const onStaffFlags = lvl.cards.map(isOnStaff);
      // No ledger card precedes an on-staff card.
      const firstLedger = onStaffFlags.indexOf(false);
      if (firstLedger !== -1) {
        expect(onStaffFlags.slice(firstLedger).some(Boolean)).toBe(false);
      }
    }
  });
});
