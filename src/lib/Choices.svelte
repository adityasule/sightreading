<script>
  // Reusable multiple-choice answer pad (4 options, one correct). Purely
  // presentational: it renders the option buttons and their feedback states and
  // reports a pick via `onpick(value)`. The owning view holds the quiz mode and
  // does the grading, so this stays card-agnostic — note-name cards today, the
  // duration / rest / clef cards in M2d reuse it unchanged.
  //
  //   options   [{ value, label }]   the choices, in display order
  //   correct   value | null          the right answer (shown once revealed)
  //   picked    value | null          what the user chose this round
  //   revealed  boolean               feedback mode — colour correct/wrong
  //   disabled  boolean               lock the pad (during feedback)
  //   onpick    (value) => void
  //
  // A small leading number hints at the 1–N hardware-key shortcut the view
  // wires up; on touch it's just a quiet index.
  let {
    options = [],
    correct = null,
    picked = null,
    revealed = false,
    disabled = false,
    onpick = () => {},
  } = $props();
</script>

<div class="choices" role="group" aria-label="Answer choices">
  {#each options as opt, i}
    <button
      type="button"
      class="choice"
      class:correct={revealed && opt.value === correct}
      class:wrong={revealed && opt.value === picked && picked !== correct}
      disabled={disabled}
      onclick={() => onpick(opt.value)}
    >
      <span class="num" aria-hidden="true">{i + 1}</span>
      <span class="label">{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  .choices {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    width: 100%;
    max-width: 420px;
  }

  .choice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 60px;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .num {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .choice.correct {
    background: var(--good);
    border-color: var(--good);
    color: var(--accent-fg);
  }
  .choice.wrong {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--accent-fg);
  }
  /* On a revealed option the dim number would clash with the solid fill. */
  .choice.correct .num,
  .choice.wrong .num {
    color: inherit;
    opacity: 0.75;
  }
</style>
