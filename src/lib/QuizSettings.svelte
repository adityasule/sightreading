<script>
  // In-quiz quick settings: a gear button that opens a small popover for the
  // handful of options worth changing mid-session. For now that's just the
  // input method; the full set lives in the Settings tab.
  import { settings, setSetting } from './settings.svelte.js';

  let open = $state(false);

  const modes = [
    { value: 'letters', label: 'Letters' },
    { value: 'piano', label: 'Piano' },
  ];

  function close() {
    open = false;
  }

  function onKey(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="wrap">
  <button
    type="button"
    class="gear"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label="Quick settings"
    onclick={() => (open = !open)}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  </button>

  {#if open}
    <!-- Backdrop captures outside clicks/taps to dismiss. -->
    <button
      type="button"
      class="backdrop"
      aria-label="Close settings"
      onclick={close}
    ></button>

    <div class="popover" role="dialog" aria-label="Quick settings">
      <h3>Quick settings</h3>

      <div class="field">
        <span class="field-label" id="qs-input">Input method</span>
        <div class="segmented" role="group" aria-labelledby="qs-input">
          {#each modes as opt}
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
      </div>

      <p class="muted hint">More options in the Settings tab.</p>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }

  .gear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    min-height: 42px;
    padding: 0;
    color: var(--muted);
  }
  .gear:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .gear svg {
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: transparent;
    border: none;
    border-radius: 0;
    min-height: 0;
    padding: 0;
    cursor: default;
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 11;
    width: max-content;
    min-width: 210px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 16px;
    text-align: left;
  }

  .popover h3 {
    margin: 0 0 12px;
    font-size: 0.95rem;
  }

  .field-label {
    display: block;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 6px;
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
    min-height: 36px;
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

  .hint {
    margin: 12px 0 0;
    font-size: 0.8rem;
  }
</style>
