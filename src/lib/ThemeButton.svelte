<script>
  // Compact theme control for the top bar. Cycles system → light → dark and
  // shows an icon for the *selected* mode. The full labelled three-way control
  // (ThemeToggle) still lives in Settings.
  import { theme, setTheme } from './theme.svelte.js';

  const NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

  function cycle() {
    setTheme(NEXT[theme.mode]);
  }
</script>

<button
  type="button"
  class="theme-btn"
  onclick={cycle}
  title={`Theme: ${LABEL[theme.mode]}`}
  aria-label={`Theme: ${LABEL[theme.mode]}. Activate to change.`}
>
  {#if theme.mode === 'light'}
    <!-- sun -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  {:else if theme.mode === 'dark'}
    <!-- moon -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  {:else}
    <!-- monitor (system) -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  {/if}
  <span class="lbl">{LABEL[theme.mode]}</span>
</button>

<style>
  .theme-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
    padding: 6px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--muted);
    font-size: 0.85rem;
  }

  .theme-btn:hover {
    color: var(--fg);
    border-color: var(--accent);
  }

  .theme-btn svg {
    width: 18px;
    height: 18px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Hide the text label on very narrow screens — the icon carries it. */
  @media (max-width: 380px) {
    .lbl {
      display: none;
    }
    .theme-btn {
      padding: 6px;
    }
  }
</style>
