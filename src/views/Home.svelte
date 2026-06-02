<script>
  import { go } from '../lib/nav.svelte.js';

  const phases = [
    {
      id: 'phase1',
      label: 'Phase 1',
      title: 'Single notes',
      blurb: 'Read one note on the treble & bass clef.',
    },
    {
      id: 'phase2',
      label: 'Phase 2',
      title: 'Triads',
      blurb: 'Identify major / minor three-note chords.',
    },
    {
      id: 'phase3',
      label: 'Phase 3',
      title: 'Key signatures',
      blurb: 'Name the major key from its signature.',
    },
  ];
</script>

<div class="view">
  <header class="intro">
    <h2>Welcome back</h2>
    <p class="muted">
      A personal trainer for sight-reading music, one card at a time.
    </p>
  </header>

  <div class="phases">
    {#each phases as p}
      <button type="button" class="card phase" onclick={() => go(p.id)}>
        <span class="badge">{p.label}</span>
        <h3>{p.title}</h3>
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

  .note {
    margin: 0;
  }
</style>
