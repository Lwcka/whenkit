import { describe, expect, it } from 'vitest';
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
