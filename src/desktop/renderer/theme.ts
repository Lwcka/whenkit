import type { Theme } from '../../shared/ipc';

// The renderer's theme (AD-20). The truth is the data-theme attribute on
// <html>, which the CSS reads. At startup it comes from prefers-color-scheme,
// which Electron ties to nativeTheme.themeSource (the saved theme, or the
// Windows one): right at the first paint, right after a reload, and followed
// live when no theme is saved.

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** How long the color transition runs (DESIGN motion.theme); only a guard. */
const TRANSITION_MS = 300;

const listeners = new Set<() => void>();
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sets the theme on <html> at once. With `animate`, the colors cross-fade
 * (the CSS reads [data-theme-changing]; its duration is 0 when the user turned
 * Animation effects off).
 */
export function applyTheme(theme: Theme, { animate = false } = {}): void {
  const root = document.documentElement;
  if (animate) {
    root.dataset.themeChanging = '';
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      delete root.dataset.themeChanging;
    }, TRANSITION_MS);
  }
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme;
  for (const listener of listeners) listener();
}

/**
 * Sets the theme from the system query before the first render and follows it
 * from then on. Returns the function that stops following.
 */
export function followSystemTheme(
  media: MediaQueryList = window.matchMedia(DARK_QUERY),
): () => void {
  applyTheme(media.matches ? 'dark' : 'light');
  const onChange = (event: MediaQueryListEvent) =>
    applyTheme(event.matches ? 'dark' : 'light', { animate: true });
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
