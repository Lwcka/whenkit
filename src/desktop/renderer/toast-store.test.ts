import { describe, expect, it, vi } from 'vitest';
import { MAX_TOASTS, createToastStore } from './toast-store';

describe('toast store', () => {
  it('keeps the newest last', () => {
    const store = createToastStore();
    store.push({ kind: 'info', message: 'a' });
    store.push({ kind: 'error', message: 'b' });
    expect(store.getToasts().map((toast) => toast.message)).toEqual(['a', 'b']);
  });

  it('drops the oldest when a fourth is pushed (max 3)', () => {
    const store = createToastStore();
    for (const message of ['1', '2', '3', '4']) {
      store.push({ kind: 'info', message });
    }
    expect(MAX_TOASTS).toBe(3);
    expect(store.getToasts().map((toast) => toast.message)).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  it('dismisses one toast by id and ignores an unknown id', () => {
    const store = createToastStore();
    const first = store.push({ kind: 'info', message: 'a' });
    store.push({ kind: 'info', message: 'b' });
    const listener = vi.fn();
    store.subscribe(listener);

    store.dismiss(999);
    expect(listener).not.toHaveBeenCalled();

    store.dismiss(first);
    expect(store.getToasts().map((toast) => toast.message)).toEqual(['b']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps an optional action and notifies subscribers until they leave', () => {
    const store = createToastStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const run = vi.fn();
    store.push({ kind: 'info', message: 'a', action: { label: 'Vezi', run } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getToasts()[0]?.action?.label).toBe('Vezi');

    unsubscribe();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getToasts()).toEqual([]);
  });
});
