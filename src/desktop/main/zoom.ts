import {
  isZoomIntent,
  type IpcResult,
  type ZoomIntent,
} from '../../shared/ipc';
import { failure, logQuietly } from './catalog';

// The window's zoom (AD-20): main owns it. Electron-free so the stepping can be
// tested without a window.

/** The zoom steps of the whole interface (EXPERIENCE: 80-200%). */
export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 2;
export const ZOOM_DEFAULT = 1;

/** Tolerance when comparing a factor with a step (floating point). */
const EPSILON = 1e-9;

/** The nearest limit for a factor outside 80-200%; the value itself otherwise. */
export function clampZoom(value: number): number {
  return Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX);
}

/**
 * The factor after `intent`. `'reset'` is always 1. `'in'` and `'out'` go to
 * the next step in that direction, so a value between steps (an edited file)
 * lands on a step; at the ends the factor stays as it is.
 */
export function nextZoom(current: number, intent: ZoomIntent): number {
  if (intent === 'reset') return ZOOM_DEFAULT;
  if (intent === 'in') {
    return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? current;
  }
  return (
    [...ZOOM_STEPS].reverse().find((step) => step < current - EPSILON) ??
    current
  );
}

/**
 * The `window:zoom` answer (AD-20). The renderer is not trusted: anything but
 * the three intents is `ARGUMENTS_INVALID` and changes nothing. `'in'` and
 * `'out'` at an end answer ok and do nothing; `'reset'` always applies. A real
 * change calls `apply(next)` (the window's zoom and title bar overlay) and only
 * then `record(next)` (remember and save), so a failing `apply` records
 * nothing and answers `INTERNAL`. Never throws.
 */
export function zoomResult(
  intent: unknown,
  current: number,
  actions: {
    apply: (next: number) => void;
    record: (next: number) => void;
  },
  logError: (error: unknown) => void = console.error,
): IpcResult<null> {
  if (!isZoomIntent(intent)) return failure('ARGUMENTS_INVALID');
  try {
    const next = nextZoom(current, intent);
    if (intent !== 'reset' && next === current) return { ok: true, data: null };
    actions.apply(next);
    actions.record(next);
    return { ok: true, data: null };
  } catch (error) {
    logQuietly(logError, error);
    return failure('INTERNAL');
  }
}
