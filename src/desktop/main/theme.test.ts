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

  it('scales the overlay height with the zoom and keeps the colors', () => {
    expect(nativeThemeSettings('dark', 1.5)).toEqual({
      backgroundColor: '#111923',
      titleBarOverlay: { color: '#0D131A', symbolColor: '#F0EBE2', height: 60 },
    });
    expect(nativeThemeSettings('light', 1.5).titleBarOverlay.height).toBe(60);
  });

  it.each([
    [0.8, 32],
    [0.9, 36],
    [1, 40],
    [1.1, 44],
    [1.25, 50],
    [1.5, 60],
    [1.75, 70],
    [2, 80],
  ])('has an overlay of %s zoom as %s DIP', (zoom, height) => {
    expect(nativeThemeSettings('light', zoom).titleBarOverlay.height).toBe(
      height,
    );
  });
});
