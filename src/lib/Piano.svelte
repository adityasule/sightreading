<script>
  // One-octave piano input for Phase 1. Only the seven white keys are
  // interactive (no accidentals yet); the black keys are drawn for realism
  // but are inert. We answer by *letter*, so octave doesn't matter here.
  //
  // Props:
  //   onpick(letter)  called when a white key is pressed
  //   disabled        block input (e.g. while showing feedback)
  //   picked          the letter the user chose (for feedback colouring)
  //   answer          the correct letter (revealed on feedback)
  //   revealed        whether to show correct/incorrect colouring

  let { onpick, disabled = false, picked = null, answer = null, revealed = false } =
    $props();

  const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Black keys sit on the boundaries after C, D, F, G, A (in sevenths).
  const BLACK = [1, 2, 4, 5, 6];

  function keyClass(letter) {
    if (!revealed) return '';
    if (letter === answer) return 'correct';
    if (letter === picked) return 'wrong';
    return '';
  }
</script>

<div class="piano" role="group" aria-label="Piano keyboard">
  <div class="whites">
    {#each WHITE as letter}
      <button
        type="button"
        class="white {keyClass(letter)}"
        {disabled}
        aria-label={letter}
        onclick={() => onpick?.(letter)}
      >
        <span class="label">{letter}</span>
      </button>
    {/each}
  </div>
  {#each BLACK as pos}
    <span class="black" style="left: {(pos / 7) * 100}%" aria-hidden="true"></span>
  {/each}
</div>

<style>
  .piano {
    position: relative;
    width: 100%;
    max-width: 360px;
    user-select: none;
    touch-action: manipulation;
  }

  .whites {
    display: flex;
    gap: 4px;
  }

  .white {
    flex: 1;
    height: 150px;
    min-height: 0;
    padding: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: #ffffff;
    color: #52525b;
    border: 1px solid var(--border);
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }

  .white:hover:not(:disabled) {
    background: var(--accent-weak);
    border-color: var(--accent);
  }

  .white:active:not(:disabled) {
    background: var(--surface-2);
  }

  .label {
    font-size: 0.8rem;
    padding-bottom: 10px;
    pointer-events: none;
  }

  .white.correct {
    background: var(--good);
    border-color: var(--good);
    color: var(--accent-fg);
  }

  .white.wrong {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--accent-fg);
  }

  /* Decorative, non-interactive accidentals. */
  .black {
    position: absolute;
    top: 0;
    width: 9%;
    height: 95px;
    transform: translateX(-50%);
    background: #27272a;
    border-radius: 0 0 4px 4px;
    pointer-events: none;
    z-index: 2;
  }
</style>
