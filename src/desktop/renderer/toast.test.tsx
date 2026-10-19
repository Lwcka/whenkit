import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost, TOAST_DWELL_MS, TOAST_FADE_MS } from './toast';
import { createToastStore, type ToastStore } from './toast-store';

let store: ToastStore;

beforeEach(() => {
  vi.useFakeTimers();
  store = createToastStore();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastHost', () => {
  it('is a polite live region, newest toast at the bottom', () => {
    render(<ToastHost store={store} />);
    act(() => {
      store.push({ kind: 'info', message: 'primul' });
      store.push({ kind: 'error', message: 'al doilea' });
    });

    const host = screen.getByLabelText('Notificări');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(
      Array.from(host.querySelectorAll('.toast-message')).map(
        (m) => m.textContent,
      ),
    ).toEqual(['primul', 'al doilea']);
    expect(host.querySelectorAll('.toast')[1]?.getAttribute('data-kind')).toBe(
      'error',
    );
  });

  it('shows at most three, dropping the oldest', () => {
    render(<ToastHost store={store} />);
    act(() => {
      for (const message of ['1', '2', '3', '4']) {
        store.push({ kind: 'info', message });
      }
    });
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getAllByText(/^[234]$/)).toHaveLength(3);
  });

  it('leaves after the dwell time', () => {
    render(<ToastHost store={store} />);
    act(() => {
      store.push({ kind: 'info', message: 'pleacă' });
    });

    act(() => {
      vi.advanceTimersByTime(TOAST_DWELL_MS - 1);
    });
    expect(screen.getByText('pleacă')).toBeTruthy();
    // The dwell is over: the toast starts to fade, and goes after the fade.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen
        .getByText('pleacă')
        .closest('.toast')
        ?.hasAttribute('data-leaving'),
    ).toBe(true);
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(screen.queryByText('pleacă')).toBeNull();
  });

  it('pauses the dwell time while the mouse is over the toast', () => {
    render(<ToastHost store={store} />);
    act(() => {
      store.push({ kind: 'info', message: 'rămâne' });
    });
    const toast = screen.getByText('rămâne').closest('.toast');
    if (toast === null) throw new Error('no toast');

    // 2 s of the dwell pass, then the mouse enters: the timer stops.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DWELL_MS * 3);
    });
    expect(screen.getByText('rămâne')).toBeTruthy();
    expect(toast.hasAttribute('data-leaving')).toBe(false);

    // Leaving resumes with the time that was left, not a full dwell.
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DWELL_MS - 2000 - 1);
    });
    expect(toast.hasAttribute('data-leaving')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toast.hasAttribute('data-leaving')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(screen.queryByText('rămâne')).toBeNull();
  });

  it('closes with the × button', () => {
    render(<ToastHost store={store} />);
    act(() => {
      store.push({ kind: 'info', message: 'închide-mă' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Închide' }));
    // It fades first, then the store drops it.
    expect(screen.getByText('închide-mă')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(screen.queryByText('închide-mă')).toBeNull();
  });

  it('runs the action and closes the toast', () => {
    const run = vi.fn();
    render(<ToastHost store={store} />);
    act(() => {
      store.push({
        kind: 'info',
        message: 'nou',
        action: { label: 'Vezi', run },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Vezi' }));
    expect(run).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(screen.queryByText('nou')).toBeNull();
  });
});
