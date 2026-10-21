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
import {
  applyTheme,
  followSystemTheme,
  getTheme,
  subscribeTheme,
} from './theme';
import { ThemeSwitch } from './theme-switch';
import { toasts } from './toast-store';

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.style.removeProperty('--motion-theme');
  Reflect.deleteProperty(document, 'startViewTransition');
});

const ok: IpcResult<null> = { ok: true, data: null };

interface FakeTransition {
  update: () => void;
  ready: PromiseWithResolvers<void>;
}

/**
 * A stand-in for document.startViewTransition: records the calls and lets the
 * test run the update callback and settle `ready`, as the browser would.
 */
function stubViewTransition() {
  const calls: FakeTransition[] = [];
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: vi.fn((update: () => void) => {
      const ready = Promise.withResolvers<void>();
      calls.push({ update, ready });
      return { ready: ready.promise };
    }),
  });
  return {
    calls,
    /** The browser runs the callback, then starts the animation. */
    start: async (index = calls.length - 1) => {
      const call = calls[index];
      await act(async () => {
        call?.update();
        call?.ready.resolve();
        await call?.ready.promise;
      });
    },
  };
}

/** Gives <html> a --motion-theme, as tokens.css does in the real app. */
function setMotionTheme(value: string) {
  document.documentElement.style.setProperty('--motion-theme', value);
}

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

describe('ThemeSwitch with a view transition', () => {
  it('flips inside the update callback and sends setTheme at the midpoint', async () => {
    vi.useFakeTimers();
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    expect(vt.calls).toHaveLength(1);
    // The old page is still showing: nothing flipped, nothing sent.
    expect(getTheme()).toBe('light');

    await vt.start();
    expect(getTheme()).toBe('dark');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(setTheme).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(149));
    expect(setTheme).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(toasts.getToasts()).toEqual([]);
  });

  it('reads --motion-theme in seconds too', async () => {
    vi.useFakeTimers();
    setMotionTheme('0.4s');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    await vt.start();
    await act(() => vi.advanceTimersByTimeAsync(199));
    expect(setTheme).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('skips the transition when --motion-theme is 0', async () => {
    setMotionTheme('0ms');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    expect(getTheme()).toBe('dark');
    await act(() => Promise.resolve());

    expect(vt.calls).toHaveLength(0);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('sends only the latest theme after a rapid double toggle', async () => {
    vi.useFakeTimers();
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle); // light -> dark
    fireEvent.click(toggle); // dark -> light, before the first midpoint
    expect(vt.calls).toHaveLength(2);
    await vt.start(0);
    await vt.start(1);
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(getTheme()).toBe('light');
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('reverts with another animated change and toasts when saving fails', async () => {
    vi.useFakeTimers();
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() =>
      Promise.resolve<IpcResult<null>>({
        ok: false,
        error: { code: 'INTERNAL' },
      }),
    );
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    await vt.start();
    await act(() => vi.advanceTimersByTimeAsync(150));

    expect(vt.calls).toHaveLength(2);
    await vt.start();
    expect(getTheme()).toBe('light');
    expect(toasts.getToasts()).toMatchObject([
      { kind: 'error', message: appStrings.themeNotChanged },
    ]);
  });

  it('still applies the theme and sends it once when the transition is skipped', async () => {
    vi.useFakeTimers();
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const setTheme = vi.fn(() => Promise.resolve(ok));
    render(<ThemeSwitch setTheme={setTheme} />);

    fireEvent.click(screen.getByRole('switch'));
    const call = vt.calls[0];
    await act(async () => {
      call?.update();
      call?.ready.reject(new Error('skipped'));
      await call?.ready.promise.catch(() => undefined);
    });

    expect(getTheme()).toBe('dark');
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});

describe('applyTheme', () => {
  it('does nothing for the theme already set, even animated', async () => {
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const listener = vi.fn();
    const stop = subscribeTheme(listener);

    await applyTheme('light', { animate: true });

    expect(vt.calls).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('keeps the pending flip when an echo arrives before the update callback', async () => {
    setMotionTheme('300ms');
    const vt = stubViewTransition();

    void applyTheme('dark', { animate: true });
    void applyTheme('dark', { animate: true });
    expect(vt.calls).toHaveLength(1);
    await vt.start();

    expect(getTheme()).toBe('dark');
  });

  it('takes the duration from the options when given', async () => {
    vi.useFakeTimers();
    const vt = stubViewTransition();
    let done = false;
    void applyTheme('dark', { animate: true, durationMs: 100 }).then(() => {
      done = true;
    });

    await vt.start();
    await vi.advanceTimersByTimeAsync(49);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
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

  it('animates a Windows change and ignores an echo of the theme already set', async () => {
    setMotionTheme('300ms');
    const vt = stubViewTransition();
    const system = fakeMedia(false);
    const stop = followSystemTheme(system.media);

    act(() => system.change(false));
    expect(vt.calls).toHaveLength(0);

    act(() => system.change(true));
    expect(vt.calls).toHaveLength(1);
    await vt.start();
    expect(getTheme()).toBe('dark');

    act(() => system.change(true));
    expect(vt.calls).toHaveLength(1);
    stop();
  });

  it('starts light when the system is light', () => {
    applyTheme('dark');
    const stop = followSystemTheme(fakeMedia(false).media);
    expect(getTheme()).toBe('light');
    stop();
  });
});
