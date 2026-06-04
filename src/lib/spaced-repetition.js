// Leitner-box spaced repetition scheduler.
//
// A "card" is anything keyed by a stable string id (e.g. "treble:60" for
// middle C on treble clef). The scheduler owns scheduling decisions; the
// caller owns what a card represents.
//
// State shape:
//   {
//     cards: { [id]: { box, dueAt, seen, correct, timeMs } },  // SR + running aggregates
//     daily: { day: "YYYY-MM-DD", introduced: <count> },
//     history: { [day]: { seen, correct } }, // per-day answer log, last HISTORY_WINDOW_DAYS
//     lifetime: { seen, correct }            // all-time roll-up of days pruned out of history
//   }

const BOX_INTERVALS_DAYS = [1, 3, 7, 14, 30];

const DAY_MS = 24 * 60 * 60 * 1000;

// Cap the per-day `history` map at a recent window: a day older than this folds
// into the `lifetime` roll-up and is dropped, so the map can't grow unbounded
// (one entry per active day, forever — the M7c state-efficiency NFR). The window
// also caps the longest streak the Home view can display; 90 days is generous
// for a personal app. Lifetime accuracy is preserved exactly via the roll-up.
const HISTORY_WINDOW_DAYS = 90;

// Clamp a single answer's elapsed time before folding it into a card's running
// `timeMs` total, so a card left on screen (tab backgrounded, walked away) can't
// permanently skew the cumulative average. 60s is well beyond any genuine read.
const MAX_ANSWER_MS = 60_000;

// Persisted-blob schema version. Stamped on every save; checked on load so a
// blob written by a *newer* app (version > this) falls back to defaults rather
// than being half-read and corrupted. Bump this when the shape changes in a way
// older builds can't safely read, and add a migration in `loadState`.
// v2 (M7a) added per-card answer aggregates (seen/correct/timeMs); they default
// in lazily on the next answer, so the migration is go-forward with no backfill.
// v3 (M7c) added the `lifetime` history roll-up; a pre-v3 blob just lacks the key
// and fills in as days age out of the window — again go-forward, no backfill.
export const STATE_VERSION = 3;

function now() {
  return Date.now();
}

/** Local calendar day key, e.g. "2026-06-01". Used to reset the new-card budget. */
function dayKey(t = now()) {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** dayKey for N local calendar days before today (0 = today). */
function dayKeyAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return dayKey(d.getTime());
}

function emptyState() {
  return { version: STATE_VERSION, cards: {}, daily: { day: dayKey(), introduced: 0 } };
}

/**
 * Bound the per-day `history` map: any day older than HISTORY_WINDOW_DAYS folds
 * its { seen, correct } into the all-time `lifetime` roll-up and is removed, so
 * the map stays a fixed-size window while lifetime accuracy is preserved exactly.
 * Idempotent — re-running it on an already-pruned state is a no-op.
 */
function pruneHistory(state) {
  if (!state.history) return state;
  const cutoff = dayKeyAgo(HISTORY_WINDOW_DAYS); // string compare: YYYY-MM-DD sorts chronologically
  const lifetime = state.lifetime ?? { seen: 0, correct: 0 };
  for (const day in state.history) {
    if (day < cutoff) {
      const h = state.history[day];
      lifetime.seen += h.seen;
      lifetime.correct += h.correct;
      delete state.history[day];
    }
  }
  state.lifetime = lifetime;
  return state;
}

/** Reset the new-card counter when the calendar day rolls over. */
function rollDaily(state) {
  if (!state.daily) state.daily = { day: dayKey(), introduced: 0 };
  if (state.daily.day !== dayKey()) {
    state.daily.day = dayKey();
    state.daily.introduced = 0;
  }
  return state;
}

