<script>
  import { theme, setTheme } from './theme.svelte.js';

  const options = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
</script>

<div class="segmented" role="group" aria-label="Theme">
  {#each options as opt}
    <button
      type="button"
      class="seg"
      aria-pressed={theme.mode === opt.value}
      onclick={() => setTheme(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
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
</style>
