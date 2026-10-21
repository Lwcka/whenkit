import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isVisible,
  parseWindowState,
  readWindowState,
  writeWindowState,
  type Rectangle,
} from './window-state';

const SCREEN: Rectangle = { x: 0, y: 0, width: 1920, height: 1040 };
const SECOND: Rectangle = { x: 1920, y: 0, width: 1280, height: 1000 };
const BOUNDS = { x: 100, y: 80, width: 900, height: 700 };

const file = (content: unknown) => JSON.stringify(content);

describe('isVisible', () => {
  it.each([
    ['fully inside', BOUNDS, true],
    ['on the second screen', { x: 2000, y: 10, width: 500, height: 400 }, true],
    ['far to the right', { x: 5000, y: 0, width: 800, height: 600 }, false],
    ['far below', { x: 0, y: 3000, width: 800, height: 600 }, false],
    [
      'only 99 px wide overlap',
      { x: 3200 - 99, y: 0, width: 800, height: 600 },
      false,
    ],
    [
      'exactly 100 x 40 overlap',
      { x: 3200 - 100, y: 1000 - 40, width: 800, height: 600 },
      true,
    ],
    [
      'only 39 px high overlap',
      { x: 0, y: 1040 - 39, width: 800, height: 600 },
      false,
    ],
  ])('%s', (_label, bounds, expected) => {
    expect(isVisible(bounds, [SCREEN, SECOND])).toBe(expected);
  });

  it('is false with no work area', () => {
    expect(isVisible(BOUNDS, [])).toBe(false);
  });
});

describe('parseWindowState', () => {
  it('reads theme and bounds', () => {
    expect(
      parseWindowState(file({ version: 1, theme: 'dark', bounds: BOUNDS }), [
        SCREEN,
      ]),
    ).toEqual({ theme: 'dark', bounds: BOUNDS });
  });

  it('reads a maximized window', () => {
    expect(
      parseWindowState(file({ version: 1, bounds: BOUNDS, maximized: true }), [
        SCREEN,
      ]),
    ).toEqual({ bounds: BOUNDS, maximized: true });
  });

  it('reads a file without the maximized field as not maximized', () => {
    const state = parseWindowState(file({ version: 1, bounds: BOUNDS }), [
      SCREEN,
    ]);
    expect(state.maximized).toBeUndefined();
  });

  it('reads maximized: false as not maximized', () => {
    const state = parseWindowState(
      file({ version: 1, bounds: BOUNDS, maximized: false }),
      [SCREEN],
    );
    expect(state.maximized).toBeUndefined();
  });

  it('keeps maximized when the bounds are off every screen', () => {
    const text = file({
      version: 1,
      bounds: { x: 9000, y: 9000, width: 800, height: 600 },
      maximized: true,
    });
    expect(parseWindowState(text, [SCREEN])).toEqual({ maximized: true });
  });

  it('reads a file with only a theme', () => {
    expect(
      parseWindowState(file({ version: 1, theme: 'light' }), [SCREEN]),
    ).toEqual({ theme: 'light' });
  });

  it('accepts a byte-order mark', () => {
    expect(
      parseWindowState(`﻿${file({ version: 1, theme: 'dark' })}`, [SCREEN]),
    ).toEqual({ theme: 'dark' });
  });

  it.each([
    ['bad JSON', '{not json'],
    ['empty text', ''],
    ['not an object', '[1]'],
    ['a missing version', file({ theme: 'dark', bounds: BOUNDS })],
    ['a wrong version', file({ version: 2, theme: 'dark', bounds: BOUNDS })],
    [
      'a non-boolean maximized',
      file({ version: 1, theme: 'dark', bounds: BOUNDS, maximized: 'yes' }),
    ],
    ['a bad theme', file({ version: 1, theme: 'blue', bounds: BOUNDS })],
    [
      'bounds of the wrong shape',
      file({ version: 1, theme: 'dark', bounds: { x: 1, y: 1 } }),
    ],
    [
      'fractional bounds',
      file({
        version: 1,
        theme: 'dark',
        bounds: { ...BOUNDS, width: 900.5 },
      }),
    ],
    [
      'a zero size',
      file({ version: 1, theme: 'dark', bounds: { ...BOUNDS, height: 0 } }),
    ],
  ])('gives defaults for everything on %s', (_label, text) => {
    expect(parseWindowState(text, [SCREEN])).toEqual({});
  });

  it('keeps the theme and drops bounds that no screen shows', () => {
    const text = file({
      version: 1,
      theme: 'dark',
      bounds: { x: 9000, y: 9000, width: 800, height: 600 },
    });
    expect(parseWindowState(text, [SCREEN, SECOND])).toEqual({ theme: 'dark' });
  });
});

describe('window-state.json on disk', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'whenkit-window-state-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('gives defaults for a missing file', () => {
    expect(
      readWindowState(path.join(dir, 'window-state.json'), [SCREEN]),
    ).toEqual({});
  });

  it('round-trips and leaves no temp file', () => {
    const target = path.join(dir, 'window-state.json');
    writeWindowState(target, { theme: 'dark', bounds: BOUNDS });

    expect(readWindowState(target, [SCREEN])).toEqual({
      theme: 'dark',
      bounds: BOUNDS,
    });
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
      version: 1,
      theme: 'dark',
      bounds: BOUNDS,
    });
    expect(readdirSync(dir)).toEqual(['window-state.json']);
  });

  it('round-trips a maximized window', () => {
    const target = path.join(dir, 'window-state.json');
    writeWindowState(target, { bounds: BOUNDS, maximized: true });

    expect(readWindowState(target, [SCREEN])).toEqual({
      bounds: BOUNDS,
      maximized: true,
    });
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
      version: 1,
      bounds: BOUNDS,
      maximized: true,
    });
  });

  it('does not write maximized for a normal window', () => {
    const target = path.join(dir, 'window-state.json');
    writeWindowState(target, { bounds: BOUNDS, maximized: false });

    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
      version: 1,
      bounds: BOUNDS,
    });
  });

  it('replaces an earlier state and omits what is absent', () => {
    const target = path.join(dir, 'window-state.json');
    writeWindowState(target, { theme: 'dark', bounds: BOUNDS });
    writeWindowState(target, { bounds: BOUNDS });

    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
      version: 1,
      bounds: BOUNDS,
    });
    expect(readdirSync(dir)).toEqual(['window-state.json']);
  });

  it('does not rewrite a corrupt file when reading it', () => {
    const target = path.join(dir, 'window-state.json');
    writeFileSync(target, '{broken', 'utf8');

    expect(readWindowState(target, [SCREEN])).toEqual({});
    expect(readFileSync(target, 'utf8')).toBe('{broken');
  });

  it('throws and removes the temp file when the rename fails', () => {
    // The target is a directory: the temp write succeeds, the rename fails.
    const target = path.join(dir, 'window-state.json');
    mkdirSync(target);
    expect(() => writeWindowState(target, { theme: 'light' })).toThrow();
    expect(existsSync(`${target}.tmp`)).toBe(false);
  });

  it('throws without leaving a temp file when the folder is missing', () => {
    const target = path.join(dir, 'missing', 'window-state.json');
    expect(() => writeWindowState(target, { theme: 'light' })).toThrow();
    expect(existsSync(`${target}.tmp`)).toBe(false);
  });
});
