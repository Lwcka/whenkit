import { describe, expect, it } from 'vitest';
import { THEME_ARGUMENT_PREFIX, themeFromArgv } from '../../shared/ipc';
import { nativeThemeSettings } from './theme';

describe('nativeThemeSettings', () => {
  it('uses the light tokens', () => {
    expect(nativeThemeSettings('light')).toEqual({
      backgroundColor: '#F7F4EE',
      titleBarOverlay: { color: '#F0EBE2', symbolColor: '#1D1B18', height: 40 },
    });
  });

  it('uses the dark tokens', () => {
    expect(nativeThemeSettings('dark')).toEqual({
      backgroundColor: '#111923',
      titleBarOverlay: { color: '#0D131A', symbolColor: '#F0EBE2', height: 40 },
    });
  });
});

describe('themeFromArgv', () => {
  it.each([
    ['dark', ['electron', `${THEME_ARGUMENT_PREFIX}dark`], 'dark'],
    ['light', [`${THEME_ARGUMENT_PREFIX}light`], 'light'],
    ['an absent argument', ['electron', '--other'], 'light'],
    ['no arguments', [], 'light'],
    ['an unknown value', [`${THEME_ARGUMENT_PREFIX}blue`], 'light'],
    [
      'an unknown value before a valid one',
      [`${THEME_ARGUMENT_PREFIX}blue`, `${THEME_ARGUMENT_PREFIX}dark`],
      'dark',
    ],
  ])('%s', (_label, argv, expected) => {
    expect(themeFromArgv(argv)).toBe(expected);
  });
});
