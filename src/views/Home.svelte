<script>
  import { go } from '../lib/nav.svelte.js';
  import { settings } from '../lib/settings.svelte.js';
  import { buildDeck } from '../lib/music.js';
  import * as srs from '../lib/spaced-repetition.js';
  import { PHASES } from '../lib/phases.js';

  // Notation "Today" snapshot. Loaded once on mount (Home remounts on every
  // navigation), then derived against the live deck so it tracks settings.
  const srsState = srs.loadState('srt:phase1');
  const deck = $derived(buildDeck(settings));
  const today = $derived(srs.summary(srsState, deck, settings.newCardsPerDay));
  const trend = srs.stats(srsState); // streak + lifetime accuracy

  // The primary action adapts to what's waiting.
  const cta = $derived(
    today.total === 0
      ? { label: 'Open Settings', to: 'settings' }
      : today.due > 0
        ? { label: `Review ${today.due} due`, to: 'phase1' }
        : today.newRemaining > 0 && today.learned < today.total
          ? { label: 'Learn new notes', to: 'phase1' }
          : { label: 'Practice notes', to: 'phase1' }
  );

</script>

<div class="view">
  <header class="intro">
    <h2>Welcome back</h2>
    <p class="muted">
      A personal trainer for sight-reading music, one card at a time.
    </p>
  </header>

  <section class="card today">
    <div class="today-head">
      <span class="badge">Today</span>
      <h3>Notation — Single notes</h3>
    </div>

    {#if today.total === 0}
      <p class="muted empty">
        No notes in the deck. Enable a clef under Settings to get started.
      </p>
    {:else}
      <div class="today-stats">
        <span><strong>{today.due}</strong> due</span>
        <span><strong>{today.newRemaining}</strong> new left</span>
        <span><strong>{today.learned}</strong>/{today.total} learned</span>
        {#if trend.streak > 0}
          <span class="streak"
            >🔥 <strong>{trend.streak}</strong>-day streak</span
          >
        {/if}
        {#if trend.accuracy !== null}
          <span><strong>{trend.accuracy}%</strong> accuracy</span>
        {/if}
      </div>
    {/if}

    <button type="button" class="btn-primary" onclick={() => go(cta.to)}>
      {cta.label}
    </button>
  </section>

  <div class="phases">
    {#each PHASES as p}
      <button type="button" class="card phase" onclick={() => go(p.id)}>
        <span class="badge" class:soon={!p.ready}>{p.ready ? 'Now' : 'Soon'}</span>
        <h3>{p.name}</h3>
        <p class="muted">{p.blurb}</p>
      </button>
    {/each}
  </div>

  <p class="muted note">
    Progress is stored locally on this device — nothing leaves your browser.
  </p>
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .intro h2 {
    margin: 0 0 0.2em;
  }
  .intro p {
    margin: 0;
  }

  .today {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: flex-start;
  }
  .today-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .today-head h3 {
    margin: 0;
    font-size: 1rem;
  }
  .today-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    font-size: 0.92rem;
    color: var(--muted);
  }
  .today-stats strong {
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .today-stats .streak strong {
    color: var(--accent);
  }
  .today .empty {
    margin: 0;
  }
  .today .btn-primary {
    align-self: stretch;
  }
  @media (min-width: 480px) {
    .today .btn-primary {
      align-self: flex-start;
    }
  }

  .phases {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  /* Card is a button: reset to a left-aligned block with a hover lift. */
  .phase {
    display: block;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.12s ease, box-shadow 0.12s ease,
      transform 0.12s ease;
  }

  .phase:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow);
    transform: translateY(-2px);
  }

  .phase:active {
    transform: translateY(0);
    background: var(--surface);
  }

  .card h3 {
    margin: 10px 0 4px;
  }
  .card p {
    margin: 0;
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

  /* Not-yet-built phases: a neutral "Soon" pill instead of the accent badge. */
  .badge.soon {
    color: var(--muted);
    background: var(--surface-2);
  }

  .note {
    margin: 0;
  }
</style>
