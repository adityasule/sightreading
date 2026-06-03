<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '../lib/settings.svelte.js';
  import { choices } from '../lib/music.js';
  import {
    buildChordDeck,
    chordLevelsFor,
    pickVoicing,
    CHORD_POOL,
    chordOptionLabel,
  } from '../lib/chords.js';
  import { drawChord } from '../lib/render.js';
  import Choices from '../lib/Choices.svelte';
  import * as srs from '../lib/spaced-repetition.js';
  import { progress, advance } from '../lib/progression.js';

  const STORAGE_KEY = 'srt:phase2';
  const ADVANCE_MS = 750; // auto-advance delay after a correct answer
  const RELEARN_GAP = 3; // re-show a missed card after this many other cards

  let staffEl;
  let vex = null; // lazily-loaded VexFlow module

  // SRS state is a plain blob (persisted to localStorage), not reactive.
  let srsState = srs.loadState(STORAGE_KEY);

  let deck = $derived(buildChordDeck(settings)); // reshapes when clefs toggle

  let current = $state(null); // active card, or null when caught up
  // The voicing chosen for *this* presentation (inversion + register, randomised),
  // frozen on the card so the feedback re-render redraws the same chord rather
  // than re-rolling. Set in showCard, read by renderChord.
  let voicing = $state(null);
  let mode = $state('answering'); // 'answering' | 'feedback' | 'caughtup'
  let source = $state('scheduled'); // 'scheduled' | 'relearn' | 'practice'
  let picked = $state(null); // chosen chord key this round (e.g. 'C:major')
  let optionValues = $state([]); // the 4 chord keys this card (frozen order)
  let session = $state({ seen: 0, correct: 0 });
  let counts = $state({ due: 0, learned: 0, total: 0, newRemaining: 0 });
  // Progression view (current level, per-level progress, gate). See progression.js;
  // Phase 2 drives it with the chord curriculum bucketer.
  let level = $state(null);

  // Manual deck top-up (batched, as in Phase 0/1): each "add more" click grants
  // one extra batch of `newCardsPerDay` on top of the daily budget. Session-scoped.
  let extraBatches = $state(0);
  let poolHasNew = $derived(!!level && level.pool.some((c) => !srsState.cards[c.id]));

  let advanceTimer = null;

  // In-session relearning, mirroring Phase 0/1: a miss re-appears after
  // RELEARN_GAP other cards. Session-only: [{ id, showAfter }] vs `shown`.
  let relearn = [];
  let shown = 0;

  let isCorrect = $derived(
    mode === 'feedback' && current != null && picked === current.key
  );
  // Option {value,label} pairs — the chord names, in the round's frozen order.
  let options = $derived(
    optionValues.map((v) => ({ value: v, label: chordOptionLabel(v) }))
  );

  // Chord levels carry no register sub-label (unlike Notation's foundation split),
  // so the level name is just the circle-of-fifths label.
  const levelName = (lvl) => lvl.label;

  function refreshCounts() {
    counts = srs.summary(srsState, deck, settings.newCardsPerDay);
    level = progress(srsState, deck, chordLevelsFor);
  }

  // Show a card and tag where it came from (drives how its answer is scored).
  function showCard(card, src) {
    current = card;
    source = src;
    picked = null;
    voicing = pickVoicing(card); // random inversion + register for this showing
    optionValues = choices(card.key, CHORD_POOL); // its key + distractors
    mode = 'answering';
    shown += 1;
    renderChord();
  }

  // Pull a relearning card off the queue by id, tolerating ones that have since
  // left the deck (clef changed mid-session).
  function takeRelearn(item) {
    return deck.find((c) => c.id === item.id) ?? null;
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

    // 1. A missed card whose relearning gap has elapsed takes priority.
    let i = relearn.findIndex((r) => r.showAfter <= shown);
    while (i !== -1) {
      const card = takeRelearn(relearn.splice(i, 1)[0]);
      if (card) return showCard(card, 'relearn');
      i = relearn.findIndex((r) => r.showAfter <= shown);
    }

    // 2. The normal scheduler: a due card, or a fresh one from the current level
    //    only (progression gates which chords are introducible). Each opted-in
    //    top-up batch lifts the daily budget by one `newCardsPerDay`.
    const view = progress(srsState, deck, chordLevelsFor);
    const budget = settings.newCardsPerDay * (1 + extraBatches);
    const id = srs.pickNext(srsState, deck, budget, view.pool);
    srs.saveState(STORAGE_KEY, srsState); // persist newly-introduced card / migration
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

  // "Keep practicing" once caught up: drill a random already-introduced card.
  function practice() {
    clearTimeout(advanceTimer);
    const introduced = deck.filter((c) => srsState.cards[c.id]);
    if (introduced.length === 0) return;
    showCard(introduced[Math.floor(Math.random() * introduced.length)], 'practice');
  }

  // Accept the progression gate: unlock the next level, then serve its chords.
  function startNextLevel() {
    advance(srsState, deck, chordLevelsFor);
    srs.saveState(STORAGE_KEY, srsState);
    next();
  }

  // Manual top-up: grant one more batch of new cards past today's budget.
  function addMoreCards() {
    extraBatches += 1;
    next();
  }

  // The caught-up screen's primary action, mirroring the on-screen button order.
  function caughtUpPrimary() {
    if (deck.length === 0) return;
    if (level?.canAdvance || (level?.next && !poolHasNew)) startNextLevel();
    else if (poolHasNew) addMoreCards();
    else practice();
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
    renderChord(); // recolour the chord green/red
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
        caughtUpPrimary();
      }
      return;
    }
    // Answering: a digit 1..N picks that option.
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      answer(options[n - 1].value);
    }
  }

  function renderChord() {
    if (!vex || !staffEl || !current || !voicing) return;
    const color =
      mode === 'feedback' && picked != null ? (isCorrect ? '#16a34a' : '#dc2626') : null;
    drawChord(vex, staffEl, {
      clef: current.clef,
      keys: voicing.keys,
      accidentals: voicing.accidentals,
      color,
    });
  }

  onMount(async () => {
    // VexFlow is heavy (~700KB gz). Dynamic-import so it only loads when this
    // view opens, keeping the initial bundle small. The `/bravura` build bundles
    // the music font (Bravura + Academico) as embedded data URIs, so no glyph
    // asset is fetched from a CDN at runtime (works offline; M5e).
    const m = await import('vexflow/bravura');
    vex = {
      Renderer: m.Renderer,
      Stave: m.Stave,
      StaveNote: m.StaveNote,
      Accidental: m.Accidental,
      Formatter: m.Formatter,
      Voice: m.Voice,
    };
    // Gate the first render on the music font being ready, or glyph metrics are
    // wrong on first paint (see M1c in HISTORY). The bravura build registers both
    // FontFaces from data URIs at import, so `document.fonts.load` resolves them
    // with no network — unlike `VexFlow.loadFonts`, which would re-fetch the
    // font from the CDN the bundled build exists to avoid.
    try {
      await Promise.all([
        document.fonts.load("1em 'Bravura'"),
        document.fonts.load("1em 'Academico'"),
      ]);
    } catch {
      /* no FontFace API (or load failed) — render anyway */
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
  <header class="head">
    <h2>Chords</h2>
    <p class="muted">Name the chord — root and quality.</p>
  </header>

  {#if level?.current}
    <div class="level" aria-live="polite">
      <span class="level-name">{level.current.label}</span>
      <span class="level-tag">{level.current.keySig}</span>
      <span class="level-prog"><strong>{level.mastered}</strong>/{level.total} mastered</span>
    </div>
  {/if}

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
      {:else if level?.canAdvance}
        <p class="good">
          ✅ You've mastered <strong>{levelName(level.current)}</strong>.
        </p>
        <p class="muted">Ready for the next level?</p>
        <button type="button" class="btn-primary" onclick={startNextLevel}>
          Start {levelName(level.next)}
        </button>
        <button type="button" onclick={practice}>Keep practicing</button>
      {:else if poolHasNew}
        <p>🎉 You're caught up — that's today's new-chord limit.</p>
        <p class="muted">Want to keep learning?</p>
        <button type="button" class="btn-primary" onclick={addMoreCards}>
          Add more new chords
        </button>
        <button type="button" onclick={practice}>Keep practicing</button>
      {:else if level?.next}
        <p class="good">
          ✅ You've started every chord in <strong>{levelName(level.current)}</strong>.
        </p>
        <p class="muted">Master them with reviews, or jump ahead now.</p>
        <button type="button" class="btn-primary" onclick={startNextLevel}>
          Start {levelName(level.next)}
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
          <p class="good">Correct — <strong>{current.name}</strong>.</p>
        {:else}
          <p class="bad">
            That was <strong>{current.name}</strong>
            {#if picked}(you picked {chordOptionLabel(picked)}){/if}.
          </p>
          <button type="button" class="btn-primary" onclick={next}>Next</button>
        {/if}
      {:else if source === 'relearn'}
        <p class="prompt-hint relearn">↻ One you just missed — try again.</p>
      {:else}
        <p class="prompt-hint muted">Which chord is this?</p>
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

  /* Current level banner — the circle-of-fifths key the user is working through. */
  .level {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 4px 10px;
    text-align: center;
  }
  .level-name {
    font-weight: 600;
  }
  .level-tag {
    font-size: 0.8rem;
    color: var(--accent);
    background: var(--accent-weak);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .level-prog {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .level-prog strong {
    color: var(--fg);
    font-variant-numeric: tabular-nums;
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
