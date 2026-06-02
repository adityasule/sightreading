/**
 * App navigation — a tiny shared store so any view can switch sections
 * without prop-drilling a callback. No router lib in v1.
 *
 *   nav.active   the id of the visible view ('home' | 'phase1' | ...)
 *   go(id)       switch to a view
 */

export const nav = $state({ active: 'home' });

export function go(id) {
  nav.active = id;
}
