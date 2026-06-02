// Shared VexFlow staff rendering, used by both the Basics view and the
// `render:basics` dev script — so the SVG the script emits is drawn through the
// exact same code that ships, and can't drift from what the user actually sees.
//
// VexFlow is passed in rather than imported here: the app dynamic-imports it
// (CDN-font build, lazy-loaded chunk) while the script imports the font-bundled
// build. Keeping this module VexFlow-free also means importing it never pulls
// VexFlow into a bundle that didn't already have it.

// Fixed staff position for a Basics duration note. Pitch is out of scope in
// Basics — the note is never named — so e4 is arbitrary; it just keeps the note
// on the bottom line with a tidy upward stem on a clef-less staff.
const DURATION_NOTE_KEY = 'e/4';

/**
 * Draw a single note of `duration` (a VexFlow duration code, e.g. 'q', 'w',
 * '1/2') on a *clef-less* staff inside `element`, using the provided `VexFlow`
 * module. `color` (any CSS colour) tints the note for answer feedback. Clears
 * and repopulates the element's SVG; returns nothing.
 */
export function drawDurationNote(VexFlow, element, { duration, color = null } = {}) {
  const { Renderer, Stave, StaveNote, Formatter, Voice } = VexFlow;
  element.innerHTML = '';
  const renderer = new Renderer(element, Renderer.Backends.SVG);
  renderer.resize(320, 150);
  const ctx = renderer.getContext();

  // A bare 5-line staff — no clef glyph (clefs aren't introduced in Basics yet,
  // and the note's pitch is irrelevant: only its duration is asked).
  const stave = new Stave(10, 35, 300);
  stave.setContext(ctx).draw();

  const note = new StaveNote({ clef: 'treble', keys: [DURATION_NOTE_KEY], duration });
  if (color) note.setStyle({ fillStyle: color, strokeStyle: color });

  // SOFT mode so a single note of any duration (including the 8-beat breve)
  // renders without tripping the voice's tick-total validation.
  const voice = new Voice({ numBeats: 4, beatValue: 4 })
    .setMode(Voice.Mode.SOFT)
    .addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], 200);
  voice.draw(ctx, stave);
}
