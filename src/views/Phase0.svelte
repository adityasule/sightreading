<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '../lib/settings.svelte.js';
  import { buildBasicsDeck, choices, basicsLabel, optionPoolFor } from '../lib/music.js';
  import { drawDurationNote, drawRest, drawClef } from '../lib/render.js';
  import Choices from '../lib/Choices.svelte';
  import QuizSettings from '../lib/QuizSettings.svelte';
  import * as srs from '../lib/spaced-repetition.js';

  const STORAGE_KEY = 'srt:phase0';
  const ADVANCE_MS = 750; // auto-advance delay after a correct answer
  const RELEARN_GAP = 3; // re-show a missed card after this many other cards

  let staffEl;
  let vex = null; // lazily-loaded VexFlow module

  // SRS state is a plain blob (persisted to localStorage), not reactive.
  let srsState = srs.loadState(STORAGE_KEY);

  // The Basics deck — note (plain + dotted), rest, and clef cards. Clef-/range-
  // independent, so unlike Phase 1 the deck is static (no $derived on settings).
  // The British/American setting changes the option labels, not the deck.
  const deck = buildBasicsDeck();

  let current = $state(null); // active card, or null when caught up
  let mode = $state('answering'); // 'answering' | 'feedback' | 'caughtup'
  let source = $state('scheduled'); // 'scheduled' | 'relearn' | 'practice'
  let picked = $state(null); // chosen duration value this round
  let optionValues = $state([]); // the 4 duration values this card (frozen order)
  let session = $state({ seen: 0, correct: 0 });
  let counts = $state({ due: 0, learned: 0, total: 0, newRemaining: 0 });

  // Manual deck top-up (M2e, batched in M2f): each "add more" click grants one
  // extra batch of `newCardsPerDay` cards on top of the daily budget — never an
  // unlimited bypass, so the setting stays a hard cap. Session-scoped (resets on
  // remount). Basics has no levels, so the top-up is just this; `deckHasNew` is
  // true while the finite deck still holds un-introduced cards.
  let extraBatches = $state(0);
  let deckHasNew = $derived(counts.learned < counts.total);

  let advanceTimer = null;

  // In-session relearning, mirroring Phase 1: a miss re-appears after
  // RELEARN_GAP other cards. Session-only (not persisted): [{ id, showAfter }]
  // compared against `shown`, a counter of cards displayed this session.
  let relearn = [];
  let shown = 0;

  let isCorrect = $derived(
    mode === 'feedback' && current != null && picked === current.key
  );
  // The card's answer label under the current naming convention.
  let answerLabel = $derived(
    current ? basicsLabel(current.type, current.key, settings.durationNames) : ''
  );
  // Option {value,label} pairs — derived, not frozen, so the quick-settings
  // British/American toggle relabels the current card live (the value set and
  // its shuffled order stay fixed). Clef labels ignore the convention.
  let options = $derived(
    current
      ? optionValues.map((v) => ({
          value: v,
          label: basicsLabel(current.type, v, settings.durationNames),
        }))
      : []
  );
  // The question prompt, per card type.
  let prompt = $derived(
    current?.type === 'rest'
      ? 'What kind of rest is this?'
      : current?.type === 'clef'
        ? 'Which clef is this?'
        : 'What kind of note is this?'
  );

  function refreshCounts() {
    counts = srs.summary(srsState, deck, settings.newCardsPerDay);
  }

  // Show a card and tag where it came from (drives how its answer is scored).
  function showCard(card, src) {
    current = card;
    source = src;
    picked = null;
    optionValues = choices(card.key, optionPoolFor(card.type)); // its key + distractors
    mode = 'answering';
    shown += 1;
    renderNote();
  }

  // Pull a relearning card off the queue by id (defensive: tolerate stale ids).
  function takeRelearn(item) {
    return deck.find((c) => c.id === item.id) ?? null;
  }

  function next() {
    clearTimeout(advanceTimer);
    picked = null;

    // 1. A missed card whose relearning gap has elapsed takes priority.
    let i = relearn.findIndex((r) => r.showAfter <= shown);
    while (i !== -1) {
      const card = takeRelearn(relearn.splice(i, 1)[0]);
      if (card) return showCard(card, 'relearn');
      i = relearn.findIndex((r) => r.showAfter <= shown);
    }

    // 2. The normal scheduler: a due card, else a fresh one (deck order, so the
    //    common durations lead), capped by the daily new-card budget — each
    //    opted-in top-up batch lifts it by one more `newCardsPerDay`.
    const budget = settings.newCardsPerDay * (1 + extraBatches);
    const id = srs.pickNext(srsState, deck, budget);
    srs.saveState(STORAGE_KEY, srsState); // persist a newly-introduced card
    refreshCounts();
    if (id) return showCard(deck.find((c) => c.id === id), 'scheduled');

    // 3. Nothing scheduled, but misses still pend — show the soonest now.
    while (relearn.length) {
      const card = takeRelearn(relearn.shift());
      if (card) return showCard(card, 'relearn');
    }

    // 4. Genuinely caught up.
    current = null;
    mode = 'caughtup';
  }

  // "Keep practicing" once caught up: drill a random already-introduced card
  // ahead of schedule. Answers still feed the scheduler, so it never hurts.
  function practice() {
    clearTimeout(advanceTimer);
    const introduced = deck.filter((c) => srsState.cards[c.id]);
    if (introduced.length === 0) return;
    showCard(introduced[Math.floor(Math.random() * introduced.length)], 'practice');
  }

  // Manual top-up (M2e): grant one more batch of new cards past today's budget,
  // then serve the next one immediately.
  function addMoreCards() {
    extraBatches += 1;
    next();
  }

  function enqueueRelearn(id) {
    relearn = relearn.filter((r) => r.id !== id); // de-dupe before re-adding
    relearn.push({ id, showAfter: shown + RELEARN_GAP });
  }

  function answer(value) {
    if (mode !== 'answering' || !current) return;
    picked = value;
    const correct = value === current.key;

    if (source === 'relearn') {
      // Pure reinforcement: the miss is already on the schedule, so don't touch
      // the scheduler or first-attempt session stats — just keep it cycling.
      if (!correct) enqueueRelearn(current.id);
    } else {
      srs.recordAnswer(srsState, current.id, correct);
      srs.saveState(STORAGE_KEY, srsState);

      session.seen += 1;
      if (correct) session.correct += 1;

      // A first-time miss enters relearning; practice misses don't.
      if (!correct && source === 'scheduled') enqueueRelearn(current.id);
      refreshCounts();
    }

    mode = 'feedback';
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
        if (deckHasNew) addMoreCards();
        else practice();
      }
      return;
    }
    // Answering: a digit 1..N picks that option.
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      answer(options[n - 1].value);
    }
  }

  function renderNote() {
    if (!vex || !staffEl || !current) return;
    const color =
      mode === 'feedback' && picked != null ? (isCorrect ? '#16a34a' : '#dc2626') : null;
    if (current.type === 'rest') {
      drawRest(vex, staffEl, { duration: current.vex, color });
    } else if (current.type === 'clef') {
      drawClef(vex, staffEl, { clef: current.clef }); // no glyph tint — see render.js
    } else {
      drawDurationNote(vex, staffEl, { duration: current.vex, dotted: current.dotted, color });
    }
  }

  onMount(async () => {
    // VexFlow is heavy (~700KB gz). Dynamic-import so it only loads when this
    // view opens, keeping the initial bundle small.
    const m = await import('vexflow');
    vex = {
      Renderer: m.Renderer,
      Stave: m.Stave,
      StaveNote: m.StaveNote,
      Dot: m.Dot,
      Formatter: m.Formatter,
      Voice: m.Voice,
    };
    // Gate the first render on the music font being ready, or glyph metrics are
    // wrong on first paint (see M1c in HISTORY).
    try {
      await m.VexFlow.loadFonts('Bravura', 'Academico');
    } catch {
      /* font fetch failed (offline / no FontFace API) — render anyway */
    }
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
    <QuizSettings fields={['durationNames']} />
  </div>

  <header class="head">
    <h2>Basics</h2>
    <p class="muted">Identify each symbol — note and rest values, and clefs.</p>
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
      {#if deckHasNew}
        <p>🎉 You're caught up — that's today's new-card limit.</p>
        <p class="muted">Want to keep learning?</p>
        <button type="button" class="btn-primary" onclick={addMoreCards}>
          Add more new cards
        </button>
        <button type="button" onclick={practice}>Keep practicing</button>
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
          <p class="good">Correct — <strong>{answerLabel}</strong>.</p>
        {:else}
          <p class="bad">
            That was the <strong>{answerLabel}</strong>
            {#if picked}(you picked {basicsLabel(current.type, picked, settings.durationNames)}){/if}.
          </p>
          <button type="button" class="btn-primary" onclick={next}>Next</button>
        {/if}
      {:else if source === 'relearn'}
        <p class="prompt-hint relearn">↻ One you just missed — try again.</p>
      {:else}
        <p class="prompt-hint muted">{prompt}</p>
      {/if}
    </div>

    <Choices
      {options}
      correct={current?.key ?? null}
      {picked}
      revealed={mode === 'feedback'}
      disabled={mode !== 'answering'}
      onpick={answer}
    />
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
  .feedback .relearn {
    color: var(--accent);
    font-weight: 600;
  }
  .feedback.caught {
    gap: 12px;
  }
</style>
