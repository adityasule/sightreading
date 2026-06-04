// Shared card-rendering harness — the bits the dev card gallery and the
// production Progress drill-down both need to draw a deck card's staff glyph.
// Centralised here so both draw through the *same* path (like render.js itself,
// the output can't drift between the dev view and what ships).
//
// VexFlow stays lazy: `loadVex` is the only thing that imports it, dynamically,
// so opening a view that imports this module costs nothing until a glyph is drawn.

import {
  drawDurationNote,
  drawRest,
  drawClef,
  drawAccidental,
  drawNote,
  drawChord,
  drawKeySignature,
  drawInterval,
} from './render.js';
import { chordPlacements, chordVoicing, INVERSIONS } from './chords.js';
import { intervalPlacements } from './intervals.js';

/**
 * Dynamic-import the font-bundled VexFlow build and gate on its FontFaces, then
 * return the module subset every `draw*` fn destructures. The `/bravura` build
 * embeds Bravura + Academico as data URIs, so `document.fonts.load` resolves them
 * with no network (M5e) — unlike `VexFlow.loadFonts`, which re-fetches from a CDN.
 * Gating here avoids the first-paint glyph-metrics race (M1c).
 */
export async function loadVex() {
  const m = await import('vexflow/bravura');
  try {
    await Promise.all([
      document.fonts.load("1em 'Bravura'"),
      document.fonts.load("1em 'Academico'"),
    ]);
  } catch {
    /* no FontFace API (or load failed) — render anyway */
  }
  return {
    Renderer: m.Renderer,
    Stave: m.Stave,
    StaveNote: m.StaveNote,
    Accidental: m.Accidental,
    GlyphNote: m.GlyphNote,
    Dot: m.Dot,
    Formatter: m.Formatter,
    Voice: m.Voice,
    KeySignature: m.KeySignature,
  };
}

// Give a freshly-drawn VexFlow SVG a viewBox from its fixed width/height, then let
// CSS size it responsively to its cell.
function fit(node) {
  const svg = node.querySelector('svg');
  if (!svg) return;
  const w = svg.getAttribute('width');
  const h = svg.getAttribute('height');
  if (w && h && !svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';
}

/**
 * Svelte action: draw a cell into its node once VexFlow is ready, and redraw when
 * the params change (settings reshape, or the font finishing loading). Params are
 * `{ draw: (node) => void, ready: boolean }`.
 */
export function staff(node, params) {
  const run = (p) => {
    if (p.ready) {
      p.draw(node);
      fit(node);
    }
  };
  run(params);
  return { update: run };
}

/**
 * The lowest in-window voicing of a chord card at the given inversion — a stable,
 * scannable register (the quiz randomises the register per show). Falls back to
 * octave 4 if no placement fits the window (shouldn't happen for a triad).
 */
export function chordVoicingFor(card, inversion) {
  const fit = chordPlacements(card).find((p) => p.inversion === inversion);
  return chordVoicing(card, inversion, fit ? fit.octave : 4);
}

/** One representative chord glyph for the details grid: root position, lowest register. */
export const representativeChordVoicing = (card) => chordVoicingFor(card, 0);

/**
 * One representative interval glyph for the details grid: the lowest *ascending*
 * placement (so direction reads left→right and the register is stable). Falls back
 * to the first placement of any direction if none ascend (always non-empty).
 */
export function representativeIntervalPair(card) {
  const all = intervalPlacements(card);
  const asc = all
    .filter((p) => p.direction === 'asc')
    .sort((a, b) => Math.min(...a.midis) - Math.min(...b.midis));
  return asc[0] ?? all[0];
}

// All five draw fns plus INVERSIONS, re-exported so consumers import from one place.
export {
  drawDurationNote,
  drawRest,
  drawClef,
  drawAccidental,
  drawNote,
  drawChord,
  drawKeySignature,
  drawInterval,
  INVERSIONS,
};

/**
 * Draw a single deck `card` as one representative staff glyph into `el`, picking
 * the right `render.js` fn by phase. The drill-down shows one glyph per card (the
 * quiz varies voicing/register/direction per show); `settings` supplies the note
 * range for Notation. Mirrors the dispatch the dev gallery uses, so the two can't
 * drift.
 */
export function drawForCard(vex, phaseId, card, el, settings = {}) {
  switch (phaseId) {
    case 'phase0':
      if (card.type === 'rest') return drawRest(vex, el, { duration: card.vex });
      if (card.type === 'clef') return drawClef(vex, el, { clef: card.clef });
      if (card.type === 'accidental') return drawAccidental(vex, el, { type: card.vex });
      return drawDurationNote(vex, el, { duration: card.vex, dotted: card.dotted });
    case 'phase1':
      return drawNote(vex, el, {
        clef: card.clef,
        vexKey: card.vexKey,
        accidental: card.accidental,
        ledgerLines: settings.ledgerLines ?? 2,
      });
    case 'phase3':
      return drawKeySignature(vex, el, { clef: card.clef, spec: card.spec });
    case 'phase4': {
      const p = representativeIntervalPair(card);
      return drawInterval(vex, el, { clef: card.clef, keys: p.keys, accidentals: p.accidentals });
    }
    case 'phase2':
    default: {
      const v = representativeChordVoicing(card);
      return drawChord(vex, el, { clef: card.clef, keys: v.keys, accidentals: v.accidentals });
    }
  }
}
