/**
 * App navigation — a tiny shared store so any view can switch sections
 * without prop-drilling a callback. No router lib in v1.
 *
 *   nav.active   the id of the visible view ('home' | 'phase1' | ...)
 *   nav.detail   optional sub-view within the active view (currently the
 *                Progress drill-down's phase id), else null
 *   go(id)       switch to a top-level view (clears any detail)
 *   openDetail(d) open a sub-view of the current view (e.g. a Progress drill-down)
 *   back()       step back one entry (the in-app equivalent of the Back button)
 *
 * Each navigation pushes a browser history entry and `popstate` restores it, so
 * the browser/Android Back button steps through in-app views instead of leaving
 * the app. There's still no URL routing (the path never changes) — only the
 * history *stack* is used, so this stays a static SPA with no deep-linking.
 */

export const nav = $state({ active: 'home', detail: null });

function apply(view, detail = null) {
  nav.active = view;
  nav.detail = detail;
}

function push(view, detail = null) {
  if (typeof history !== 'undefined') history.pushState({ view, detail }, '');
}

export function go(id) {
  // No-op (and no duplicate history entry) when already on this view with no
  // detail open; otherwise switch and clear any drill-down.
  if (nav.active === id && nav.detail == null) return;
  apply(id, null);
  push(id, null);
}

export function openDetail(detail) {
  if (nav.detail === detail) return;
  apply(nav.active, detail);
  push(nav.active, detail);
}

export function back() {
  if (typeof history !== 'undefined') history.back();
}

if (typeof window !== 'undefined') {
  // Stamp the initial entry so the first Back has state to restore.
  history.replaceState({ view: nav.active, detail: nav.detail }, '');
  // Restore the view from the popped entry — apply (not go) so we don't push a
  // new entry back onto the stack we're walking.
  window.addEventListener('popstate', (e) => {
    apply(e.state?.view ?? 'home', e.state?.detail ?? null);
  });
}
