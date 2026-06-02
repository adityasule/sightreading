<script>
  // One-octave piano input for Phase 1. All twelve keys are interactive: the
  // seven white naturals plus the five black accidentals. We grade by *pitch
  // class* (which key), so octave is ignored and a black key answers for both
  // of its enharmonic spellings (C♯ and D♭ are the same key).
  //
  // Props:
  //   onpick(pc)   called with the pressed key's pitch class
  //   disabled     block input (e.g. while showing feedback)
  //   pickedPc     the pitch class the user chose (for feedback colouring)
  //   correctPc    the correct pitch class (revealed on feedback)
  //   revealed     whether to show correct/incorrect colouring

  let {
    onpick,
    disabled = false,
    pickedPc = null,
    correctPc = null,
    revealed = false,
  } = $props();

  // White keys, left to right, with pitch class.
  const WHITE = [
    { letter: 'C', pc: 0 },
    { letter: 'D', pc: 2 },
    { letter: 'E', pc: 4 },
    { letter: 'F', pc: 5 },
    { letter: 'G', pc: 7 },
    { letter: 'A', pc: 9 },
    { letter: 'B', pc: 11 },
  ];

  // Black keys sit on the gaps after C, D, F, G, A. `pos` is the white-key
  // boundary (in sevenths) the key straddles; `pc` is its pitch class.
  const BLACK = [
    { pos: 1, pc: 1, name: 'C♯ / D♭' },
    { pos: 2, pc: 3, name: 'D♯ / E♭' },
    { pos: 4, pc: 6, name: 'F♯ / G♭' },
    { pos: 5, pc: 8, name: 'G♯ / A♭' },
    { pos: 6, pc: 10, name: 'A♯ / B♭' },
  ];

  function keyClass(pc) {
    if (!revealed) return '';
    if (pc === correctPc) return 'correct';
    if (pc === pickedPc) return 'wrong';
    return '';
  }
</script>

<div class="piano" role="group" aria-label="Piano keyboard">
  <div class="whites">
    {#each WHITE as key}
      <button
        type="button"
        class="white {keyClass(key.pc)}"
        {disabled}
        aria-label={key.letter}
        onclick={() => onpick?.(key.pc)}
      >
        <span class="label">{key.letter}</span>
      </button>
    {/each}
  </div>
  {#each BLACK as key}
    <button
      type="button"
      class="black {keyClass(key.pc)}"
      style="left: {(key.pos / 7) * 100}%"
      {disabled}
      aria-label={key.name}
      onclick={() => onpick?.(key.pc)}
    ></button>
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

  /* Black keys overlap the white-key boundaries. */
  .black {
    position: absolute;
    top: 0;
    width: 9%;
    height: 95px;
    min-height: 0;
    padding: 0;
    transform: translateX(-50%);
    background: #27272a;
    border: 1px solid #18181b;
    border-radius: 0 0 4px 4px;
    box-shadow: var(--shadow-sm);
    z-index: 2;
  }

  .black:hover:not(:disabled) {
    background: #3f3f46;
  }

  .black:active:not(:disabled) {
    background: #52525b;
  }

  .black.correct {
    background: var(--good);
    border-color: var(--good);
  }

  .black.wrong {
    background: var(--bad);
    border-color: var(--bad);
  }
</style>
