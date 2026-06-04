import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadState,
  saveState,
  introduce,
  recordAnswer,
  dueCards,
  pickNext,
  masteredCount,
  boxAtLeast,
  summary,
  stats,
  cardStats,
  aggregateStats,
} from './spaced-repetition.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirror the module's private day-key format so we can build history blobs.
function dayKey(t = Date.now()) {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function dayKeyAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return dayKey(d.getTime());
}

// A few stand-in cards — the scheduler only ever reads `.id`.
const card = (id) => ({ id });
const deck = [card('a'), card('b'), card('c')];

function freshState() {
  return { cards: {}, daily: { day: dayKey(), introduced: 0 } };
}

describe('introduce', () => {
  it('seeds a new card at box 0 and counts it against the daily budget', () => {
    const s = freshState();
    introduce(s, 'a');
    expect(s.cards.a.box).toBe(0);
    expect(typeof s.cards.a.dueAt).toBe('number');
    expect(s.daily.introduced).toBe(1);
  });

  it('is a no-op for an already-introduced card', () => {
    const s = freshState();
    introduce(s, 'a');
    introduce(s, 'a');
    expect(s.daily.introduced).toBe(1);
  });
});

describe('recordAnswer', () => {
  it('advances a box on correct and caps at the top box', () => {
    const s = freshState();
    introduce(s, 'a');
    for (let i = 0; i < 10; i++) recordAnswer(s, 'a', true);
    expect(s.cards.a.box).toBe(4); // 5 boxes (0..4), capped
  });

  it('resets to box 0 on an incorrect answer', () => {
    const s = freshState();
    introduce(s, 'a');
    recordAnswer(s, 'a', true);
    recordAnswer(s, 'a', true);
    expect(s.cards.a.box).toBe(2);
    recordAnswer(s, 'a', false);
    expect(s.cards.a.box).toBe(0);
  });

  it('schedules the next review per the box interval', () => {
    const s = freshState();
    introduce(s, 'a');
    const before = Date.now();
    recordAnswer(s, 'a', true); // box 1 → 1-day interval
    expect(s.cards.a.dueAt).toBeGreaterThanOrEqual(before + DAY_MS - 1000);
  });

  it('records an answer for a never-introduced card', () => {
    const s = freshState();
    recordAnswer(s, 'z', true);
    expect(s.cards.z.box).toBe(1);
  });

  it('logs the answer into the per-day history', () => {
    const s = freshState();
    recordAnswer(s, 'a', true);
    recordAnswer(s, 'a', false);
    const h = s.history[dayKey()];
    expect(h).toEqual({ seen: 2, correct: 1 });
  });
});

describe('recordAnswer — per-card aggregates (M7a)', () => {
  it('accumulates seen, correct and timeMs across answers', () => {
    const s = freshState();
    recordAnswer(s, 'a', true, 1000);
    recordAnswer(s, 'a', false, 2000);
    recordAnswer(s, 'a', true, 500);
    expect(s.cards.a.seen).toBe(3);
    expect(s.cards.a.correct).toBe(2);
    expect(s.cards.a.timeMs).toBe(3500);
  });

  it('defaults elapsedMs to 0 (the old 3-arg signature leaves timeMs at 0)', () => {
    const s = freshState();
    recordAnswer(s, 'a', true);
    expect(s.cards.a.seen).toBe(1);
    expect(s.cards.a.timeMs).toBe(0);
  });

  it('clamps a single answer time to 60s and floors a negative at 0', () => {
    const s = freshState();
    recordAnswer(s, 'a', true, 5 * 60 * 1000); // 5 min idle → capped at 60s
    recordAnswer(s, 'a', true, -100); // bogus negative → 0
    expect(s.cards.a.timeMs).toBe(60_000);
  });

  it('initialises aggregates lazily for a pre-M7a card with no fields', () => {
    const s = { cards: { a: { box: 2, dueAt: 0 } } };
    recordAnswer(s, 'a', true, 1000);
    expect(s.cards.a).toMatchObject({ seen: 1, correct: 1, timeMs: 1000 });
    expect(s.cards.a.box).toBe(3); // box logic still runs
  });
});

