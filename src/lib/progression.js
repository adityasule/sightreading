// Scale-based learning progression (M1d): resolves which level the user is on
// from the live deck + SR state, and owns advancing through the gate.
//
// Layering: the curriculum *model* (levels, ordering) lives in music.js; the
// *scheduler* (boxes, due dates) lives in spaced-repetition.js and stays
// curriculum-blind. This module is the thin bridge that answers the questions
// the quiz and Home ask — "what level am I on, is it done, can I move on?"
//
// Persisted state: a single integer `unlocked` carried on the SR blob — the
// canonical index (0–11, see SCALE_SEQUENCE) of the furthest level the user has
// unlocked. It advances *only* when the user accepts the gate; everything else
// is derived from it against the live deck, so widening the range or toggling a
// clef is self-correcting (a re-opened earlier level simply becomes `current`
// again until it's mastered).

import { levelsFor } from './music.js';
import { boxAtLeast, masteredCount } from './spaced-repetition.js';

// A level is complete once every card in it has been reviewed correctly twice
// (Leitner box ≥ 2). See GOALS.md → Design Notes → Learning progression.
export const MASTER_BOX = 2;

// Seed `unlocked` for a blob that doesn't have it yet. Brand-new users land on
// level 0; pre-M1d users (cards introduced in raw MIDI order) are placed at
// their first not-yet-mastered level — everything before it is already complete,
// so this drops them exactly where they left off. A fully-mastered deck seeds to
// the last level (curriculum finished).
function seedUnlocked(state, levels) {
  const firstIncomplete = levels.find(
    (l) => !boxAtLeast(state, l.cards, MASTER_BOX)
  );
  return firstIncomplete ? firstIncomplete.index : levels[levels.length - 1].index;
}

/**
 * Resolve the live progression view for `state` against `deck`. Seeds (and
 * persists onto the blob) `unlocked` on first call, so callers should
 * `saveState` after if they care to keep a freshly-migrated pointer. Returns:
 *   levels        all present levels, in order
 *   current       the level new cards are introduced from now (null if deck empty)
 *   pool          current.cards — pass straight to pickNext as its newPool
 *   mastered/total  progress within `current` (cards at box ≥ 2 / all)
 *   complete      is `current` fully mastered?
 *   next          the level the gate would unlock, or null
 *   canAdvance    complete && next exists → show the "Start next level?" gate
 */
export function progress(state, deck) {
  const levels = levelsFor(deck);
  if (levels.length === 0) {
    return {
      levels, current: null, pool: [], mastered: 0, total: 0,
      complete: false, next: null, canAdvance: false,
    };
  }

  if (typeof state.unlocked !== 'number') {
    state.unlocked = seedUnlocked(state, levels);
  }

  // Levels the user has unlocked. Level 0 is always present (the staff's own
  // lines are naturals), so this is non-empty; the fallback is purely defensive.
  const active = levels.filter((l) => l.index <= state.unlocked);
  const pool = active.length ? active : [levels[0]];

  // The current level is the *introduction frontier*: the earliest unlocked level
  // that still has un-introduced cards, else the frontier (last unlocked), where
  // the gate appears. Basing this on introduction rather than mastery is what
  // lets the M2e early top-up work — bumping `unlocked` past a fully-introduced
  // but unmastered level moves both the banner (`current`) and the new-card pool
  // to the next level without first mastering this one. In the *normal* flow the
  // two are identical: `unlocked` only ever advances past a level once it's
  // mastered (and a mastered level is fully introduced), so the earliest level
  // with un-introduced cards is also the earliest unmastered one.
  const current =
    pool.find((l) => l.cards.some((c) => !(c.id in state.cards))) ??
    pool[pool.length - 1];

  const total = current.cards.length;
  const mastered = masteredCount(state, current.cards, MASTER_BOX);
  const complete = mastered === total;
  const next = levels.find((l) => l.index > state.unlocked) ?? null;

  return {
    levels, current, pool: current.cards, mastered, total,
    complete, next, canAdvance: complete && next != null,
  };
}

/**
 * Accept the gate: unlock the next level. No-op if there's nothing to unlock.
 * The caller is responsible for persisting the blob (`saveState`) afterwards.
 */
export function advance(state, deck) {
  const { next } = progress(state, deck);
  if (next) state.unlocked = next.index;
}
