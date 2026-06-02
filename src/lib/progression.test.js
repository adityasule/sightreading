import { describe, it, expect } from 'vitest';
import { progress, advance, MASTER_BOX } from './progression.js';
import { buildDeck, levelsFor } from './music.js';

// A small but multi-level deck: treble, on-staff naturals + the five black-key
// home-key levels. Skips the foundation-ledger level (no ledger naturals at
// ledgerLines 0), which is fine — we just need several levels in order.
const DECK = buildDeck({ treble: true, bass: false, ledgerLines: 0 });
const LEVELS = levelsFor(DECK);

function freshState() {
  return { cards: {} };
}

// Drive a set of cards to mastery (box ≥ MASTER_BOX) directly in SR state.
function master(state, cards) {
  for (const c of cards) state.cards[c.id] = { box: MASTER_BOX, dueAt: 0 };
}

describe('progress — live level resolution', () => {
  it('reports an empty progression for an empty deck', () => {
    const p = progress(freshState(), []);
    expect(p.current).toBeNull();
    expect(p.canAdvance).toBe(false);
    expect(p.levels).toEqual([]);
  });

  it('seeds a fresh user onto level 0 and persists the pointer', () => {
    const s = freshState();
    const p = progress(s, DECK);
    expect(s.unlocked).toBe(0);
    expect(p.current.index).toBe(0);
    expect(p.pool).toEqual(LEVELS[0].cards);
    expect(p.mastered).toBe(0);
    expect(p.total).toBe(LEVELS[0].cards.length);
    expect(p.complete).toBe(false);
    expect(p.canAdvance).toBe(false);
    expect(p.next.index).toBe(LEVELS[1].index); // the next present level
  });

  it('flags canAdvance once the current level is fully mastered', () => {
    const s = { cards: {}, unlocked: 0 };
    master(s, LEVELS[0].cards);
    const p = progress(s, DECK);
    expect(p.current.index).toBe(0);
    expect(p.complete).toBe(true);
    expect(p.canAdvance).toBe(true);
    expect(p.next.index).toBe(LEVELS[1].index);
  });

  it('does not advance past the unlocked frontier on its own', () => {
    const s = { cards: {}, unlocked: 0 };
    // Even with later levels mastered, current stays at the unlocked frontier.
    master(s, LEVELS[0].cards);
    master(s, LEVELS[1].cards);
    const p = progress(s, DECK);
    expect(s.unlocked).toBe(0);
    expect(p.current.index).toBe(0);
  });
});

describe('advance — accepting the gate', () => {
  it('unlocks the next level only when one exists', () => {
    const s = { cards: {}, unlocked: 0 };
    master(s, LEVELS[0].cards);
    advance(s, DECK);
    expect(s.unlocked).toBe(LEVELS[1].index);

    // After advancing, the (mastered) level 0 is skipped and the new frontier
    // becomes current.
    const p = progress(s, DECK);
    expect(p.current.index).toBe(LEVELS[1].index);
  });

  it('is a no-op at the end of the curriculum', () => {
    const s = freshState();
    master(s, DECK);
    progress(s, DECK); // fully mastered → seeds to the last level
    const before = s.unlocked;
    advance(s, DECK);
    expect(s.unlocked).toBe(before);
  });
});

describe('seedUnlocked — pre-M1d migration', () => {
  it('places a partly-trained user at their first unmastered level', () => {
    // Pre-M1d blob: cards trained in MIDI order, no `unlocked` pointer.
    const s = freshState();
    master(s, LEVELS[0].cards); // foundation done, nothing past it
    expect(s.unlocked).toBeUndefined();
    progress(s, DECK);
    expect(s.unlocked).toBe(LEVELS[1].index);
  });

  it('seeds a fully-mastered deck to the final level', () => {
    const s = freshState();
    master(s, DECK);
    progress(s, DECK);
    expect(s.unlocked).toBe(LEVELS[LEVELS.length - 1].index);
  });
});