describe('cardStats', () => {
  it('returns null accuracy/avgMs for an unseen card', () => {
    expect(cardStats({ cards: {} }, 'a')).toEqual({
      seen: 0, correct: 0, accuracy: null, avgMs: null,
    });
  });

  it('derives accuracy and average time from the running totals', () => {
    const s = { cards: { a: { box: 1, dueAt: 0, seen: 4, correct: 3, timeMs: 8000 } } };
    expect(cardStats(s, 'a')).toEqual({
      seen: 4, correct: 3, accuracy: 75, avgMs: 2000,
    });
  });
});

describe('aggregateStats', () => {
  it('returns nulls when nothing has been answered', () => {
    expect(aggregateStats({ cards: {} })).toEqual({ accuracy: null, avgMs: null });
  });

  it('sums every card into a phase-wide accuracy and average time', () => {
    const s = {
      cards: {
        a: { seen: 2, correct: 2, timeMs: 2000 },
        b: { seen: 2, correct: 1, timeMs: 6000 },
      },
    };
    // 3/4 correct = 75%; 8000ms / 4 answers = 2000ms
    expect(aggregateStats(s)).toEqual({ accuracy: 75, avgMs: 2000 });
  });

  it('ignores cards with no aggregates (pre-M7a, not yet re-answered)', () => {
    const s = {
      cards: {
        a: { box: 2, dueAt: 0 },
        b: { seen: 1, correct: 1, timeMs: 1000 },
      },
    };
    expect(aggregateStats(s)).toEqual({ accuracy: 100, avgMs: 1000 });
  });
});

describe('dueCards', () => {
  it('returns only cards whose dueAt has passed', () => {
    const now = Date.now();
    const s = {
      cards: {
        past: { box: 1, dueAt: now - 1000 },
        future: { box: 1, dueAt: now + DAY_MS },
      },
    };
    expect(dueCards(s, now)).toEqual(['past']);
  });
});

describe('pickNext', () => {
  it('serves the most-overdue due card before introducing new ones', () => {
    const now = Date.now();
    const s = freshState();
    s.cards = {
      a: { box: 1, dueAt: now - 100 },
      b: { box: 1, dueAt: now - 5000 }, // more overdue
    };
    expect(pickNext(s, deck, 5)).toBe('b');
  });

  it('introduces a fresh card when nothing is due and budget remains', () => {
    const s = freshState();
    const next = pickNext(s, deck, 5);
    expect(next).toBe('a'); // first un-introduced card
    expect(s.cards.a).toBeDefined();
    expect(s.daily.introduced).toBe(1);
  });

  it('returns null when caught up and the daily budget is exhausted', () => {
    const s = freshState();
    s.daily.introduced = 5;
    expect(pickNext(s, deck, 5)).toBeNull();
  });

  it('only introduces new cards drawn from newPool', () => {
    const s = freshState();
    // Nothing due, budget available, but the pool is just card "c".
    const next = pickNext(s, deck, 5, [card('c')]);
    expect(next).toBe('c');
    expect(s.cards.a).toBeUndefined();
  });
});

describe('masteredCount / boxAtLeast', () => {
  const cards = [card('a'), card('b'), card('c')];

  it('counts only cards at or above the box threshold; un-introduced = box -1', () => {
    const s = { cards: { a: { box: 2, dueAt: 0 }, b: { box: 1, dueAt: 0 } } };
    expect(masteredCount(s, cards, 2)).toBe(1);
    expect(boxAtLeast(s, cards, 2)).toBe(false);
  });

  it('boxAtLeast is true once every card meets the threshold', () => {
    const s = { cards: { a: { box: 2 }, b: { box: 3 }, c: { box: 2 } } };
    expect(boxAtLeast(s, cards, 2)).toBe(true);
  });

  it('treats an empty group as vacuously complete', () => {
    expect(boxAtLeast({ cards: {} }, [], 2)).toBe(true);
  });
});

