import { describe, it, expect } from 'vitest';
import {
  midiOctave,
  midiLetter,
  noteName,
  midiToVexKey,
  pcOf,
  pcName,
  buildDeck,
  buildBasicsDeck,
  choices,
  durationLabel,
  noteLabel,
  restLabel,
  clefLabel,
  basicsLabel,
  beatsForKey,
  beatsLabel,
  optionPoolFor,
  DURATION_VALUES,
  NOTE_KEYS,
  REST_VALUES,
  CLEF_VALUES,
  isOnStaff,
  isAnchor,
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
    // Level 0 = on-staff naturals plus the middle-C anchor cluster (which is on
    // ledger lines but pulled forward); level 1 = the remaining ledger naturals.
    expect(onstaff.every((c) => c.accidental === '' && (isOnStaff(c) || isAnchor(c)))).toBe(true);
    expect(ledger.every((c) => c.accidental === '' && !isOnStaff(c) && !isAnchor(c))).toBe(true);
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
      // The anchor cluster legitimately leads with ledger notes; the on-staff-
      // before-ledger rule governs everything after it.
      const rest = lvl.cards.filter((c) => !isAnchor(c));
      const onStaffFlags = rest.map(isOnStaff);
      // No ledger card precedes an on-staff card.
      const firstLedger = onStaffFlags.indexOf(false);
      if (firstLedger !== -1) {
        expect(onStaffFlags.slice(firstLedger).some(Boolean)).toBe(false);
      }
    }
  });
});

describe('Middle C anchor (cluster-first)', () => {
  it('isAnchor matches the natural B3/C4/D4 cluster only', () => {
    expect(isAnchor({ midi: 60, accidental: '' })).toBe(true); // middle C
    expect(isAnchor({ midi: 59, accidental: '' })).toBe(true); // B3
    expect(isAnchor({ midi: 62, accidental: '' })).toBe(true); // D4
    expect(isAnchor({ midi: 57, accidental: '' })).toBe(false); // A3, outside
    expect(isAnchor({ midi: 64, accidental: '' })).toBe(false); // E4, on-staff
    expect(isAnchor({ midi: 61, accidental: '#' })).toBe(false); // C#4, not natural
  });

  it('routes the anchor cluster into the foundation (level 0), not ledger (level 1)', () => {
    const levels = levelsFor(buildDeck({ treble: true, bass: true, ledgerLines: 2 }));
    const onstaff = levels.find((l) => l.index === 0).cards;
    const ledger = levels.find((l) => l.index === 1).cards;
    // Both clefs contribute a middle-C card; both anchor to level 0.
    expect(onstaff.filter(isAnchor)).toHaveLength(6); // {B3,C4,D4} × {treble,bass}
    expect(ledger.some(isAnchor)).toBe(false);
  });

  it('introduces the anchor cluster first, middle C leading', () => {
    const cards = levelsFor(buildDeck({ treble: true, bass: false, ledgerLines: 2 }))
      .find((l) => l.index === 0).cards;
    // First three cards are the anchor cluster, middle C ahead of its neighbours.
    expect(cards.slice(0, 3).map((c) => c.midi)).toEqual([60, 59, 62]);
    expect(cards.slice(3).some(isAnchor)).toBe(false); // nothing else is an anchor
    expect(cards[3] && isOnStaff(cards[3])).toBe(true); // on-staff naturals follow
  });

  it('keeps the anchor inside level 0 even when only ledger notes are in range', () => {
    // ledgerLines 0 is on-staff only → anchor notes fall out of range entirely.
    const levels = levelsFor(buildDeck({ treble: true, bass: false, ledgerLines: 0 }));
    expect(levels.find((l) => l.index === 0).cards.some(isAnchor)).toBe(false);
    expect(levels.some((l) => l.index === 1)).toBe(false); // no ledger level at all
  });
});

