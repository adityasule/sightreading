// Render the project's staff glyphs to standalone SVG files, fast, without
// launching a browser. The browser is still the source of truth for correctness
// (real fonts, layout, CSS); this just shortens the inner loop when iterating on
// the rendering.
//
// It draws through the SAME src/lib/render.js the app uses, so the output can't
// drift from what ships, and embeds the Bravura music font (data URI) so each
// SVG is self-contained — opens correctly anywhere, no CDN, no font race.
//
//   npm run render                  # all Basics cards (notes/rests/clefs)
//   npm run render -- note          # just the note cards (incl. dotted)
//   npm run render -- rest          # just the rest cards
//   npm run render -- clef          # just the clef cards
//   npm run render -- rest quarter  # one card, by key/value (or id)
//   npm run render -- note half.    # the dotted-half note
//   npm run render -- phase1        # a representative Phase 1 (Notation) set
//   npm run render -- phase1 treble:60   # one Phase 1 card, by id
//   npm run render -- chord         # a representative Phase 2 (Chords) set, each inversion
//   npm run render -- chord treble:Bb:major  # one chord (all inversions), by id/key
//   npm run render -- quarter       # shorthand: a Basics card by key/value/id
//   npm run render -- --feedback    # tint as a correct answer (combine w/ above)
//
// (the `--` passes args through npm to the script.)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import jsdomPkg from 'jsdom';

const { JSDOM, VirtualConsole } = jsdomPkg;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// A minimal DOM so VexFlow's SVG backend has a `document` to build into. The
// silent VirtualConsole swallows jsdom's "canvas getContext not implemented"
// notices — VexFlow only touches a canvas to measure arbitrary *text*, of which
// these cards have none (the music glyphs lay out from bundled font metrics).
const dom = new JSDOM('<!DOCTYPE html><body></body>', { virtualConsole: new VirtualConsole() });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

// VexFlow measures arbitrary text via an offscreen <canvas>; jsdom has no canvas
// backend, so it logs a warning per call. These cards have no text (only music
// glyphs, which lay out from bundled font metrics), so a no-op 2D context that
// reports zero-width text is correct here and keeps the output clean.
const noopCtx = new Proxy(
  {},
  {
    get: (_t, prop) =>
      prop === 'measureText'
        ? () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })
        : () => {},
    set: () => true,
  }
);
dom.window.HTMLCanvasElement.prototype.getContext = () => noopCtx;

// vexflow/bravura = VexFlow with Bravura + Academico bundled (no CDN fetch).
const VexFlow = await import('vexflow/bravura');
const { buildBasicsDeck, buildDeck, basicsLabel } = await import(join(root, 'src/lib/music.js'));
const { buildChordDeck, chordVoicing, chordPlacements, INVERSIONS } = await import(
  join(root, 'src/lib/chords.js')
);
const { drawDurationNote, drawRest, drawClef, drawNote, drawChord } = await import(
  join(root, 'src/lib/render.js')
);

