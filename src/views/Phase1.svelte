<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '../lib/settings.svelte.js';
  import { buildDeck, LETTERS } from '../lib/music.js';
  import Piano from '../lib/Piano.svelte';
  import QuizSettings from '../lib/QuizSettings.svelte';
  import * as srs from '../lib/spaced-repetition.js';

  const STORAGE_KEY = 'srt:phase1';
  const ADVANCE_MS = 750; // auto-advance delay after a correct answer

  let staffEl;
  let vex = null; // lazily-loaded VexFlow module

  // SRS state is a plain blob (persisted to localStorage), not reactive.
  // UI-facing values are separate $state below.
  let srsState = srs.loadState(STORAGE_KEY);

  let deck = $derived(buildDeck(settings)); // reshapes when clefs toggle

  let current = $state(null); // active card, or null when caught up
  let mode = $state('answering'); // 'answering' | 'feedback' | 'caughtup'
  let picked = $state(null); // letter the user chose this round
  let session = $state({ seen: 0, correct: 0 });
  let counts = $state({ due: 0, learned: 0, total: 0, newRemaining: 0 });

  let advanceTimer = null;

  let isCorrect = $derived(
    mode === 'feedback' && current && picked === current.letter
  );

  function refreshCounts() {
    counts = srs.summary(srsState, deck, settings.newCardsPerDay);
  }

  function next() {
    clearTimeout(advanceTimer);
    picked = null;

    if (deck.length === 0) {
      current = null;
      mode = 'caughtup';
      refreshCounts();
      return;
    }

    const id = srs.pickNext(srsState, deck, settings.newCardsPerDay);
    srs.saveState(STORAGE_KEY, srsState); // persist any newly-introduced card
    refreshCounts();

    if (!id) {
      current = null;
      mode = 'caughtup';
      return;
    }
    current = deck.find((c) => c.id === id);
    mode = 'answering';
    renderNote();
  }

  // "Keep practicing" once caught up: drill a random card ahead of schedule.
  // Answers still feed the scheduler, so this never hurts.
  function practice() {
    clearTimeout(advanceTimer);
    picked = null;
    if (deck.length === 0) return;
    current = deck[Math.floor(Math.random() * deck.length)];
    mode = 'answering';
    renderNote();
  }

  function answer(letter) {
    if (mode !== 'answering' || !current) return;
    picked = letter;
    const correct = letter === current.letter;
    srs.recordAnswer(srsState, current.id, correct);
    srs.saveState(STORAGE_KEY, srsState);

    session.seen += 1;
    if (correct) session.correct += 1;

    mode = 'feedback';
    refreshCounts();
    renderNote(); // recolour the note green/red

    if (correct) advanceTimer = setTimeout(next, ADVANCE_MS);
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (mode === 'feedback') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
      return;
    }
    if (mode === 'caughtup') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        practice();
      }
      return;
    }
    // Answering: accept hardware A–G (letter mode affordance, but harmless
    // to allow in piano mode too).
    const k = e.key.toUpperCase();
    if (LETTERS.includes(k)) answer(k);
  }

  function renderNote() {
    if (!vex || !staffEl || !current) return;
    const { Renderer, Stave, StaveNote, Formatter, Voice } = vex;
    staffEl.innerHTML = '';
    const renderer = new Renderer(staffEl, Renderer.Backends.SVG);
    renderer.resize(320, 170);
    const ctx = renderer.getContext();

    const stave = new Stave(10, 35, 300).addClef(current.clef);
    stave.setContext(ctx).draw();

    const note = new StaveNote({
      clef: current.clef,
      keys: [current.vexKey],
      duration: 'q',
    });
    if (mode === 'feedback' && picked != null) {
      const color = picked === current.letter ? '#16a34a' : '#dc2626';
      note.setStyle({ fillStyle: color, strokeStyle: color });
    }

    const voice = new Voice({ numBeats: 1, beatValue: 4 }).addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 220);
    voice.draw(ctx, stave);
  }

  onMount(async () => {
    // VexFlow is heavy (~700KB gz). Dynamic-import so it only loads when this
    // view opens, keeping the initial bundle small.
    const m = await import('vexflow');
    vex = {
      Renderer: m.Renderer,
      Stave: m.Stave,
      StaveNote: m.StaveNote,
      Formatter: m.Formatter,
      Voice: m.Voice,
    };
    next();
  });

  onDestroy(() => clearTimeout(advanceTimer));

  let accuracy = $derived(
    session.seen ? Math.round((session.correct / session.seen) * 100) : null
  );
