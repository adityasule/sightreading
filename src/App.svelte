<script>
  import { onMount } from 'svelte';
  import Home from './views/Home.svelte';
  import Phase0 from './views/Phase0.svelte';
  import Phase1 from './views/Phase1.svelte';
  import Phase2 from './views/Phase2.svelte';
  import Phase3 from './views/Phase3.svelte';
  import Phase4 from './views/Phase4.svelte';
  import Progress from './views/Progress.svelte';
  import Settings from './views/Settings.svelte';
  import ThemeButton from './lib/ThemeButton.svelte';
  import { nav, go } from './lib/nav.svelte.js';
  import { PHASES } from './lib/phases.js';

  // Phase labels come from the shared config; Home/Settings/etc. wraps it so a
  // rename lives in one place. Internal route ids are untouched.
  const components = {
    phase0: Phase0,
    phase1: Phase1,
    phase2: Phase2,
    phase3: Phase3,
    phase4: Phase4,
  };

  // Dev-only "Cards" gallery: loaded via a dynamic import gated on import.meta.env.DEV
  // (statically `false` in a production build, so Rollup drops both the import and
  // the nav entry — it never ships). Available only under `npm run dev`.
  let galleryComponent = $state(null);
  onMount(async () => {
    if (import.meta.env.DEV) {
      galleryComponent = (await import('./dev/CardGallery.svelte')).default;
    }
  });

  let views = $derived.by(() => {
    const list = [
      { id: 'home', label: 'Home', component: Home },
      ...PHASES.map((p) => ({ id: p.id, label: p.name, component: components[p.id] })),
      { id: 'progress', label: 'Progress', component: Progress },
    ];
    if (import.meta.env.DEV && galleryComponent) {
      list.push({ id: 'cards', label: 'Cards (dev)', component: galleryComponent });
    }
    list.push({ id: 'settings', label: 'Settings', component: Settings });
    return list;
  });

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
    <!-- Production error boundary: a render throw (e.g. a VexFlow failure) shows
         a fallback instead of blanking the whole app. Wraps only the active view
         so the header + nav stay live to navigate away or retry. -->
    <svelte:boundary onerror={(e) => console.error(e)}>
      <ActiveComponent />

      {#snippet failed(error, reset)}
        <div class="boundary">
          <h2>Something went wrong</h2>
          <p class="muted">
            This view hit an error. Try again, or pick another section from the menu.
          </p>
          <button type="button" class="btn-primary" onclick={reset}>Try again</button>
        </div>
      {/snippet}
    </svelte:boundary>
  </main>

  <footer>
    <span>© 2026 Aditya Sule · MIT License</span>
    <span class="links">
      <a href="https://github.com/adityasule/sightreading" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://www.linkedin.com/in/aditya-sule/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
    </span>
  </footer>
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
    /* Clear the status bar / notch (top) and a landscape side notch
       (left/right). env() is 0 on devices without cutouts, so this is a no-op
       on desktop. The bottom edge is the footer's job (see below). */
    padding: calc(12px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right))
      12px calc(20px + env(safe-area-inset-left));
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
    padding: 24px calc(20px + env(safe-area-inset-right)) 24px calc(20px + env(safe-area-inset-left));
    min-height: 0;
  }

  /* Attribution footer — sits at the bottom on every view. */
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 16px;
    padding: 16px calc(20px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom))
      calc(20px + env(safe-area-inset-left));
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.8rem;
    text-align: center;
  }
  footer .links {
    display: inline-flex;
    gap: 16px;
  }
  footer a {
    color: var(--muted);
    text-decoration: none;
  }
  footer a:hover {
    color: var(--accent);
    text-decoration: underline;
  }

  /* Error-boundary fallback — centered, calm, with a retry. */
  .boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 40px 16px;
  }
  .boundary h2 {
    margin: 0;
  }
  .boundary p {
    margin: 0;
    max-width: 36ch;
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
    /* Off-canvas drawer pinned to the top-left edge: clear the notch (top) and a
       landscape left-side notch (left), plus the home indicator (bottom). */
    padding: calc(16px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom))
      calc(12px + env(safe-area-inset-left));
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
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        'header header'
        'nav main'
        'footer footer';
    }
    header {
      grid-area: header;
    }
    footer {
      grid-area: footer;
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
      /* Sidebar hugs the left edge — clear a landscape left-side notch. */
      padding: 16px 12px 16px calc(12px + env(safe-area-inset-left));
    }
    main {
      grid-area: main;
      /* Content hugs the right edge in this layout (left is the sidebar). */
      padding: 32px calc(32px + env(safe-area-inset-right)) 32px 32px;
    }
    .tab {
      font-size: 0.92rem;
    }
  }
</style>