describe('summary', () => {
  it('reports due / learned / total / remaining-new', () => {
    const now = Date.now();
    const s = freshState();
    s.daily.introduced = 2;
    s.cards = {
      a: { box: 1, dueAt: now - 10 }, // due
      b: { box: 1, dueAt: now + DAY_MS }, // not due
    };
    expect(summary(s, deck, 5)).toEqual({
      due: 1, learned: 2, total: 3, newRemaining: 3,
    });
  });

  it('never reports negative remaining-new', () => {
    const s = freshState();
    s.daily.introduced = 8;
    expect(summary(s, deck, 5).newRemaining).toBe(0);
  });
});

describe('stats', () => {
  it('returns null accuracy and zero streak with no history', () => {
    expect(stats({})).toEqual({ streak: 0, accuracy: null });
  });

  it('computes lifetime first-attempt accuracy across all days', () => {
    const s = {
      history: {
        '2026-01-01': { seen: 4, correct: 2 },
        '2026-01-02': { seen: 6, correct: 4 },
      },
    };
    expect(stats(s).accuracy).toBe(60); // 6/10
  });

  it('counts a streak back from today', () => {
    const s = {
      history: {
        [dayKeyAgo(0)]: { seen: 3, correct: 3 },
        [dayKeyAgo(1)]: { seen: 1, correct: 1 },
        [dayKeyAgo(2)]: { seen: 2, correct: 1 },
      },
    };
    expect(stats(s).streak).toBe(3);
  });

  it('keeps the streak alive with a one-day grace when today is untouched', () => {
    const s = {
      history: {
        [dayKeyAgo(1)]: { seen: 1, correct: 1 },
        [dayKeyAgo(2)]: { seen: 1, correct: 1 },
      },
    };
    expect(stats(s).streak).toBe(2);
  });

  it('breaks the streak after a full missed day', () => {
    const s = { history: { [dayKeyAgo(2)]: { seen: 1, correct: 1 } } };
    expect(stats(s).streak).toBe(0);
  });
});

describe('loadState / saveState (localStorage round-trip)', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('returns an empty state when nothing is stored', () => {
    const s = loadState('srt:test');
    expect(s.cards).toEqual({});
    expect(s.daily.day).toBe(dayKey());
    expect(s.daily.introduced).toBe(0);
  });

  it('round-trips a saved blob', () => {
    const s = freshState();
    introduce(s, 'a');
    recordAnswer(s, 'a', true);
    saveState('srt:test', s);
    const loaded = loadState('srt:test');
    expect(loaded.cards.a.box).toBe(1);
  });

  it('falls back to empty state on corrupt JSON', () => {
    localStorage.setItem('srt:test', '{not json');
    expect(loadState('srt:test').cards).toEqual({});
  });

  it('resets the daily counter when the stored day is stale', () => {
    saveState('srt:test', {
      cards: {}, daily: { day: '2000-01-01', introduced: 9 },
    });
    const loaded = loadState('srt:test');
    expect(loaded.daily.day).toBe(dayKey());
    expect(loaded.daily.introduced).toBe(0);
  });

  it('stamps the schema version on save', () => {
    const s = freshState();
    saveState('srt:test', s);
    expect(JSON.parse(localStorage.getItem('srt:test')).version).toBe(2);
  });

  it('falls back to defaults for a blob from a newer app version', () => {
    localStorage.setItem(
      'srt:test',
      JSON.stringify({ version: 999, cards: { a: { box: 4, dueAt: 0 } } })
    );
    expect(loadState('srt:test').cards).toEqual({}); // reset, not half-read
  });

  it('falls back to defaults for a non-object blob', () => {
    localStorage.setItem('srt:test', '42');
    expect(loadState('srt:test').cards).toEqual({});
    localStorage.setItem('srt:test', '[1,2,3]');
    expect(loadState('srt:test').cards).toEqual({});
  });

  it('migrates an unversioned legacy blob forward, preserving cards', () => {
    localStorage.setItem(
      'srt:test',
      JSON.stringify({ cards: { a: { box: 2, dueAt: 0 } } })
    );
    const loaded = loadState('srt:test');
    expect(loaded.cards.a.box).toBe(2); // progress kept
    expect(loaded.version).toBe(2); // stamped to current
  });
});