export function loadState(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyState();
    const state = JSON.parse(raw);
    // Defend against anything that isn't a plain object (corrupt / hand-edited),
    // or a blob from a newer app we can't understand — reset to defaults rather
    // than risk a half-read, throwing state. A missing version is a pre-M2f blob.
    if (!state || typeof state !== 'object' || Array.isArray(state)) return emptyState();
    if (typeof state.version === 'number' && state.version > STATE_VERSION) {
      return emptyState();
    }
    if (!state.cards || typeof state.cards !== 'object') state.cards = {};
    state.version = STATE_VERSION; // stamp / migrate an unversioned blob forward
    rollDaily(state); // normalize older blobs that predate the daily budget
    pruneHistory(state); // shrink an over-window history map on first load
    return state;
  } catch {
    return emptyState();
  }
}

export function saveState(storageKey, state) {
  state.version = STATE_VERSION;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function introduce(state, cardId) {
  if (state.cards[cardId]) return state;
  rollDaily(state);
  state.cards[cardId] = { box: 0, dueAt: now() };
  state.daily.introduced += 1;
  return state;
}

export function recordAnswer(state, cardId, correct, elapsedMs = 0) {
  const card = state.cards[cardId] ?? { box: 0, dueAt: now() };
  card.box = correct
    ? Math.min(card.box + 1, BOX_INTERVALS_DAYS.length - 1)
    : 0;
  card.dueAt = now() + BOX_INTERVALS_DAYS[card.box] * DAY_MS;

  // Running per-card aggregates (M7a) — totals, not an event log, so the
  // behaviour page derives accuracy = correct/seen and avg time = timeMs/seen
  // without storing every answer. `?? 0` lets pre-M7a cards self-heal here.
  card.seen = (card.seen ?? 0) + 1;
  if (correct) card.correct = (card.correct ?? 0) + 1;
  card.timeMs = (card.timeMs ?? 0) + Math.round(Math.min(Math.max(0, elapsedMs), MAX_ANSWER_MS));

  state.cards[cardId] = card;

  // Log the answer against today so Home can show a streak + accuracy. Mirrors
  // the in-session counter but persists across sessions and days.
  if (!state.history) state.history = {};
  const k = dayKey();
  const h = state.history[k] ?? { seen: 0, correct: 0 };
  h.seen += 1;
  if (correct) h.correct += 1;
  state.history[k] = h;
  pruneHistory(state); // keep the day map bounded on the one write path

  return state;
}

export function dueCards(state, t = now()) {
  return Object.entries(state.cards)
    .filter(([, c]) => c.dueAt <= t)
    .map(([id]) => id);
}

/**
 * Choose the next card to show:
 *   1. the most-overdue introduced card from `deck` that is due now, else
 *   2. a fresh card (introducing it) if today's new-card budget allows, else
 *   3. null — the user is caught up for now.
 *
 * Reviews always draw from the full `deck`, but *new* cards are introduced only
 * from `newPool` (defaults to `deck`). The curriculum passes the current
 * level's cards here so progression gates which notes get introduced without
 * the scheduler needing to know what a "level" is.
 */
export function pickNext(state, deck, newPerDay, newPool = deck) {
  rollDaily(state);
  const ids = new Set(deck.map((c) => c.id));

  const due = Object.entries(state.cards)
    .filter(([id, c]) => ids.has(id) && c.dueAt <= now())
    .sort((a, b) => a[1].dueAt - b[1].dueAt);
  if (due.length) return due[0][0];

  if (state.daily.introduced < newPerDay) {
    const fresh = newPool.find((c) => !state.cards[c.id]);
    if (fresh) {
      introduce(state, fresh.id);
      return fresh.id;
    }
  }

  return null;
}

/**
 * How many of `cards` have reached at least Leitner box `minBox`. Un-introduced
 * cards count as box -1, so they don't count. Drives level-progress readouts
 * (e.g. "3/4 mastered") and `boxAtLeast` below.
 */
export function masteredCount(state, cards, minBox) {
  return cards.filter((c) => (state.cards[c.id]?.box ?? -1) >= minBox).length;
}

/**
 * Has every card in `cards` reached at least Leitner box `minBox`? Used to
 * detect level completion (box ≥ 2 = answered correctly on two reviews). An
 * empty group is vacuously complete, so range/clef changes that empty a level
 * let progression skip past it.
 */
export function boxAtLeast(state, cards, minBox) {
  return masteredCount(state, cards, minBox) === cards.length;
}

/** Counts for the session header: due now, learned/total, new budget left. */
export function summary(state, deck, newPerDay) {
  rollDaily(state);
  const introduced = deck.filter((c) => state.cards[c.id]);
  const due = introduced.filter((c) => state.cards[c.id].dueAt <= now()).length;
  return {
    due,
    learned: introduced.length,
    total: deck.length,
    newRemaining: Math.max(0, newPerDay - state.daily.introduced),
  };
}

/**
 * Cross-session stats for the Home dashboard, derived from the day log:
 *   - streak:   consecutive days with activity, counting back from today (or
 *               from yesterday if today is untouched, so the streak only breaks
 *               after a full missed day).
 *   - accuracy: lifetime first-attempt accuracy (%), or null if nothing logged.
 */
export function stats(state) {
  const hist = state.history ?? {};

  // Seed with the lifetime roll-up (days pruned out of `history`) so accuracy is
  // exact across the window prune, then add the days still in the window.
  const lifetime = state.lifetime ?? { seen: 0, correct: 0 };
  let seen = lifetime.seen;
  let correct = lifetime.correct;
  for (const k in hist) {
    seen += hist[k].seen;
    correct += hist[k].correct;
  }
  const accuracy = seen ? Math.round((correct / seen) * 100) : null;

  let streak = 0;
  let n = hist[dayKeyAgo(0)] ? 0 : 1; // grace day: keep the streak alive today
  while (hist[dayKeyAgo(n)]?.seen > 0) {
    streak += 1;
    n += 1;
  }

  return { streak, accuracy };
}

/**
 * Per-card answer aggregates for the behaviour page (M7b), derived from the
 * running totals `recordAnswer` keeps:
 *   - accuracy: first-attempt accuracy (%), or null if the card is unseen.
 *   - avgMs:    average time-to-answer in ms, or null if unseen.
 */
export function cardStats(state, cardId) {
  const c = state.cards?.[cardId];
  const seen = c?.seen ?? 0;
  if (!seen) return { seen: 0, correct: 0, accuracy: null, avgMs: null };
  const correct = c.correct ?? 0;
  return {
    seen,
    correct,
    accuracy: Math.round((correct / seen) * 100),
    avgMs: Math.round((c.timeMs ?? 0) / seen),
  };
}

/**
 * Raw (unrounded) sums of every card's running totals: { seen, correct, timeMs }.
 * The combinable primitive — sum these across phases for an app-wide figure, then
 * round once. (Averaging the per-phase percentages instead would mis-weight phases
 * with different seen-counts.) Backs `aggregateStats`.
 */
export function rawTotals(state) {
  let seen = 0;
  let correct = 0;
  let timeMs = 0;
  for (const id in state.cards ?? {}) {
    const c = state.cards[id];
    seen += c.seen ?? 0;
    correct += c.correct ?? 0;
    timeMs += c.timeMs ?? 0;
  }
  return { seen, correct, timeMs };
}

/**
 * Phase-wide answer aggregates (M7b's general metrics) from a single state's
 * running totals: average accuracy (%) and average time-to-answer (ms), each
 * null until at least one answer is recorded.
 */
export function aggregateStats(state) {
  return statsFromTotals(rawTotals(state));
}

/**
 * Reduce raw totals ({ seen, correct, timeMs }) to { accuracy, avgMs }, rounding
 * once at the end. Shared by `aggregateStats` and the app-wide band, which sums
 * `rawTotals` across phases before calling this.
 */
export function statsFromTotals({ seen, correct, timeMs }) {
  return {
    accuracy: seen ? Math.round((correct / seen) * 100) : null,
    avgMs: seen ? Math.round(timeMs / seen) : null,
  };
}
