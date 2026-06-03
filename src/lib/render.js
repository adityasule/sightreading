// Shared VexFlow staff rendering, used by both the app's quiz views and the
// `render` dev script — so the SVG the script emits is drawn through the exact
// same code that ships, and can't drift from what the user actually sees.
//
// Covers every glyph the project draws: the Basics (Phase 0) note / rest / clef
// cards and the Phase 1 (Notation) single note. Each function is given the
// `VexFlow` module rather than importing it: the app dynamic-imports it (CDN-font
// build, lazy-loaded chunk) while the script imports the font-bundled build.
// Keeping this module VexFlow-free also means importing it never pulls VexFlow
// into a bundle that didn't already have it.

// Fixed staff positions on a clef-less staff. Pitch is out of scope on the
// Basics note/rest cards — the glyph is never named — so these are arbitrary;
// they just keep the glyph tidily on the staff. e/4 gives a note a clean upward
// stem; b/4 (middle line) is the conventional resting place for a rest.
const DURATION_NOTE_KEY = 'e/4';
const REST_KEY = 'b/4';

/**
 * Horizontally centre a single formatted note/chord's *noteheads* in `stave`'s
 * note area. Call after formatting and after `note.setStave(stave)` (so the
 * metrics are measurable); a no-op if they aren't. Used by both the Notation
 * (single note) and Chords (block chord) cards so their notes sit consistently.
 *
 * Centre on the notehead column, not the full bounding box: the latter includes
 * any accidental (a LEFT modifier, drawn to the note's left) and would push the
 * heads right of centre — and shift them card-to-card as the accidental comes and
 * goes, and as a single note's stem flips up/down. We move the note's *tick
 * context*, not its xShift: VexFlow applies xShift to the noteheads but draws a
 * LEFT-anchored accidental at getAbsoluteX()-2 with no xShift term, so an xShift
 * centre would strand the accidental back by the clef. Both the heads and the
 * accidental derive their x from getAbsoluteX() → tickContext.getX(), so shifting
 * that keeps the accidental glued to the heads (hanging just to their left).
 *
 * Notehead width comes from getGlyphWidth(): exact in the browser (the source of
 * truth), but it collapses to 0 under the render script's stubbed text metrics,
 * so there we fall back to the bounding box (font-path metrics, non-zero) just to
 * keep the dev-render legible.
 */
function centerNote(stave, note) {
  const avail = stave.getNoteEndX() - stave.getNoteStartX();
  let left = null;
  let w = 0;
  try {
    const glyphW = note.getGlyphWidth();
    if (glyphW > 0) {
      left = note.getNoteHeadBeginX(); // notehead column only — accidental excluded
      w = glyphW;
    } else {
      const bb = note.getBoundingBox(); // headless fallback — includes the accidental
      if (bb) {
        left = bb.getX();
        w = bb.getW();
      }
    }
  } catch {
    left = null; // metrics unavailable — leave left-aligned, still legible
  }
  if (left !== null && w > 0 && w < avail) {
    const target = stave.getNoteStartX() + (avail - w) / 2;
    const tc = note.getTickContext();
    tc.setX(tc.getX() + (target - left));
  }
}

/**
 * Render a 320×150 clef-less staff inside `element` and place a single,
 * horizontally-centered glyph on it — shared by the Basics note and rest cards
 * (duration symbols, pitch irrelevant). `makeGlyph(VexFlow)` returns the
 * `StaveNote` to draw; `color` (any CSS colour) tints it for answer feedback.
 * Clears and repopulates the element's SVG.
 */
function drawCenteredGlyph(VexFlow, element, makeGlyph, color) {
  const { Renderer, Stave, Formatter, Voice } = VexFlow;
  element.innerHTML = '';
  const renderer = new Renderer(element, Renderer.Backends.SVG);
  renderer.resize(320, 150);
  const ctx = renderer.getContext();

  // A bare 5-line staff — no clef glyph (clefs aren't introduced on note/rest
  // cards, and the glyph's pitch is irrelevant: only its time value is asked).
  const stave = new Stave(10, 35, 300);
  stave.setContext(ctx).draw();

  const note = makeGlyph(VexFlow);
  // Attach the stave up front so the glyph's bounding box is measurable *before*
  // we draw (getBoundingBox throws without a stave) — needed to centre it.
  note.setStave(stave);
  if (color) note.setStyle({ fillStyle: color, strokeStyle: color });

  // SOFT mode so a single glyph of any duration (incl. the 8-beat breve)
  // renders without tripping the voice's tick-total validation.
  const voice = new Voice({ numBeats: 4, beatValue: 4 })
    .setMode(Voice.Mode.SOFT)
    .addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], 200);

  // Centre the lone glyph in the stave's note area — it would otherwise sit hard
  // against the left. Shift it right by half the leftover space around its width.
  const avail = stave.getNoteEndX() - stave.getNoteStartX();
  let w = 0;
  try {
    w = note.getBoundingBox()?.getW() ?? 0;
  } catch {
    w = 0; // bbox unavailable — fall back to left-aligned, still legible
  }
  if (w > 0 && w < avail) note.setXShift((avail - w) / 2);

  voice.draw(ctx, stave);
}

/**
 * Draw a single note of `duration` (a VexFlow duration code, e.g. 'q', 'w',
 * '1/2'), optionally `dotted`, on a clef-less staff inside `element`. `color`
 * tints the note for feedback.
 */
