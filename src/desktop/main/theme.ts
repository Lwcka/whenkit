import type { Theme } from '../../shared/ipc';

// The native half of the theme (AD-20). The values are the DESIGN.md tokens
// (canvas, chrome, ink, titlebar-height); the renderer's CSS owns the rest.

/** DESIGN.md `titlebar-height`: the height of the native window controls. */
export const TITLE_BAR_HEIGHT = 40;
/** DESIGN.md `window-min-width` and `window-min-height`. */
export const WINDOW_MIN_WIDTH = 640;
export const WINDOW_MIN_HEIGHT = 480;

const PALETTE = {
  light: { canvas: '#F7F4EE', chrome: '#F0EBE2', ink: '#1D1B18' },
  dark: { canvas: '#111923', chrome: '#0D131A', ink: '#F0EBE2' },
} as const satisfies Record<
  Theme,
  { canvas: string; chrome: string; ink: string }
>;

export interface NativeThemeSettings {
  backgroundColor: string;
  titleBarOverlay: { color: string; symbolColor: string; height: number };
}

/**
 * The window background and the caption buttons for `theme`. At zoom `z` the
 * overlay is `40 * z` DIP tall, so `env(titlebar-area-height)` stays 40 CSS px
 * and the title bar keeps its layout at every zoom (AD-20).
 */
export function nativeThemeSettings(
  theme: Theme,
  zoom = 1,
): NativeThemeSettings {
  const { canvas, chrome, ink } = PALETTE[theme];
  return {
    backgroundColor: canvas,
    titleBarOverlay: {
      color: chrome,
      symbolColor: ink,
      height: Math.round(TITLE_BAR_HEIGHT * zoom),
    },
  };
}
