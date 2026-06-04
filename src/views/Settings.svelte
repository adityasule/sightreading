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
  import {
    buildExport,
    triggerDownload,
    parseAndValidate,
    applyImport,
  } from '../lib/transfer.js';

  const answerModes = [
    { value: 'letters', label: 'Letters' },
    { value: 'piano', label: 'Piano' },
  ];

  const durationNameOpts = [
    { value: 'british', label: 'British' },
    { value: 'american', label: 'American' },
  ];

  // Backup & transfer (M7c) — export downloads all srt:* keys as one JSON file;
  // import validates, confirms, writes back, then reloads so every reactive
  // store re-reads from storage.
  let fileInput;
  let status = $state(null); // { kind: 'info' | 'error', message } | null

  function handleExport() {
    triggerDownload(buildExport());
    status = { kind: 'info', message: 'Progress exported.' };
  }

  async function handleImport(e) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // reset so re-picking the same file re-fires change
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      status = { kind: 'error', message: 'Could not read that file.' };
      return;
    }

    const result = parseAndValidate(text);
    if (!result.ok) {
      status = { kind: 'error', message: result.error };
      return;
    }
    if (!confirm('Import will replace all progress and settings on this device. Continue?')) {
      status = null;
      return;
    }
    applyImport(result.data);
    location.reload();
  }
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
      <p class="muted">Which staves appear in the Notation deck.</p>
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
      <p class="muted">
        How many unseen cards to introduce each day. "Add more" tops up by this
        many at a time.
      </p>
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

  <section class="card setting">
    <div class="setting-text">
      <h3>Duration names</h3>
      <p class="muted">
        Naming for the Basics note-value cards — British (crotchet, quaver) or
        American (quarter, eighth).
      </p>
    </div>
    <div class="segmented" role="group" aria-label="Duration names">
      {#each durationNameOpts as opt}
        <button
          type="button"
          class="seg"
          aria-pressed={settings.durationNames === opt.value}
          onclick={() => setSetting('durationNames', opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="card setting">
    <div class="setting-text">
      <h3>Backup &amp; transfer</h3>
      <p class="muted">
        Save your progress and settings to a file, or import one from another
        device. Stored on this device only — no account, nothing leaves your
        browser. Importing replaces everything currently on this device.
      </p>
    </div>
    <div class="actions">
      <button type="button" class="btn-primary" onclick={handleExport}>
        Export
      </button>
      <button type="button" onclick={() => fileInput.click()}>Import…</button>
      <input
        bind:this={fileInput}
        type="file"
        accept="application/json,.json"
        class="visually-hidden"
        onchange={handleImport}
      />
    </div>
    {#if status}
      <p class="status" class:error={status.kind === 'error'} aria-live="polite">
        {status.message}
      </p>
    {/if}
  </section>
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

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* Status line spans the card's full width below the buttons (the card wraps). */
  .status {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .status.error {
    color: var(--bad);
  }

  /* Off-screen but focusable file input; the visible "Import…" button proxies it. */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