export function drawDurationNote(VexFlow, element, { duration, dotted = false, color = null } = {}) {
  drawCenteredGlyph(
    VexFlow,
    element,
    ({ StaveNote, Dot }) => {
      const note = new StaveNote({ clef: 'treble', keys: [DURATION_NOTE_KEY], duration });
      if (dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    },
    color
  );
}

/**
 * Draw a single rest of `duration` (the same VexFlow duration code as the note
 * — the 'r' suffix makes it a rest) on a clef-less staff inside `element`.
 * `color` tints it for feedback.
 */
export function drawRest(VexFlow, element, { duration, color = null } = {}) {
  drawCenteredGlyph(
    VexFlow,
    element,
    ({ StaveNote }) =>
      new StaveNote({ clef: 'treble', keys: [REST_KEY], duration: `${duration}r` }),
    color
  );
}

/**
 * Draw a lone `clef` ('treble' | 'bass') on an otherwise empty 5-line staff
 * inside `element` — the only Basics card that shows a clef in isolation. The
 * clef sits at the staff start, as in real notation (not centered).
 *
 * Unlike the note/rest cards there is no feedback tint: VexFlow 5 renders the
 * clef as a `<text>` glyph the drawing context can't recolour after the fact,
 * and tinting the whole staff would look wrong. Clef cards convey correct/wrong
 * through the answer buttons instead (a plain binary multiple choice).
 */
export function drawClef(VexFlow, element, { clef } = {}) {
  const { Renderer, Stave } = VexFlow;
  element.innerHTML = '';
  const renderer = new Renderer(element, Renderer.Backends.SVG);
  renderer.resize(320, 150);
  const ctx = renderer.getContext();

  const stave = new Stave(10, 35, 300).addClef(clef);
  stave.setContext(ctx).draw();
}

/**
 * Draw a single Phase 1 (Notation) note: `vexKey` (e.g. 'c/4') on the given
 * `clef`, with an optional `accidental` glyph ('#' | 'b'). `ledgerLines` sizes
 * the vertical margin so notes above/below the staff aren't clipped (stable
 * across cards, so the staff doesn't jump). `color` tints the note for feedback.
 */
export function drawNote(
  VexFlow,
  element,
  { clef, vexKey, accidental = '', ledgerLines = 2, duration = 'q', color = null } = {}
) {
  const { Renderer, Stave, StaveNote, Accidental, Formatter, Voice } = VexFlow;
  element.innerHTML = '';
  const renderer = new Renderer(element, Renderer.Backends.SVG);
  const margin = 44 + ledgerLines * 12;
  renderer.resize(320, margin * 2 + 44);
  const ctx = renderer.getContext();

  const stave = new Stave(10, margin, 300).addClef(clef);
  stave.setContext(ctx).draw();

  const note = new StaveNote({ clef, keys: [vexKey], duration });
  // The accidental in the key string sets the pitch but isn't drawn; the glyph
  // must be added explicitly.
  if (accidental) note.addModifier(new Accidental(accidental), 0);
  // Attach the stave up front so the note's metrics are measurable before drawing
  // (getBoundingBox throws without a stave) — needed to centre it.
  note.setStave(stave);
  if (color) note.setStyle({ fillStyle: color, strokeStyle: color });

  const voice = new Voice({ numBeats: 1, beatValue: 4 }).addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], 220);
  // Centre the note's head in the note area (matching the chord cards), so its
  // horizontal position stays put across pitches even as the stem flips up/down.
  centerNote(stave, note);
  voice.draw(ctx, stave);
}

/**
 * Draw a Phase 2 (Chords) triad: the `keys` array (e.g. ['e/4','g#/4','b/4'],
 * low→high as VexFlow expects) on the given `clef`, with `accidentals` as
 * `[{ index, type }]` where `index` is the notehead's position in `keys` and
 * `type` is '#' | 'b'. Drawn as a whole-note "block chord" (open noteheads, no
 * stem) — the clearest read for chord identification, and stem-direction-free
 * across registers. `ledgerLines` sizes the vertical margin so inverted / high /
 * low voicings aren't clipped (a chord can reach ~2–3 ledger lines either way);
 * `color` tints the noteheads for answer feedback. The voicing itself comes from
 * `chordVoicing` in chords.js, so this stays a pure draw step.
 */
export function drawChord(
  VexFlow,
  element,
  { clef, keys, accidentals = [], ledgerLines = 3, color = null } = {}
) {
  const { Renderer, Stave, StaveNote, Accidental, Formatter, Voice } = VexFlow;
  element.innerHTML = '';
  const renderer = new Renderer(element, Renderer.Backends.SVG);
  const margin = 44 + ledgerLines * 12;
  renderer.resize(320, margin * 2 + 44);
  const ctx = renderer.getContext();

  const stave = new Stave(10, margin, 300).addClef(clef);
  stave.setContext(ctx).draw();

  const note = new StaveNote({ clef, keys, duration: 'w' });
  // Each altered notehead gets its glyph by key index; naturals are omitted.
  for (const { index, type } of accidentals) note.addModifier(new Accidental(type), index);
  // Attach the stave up front so the bounding box is measurable before drawing
  // (getBoundingBox throws without a stave) — needed to centre the chord.
  note.setStave(stave);
  if (color) note.setStyle({ fillStyle: color, strokeStyle: color });

  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], 200);

  // A single block chord would otherwise sit hard against the clef and overlap it
  // (worst on low voicings with ledger lines); centre its noteheads in the note
  // area (the accidental hangs to their left). See centerNote.
  centerNote(stave, note);

  voice.draw(ctx, stave);
}
