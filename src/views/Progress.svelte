<script>
  import { settings } from '../lib/settings.svelte.js';
  import { buildDeck, buildBasicsDeck, basicsLabel } from '../lib/music.js';
  import { buildChordDeck, chordLevelsFor } from '../lib/chords.js';
  import { buildKeySigDeck, keySigLevelsFor } from '../lib/keysig.js';
  import { buildIntervalDeck, intervalLevelsFor } from '../lib/intervals.js';
  import * as srs from '../lib/spaced-repetition.js';
  import { progress, MASTER_BOX } from '../lib/progression.js';
  import { PHASES } from '../lib/phases.js';
  import { nav, go, openDetail, back } from '../lib/nav.svelte.js';
  import { loadVex, staff, drawForCard } from '../lib/cardRender.js';

  // Each phase's progress is read straight from its own srt:phaseN blob — no new
  // persistence. Loaded once (this view remounts on every navigation, like Home),
  // then derived against the live deck so Notation/Chords track the clef settings.
  const phase0State = srs.loadState('srt:phase0');
  const phase1State = srs.loadState('srt:phase1');
  const phase2State = srs.loadState('srt:phase2');
  const phase3State = srs.loadState('srt:phase3');
  const phase4State = srs.loadState('srt:phase4');

  const basicsDeck = buildBasicsDeck();
  const notationDeck = $derived(buildDeck(settings));
  const chordDeck = $derived(buildChordDeck(settings));
  const keysigDeck = $derived(buildKeySigDeck(settings));
  const intervalDeck = $derived(buildIntervalDeck(settings));

  // Phase id → its loaded state / live deck, for the drill-down lookups below.
  const stateOf = {
    phase0: phase0State,
    phase1: phase1State,
    phase2: phase2State,
    phase3: phase3State,
    phase4: phase4State,
  };
  const deckOf = $derived({
    phase0: basicsDeck,
    phase1: notationDeck,
    phase2: chordDeck,
    phase3: keysigDeck,
    phase4: intervalDeck,
  });

  // App-wide behaviour metrics: sum every phase's *raw* answer totals, then round
  // once (averaging the five per-phase percentages would mis-weight phases with
  // different answer counts). Loaded-once state, so a plain const — no reactivity.
  const overall = srs.statsFromTotals(
    [phase0State, phase1State, phase2State, phase3State, phase4State].reduce(
      (acc, st) => {
        const t = srs.rawTotals(st);
        acc.seen += t.seen;
        acc.correct += t.correct;
        acc.timeMs += t.timeMs;
        return acc;
      },
      { seen: 0, correct: 0, timeMs: 0 }
    )
  );

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

  // Chords mirrors Notation's two dimensions: how far through the circle-of-fifths
  // key curriculum (levels fully mastered) and how many individual chords mastered.
  const chords = $derived.by(() => {
    const p = progress(phase2State, chordDeck, chordLevelsFor);
    return {
      levelsDone: p.levels.filter((l) => srs.boxAtLeast(phase2State, l.cards, MASTER_BOX))
        .length,
      levelsTotal: p.levels.length,
      currentLabel: p.current?.label ?? null,
      chordsMastered: srs.masteredCount(phase2State, chordDeck, MASTER_BOX),
      chordsTotal: chordDeck.length,
    };
  });

  // Key Signatures: how far through the circle-of-fifths key curriculum (levels
  // fully mastered) and how many individual signatures are mastered.
  const keysigs = $derived.by(() => {
    const p = progress(phase3State, keysigDeck, keySigLevelsFor);
    return {
      levelsDone: p.levels.filter((l) => srs.boxAtLeast(phase3State, l.cards, MASTER_BOX))
        .length,
      levelsTotal: p.levels.length,
      currentLabel: p.current?.label ?? null,
      mastered: srs.masteredCount(phase3State, keysigDeck, MASTER_BOX),
      total: keysigDeck.length,
    };
  });

  // Intervals: how far through the difficulty curriculum (levels fully mastered)
  // and how many individual intervals are mastered.
  const intervals = $derived.by(() => {
    const p = progress(phase4State, intervalDeck, intervalLevelsFor);
    return {
      levelsDone: p.levels.filter((l) => srs.boxAtLeast(phase4State, l.cards, MASTER_BOX))
        .length,
      levelsTotal: p.levels.length,
      currentLabel: p.current?.label ?? null,
      mastered: srs.masteredCount(phase4State, intervalDeck, MASTER_BOX),
      total: intervalDeck.length,
    };
  });

  const nameOf = (id) => PHASES.find((p) => p.id === id)?.name ?? id;
  const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const fmtPct = (v) => (v != null ? `${v}%` : '—');
  const fmtTime = (ms) => (ms != null ? `${(ms / 1000).toFixed(1)}s` : '—');

  // Caption for a drill-down card — the same labels the dev gallery uses.
  function cardLabel(phaseId, card) {
    if (phaseId === 'phase0') return basicsLabel(card.type, card.key, settings.durationNames);
    return `${card.name} · ${card.clef}`;
  }

  // Drill-down: which phase's card detail is open lives in nav.detail, so the
  // browser Back button closes the drill-down before leaving the Progress view.
  // VexFlow loads lazily the first time a drill-down opens (the overview pays no
  // cost); once loaded it's kept for the rest of the visit.
  let vex = $state(null);
  $effect(() => {
    if (nav.detail && !vex) loadVex().then((v) => (vex = v));
  });

  // Every possible card in the open phase, each with its representative glyph
  // draw + per-card stats + whether it's been introduced to the deck. Rebuilt when
  // the phase or settings change; the glyph itself draws via the shared harness.
  const detail = $derived.by(() => {
    const phaseId = nav.detail;
    if (!phaseId) return null;
    const state = stateOf[phaseId];
    const deck = deckOf[phaseId];
    return {
      id: phaseId,
      name: nameOf(phaseId),
      aggregate: srs.aggregateStats(state),
      cells: deck.map((card) => ({
        card,
        label: cardLabel(phaseId, card),
        draw: (el) => drawForCard(vex, phaseId, card, el, settings),
        stats: srs.cardStats(state, card.id),
        introduced: !!state.cards[card.id],
      })),
    };
  });
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

