import type { Theme } from '../../shared/ipc';

// The renderer's theme (AD-20). The truth is the data-theme attribute on
// <html>, which the CSS reads. At startup it comes from prefers-color-scheme,
// which Electron ties to nativeTheme.themeSource (the saved theme, or the
// Windows one): right at the first paint, right after a reload, and followed
// live when no theme is saved.
//
// An animated change is one View Transition: the browser snapshots the old
// page and cross-fades it into the live new one (index.css), so hundreds of
// cards and the millimetre grid fade together, on the compositor.

const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();
/** The theme asked for last; ahead of data-theme while a transition runs. */
let target: Theme | undefined;
/** Counts applyTheme calls, so a superseded transition callback does nothing. */
let latestCall = 0;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * The theme the page is heading to: the last one asked for, which is ahead of
 * getTheme() between the click and the moment the transition flips data-theme.
 */
export function getTargetTheme(): Theme {
  return target ?? getTheme();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The `--motion-theme` token of <html> in milliseconds; 0 if absent or unreadable. */
function readThemeDurationMs(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-theme')
    .trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : 0;
}

function flip(theme: Theme): void {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme;
  for (const listener of listeners) listener();
}

export interface ApplyThemeOptions {
  /** Cross-fade the change (View Transitions API), unless the duration is 0. */
  animate?: boolean;
  /** Overrides the `--motion-theme` token; for tests. */
  durationMs?: number;
}

/**
 * Sets the theme on <html>. Without `animate`, or with a `--motion-theme` of 0
 * (Animation effects off) or no View Transitions API, it changes at once.
 * Otherwise data-theme flips inside the transition's update callback.
 *
 * The promise resolves at the visual midpoint of the fade (at once when there
 * is none), the moment to tell main, so the native caption buttons recolor
 * once, mid-fade. It never rejects.
 */
export function applyTheme(
  theme: Theme,
  { animate = false, durationMs }: ApplyThemeOptions = {},
): Promise<void> {
  // Asking for the theme already set (or already on its way) changes nothing,
  // but the very first call must still write the attribute.
  const echo =
    target === undefined
      ? document.documentElement.dataset.theme === theme
      : target === theme;
  target = theme;
  if (echo) return Promise.resolve();
  const call = ++latestCall;

  const duration = animate ? (durationMs ?? readThemeDurationMs()) : 0;
  if (duration <= 0 || typeof document.startViewTransition !== 'function') {
    flip(theme);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const transition = document.startViewTransition(() => {
      // A newer call has the last word on data-theme.
      if (call === latestCall) flip(theme);
    });
    transition.ready.then(
      () => void setTimeout(resolve, duration / 2),
      resolve, // skipped or aborted: the theme is still applied
    );
  });
}

/**
 * Sets the theme from the system query before the first render and follows it
 * from then on. Returns the function that stops following.
 */
export function followSystemTheme(
  media: MediaQueryList = window.matchMedia(DARK_QUERY),
): () => void {
  void applyTheme(media.matches ? 'dark' : 'light');
  const onChange = (event: MediaQueryListEvent) =>
    void applyTheme(event.matches ? 'dark' : 'light', { animate: true });
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
