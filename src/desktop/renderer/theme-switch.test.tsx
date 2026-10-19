import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcResult } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { applyTheme, followSystemTheme, getTheme } from './theme';
import { ThemeSwitch } from './theme-switch';
import { toasts } from './toast-store';

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
});

afterEach(cleanup);

const ok: IpcResult<null> = { ok: true, data: null };

describe('ThemeSwitch', () => {
  it('flips data-theme at once and asks main to keep it', async () => {
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);
    const toggle = screen.getByRole('switch', {
      name: appStrings.themeSwitchLabel,
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    // Before the answer arrives the theme is already dark.
    expect(document.documentElement.dataset.theme).toBe('dark');
    await act(() => Promise.resolve());

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toasts.getToasts()).toEqual([]);

    fireEvent.click(toggle);
    await act(() => Promise.resolve());
    expect(setTheme).toHaveBeenLastCalledWith('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reverts the theme and shows an error toast on an error result', async () => {
    const setTheme = vi.fn(() =>
      Promise.resolve<IpcResult<null>>({
        ok: false,
        error: { code: 'INTERNAL' },
      }),
    );
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    await act(() => Promise.resolve());

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(toasts.getToasts()).toMatchObject([
      { kind: 'error', message: appStrings.themeNotChanged },
    ]);
  });

  it('reverts and toasts when the bridge itself rejects', async () => {
    const setTheme = vi.fn(() => Promise.reject(new Error('ipc down')));
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    await act(() => Promise.resolve());

    expect(getTheme()).toBe('light');
    expect(toasts.getToasts()).toHaveLength(1);
  });
});

describe('followSystemTheme', () => {
  function fakeMedia(matches: boolean) {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches,
      addEventListener: (_type: string, fn: typeof listener) => {
        listener = fn;
      },
      removeEventListener: () => {
        listener = undefined;
      },
    } as unknown as MediaQueryList;
    return {
      media,
      change: (next: boolean) =>
        listener?.({ matches: next } as MediaQueryListEvent),
      hasListener: () => listener !== undefined,
    };
  }

  it('reads the system theme before the first render and follows it', () => {
    const system = fakeMedia(true);
    const stop = followSystemTheme(system.media);
    expect(getTheme()).toBe('dark');

    act(() => system.change(false));
    expect(getTheme()).toBe('light');

    stop();
    expect(system.hasListener()).toBe(false);
  });

  it('starts light when the system is light', () => {
    applyTheme('dark');
    const stop = followSystemTheme(fakeMedia(false).media);
    expect(getTheme()).toBe('light');
    stop();
  });
});
