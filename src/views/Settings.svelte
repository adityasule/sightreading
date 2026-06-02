<script>
  import ThemeToggle from '../lib/ThemeToggle.svelte';
  import {
    settings,
    setSetting,
    setNewCardsPerDay,
    setLedgerLines,
    LEDGER_MIN,
    LEDGER_MAX,
  } from '../lib/settings.svelte.js';

  const answerModes = [
    { value: 'letters', label: 'Letters' },
    { value: 'piano', label: 'Piano' },
  ];
</script>

<div class="view">
  <h2>Settings</h2>

  <section class="card setting">
    <div class="setting-text">
      <h3>Appearance</h3>
      <p class="muted">
        Follow your device, or pick a mode. Saved on this device.
      </p>
    </div>
    <ThemeToggle />
  </section>

  <section class="card setting">
    <div class="setting-text">
      <h3>Answer mode</h3>
      <p class="muted">
        Tap note-name buttons, or play the matching key on a piano.
      </p>
    </div>
    <div class="segmented" role="group" aria-label="Answer mode">
      {#each answerModes as opt}
        <button
          type="button"
          class="seg"
          aria-pressed={settings.answerMode === opt.value}
          onclick={() => setSetting('answerMode', opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="card setting">
    <div class="setting-text">
      <h3>Clefs</h3>
      <p class="muted">Which staves appear in the Phase 1 deck.</p>
    </div>
    <div class="checks">
      <label class="check">
        <input
          type="checkbox"
          checked={settings.treble}
          onchange={(e) => setSetting('treble', e.currentTarget.checked)}
        />
        Treble
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.bass}
          onchange={(e) => setSetting('bass', e.currentTarget.checked)}
        />
        Bass
      </label>
    </div>
  </section>

  <section class="card setting">
    <div class="setting-text">
      <h3>Note range</h3>
      <p class="muted">
        Ledger lines above and below each staff. More lines means a wider range
        of notes.
      </p>
    </div>
    <div class="stepper" role="group" aria-label="Ledger lines">
      <button
        type="button"
        aria-label="Narrower"
        disabled={settings.ledgerLines <= LEDGER_MIN}
        onclick={() => setLedgerLines(settings.ledgerLines - 1)}
      >
        −
      </button>
      <span class="count" aria-live="polite">{settings.ledgerLines}</span>
      <button
        type="button"
        aria-label="Wider"
        disabled={settings.ledgerLines >= LEDGER_MAX}
        onclick={() => setLedgerLines(settings.ledgerLines + 1)}
      >
        +
      </button>
    </div>
  </section>

  <section class="card setting">
    <div class="setting-text">
      <h3>New cards per day</h3>
      <p class="muted">How many unseen notes to introduce each day.</p>
    </div>
    <div class="stepper" role="group" aria-label="New cards per day">
      <button
        type="button"
        aria-label="Fewer"
        onclick={() => setNewCardsPerDay(settings.newCardsPerDay - 1)}
      >
        −
      </button>
      <span class="count" aria-live="polite">{settings.newCardsPerDay}</span>
      <button
        type="button"
        aria-label="More"
        onclick={() => setNewCardsPerDay(settings.newCardsPerDay + 1)}
      >
        +
      </button>
    </div>
  </section>

  <p class="muted soon">
    Progress export / import is coming with the PWA milestone.
  </p>
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .setting-text {
    min-width: 0;
  }

  .setting h3 {
    margin: 0 0 0.15em;
  }

  .setting-text p {
    margin: 0;
  }

  /* Segmented control — matches ThemeToggle. */
  .segmented {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .seg {
    min-height: 38px;
    padding: 6px 16px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 0.9rem;
  }
  .seg:hover {
    color: var(--fg);
  }
  .seg[aria-pressed='true'] {
    background: var(--surface);
    color: var(--fg);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }

  .checks {
    display: flex;
    gap: 16px;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 3px;
  }
  .stepper button {
    min-height: 38px;
    min-width: 42px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 1.2rem;
    line-height: 1;
  }
  .stepper button:hover {
    background: var(--surface);
  }
  .count {
    min-width: 2ch;
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .soon {
    margin: 0;
  }
</style>
