import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { WINDOW_STATE_VERSION } from '../../core/versions';
import type { Theme } from '../../shared/ipc';
import { clampZoom } from './zoom';

// The window's preferences (AD-20): `userData/window-state.json`, read by main
// before the window exists and written only by main. Electron-free so tests
// can drive it with temp dirs.

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What the file holds, without its version. Every field is optional.
 * `bounds` is the normal (restored) size; `maximized` is written and read
 * back only when true (absent means not maximized). `zoom` is the interface
 * zoom factor (AD-20): absent means 100%, and a value read from the file is
 * clamped to 80-200%.
 */
export interface WindowState {
  theme?: Theme;
  bounds?: Rectangle;
  maximized?: boolean;
  zoom?: number;
}

const boundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const fileSchema = z.object({
  version: z.literal(WINDOW_STATE_VERSION),
  theme: z.enum(['light', 'dark']).optional(),
  bounds: boundsSchema.optional(),
  maximized: z.boolean().optional(),
  zoom: z.number().finite().optional(),
});

/** The least overlap with a work area for a saved window to count as reachable. */
const MIN_OVERLAP_WIDTH = 100;
const MIN_OVERLAP_HEIGHT = 40;

/** True when the bounds overlap some work area by at least 100 x 40 px. */
export function isVisible(
  bounds: Rectangle,
  workAreas: readonly Rectangle[],
): boolean {
  return workAreas.some((area) => {
    const width =
      Math.min(bounds.x + bounds.width, area.x + area.width) -
      Math.max(bounds.x, area.x);
    const height =
      Math.min(bounds.y + bounds.height, area.y + area.height) -
      Math.max(bounds.y, area.y);
    return width >= MIN_OVERLAP_WIDTH && height >= MIN_OVERLAP_HEIGHT;
  });
}

/**
 * Parses the file's text. Anything wrong with it (bad JSON, version, theme,
 * bounds, maximized or zoom shape) gives `{}`; bounds that no work area shows
 * are dropped, and the theme, the maximized flag and the zoom are kept.
 */
export function parseWindowState(
  text: string,
  workAreas: readonly Rectangle[],
): WindowState {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return {};
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) return {};
  const state: WindowState = {};
  if (parsed.data.theme !== undefined) state.theme = parsed.data.theme;
  if (parsed.data.maximized === true) state.maximized = true;
  if (parsed.data.zoom !== undefined) state.zoom = clampZoom(parsed.data.zoom);
  const { bounds } = parsed.data;
  if (bounds !== undefined && isVisible(bounds, workAreas)) {
    state.bounds = bounds;
  }
  return state;
}

/** Reads the state; a missing or unreadable file gives `{}`. Never throws. */
export function readWindowState(
  path: string,
  workAreas: readonly Rectangle[],
): WindowState {
  try {
    return parseWindowState(readFileSync(path, 'utf8'), workAreas);
  } catch {
    return {};
  }
}

/**
 * Writes the state through a temp file and a rename, so a crash never leaves
 * a half-written file. Throws on failure, after removing the temp file.
 */
export function writeWindowState(path: string, state: WindowState): void {
  const temp = `${path}.tmp`;
  const content = {
    version: WINDOW_STATE_VERSION,
    ...(state.theme === undefined ? {} : { theme: state.theme }),
    ...(state.bounds === undefined ? {} : { bounds: state.bounds }),
    ...(state.maximized === true ? { maximized: true } : {}),
    ...(state.zoom === undefined ? {} : { zoom: state.zoom }),
  };
  try {
    writeFileSync(temp, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
