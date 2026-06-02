<script>
  import Home from './views/Home.svelte';
  import Phase1 from './views/Phase1.svelte';
  import Phase2 from './views/Phase2.svelte';
  import Phase3 from './views/Phase3.svelte';
  import Settings from './views/Settings.svelte';
  import ThemeButton from './lib/ThemeButton.svelte';
  import { nav, go } from './lib/nav.svelte.js';

  const views = [
    { id: 'home', label: 'Home', component: Home },
    { id: 'phase1', label: 'Phase 1', component: Phase1 },
    { id: 'phase2', label: 'Phase 2', component: Phase2 },
    { id: 'phase3', label: 'Phase 3', component: Phase3 },
    { id: 'settings', label: 'Settings', component: Settings },
  ];

  let active = $derived(views.find((v) => v.id === nav.active) ?? views[0]);
  const ActiveComponent = $derived(active.component);
</script>

<div class="layout">
  <header>
    <h1><span class="dot" aria-hidden="true"></span>Sight Reading Trainer</h1>
    <ThemeButton />
  </header>

  <main>
    <ActiveComponent />
  </main>

  <nav aria-label="Sections">
    {#each views as v}
      <button
        type="button"
        class="tab"
        aria-current={v.id === nav.active ? 'page' : undefined}
        onclick={() => go(v.id)}
      >
        {v.label}
      </button>
    {/each}
  </nav>
</div>

<style>
  .layout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    min-height: 100dvh;
    max-width: 960px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
  }

  header h1 {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 1rem;
    margin: 0;
    color: var(--fg);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    flex: none;
  }

  main {
    padding: 24px 20px;
    min-height: 0;
  }

  nav {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    position: sticky;
    bottom: 0;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
  }

  .tab {
    flex: 1;
    min-height: 46px;
    padding: 8px 6px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 0.82rem;
  }

  .tab:hover {
    background: var(--surface-2);
    color: var(--fg);
  }

  .tab[aria-current='page'] {
    background: var(--accent-weak);
    color: var(--accent);
    font-weight: 600;
  }

  @media (min-width: 760px) {
    .layout {
      grid-template-columns: 210px 1fr;
      grid-template-rows: auto 1fr;
      grid-template-areas:
        'header header'
        'nav main';
    }
    header {
      grid-area: header;
    }
    main {
      grid-area: main;
      padding: 32px;
    }
    nav {
      grid-area: nav;
      flex-direction: column;
      gap: 2px;
      border-top: none;
      border-right: 1px solid var(--border);
      background: transparent;
      position: static;
      padding: 16px 12px;
    }
    .tab {
      flex: none;
      text-align: left;
      padding: 10px 14px;
      font-size: 0.92rem;
    }
  }
</style>
