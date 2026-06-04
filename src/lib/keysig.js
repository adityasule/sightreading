// Phase 3 (Key Signatures): name the major key from its signature.
//
// The user is shown a key signature (the sharps or flats) drawn on a clef and
// picks the major key it denotes — e.g. two sharps → "D major" — by multiple
// choice. Every signature is unambiguous (each of the 15 keys has a distinct
// sharp/flat count), so unlike a single accidental there is no enharmonic
// ambiguity to resolve. Introduction is ordered by the circle of fifths, the
// same alternating-outward-from-C order Notation/Chords use, extended to all 15
// keys (those phases stop at 5♯/5♭ because further keys add only enharmonic
// naturals to *their* decks; a key *signature* card has no such limit).
//
// Layering mirrors Chords: this module is the curriculum model + deck (pure,
// card-agnostic data); the generic Leitner scheduler (spaced-repetition.js) and
// the pluggable progression layer (progression.js, handed `keySigLevelsFor`) do
// the scheduling. Rendering lives in render.js (`drawKeySignature`), fed the
// VexFlow key spec this module stores.

import { noteName } from './music.js';

// Split a key spelling ('C', 'F#', 'Bb') into letter + accidental ('' | '#' | 'b').
function parseKey(key) {
  return { letter: key[0], accidental: key.slice(1) };
}

// The wording for a signature's accidental tally, matching the Notation/Chords
// curriculum's `keySig` phrasing ('no sharps or flats', '1 sharp', '2 flats', …).
function sigWording(count, type) {
  if (count === 0) return 'no sharps or flats';
  return `${count} ${type}${count === 1 ? '' : 's'}`;
}

// The 15 major keys in circle-of-fifths order — C, then alternating outward a
// sharp / a flat at a time out to 7♯ (C♯) and 7♭ (C♭). `key` is both the stable
// grading key (clef-independent answer) and the VexFlow `addKeySignature` spec
// (ASCII '#'/'b'); `count`/`type` drive the signature wording. Stored explicitly
// so the spelling can't drift.
const SEQUENCE = [
  { key: 'C', count: 0, type: 'none' },
  { key: 'G', count: 1, type: 'sharp' },
  { key: 'F', count: 1, type: 'flat' },
  { key: 'D', count: 2, type: 'sharp' },
  { key: 'Bb', count: 2, type: 'flat' },
  { key: 'A', count: 3, type: 'sharp' },
  { key: 'Eb', count: 3, type: 'flat' },
  { key: 'E', count: 4, type: 'sharp' },
  { key: 'Ab', count: 4, type: 'flat' },
  { key: 'B', count: 5, type: 'sharp' },
  { key: 'Db', count: 5, type: 'flat' },
  { key: 'F#', count: 6, type: 'sharp' },
  { key: 'Gb', count: 6, type: 'flat' },
  { key: 'C#', count: 7, type: 'sharp' },
  { key: 'Cb', count: 7, type: 'flat' },
];

/** Display label for a key spec, e.g. 'Bb' → "B♭ major", 'F#' → "F♯ major". */
export function keySigLabel(key) {
  const { letter, accidental } = parseKey(key);
  return `${noteName(letter, accidental)} major`;
}

/**
 * The ordered key-signature curriculum: one level per key, each stamped with its
 * canonical index, the VexFlow `spec`, a display `label` and the signature
 * `keySig` wording (mirroring the Notation/Chords level metadata).
 */
export const KEY_SEQUENCE = SEQUENCE.map((lvl, index) => ({
  index,
  key: lvl.key,
  spec: lvl.key, // VexFlow addKeySignature spec — identical string
  label: keySigLabel(lvl.key),
  keySig: sigWording(lvl.count, lvl.type),
}));

/** The option pool for `choices`: every key's grading key, in curriculum order. */
export const KEYSIG_POOL = KEY_SEQUENCE.map((lvl) => lvl.key);

// Label per grading key, for the multiple-choice options ('Bb' → "B♭ major").
const KEY_LABEL = Object.fromEntries(KEY_SEQUENCE.map((lvl) => [lvl.key, lvl.label]));

/** Display label for a key-signature option, e.g. 'Bb' → "B♭ major". */
export function keySigOptionLabel(key) {
  return KEY_LABEL[key] ?? key;
}

function makeKeySigCard(clef, meta) {
  return {
    id: `${clef}:${meta.key}`,
    clef,
    spec: meta.spec, // VexFlow key spec for the renderer
    level: meta.index,
    key: meta.key, // grading key (clef-independent major key)
    name: meta.label,
  };
}

/**
 * Build the key-signature deck from settings. Only the enabled clefs are
 * included, so toggling a clef in Settings reshapes the deck immediately (as in
 * Phase 1/2). A card exists per (clef, key); the signature renders identically
 * every showing (no voicing to randomise, unlike chords).
 */
export function buildKeySigDeck(settings) {
  const clefs = [];
  if (settings.treble) clefs.push('treble');
  if (settings.bass) clefs.push('bass');
  const deck = [];
  for (const meta of KEY_SEQUENCE) {
    for (const clef of clefs) deck.push(makeKeySigCard(clef, meta));
  }
  return deck;
}

// Introduction order within a level: treble before bass — a clef round-robin so
// new cards fan out across the enabled clefs (the M2f lesson). A level holds at
// most one card per clef, so this just orders the (≤2) clef variants.
const CLEF_RANK = { treble: 0, bass: 1 };

function orderForIntroduction(cards) {
  return [...cards].sort((a, b) => (CLEF_RANK[a.clef] ?? 9) - (CLEF_RANK[b.clef] ?? 9));
}

/**
 * Bucket a key-signature deck into its ordered curriculum levels — the key-sig
 * analogue of `levelsFor`/`chordLevelsFor`, so the generic `progress`/`advance`
 * can drive Phase 3 unchanged (pass this as their `levelsFn`). Returns only
 * levels with at least one in-deck card, each carrying its `KEY_SEQUENCE`
 * metadata plus a `cards` array in introduction order.
 */
export function keySigLevelsFor(deck) {
  const byIndex = new Map();
  for (const card of deck) {
    if (!byIndex.has(card.level)) byIndex.set(card.level, []);
    byIndex.get(card.level).push(card);
  }
  const levels = [];
  for (const meta of KEY_SEQUENCE) {
    const cards = byIndex.get(meta.index);
    if (!cards || cards.length === 0) continue;
    levels.push({ ...meta, cards: orderForIntroduction(cards) });
  }
  return levels;
}
