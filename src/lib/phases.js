// Canonical phase metadata — the single source of truth for user-facing phase
// names. The `id` stays an internal route id ('phase1' etc.) so storage keys
// and scheduler state are untouched; only `name`/`blurb` are shown to the user.
// Both the nav (App.svelte) and the Home dashboard read from here so a rename
// happens in one place.
export const PHASES = [
  {
    id: 'phase1',
    name: 'Notation',
    blurb: 'Read one note on the treble & bass clef.',
    ready: true,
  },
  {
    id: 'phase2',
    name: 'Chords',
    blurb: 'Identify major / minor three-note chords.',
    ready: false,
  },
  {
    id: 'phase3',
    name: 'Key Signatures',
    blurb: 'Name the major key from its signature.',
    ready: false,
  },
];
