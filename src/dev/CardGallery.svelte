<script>
  // Dev-only "browse every card" view (never shipped — gated behind
  // import.meta.env.DEV + a dynamic import in App.svelte). Lets future cards be
  // checked by eye without playing the quiz; the in-browser companion to the
  // `render` script. Draws through the *same* render.js the quiz uses, so what's
  // shown here can't drift from what the quiz renders.
  import { onMount } from 'svelte';
  import { settings } from '../lib/settings.svelte.js';
  import { buildBasicsDeck, basicsLabel, buildDeck } from '../lib/music.js';
  import { buildChordDeck, chordVoicing, chordPlacements, INVERSIONS } from '../lib/chords.js';
  import { buildKeySigDeck } from '../lib/keysig.js';
  import { buildIntervalDeck, intervalPlacements } from '../lib/intervals.js';
  import {
    drawDurationNote,
    drawRest,
    drawClef,
    drawAccidental,
    drawNote,
    drawChord,
    drawKeySignature,
    drawInterval,
  } from '../lib/render.js';

  const TABS = [
    { id: 'phase0', label: 'Basics' },
    { id: 'phase1', label: 'Notation' },
    { id: 'phase2', label: 'Chords' },
    { id: 'phase3', label: 'Key Signatures' },
    { id: 'phase4', label: 'Intervals' },
  ];
  let active = $state('phase0');

  let vex = $state(null);

  // Basics: the same type dispatch the quiz view uses.
  function drawBasics(card, el) {
    if (card.type === 'rest') drawRest(vex, el, { duration: card.vex });
    else if (card.type === 'clef') drawClef(vex, el, { clef: card.clef });
    else if (card.type === 'accidental') drawAccidental(vex, el, { type: card.vex });
    else drawDurationNote(vex, el, { duration: card.vex, dotted: card.dotted });
  }

  const INV_LABEL = { 0: 'root', 1: '1st inv', 2: '2nd inv' };

  // A representative octave for an inversion in the gallery: the lowest in-window
  // one, so the register is stable to scan (the quiz randomises it per show).
  function galleryVoicing(card, inversion) {
    const fit = chordPlacements(card).find((p) => p.inversion === inversion);
    return chordVoicing(card, inversion, fit ? fit.octave : 4);
  }

  // Display groups for the active tab. A group is { heading, chord, cells } where
  // a cell is { label, draw }. Basics/Notation get one heading-less group; Chords
  // get one group per card (its three inversions side by side). Derived against
  // live settings, so toggling clefs / range / naming reshapes the gallery.
  let groups = $derived.by(() => {
    if (active === 'phase0') {
      return [
        {
          heading: null,
          chord: false,
          cells: buildBasicsDeck().map((c) => ({
            label: basicsLabel(c.type, c.key, settings.durationNames),
            draw: (el) => drawBasics(c, el),
          })),
        },
      ];
    }
    if (active === 'phase1') {
      return [
        {
          heading: null,
          chord: false,
          cells: buildDeck(settings).map((c) => ({
            label: `${c.name} · ${c.clef}`,
            draw: (el) =>
              drawNote(vex, el, {
                clef: c.clef,
                vexKey: c.vexKey,
                accidental: c.accidental,
                ledgerLines: settings.ledgerLines ?? 2,
              }),
          })),
        },
      ];
    }
    if (active === 'phase3') {
      return [
        {
          heading: null,
          chord: false,
          cells: buildKeySigDeck(settings).map((c) => ({
            label: `${c.name} · ${c.clef}`,
            draw: (el) => drawKeySignature(vex, el, { clef: c.clef, spec: c.spec }),
          })),
        },
      ];
    }
    if (active === 'phase4') {
      // One group per (clef, interval), like Chords' inversions: a representative
      // 2×2 of the quiz's variety — ascending + descending, each at a low and a
      // high register (by the pair's floor pitch), so both directions and the
      // ledger-line extremes show. The quiz randomises across every placement
      // (~528 in all); this is the eyeball-able sample, not the full set.
      const reps = (card) => {
        const all = intervalPlacements(card);
        const ends = (dir) => {
          const ps = all
            .filter((p) => p.direction === dir)
            .sort((a, b) => Math.min(...a.midis) - Math.min(...b.midis));
          if (ps.length === 0) return [];
          const out = [{ p: ps[0], reg: 'low' }];
          if (ps.length > 1) out.push({ p: ps[ps.length - 1], reg: 'high' });
          return out;
        };
        return [
          ...ends('asc').map(({ p, reg }) => ({ p, label: `asc · ${reg}` })),
          ...ends('desc').map(({ p, reg }) => ({ p, label: `desc · ${reg}` })),
        ];
      };
      return buildIntervalDeck(settings).map((card) => ({
        heading: `${card.name} · ${card.clef}`,
        interval: true,
        cells: reps(card).map(({ p, label }) => ({
          label,
          draw: (el) =>
            drawInterval(vex, el, { clef: card.clef, keys: p.keys, accidentals: p.accidentals }),
        })),
      }));
    }
    // Chords: one group per card, all three inversions.
    return buildChordDeck(settings).map((card) => ({
      heading: `${card.name} · ${card.clef}`,
      chord: true,
      cells: INVERSIONS.map((inv) => {
        const { keys, accidentals } = galleryVoicing(card, inv);
        return {
          label: INV_LABEL[inv],
          draw: (el) => drawChord(vex, el, { clef: card.clef, keys, accidentals }),
        };
      }),
    }));
  });

  let count = $derived(groups.reduce((n, g) => n + g.cells.length, 0));

  // Make a freshly-drawn VexFlow SVG scale to its cell: give it a viewBox from its
  // fixed width/height, then let CSS size it responsively.
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

  // Action: draw a cell into its node once VexFlow is ready, and redraw when the
  // params change (tab switch, settings reshape, or the font finishing loading).
  function staff(node, params) {
    const run = (p) => {
      if (p.ready) {
        p.draw(node);
        fit(node);
      }
    };
    run(params);
    return { update: run };
  }

  onMount(async () => {
    // The `/bravura` build bundles the music font as data URIs — no runtime CDN
    // fetch (M5e); `document.fonts.load` then awaits the registered FontFaces
    // without re-fetching (unlike `VexFlow.loadFonts`).
    const m = await import('vexflow/bravura');
    try {
      await Promise.all([
        document.fonts.load("1em 'Bravura'"),
        document.fonts.load("1em 'Academico'"),
      ]);
    } catch {
      /* no FontFace API (or load failed) — render anyway */
    }
    vex = {
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
  });
</script>

<div class="view">
  <header class="intro">
    <h2>Cards <span class="dev">dev</span></h2>
    <p class="muted">
      Every card the app can show, drawn through the same renderer as the quiz.
      Reflects current <strong>Settings</strong> (clefs, range, duration names).
    </p>
  </header>

  <div class="tabs" role="tablist">
    {#each TABS as t}
      <button
        type="button"
        class="seg"
        role="tab"
        aria-selected={active === t.id}
        onclick={() => (active = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <p class="muted count">{count} cards</p>

  {#if count === 0}
    <p class="muted">No cards — enable a clef under Settings.</p>
  {/if}

  {#each groups as group}
    {#if group.heading}
      <h3 class="chord-head">{group.heading}</h3>
    {/if}
    <div class="grid" class:chord={group.chord} class:interval={group.interval}>
      {#each group.cells as cell}
        <figure class="cell">
          <div class="paper"><div class="staff" use:staff={{ draw: cell.draw, ready: !!vex }}></div></div>
          <figcaption>{cell.label}</figcaption>
        </figure>
      {/each}
    </div>
  {/each}
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .intro h2 {
    margin: 0 0 0.2em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .intro p {
    margin: 0;
  }
  .dev {
    font-size: 0.6em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
    background: var(--accent-weak);
    padding: 2px 7px;
    border-radius: 999px;
  }

  .tabs {
    display: inline-flex;
    align-self: flex-start;
    padding: 3px;
    gap: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .seg {
    min-height: 38px;
    padding: 6px 18px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 0.92rem;
  }
  .seg:hover {
    color: var(--fg);
  }
  .seg[aria-selected='true'] {
    background: var(--surface);
    color: var(--fg);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }

  .count {
    margin: 0;
    font-size: 0.85rem;
  }

  .chord-head {
    margin: 10px 0 0;
    font-size: 0.95rem;
  }

  .grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  }
  /* A chord's three inversions sit in one row for easy comparison. */
  .grid.chord {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
    max-width: 640px;
  }
  /* An interval's four samples sit in a 2×2 (asc row, desc row). */
  .grid.interval {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
    max-width: 440px;
  }

  .cell {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* Staff is black-on-white "paper" in both themes, matching the quiz views. */
  .paper {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 6px;
    overflow: hidden;
  }
  .staff {
    display: block;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--muted);
    text-align: center;
  }
</style>
