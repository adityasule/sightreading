<script>
  import Home from './views/Home.svelte';
  import Phase0 from './views/Phase0.svelte';
  import Phase1 from './views/Phase1.svelte';
  import Phase2 from './views/Phase2.svelte';
  import Phase3 from './views/Phase3.svelte';
  import Settings from './views/Settings.svelte';
  import ThemeButton from './lib/ThemeButton.svelte';
  import { nav, go } from './lib/nav.svelte.js';
  import { PHASES } from './lib/phases.js';

  // Phase labels come from the shared config; Home/Settings/etc. wraps it so a
  // rename lives in one place. Internal route ids are untouched.
  const components = { phase0: Phase0, phase1: Phase1, phase2: Phase2, phase3: Phase3 };
  const views = [
    { id: 'home', label: 'Home', component: Home },
    ...PHASES.map((p) => ({ id: p.id, label: p.name, component: components[p.id] })),
    { id: 'settings', label: 'Settings', component: Settings },
  ];

  let active = $derived(views.find((v) => v.id === nav.active) ?? views[0]);
  const ActiveComponent = $derived(active.component);

  // The drawer only exists on narrow screens; on wide screens the same <nav>
  // is the always-visible sidebar and `menuOpen` is irrelevant.
  let menuOpen = $state(false);

  function navigate(id) {
    go(id);
    menuOpen = false;
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && menuOpen) menuOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout" class:menu-open={menuOpen}>
  <header>
    <button
      type="button"
      class="hamburger"
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="main-nav"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if menuOpen}
          <path d="M6 6l12 12M18 6L6 18" />
        {:else}
          <path d="M3 6h18M3 12h18M3 18h18" />
        {/if}
      </svg>
    </button>
    <h1><span class="dot" aria-hidden="true"></span>Sight Reading Trainer</h1>
    <ThemeButton />
  </header>

  <!-- Backdrop: only interactive when the drawer is open (narrow screens). -->
  <button
    type="button"
    class="scrim"
    tabindex="-1"
    aria-hidden="true"
    hidden={!menuOpen}
    onclick={() => (menuOpen = false)}
  ></button>

  <nav id="main-nav" aria-label="Sections">
    {#each views as v}
      <button
        type="button"
        class="tab"
        aria-current={v.id === nav.active ? 'page' : undefined}
        onclick={() => navigate(v.id)}
      >
        {v.label}
      </button>
    {/each}
  </nav>

  <main>
    <ActiveComponent />
  </main>
</div>

<style>
  .layout {
    display: grid;
    grid-template-rows: auto 1fr;
    /* minmax(0,…) so the column tracks the viewport instead of growing to the
       widest content's max-content (which overflowed the header on phones). */
    grid-template-columns: minmax(0, 1fr);
    min-height: 100vh;
    min-height: 100dvh;
    max-width: 960px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
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
    margin-right: auto; /* push ThemeButton to the right edge */
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

  /* Hamburger — narrow screens only. */
  .hamburger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    min-width: 40px;
    padding: 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--fg);
  }
  .hamburger:hover {
    background: var(--surface-2);
    border-color: var(--border);
  }
  .hamburger svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  main {
    padding: 24px 20px;
    min-height: 0;
  }

  /* Backdrop behind the open drawer. */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    border: none;
    border-radius: 0;
    min-height: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
    cursor: default;
    animation: fade-in 0.15s ease;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  /* Narrow screens: <nav> is an off-canvas drawer that slides in from the left. */
  nav {
    position: fixed;
    z-index: 30;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(78vw, 280px);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 12px calc(16px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-right: 1px solid var(--border);
    box-shadow: var(--shadow);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    overflow-y: auto;
  }
  .menu-open nav {
    transform: translateX(0);
  }

  .tab {
    min-height: 46px;
    padding: 10px 14px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 0.95rem;
    text-align: left;
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

  /* Wide screens: the drawer becomes a static sidebar; hamburger + scrim hide. */
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
    .hamburger {
      display: none;
    }
    .scrim {
      display: none;
    }
    nav {
      grid-area: nav;
      position: static;
      width: auto;
      transform: none;
      gap: 2px;
      border-right: 1px solid var(--border);
      box-shadow: none;
      padding: 16px 12px;
    }
    main {
      grid-area: main;
      padding: 32px;
    }
    .tab {
      font-size: 0.92rem;
    }
  }
</style>
