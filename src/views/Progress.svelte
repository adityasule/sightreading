<script>
  import { settings } from '../lib/settings.svelte.js';
  import { buildDeck, buildBasicsDeck } from '../lib/music.js';
  import * as srs from '../lib/spaced-repetition.js';
  import { progress, MASTER_BOX } from '../lib/progression.js';
  import { PHASES } from '../lib/phases.js';
  import { go } from '../lib/nav.svelte.js';

  // Each phase's progress is read straight from its own srt:phaseN blob — no new
  // persistence. Loaded once (this view remounts on every navigation, like Home),
  // then derived against the live deck so Notation tracks the clef/range settings.
  const phase0State = srs.loadState('srt:phase0');
  const phase1State = srs.loadState('srt:phase1');

  const basicsDeck = buildBasicsDeck();
  const notationDeck = $derived(buildDeck(settings));

  // "Mastered" everywhere means box ≥ 2 (answered correctly on two reviews) —
  // the same bar the curriculum uses for level completion, kept consistent so a
  // full bar always means the same thing.

  // Basics: one bar — symbols (notes/rests/clefs) mastered out of the deck.
  const basics = $derived({
    mastered: srs.masteredCount(phase0State, basicsDeck, MASTER_BOX),
    total: basicsDeck.length,
  });

  // Notation carries two dimensions: how far through the scale curriculum (levels
  // fully mastered) and how many individual notes are mastered.
  const notation = $derived.by(() => {
    const p = progress(phase1State, notationDeck);
    return {
      levelsDone: p.levels.filter((l) => srs.boxAtLeast(phase1State, l.cards, MASTER_BOX))
        .length,
      levelsTotal: p.levels.length,
      currentLabel: p.current?.label ?? null,
      notesMastered: srs.masteredCount(phase1State, notationDeck, MASTER_BOX),
      notesTotal: notationDeck.length,
    };
  });

  const nameOf = (id) => PHASES.find((p) => p.id === id)?.name ?? id;
  const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);
</script>

{#snippet bar(label, value, total)}
  <div class="bar">
    <div class="bar-head">
      <span class="bar-label">{label}</span>
      <span class="bar-count">{value}/{total}</span>
    </div>
    <div
      class="track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct(value, total)}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="fill" style:width="{pct(value, total)}%"></div>
    </div>
  </div>
{/snippet}

<div class="view">
  <header class="intro">
    <h2>Progress</h2>
    <p class="muted">How far you've come across every phase — stored on this device.</p>
  </header>

  <button type="button" class="card phase" onclick={() => go('phase0')}>
    <div class="phase-head">
      <span class="badge">Now</span>
      <h3>{nameOf('phase0')}</h3>
    </div>
    {@render bar('Symbols mastered', basics.mastered, basics.total)}
  </button>

  <button type="button" class="card phase" onclick={() => go('phase1')}>
    <div class="phase-head">
      <span class="badge">Now</span>
      <h3>{nameOf('phase1')}</h3>
    </div>
    {#if notation.notesTotal === 0}
      <p class="muted hint">No notes — enable a clef under Settings.</p>
    {:else}
      {@render bar(
        notation.currentLabel ? `Scale levels · ${notation.currentLabel}` : 'Scale levels',
        notation.levelsDone,
        notation.levelsTotal
      )}
      {@render bar('Notes mastered', notation.notesMastered, notation.notesTotal)}
    {/if}
  </button>

  {#each PHASES.filter((p) => !p.ready) as p}
    <section class="card phase locked">
      <div class="phase-head">
        <span class="badge soon">Soon</span>
        <h3>{p.name}</h3>
      </div>
      <div class="bar">
        <div class="bar-head">
          <span class="bar-label muted">{p.blurb}</span>
        </div>
        <div class="track"><div class="fill" style:width="0%"></div></div>
      </div>
    </section>
  {/each}
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .intro h2 {
    margin: 0 0 0.2em;
  }
  .intro p {
    margin: 0;
  }

  .phase {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    text-align: left;
  }

  /* Ready phases are buttons that jump to their quiz; give them the Home lift. */
  button.phase {
    cursor: pointer;
    transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
  }
  button.phase:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow);
    transform: translateY(-2px);
  }
  button.phase:active {
    transform: translateY(0);
    background: var(--surface);
  }

  .phase.locked {
    opacity: 0.7;
  }

  .phase-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .phase-head h3 {
    margin: 0;
    font-size: 1rem;
  }

  .hint {
    margin: 0;
  }

  .bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    font-size: 0.85rem;
  }
  .bar-label {
    color: var(--fg);
  }
  .bar-count {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .track {
    height: 8px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .badge {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-weak);
    padding: 3px 8px;
    border-radius: 999px;
  }
  .badge.soon {
    color: var(--muted);
    background: var(--surface-2);
  }
</style>
