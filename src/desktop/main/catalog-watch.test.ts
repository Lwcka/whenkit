import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchCatalog } from './catalog-watch';

describe('watchCatalog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function watch(readVersion: () => number) {
    const emit = vi.fn();
    const logError = vi.fn();
    const watcher = watchCatalog({
      readVersion,
      emit,
      intervalMs: 2000,
      logError,
    });
    return { emit, logError, watcher };
  }

  it('emits once when the version changes, not for the first reading', () => {
    let version = 7;
    const { emit } = watch(() => version);
    vi.advanceTimersByTime(2000);
    expect(emit).not.toHaveBeenCalled();

    version = 8;
    vi.advanceTimersByTime(2000);
    expect(emit).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6000);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('polls at the interval, not before it', () => {
    let version = 1;
    const { emit } = watch(() => version);
    version = 2;
    vi.advanceTimersByTime(1999);
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('emits for each change, one per poll at most', () => {
    let version = 1;
    const { emit } = watch(() => version);
    version = 2;
    vi.advanceTimersByTime(2000);
    version = 5;
    vi.advanceTimersByTime(2000);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('logs a failing read once per streak and keeps polling', () => {
    let fail = false;
    const version = 1;
    const { emit, logError } = watch(() => {
      if (fail) throw new Error('database is locked');
      return version;
    });

    fail = true;
    vi.advanceTimersByTime(6000);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();

    // Recovery emits (changes may have gone unseen) and a new streak logs again.
    fail = false;
    vi.advanceTimersByTime(2000);
    expect(emit).toHaveBeenCalledTimes(1);
    fail = true;
    vi.advanceTimersByTime(2000);
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it('survives a failing first reading', () => {
    let calls = 0;
    const { emit, logError } = watch(() => {
      if (++calls === 1) throw new Error('first');
      return 3;
    });
    expect(logError).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('survives an emit and a logger that throw', () => {
    let version = 1;
    const emit = vi.fn(() => {
      throw new Error('window gone');
    });
    const logError = vi.fn(() => {
      throw new Error('log down');
    });
    watchCatalog({
      readVersion: () => version,
      emit,
      intervalMs: 2000,
      logError,
    });
    version = 2;
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    version = 3;
    vi.advanceTimersByTime(2000);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('stops polling', () => {
    let version = 1;
    const { emit, watcher } = watch(() => version);
    watcher.stop();
    watcher.stop();
    version = 2;
    vi.advanceTimersByTime(10_000);
    expect(emit).not.toHaveBeenCalled();
  });

  it('uses injected timers', () => {
    let tick: () => void = () => {};
    const cleared: unknown[] = [];
    let version = 1;
    const emit = vi.fn();
    const watcher = watchCatalog({
      readVersion: () => version,
      emit,
      intervalMs: 2000,
      logError: () => {},
      timers: {
        setInterval: (callback, ms) => {
          expect(ms).toBe(2000);
          tick = callback;
          return 'handle';
        },
        clearInterval: (handle) => cleared.push(handle),
      },
    });
    version = 2;
    tick();
    expect(emit).toHaveBeenCalledTimes(1);
    watcher.stop();
    expect(cleared).toEqual(['handle']);
  });
});
