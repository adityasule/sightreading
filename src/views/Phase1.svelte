<script>
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '../lib/settings.svelte.js';
  import {
    buildDeck,
    LETTERS,
    ACCIDENTALS,
    noteName,
    pcOf,
    pcName,
  } from '../lib/music.js';
  import { drawNote } from '../lib/render.js';
  import Piano from '../lib/Piano.svelte';
  import QuizSettings from '../lib/QuizSettings.svelte';
  import * as srs from '../lib/spaced-repetition.js';
  import { progress, advance } from '../lib/progression.js';

  const STORAGE_KEY = 'srt:phase1';
  const ADVANCE_MS = 750; // auto-advance delay after a correct answer
  const RELEARN_GAP = 3; // re-show a missed card after this many other cards

  let staffEl;
  let vex = null; // lazily-loaded VexFlow module

  // SRS state is a plain blob (persisted to localStorage), not reactive.
  // UI-facing values are separate $state below.
  let srsState = srs.loadState(STORAGE_KEY);

  let deck = $derived(buildDeck(settings)); // reshapes when clefs toggle

  let current = $state(null); // active card, or null when caught up
  let mode = $state('answering'); // 'answering' | 'feedback' | 'caughtup'
  let source = $state('scheduled'); // 'scheduled' | 'relearn' | 'practice'
  let picked = $state(null); // { pc, name, letter?, accidental? } chosen this round
  let pendingAcc = $state(''); // '' | '#' | 'b' — staged modifier in Letters mode
  let session = $state({ seen: 0, correct: 0 });
  let counts = $state({ due: 0, learned: 0, total: 0, newRemaining: 0 });
  // Progression view (current level, per-level progress, gate). See progression.js.
  let level = $state(null);

  // Manual deck top-up (M2e, batched in M2f): each "add more" click grants one
  // extra batch of `newCardsPerDay` cards on top of the daily budget — never an
  // unlimited bypass, so the setting stays a hard cap. Session-scoped (resets on
  // remount); the daily counter still resets at local midnight.
  let extraBatches = $state(0);
  // Caught-up: does the current level still have un-introduced cards? True means a
  // budget-limited dead-end (offer another batch); false once the level pool is
  // exhausted (offer the early next-level advance instead).
  let poolHasNew = $derived(!!level && level.pool.some((c) => !srsState.cards[c.id]));

  let advanceTimer = null;

  // In-session relearning: a miss re-appears after RELEARN_GAP other cards,
  // so it registers before sinking into the day-scale schedule. Session-only
  // (not persisted): [{ id, showAfter }], compared against `shown`, a counter
  // of how many cards have been displayed this session.
  let relearn = [];
  let shown = 0;

  // Letters mode grades the spelling (letter + accidental); Piano mode grades
  // the key (pitch class), so C♯ and D♭ both accept the same black key.
  function gradeCorrect(card, pick) {
    if (!card || !pick) return false;
    if (settings.answerMode === 'piano') return pick.pc === card.pc;
    return pick.letter === card.letter && pick.accidental === card.accidental;
  }

  let isCorrect = $derived(mode === 'feedback' && gradeCorrect(current, picked));

  // Full level name including the register sub-label. Matters at the C-major
  // foundation split, where two levels share the "C major / A minor" label and
  // differ only by register — without the sub the gate reads as a no-op.
  const levelName = (lvl) => (lvl.sub ? `${lvl.label} — ${lvl.sub}` : lvl.label);

  function refreshCounts() {
    counts = srs.summary(srsState, deck, settings.newCardsPerDay);
    level = progress(srsState, deck);
  }

  // Show a card and tag where it came from (drives how its answer is scored).
  function showCard(card, src) {
    current = card;
    source = src;
    mode = 'answering';
    shown += 1;
    renderNote();
  }

  // Pull a relearning card off the queue by id, tolerating ones that have
  // since left the deck (clef/range changed mid-session).
  function takeRelearn(item) {
    const card = deck.find((c) => c.id === item.id);
    return card ?? null;
  }

  function next() {
    clearTimeout(advanceTimer);
    picked = null;
    pendingAcc = '';

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

    // 2. The normal scheduler: a due card, or a fresh one from the current
    //    level only (progression gates which notes are introducible). Each
    //    opted-in top-up batch lifts the daily budget by one `newCardsPerDay`.
    const view = progress(srsState, deck);
    const budget = settings.newCardsPerDay * (1 + extraBatches);
    const id = srs.pickNext(srsState, deck, budget, view.pool);
    srs.saveState(STORAGE_KEY, srsState); // persist newly-introduced card / migration
    refreshCounts();
    if (id) return showCard(deck.find((c) => c.id === id), 'scheduled');

    // 3. Nothing scheduled, but missed cards still pend — show the soonest now
    //    rather than declaring "caught up" with relearning outstanding.
    while (relearn.length) {
      const card = takeRelearn(relearn.shift());
      if (card) return showCard(card, 'relearn');
    }

    // 4. Genuinely caught up.
    current = null;
    mode = 'caughtup';
  }

  // "Keep practicing" once caught up: drill a random card ahead of schedule.
  // Answers still feed the scheduler, so this never hurts. Only draws from
  // notes already introduced — never jumps ahead to locked levels.
  function practice() {
    clearTimeout(advanceTimer);
    picked = null;
    pendingAcc = '';
    const introduced = deck.filter((c) => srsState.cards[c.id]);
    if (introduced.length === 0) return;
    showCard(introduced[Math.floor(Math.random() * introduced.length)], 'practice');
  }

  // Accept the progression gate: unlock the next level, then start serving its
  // notes. Reached from the mastered gate (level complete) or the M2e early
  // top-up (level fully introduced but not yet mastered) — `advance` + the
  // introduction-frontier `current` move both the banner and the new-card pool.
  function startNextLevel() {
    advance(srsState, deck);
    srs.saveState(STORAGE_KEY, srsState);
    next();
  }

  // Manual top-up (M2e): grant one more batch of new cards past today's budget,
  // then serve the next one immediately.
  function addMoreCards() {
    extraBatches += 1;
    next();
  }

  // The caught-up screen's primary action, mirroring the on-screen button order:
  // advance the level (mastered gate or early top-up), else add more new notes
  // past the cap, else practice already-learned notes ahead of schedule.
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

  // Letters pad / hardware keyboard: submit the letter with the staged
  // modifier (pendingAcc). pc is carried too so the answer still grades in
  // Piano mode if a keyboard letter is used there.
  function answerLetter(letter) {
    if (mode !== 'answering' || !current) return;
    const accidental = pendingAcc;
    commit({
      letter,
      accidental,
      pc: pcOf(letter, accidental),
      name: noteName(letter, accidental),
    });
  }

  // Piano: a pressed key, identified by pitch class.
  function answerPiano(pc) {
    if (mode !== 'answering' || !current) return;
    commit({ pc, name: pcName(pc) });
  }

  // Toggle the staged sharp/flat for the next Letters answer (sticky, so a
  // natural stays one tap; tapping the same modifier again clears it).
  function toggleAcc(acc) {
    if (mode !== 'answering') return;
    pendingAcc = pendingAcc === acc ? '' : acc;
  }

  function commit(pick) {
    picked = pick;
    const correct = gradeCorrect(current, pick);

    if (source === 'relearn') {
      // Pure reinforcement: the miss is already on the schedule, so don't
      // touch the scheduler or first-attempt session stats. Just keep the
      // card cycling until it's answered correctly.
      if (!correct) enqueueRelearn(current.id);
    } else {
      srs.recordAnswer(srsState, current.id, correct);
      srs.saveState(STORAGE_KEY, srsState);

      session.seen += 1;
      if (correct) session.correct += 1;

      // A first-time miss enters relearning; practice misses don't (practice
      // already re-draws freely and shouldn't pad the session queue).
      if (!correct && source === 'scheduled') enqueueRelearn(current.id);
      refreshCounts();
    }

    pendingAcc = '';
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
        caughtUpPrimary();
      }
      return;
    }
    // Answering. Sharp/flat modifiers first (so they can be staged before a
    // letter), then hardware A–G (a Letters affordance, harmless in Piano).
    if (e.key === '#' || e.key === '+' || e.key === '=') {
      toggleAcc('#');
      return;
    }
    if (e.key === '-' || e.key === '_') {
      toggleAcc('b');
      return;
    }
    const k = e.key.toUpperCase();
    if (LETTERS.includes(k)) answerLetter(k);
  }

  function renderNote() {
    if (!vex || !staffEl || !current) return;
    const color =
      mode === 'feedback' && picked != null ? (isCorrect ? '#16a34a' : '#dc2626') : null;
    drawNote(vex, staffEl, {
      clef: current.clef,
      vexKey: current.vexKey,
      accidental: current.accidental,
      ledgerLines: settings.ledgerLines ?? 2,
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
    // Gate the first render on the music font being ready. VexFlow's default
    // family is "Bravura,Academico"; before those load it lays out with wrong
    // glyph metrics and the stem detaches / shifts right (it only looked right
    // after a reload because the font was then cached). The bravura build
    // registers both FontFaces from data URIs at import, so `document.fonts.load`
    // resolves them with no network — unlike `VexFlow.loadFonts`, which would
    // re-fetch the font from the CDN the bundled build exists to avoid.
    try {
      await Promise.all([
        document.fonts.load("1em 'Bravura'"),
        document.fonts.load("1em 'Academico'"),
      ]);
    } catch {
      /* no FontFace API (or load failed) — render anyway, worst case is the
         original first-paint glitch, self-corrects on next card */
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
    <QuizSettings />
  </div>

  <header class="head">
    <h2>Notation</h2>
    <p class="muted">Name the note on the staff.</p>
  </header>

  {#if level?.current}
    <div class="level" aria-live="polite">
      <span class="level-name">{level.current.label}</span>
      <span class="level-tag">{level.current.sub ?? level.current.keySig}</span>
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
        <p>🎉 You're caught up — that's today's new-note limit.</p>
        <p class="muted">Want to keep learning?</p>
        <button type="button" class="btn-primary" onclick={addMoreCards}>
          Add more new notes
        </button>
        <button type="button" onclick={practice}>Keep practicing</button>
      {:else if level?.next}
        <p class="good">
          ✅ You've started every note in <strong>{levelName(level.current)}</strong>.
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
          <p class="good">Correct — that's <strong>{current.name}</strong>.</p>
        {:else}
          <p class="bad">
            That was <strong>{current.name}</strong>
            {#if picked}(you picked {picked.name}){/if}.
          </p>
          <button type="button" class="btn-primary" onclick={next}>
            Next
          </button>
        {/if}
      {:else if source === 'relearn'}
        <p class="prompt-hint relearn">↻ One you just missed — try again.</p>
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
        onpick={answerPiano}
        disabled={mode !== 'answering'}
        pickedPc={picked?.pc ?? null}
        correctPc={current?.pc ?? null}
        revealed={mode === 'feedback'}
      />
    {:else}
      <div class="pad-wrap">
        <div class="accidentals" role="group" aria-label="Accidental">
          {#each ACCIDENTALS as acc}
            <button
              type="button"
              class="mod"
              class:active={mode === 'answering' && pendingAcc === acc.value}
              class:correct={mode === 'feedback' &&
                current?.accidental === acc.value}
              aria-pressed={pendingAcc === acc.value}
              aria-label={acc.label}
              disabled={mode !== 'answering'}
              onclick={() => toggleAcc(acc.value)}
            >
              {acc.symbol}
            </button>
          {/each}
        </div>
        <div class="pad" role="group" aria-label="Note names">
          {#each LETTERS as letter}
            <button
              type="button"
              class="key"
              class:correct={mode === 'feedback' && current?.letter === letter}
              class:wrong={mode === 'feedback' &&
                picked?.letter === letter &&
                current?.letter !== letter}
              disabled={mode !== 'answering'}
              onclick={() => answerLetter(letter)}
            >
              {letter}{#if mode === 'answering' && pendingAcc}<span class="key-acc"
                  >{pendingAcc === '#' ? '♯' : '♭'}</span
                >{/if}
            </button>
          {/each}
        </div>
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

  /* Current level banner — the scale the user is working through. */
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

  .pad-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  /* Sharp/flat modifiers — staged before a letter, so they read as a toggle
     rather than an immediate answer. */
  .accidentals {
    display: flex;
    gap: 8px;
  }
  .mod {
    min-height: 48px;
    min-width: 56px;
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1;
  }
  .mod.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }
  .mod.correct {
    background: var(--good);
    border-color: var(--good);
    color: var(--accent-fg);
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
  .key-acc {
    color: var(--accent);
    margin-left: 1px;
  }
  .key.correct .key-acc,
  .key.wrong .key-acc {
    color: inherit;
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