// The bundled font module is literally `export const Bravura = 'data:font/woff2…'`.
const bravuraModule = readFileSync(
  join(root, 'node_modules/vexflow/build/esm/src/fonts/bravura.js'),
  'utf8'
);
const BRAVURA_DATA_URI = bravuraModule.match(/data:font\/woff2[^'"]+/)[0];

// Make the SVG a portable standalone file: add the SVG namespace (jsdom's
// innerHTML serialization drops it, so a browser would otherwise show the file
// as raw XML) and inline the Bravura font via @font-face so nothing external is
// needed to display the music glyphs.
function selfContained(svg) {
  if (!/\bxmlns=/.test(svg)) {
    svg = svg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const style =
    `<defs><style>@font-face{font-family:'Bravura';` +
    `src:url("${BRAVURA_DATA_URI}") format('woff2');}</style></defs>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${style}`);
}

// A filename-safe slug from a card id (e.g. 'dur:half:dot' → 'dur-half-dot').
// '#' → 's' first so a sharp root/spelling stays distinct from its natural
// ('G#' vs 'G') instead of both collapsing to the same name; flats keep their 'b'.
const slug = (s) => s.replace(/#/g, 's').replace(/[^a-z0-9]+/gi, '-');

// Draw a Basics card to `el`, routed by type through the shared render.js — the
// same dispatch the Basics view uses.
function drawBasicsCard(el, card, color) {
  if (card.type === 'rest') drawRest(VexFlow, el, { duration: card.vex, color });
  else if (card.type === 'clef') drawClef(VexFlow, el, { clef: card.clef }); // no tint
  else drawDurationNote(VexFlow, el, { duration: card.vex, dotted: card.dotted, color });
}

// Representative Phase 1 cards when no id is given: middle C on both clefs, a
// sharp and a flat (all present in the default ±2-ledger deck).
const PHASE1_SAMPLE = ['treble:60', 'bass:60', 'treble:61:#', 'treble:66:b'];

// Representative Phase 2 chords when no id is given: a natural major + minor, a
// sharp major, a flat major, and one on bass — each rendered in all inversions.
const CHORD_SAMPLE = ['treble:C:major', 'treble:A:minor', 'treble:E:major', 'treble:Bb:major', 'bass:C:major'];

const args = process.argv.slice(2);
const feedback = args.includes('--feedback');
const color = feedback ? '#16a34a' : null;
const positionals = args.filter((a) => !a.startsWith('-'));

const KINDS = new Set(['basics', 'note', 'rest', 'clef', 'phase1', 'chord']);
let kind, filter;
if (positionals[0] && KINDS.has(positionals[0])) {
  [kind, filter] = positionals;
} else {
  kind = 'basics'; // first positional (if any) is a Basics value/key/id filter
  filter = positionals[0];
}

let renderables;
if (kind === 'phase1') {
  const deck = buildDeck({ treble: true, bass: true, ledgerLines: 2 });
  const cards = filter
    ? deck.filter((c) => c.id === filter)
    : deck.filter((c) => PHASE1_SAMPLE.includes(c.id));
  renderables = cards.map((card) => ({
    label: `${card.name} (${card.clef})`,
    file: `phase1-${slug(card.id)}.svg`,
    draw: (el) =>
      drawNote(VexFlow, el, {
        clef: card.clef,
        vexKey: card.vexKey,
        accidental: card.accidental,
        ledgerLines: 2,
        color,
      }),
  }));
} else if (kind === 'chord') {
  const deck = buildChordDeck({ treble: true, bass: true });
  const cards = filter
    ? deck.filter((c) => c.id === filter || c.key === filter)
    : deck.filter((c) => CHORD_SAMPLE.includes(c.id));
  // One SVG per (chord, inversion); pick the lowest in-window octave for a stable
  // register (the app randomises it — here we want deterministic, eyeballable output).
  renderables = cards.flatMap((card) =>
    INVERSIONS.map((inversion) => {
      const fit = chordPlacements(card).find((p) => p.inversion === inversion);
      const octave = fit ? fit.octave : 4;
      const { keys, accidentals } = chordVoicing(card, inversion, octave);
      return {
        label: `${card.name} (${card.clef}, inv ${inversion})`,
        file: `chord-${slug(card.id)}-inv${inversion}.svg`,
        draw: (el) => drawChord(VexFlow, el, { clef: card.clef, keys, accidentals, color }),
      };
    })
  );
} else {
  let cards = buildBasicsDeck();
  if (kind !== 'basics') cards = cards.filter((c) => c.type === kind);
  if (filter) cards = cards.filter((c) => c.key === filter || c.id === filter);
  renderables = cards.map((card) => ({
    label: basicsLabel(card.type, card.key),
    file: `basics-${slug(card.id)}.svg`,
    draw: (el) => drawBasicsCard(el, card, color),
  }));
}

if (renderables.length === 0) {
  console.error(
    `Nothing to render for "${positionals.join(' ') || '(all)'}".\n` +
      `Kinds: note | rest | clef | phase1 | chord (or a Basics key/value/id).`
  );
  process.exit(1);
}

const outDir = join(root, 'render-out');
mkdirSync(outDir, { recursive: true });

const el = document.createElement('div');
for (const r of renderables) {
  r.draw(el);
  const file = join(outDir, r.file);
  writeFileSync(file, selfContained(el.innerHTML));
  console.log(`  ${r.label.padEnd(20)} → ${file}`);
}
