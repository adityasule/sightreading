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
  if (color) note.setStyle({ fillStyle: color, strokeStyle: color });

  const voice = new Voice({ numBeats: 1, beatValue: 4 }).addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], 220);
  voice.draw(ctx, stave);
}
