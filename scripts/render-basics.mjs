// Render the Basics (Phase 0) note-value cards to standalone SVG files, fast,
// without launching a browser. The browser is still the source of truth for
// correctness (real fonts, layout, CSS); this just shortens the inner loop when
// iterating on the staff rendering.
//
// It draws through the SAME src/lib/render.js the app uses, so the output can't
// drift from what ships, and embeds the Bravura music font (data URI) so each
// SVG is self-contained — opens correctly anywhere, no CDN, no font race.
//
//   npm run render:basics                  # all six durations → render-out/
//   npm run render:basics -- quarter       # just one (by value or vex code)
//   npm run render:basics -- --feedback    # tint as a correct answer
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
// Basics cards have none (the music glyphs lay out from bundled font metrics).
const dom = new JSDOM('<!DOCTYPE html><body></body>', { virtualConsole: new VirtualConsole() });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

// VexFlow measures arbitrary text via an offscreen <canvas>; jsdom has no canvas
// backend, so it logs a warning per call. Basics cards have no text (only music
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
const { buildBasicsDeck, durationLabel } = await import(join(root, 'src/lib/music.js'));
const { drawDurationNote } = await import(join(root, 'src/lib/render.js'));

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

const args = process.argv.slice(2);
const feedback = args.includes('--feedback');
const filter = args.find((a) => !a.startsWith('-'));

const deck = buildBasicsDeck();
const cards = filter ? deck.filter((c) => c.value === filter || c.vex === filter) : deck;
if (cards.length === 0) {
  console.error(`No Basics duration matches "${filter}". Values: ${deck.map((c) => c.value).join(', ')}`);
  process.exit(1);
}

const outDir = join(root, 'render-out');
mkdirSync(outDir, { recursive: true });

const el = document.createElement('div');
for (const card of cards) {
  drawDurationNote(VexFlow, el, { duration: card.vex, color: feedback ? '#16a34a' : null });
  const file = join(outDir, `basics-${card.value}.svg`);
  writeFileSync(file, selfContained(el.innerHTML));
  console.log(`  ${durationLabel(card.value).padEnd(18)} → ${file}`);
}