</script>

<svelte:window onkeydown={onKey} />

<div class="view">
  <div class="toolbar">
    <QuizSettings />
  </div>

  <header class="head">
    <h2>Phase 1 — Single Notes</h2>
    <p class="muted">Name the note on the staff.</p>
  </header>

  <div class="stats" aria-live="polite">
    <span><strong>{counts.due}</strong> due</span>
    <span><strong>{counts.newRemaining}</strong> new left</span>
    <span><strong>{counts.learned}</strong>/{counts.total} learned</span>
    {#if accuracy !== null}
      <span class="acc"><strong>{accuracy}%</strong> this session</span>
    {/if}
  </div>

  <!-- Notation is black-on-white "paper" in both themes — easier to read than
       inverting the staff. -->
  <div class="paper">
    <div class="staff" bind:this={staffEl}></div>
  </div>

  {#if mode === 'caughtup'}
    <div class="feedback caught">
      {#if deck.length === 0}
        <p>No clefs enabled. Turn on treble or bass in <strong>Settings</strong>.</p>
      {:else}
        <p>🎉 You're caught up — nothing due right now.</p>
        <button type="button" class="btn-primary" onclick={practice}>
          Keep practicing
        </button>
      {/if}
    </div>
  {:else}
    <div class="feedback" aria-live="polite">
      {#if mode === 'feedback' && current}
        {#if isCorrect}
          <p class="good">Correct — that's <strong>{current.letter}</strong>.</p>
        {:else}
          <p class="bad">
            That was <strong>{current.letter}</strong>
            {#if picked}(you picked {picked}){/if}.
          </p>
          <button type="button" class="btn-primary" onclick={next}>
            Next
          </button>
        {/if}
      {:else}
        <p class="prompt-hint muted">
          {settings.answerMode === 'piano'
            ? 'Tap the matching key.'
            : 'Tap a letter, or use your keyboard.'}
        </p>
      {/if}
    </div>

    {#if settings.answerMode === 'piano'}
      <Piano
        onpick={answer}
        disabled={mode !== 'answering'}
        {picked}
        answer={current?.letter ?? null}
        revealed={mode === 'feedback'}
      />
    {:else}
      <div class="pad" role="group" aria-label="Note names">
        {#each LETTERS as letter}
          <button
            type="button"
            class="key"
            class:correct={mode === 'feedback' && current?.letter === letter}
            class:wrong={mode === 'feedback' &&
              picked === letter &&
              current?.letter !== letter}
            disabled={mode !== 'answering'}
            onclick={() => answer(letter)}
          >
            {letter}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }

  .toolbar {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    margin-bottom: -8px;
  }

  .head {
    text-align: center;
  }
  .head h2 {
    margin: 0 0 0.2em;
  }
  .head p {
    margin: 0;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 14px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .stats strong {
    color: var(--fg);
  }
  .stats .acc strong {
    color: var(--accent);
  }

  .paper {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    padding: 12px;
  }
  .staff {
    display: block;
  }

  .feedback {
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .feedback p {
    margin: 0;
  }
  .feedback .good {
    color: var(--good);
  }
  .feedback .bad {
    color: var(--bad);
  }
  .feedback.caught {
    gap: 12px;
  }

  .pad {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 420px;
  }
  @media (max-width: 420px) {
    .pad {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .key {
    min-height: 56px;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .key.correct {
    background: var(--good);
    border-color: var(--good);
    color: var(--accent-fg);
  }
  .key.wrong {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--accent-fg);
  }
</style>