{#snippet metrics(stats, scope)}
  <div class="band" aria-label="{scope} behaviour">
    <div class="metric">
      <span class="metric-value">{fmtPct(stats.accuracy)}</span>
      <span class="metric-label">avg accuracy</span>
    </div>
    <div class="metric">
      <span class="metric-value">{fmtTime(stats.avgMs)}</span>
      <span class="metric-label">avg time to answer</span>
    </div>
  </div>
{/snippet}

{#if detail}
  <!-- Drill-down: every card in one phase, with its glyph + stats. -->
  <div class="view">
    <header class="intro detail-head">
      <button type="button" class="back" onclick={back}>← Progress</button>
      <h2>{detail.name}</h2>
      {@render metrics(detail.aggregate, detail.name)}
      <button type="button" class="btn-primary practice" onclick={() => go(detail.id)}>
        Practice {detail.name}
      </button>
    </header>

    {#if detail.cells.length === 0}
      <p class="muted">No cards — enable a clef under Settings.</p>
    {:else}
      <p class="muted count">{detail.cells.length} cards</p>
      <div class="grid">
        {#each detail.cells as cell}
          <figure class="cell" class:new={!cell.introduced}>
            <figcaption>{cell.label}</figcaption>
            <div class="paper">
              <div class="staff" use:staff={{ draw: cell.draw, ready: !!vex }}></div>
            </div>
            {#if cell.introduced}
              <dl class="cstats">
                <div><dt>Accuracy</dt><dd>{fmtPct(cell.stats.accuracy)}</dd></div>
                <div><dt>Avg time</dt><dd>{fmtTime(cell.stats.avgMs)}</dd></div>
              </dl>
            {:else}
              <p class="cnew">Not introduced</p>
            {/if}
          </figure>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <!-- Overview: app-wide metrics + a per-phase progress card (opens its drill-down). -->
  <div class="view">
    <header class="intro">
      <h2>Progress</h2>
      <p class="muted">How far you've come across every phase — stored on this device.</p>
    </header>

    {@render metrics(overall, 'Overall')}

    <button type="button" class="card phase" onclick={() => openDetail('phase0')}>
      <div class="phase-head">
        <span class="badge">Now</span>
        <h3>{nameOf('phase0')}</h3>
      </div>
      {@render bar('Symbols mastered', basics.mastered, basics.total)}
    </button>

    <button type="button" class="card phase" onclick={() => openDetail('phase1')}>
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

    <button type="button" class="card phase" onclick={() => openDetail('phase2')}>
      <div class="phase-head">
        <span class="badge">Now</span>
        <h3>{nameOf('phase2')}</h3>
      </div>
      {#if chords.chordsTotal === 0}
        <p class="muted hint">No chords — enable a clef under Settings.</p>
      {:else}
        {@render bar(
          chords.currentLabel ? `Key levels · ${chords.currentLabel}` : 'Key levels',
          chords.levelsDone,
          chords.levelsTotal
        )}
        {@render bar('Chords mastered', chords.chordsMastered, chords.chordsTotal)}
      {/if}
    </button>

    <button type="button" class="card phase" onclick={() => openDetail('phase3')}>
      <div class="phase-head">
        <span class="badge">Now</span>
        <h3>{nameOf('phase3')}</h3>
      </div>
      {#if keysigs.total === 0}
        <p class="muted hint">No keys — enable a clef under Settings.</p>
      {:else}
        {@render bar(
          keysigs.currentLabel ? `Key levels · ${keysigs.currentLabel}` : 'Key levels',
          keysigs.levelsDone,
          keysigs.levelsTotal
        )}
        {@render bar('Signatures mastered', keysigs.mastered, keysigs.total)}
      {/if}
    </button>

    <button type="button" class="card phase" onclick={() => openDetail('phase4')}>
      <div class="phase-head">
        <span class="badge">Now</span>
        <h3>{nameOf('phase4')}</h3>
      </div>
      {#if intervals.total === 0}
        <p class="muted hint">No intervals — enable a clef under Settings.</p>
      {:else}
        {@render bar(
          intervals.currentLabel ? `Difficulty levels · ${intervals.currentLabel}` : 'Difficulty levels',
          intervals.levelsDone,
          intervals.levelsTotal
        )}
        {@render bar('Intervals mastered', intervals.mastered, intervals.total)}
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
{/if}

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

  /* Behaviour metrics band — app-wide on the overview, per-phase on a drill-down. */
  .band {
    display: flex;
    gap: 12px;
  }
  .metric {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .metric-value {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .metric-label {
    font-size: 0.78rem;
    color: var(--muted);
  }

  .phase {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    text-align: left;
  }

  /* Ready phases are buttons that open their drill-down; give them the Home lift. */
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

  /* Drill-down header: back link, title, metrics, then the practice jump. */
  .detail-head {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .back {
    border: none;
    background: transparent;
    padding: 4px 0;
    color: var(--muted);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .back:hover {
    color: var(--fg);
  }
  .detail-head .band {
    align-self: stretch;
  }
  .practice {
    align-self: stretch;
  }
  @media (min-width: 480px) {
    .practice {
      align-self: flex-start;
    }
  }

  .count {
    margin: 0;
    font-size: 0.85rem;
  }

  .grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }

  .cell {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* Not-yet-introduced cards are dimmed so the deck frontier reads at a glance. */
  .cell.new {
    opacity: 0.55;
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
    color: var(--fg);
    text-align: center;
  }

  .cstats {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin: 0;
  }
  .cstats div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .cstats dt {
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .cstats dd {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .cnew {
    margin: 0;
    text-align: center;
    font-size: 0.78rem;
    color: var(--muted);
  }
</style>