describe('buildBasicsDeck — Phase 0 deck (notes, rests, clefs)', () => {
  it('has note (6 plain + 3 dotted), rest (6) and clef (2) cards, unique ids', () => {
    const deck = buildBasicsDeck();
    expect(deck).toHaveLength(17);
    const byType = (t) => deck.filter((c) => c.type === t);
    expect(byType('note')).toHaveLength(9);
    expect(byType('rest')).toHaveLength(6);
    expect(byType('clef')).toHaveLength(2);
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it('keeps the original plain-note ids stable (srt:phase0 progress survives)', () => {
    const ids = buildBasicsDeck().map((c) => c.id);
    for (const v of DURATION_VALUES) expect(ids).toContain(`dur:${v}`);
  });

  it('models plain notes with their duration value as the grading key', () => {
    const whole = buildBasicsDeck().find((c) => c.id === 'dur:whole');
    expect(whole).toMatchObject({ type: 'note', key: 'whole', vex: 'w', dotted: false });
    const breve = buildBasicsDeck().find((c) => c.id === 'dur:breve');
    expect(breve).toMatchObject({ type: 'note', key: 'breve', vex: '1/2' });
  });

  it('adds the common dotted notes (half, quarter, eighth) with a dotted key', () => {
    const dotted = buildBasicsDeck().filter((c) => c.type === 'note' && c.dotted);
    expect(dotted.map((c) => c.id)).toEqual([
      'dur:half:dot',
      'dur:quarter:dot',
      'dur:eighth:dot',
    ]);
    // Dotted cards carry the *base* vex code plus the dotted flag (the dot is a
    // render-time modifier, not a different duration).
    expect(buildBasicsDeck().find((c) => c.id === 'dur:half:dot')).toMatchObject({
      key: 'half.',
      vex: 'h',
      dotted: true,
    });
  });

  it('models rest cards keyed by duration value, sharing the note vex codes', () => {
    const deck = buildBasicsDeck();
    expect(deck.find((c) => c.id === 'rest:quarter')).toMatchObject({
      type: 'rest',
      key: 'quarter',
      vex: 'q',
    });
    expect(deck.filter((c) => c.type === 'rest').map((c) => c.key)).toEqual(DURATION_VALUES);
  });

  it('models the two clef cards', () => {
    const deck = buildBasicsDeck();
    expect(deck.find((c) => c.id === 'clef:treble')).toMatchObject({
      type: 'clef',
      key: 'treble',
      clef: 'treble',
    });
    expect(deck.find((c) => c.id === 'clef:bass')).toMatchObject({ type: 'clef', clef: 'bass' });
  });

  it('is clef- and range-independent (takes no settings)', () => {
    // Same cards no matter what; pitch/clef/range are out of scope for Basics.
    expect(buildBasicsDeck().map((c) => c.id)).toEqual(buildBasicsDeck().map((c) => c.id));
  });
});

describe('Basics option pools', () => {
  it('note pool is the 6 plain + 3 dotted keys', () => {
    expect(NOTE_KEYS).toHaveLength(9);
    expect(NOTE_KEYS).toEqual(
      expect.arrayContaining([...DURATION_VALUES, 'half.', 'quarter.', 'eighth.'])
    );
  });

  it('rest pool is the 6 duration values; clef pool is the 2 clefs', () => {
    expect(REST_VALUES).toHaveLength(6);
    expect(CLEF_VALUES).toEqual(['treble', 'bass']);
  });

  it('optionPoolFor picks the pool by card type', () => {
    expect(optionPoolFor('note')).toBe(NOTE_KEYS);
    expect(optionPoolFor('rest')).toBe(REST_VALUES);
    expect(optionPoolFor('clef')).toBe(CLEF_VALUES);
  });

  it('a clef question clamps to its two options', () => {
    const opts = choices('treble', CLEF_VALUES);
    expect(opts).toHaveLength(2);
    expect(new Set(opts)).toEqual(new Set(['treble', 'bass']));
  });
});

describe('Basics labels — notes, rests, clefs', () => {
  it('noteLabel names plain and dotted notes', () => {
    expect(noteLabel('half')).toBe('Minim');
    expect(noteLabel('half', 'american')).toBe('Half note');
    expect(noteLabel('half.')).toBe('Dotted minim');
    expect(noteLabel('quarter.', 'american')).toBe('Dotted quarter note');
  });

  it('restLabel uses natural rest names in both conventions', () => {
    expect(restLabel('quarter')).toBe('Crotchet rest');
    expect(restLabel('whole')).toBe('Semibreve rest');
    expect(restLabel('quarter', 'american')).toBe('Quarter rest');
    expect(restLabel('whole', 'american')).toBe('Whole rest');
    expect(restLabel('breve', 'american')).toBe('Double whole rest'); // " note" stripped
  });

  it('clefLabel names the clef', () => {
    expect(clefLabel('treble')).toBe('Treble clef');
    expect(clefLabel('bass')).toBe('Bass clef');
  });

  it('basicsLabel dispatches on type and appends beats to notes/rests, not clefs', () => {
    expect(basicsLabel('note', 'quarter')).toBe('Crotchet · 1 beat');
    expect(basicsLabel('note', 'half.', 'american')).toBe('Dotted half note · 3 beats');
    expect(basicsLabel('rest', 'quarter', 'american')).toBe('Quarter rest · 1 beat');
    expect(basicsLabel('rest', 'eighth')).toBe('Quaver rest · ½ beat');
    expect(basicsLabel('clef', 'bass')).toBe('Bass clef'); // clefs have no beat value
  });
});

describe('beats — note/rest length', () => {
  it('beatsForKey: quarter = 1 beat, scaling by value, dotted ×1.5', () => {
    expect(beatsForKey('quarter')).toBe(1);
    expect(beatsForKey('whole')).toBe(4);
    expect(beatsForKey('breve')).toBe(8);
    expect(beatsForKey('eighth')).toBe(0.5);
    expect(beatsForKey('half.')).toBe(3);
    expect(beatsForKey('quarter.')).toBe(1.5);
    expect(beatsForKey('eighth.')).toBe(0.75);
  });

  it('beatsLabel formats whole + fractional beats with pluralization', () => {
    expect(beatsLabel(1)).toBe('1 beat');
    expect(beatsLabel(2)).toBe('2 beats');
    expect(beatsLabel(8)).toBe('8 beats');
    expect(beatsLabel(0.5)).toBe('½ beat');
    expect(beatsLabel(0.25)).toBe('¼ beat');
    expect(beatsLabel(0.75)).toBe('¾ beat');
    expect(beatsLabel(1.5)).toBe('1½ beats');
  });
});

describe('durationLabel — British / American naming', () => {
  it('defaults to British names', () => {
    expect(durationLabel('whole')).toBe('Semibreve');
    expect(durationLabel('quarter')).toBe('Crotchet');
    expect(durationLabel('eighth')).toBe('Quaver');
    expect(durationLabel('breve')).toBe('Breve');
  });

  it('switches to American names', () => {
    expect(durationLabel('whole', 'american')).toBe('Whole note');
    expect(durationLabel('quarter', 'american')).toBe('Quarter note');
    expect(durationLabel('eighth', 'american')).toBe('Eighth note');
    expect(durationLabel('breve', 'american')).toBe('Double whole note');
  });
});

describe('choices — multiple-choice option builder', () => {
  it('returns `count` distinct options including the correct one', () => {
    const opts = choices('C', LETTERS);
    expect(opts).toHaveLength(4);
    expect(opts).toContain('C');
    expect(new Set(opts).size).toBe(4);
    expect(opts.every((o) => LETTERS.includes(o))).toBe(true);
  });

  it('never repeats the correct value among the distractors', () => {
    for (let i = 0; i < 50; i++) {
      expect(choices('E', LETTERS).filter((o) => o === 'E')).toHaveLength(1);
    }
  });

  it('clamps to the pool size when count exceeds it', () => {
    const opts = choices('C', ['C', 'D'], 4);
    expect(opts).toHaveLength(2);
    expect(new Set(opts)).toEqual(new Set(['C', 'D']));
  });
});
