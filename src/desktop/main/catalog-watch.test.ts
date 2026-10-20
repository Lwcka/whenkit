import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhenkitError } from '../../core/errors';
import type { CatalogStore } from '../../core/ports';
import type { EntryDto } from '../../shared/ipc';
import { runWrite, watchCatalog } from './catalog-watch';

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

describe('runWrite', () => {
  const store = {} as CatalogStore;
  const opened = { ok: true, store, workspace: 'D:\\ws' } as const;
  const changed: readonly EntryDto[] = [];

  it('emits after a successful write and answers with its result', async () => {
    const emit = vi.fn();
    const fn = vi.fn((given: CatalogStore) => {
      expect(given).toBe(store);
      return { changed };
    });
    await expect(runWrite(opened, fn, emit)).resolves.toEqual({
      ok: true,
      data: { changed },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('awaits an asynchronous write before it emits', async () => {
    const order: string[] = [];
    const result = await runWrite(
      opened,
      async () => {
        await Promise.resolve();
        order.push('written');
        return { changed };
      },
      () => order.push('emitted'),
    );
    expect(result.ok).toBe(true);
    expect(order).toEqual(['written', 'emitted']);
  });

  it('answers the code of a WhenkitError and does not emit', async () => {
    const emit = vi.fn();
    const logError = vi.fn();
    await expect(
      runWrite(
        opened,
        () => {
          throw new WhenkitError('ARGUMENTS_INVALID');
        },
        emit,
        logError,
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
    expect(emit).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('answers INTERNAL for any other throw, logged, without emitting', async () => {
    const emit = vi.fn();
    const logError = vi.fn();
    const failure = new Error('disk on fire');
    await expect(
      runWrite(opened, () => Promise.reject(failure), emit, logError),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(emit).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(failure);
  });

  it('answers the startup code when the catalog did not open', async () => {
    const fn = vi.fn(() => ({ changed }));
    const emit = vi.fn();
    await expect(
      runWrite({ ok: false, code: 'DATABASE_NEEDS_MIGRATION' }, fn, emit),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'DATABASE_NEEDS_MIGRATION' },
    });
    expect(fn).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps a saved write an answer when emit throws', async () => {
    const logError = vi.fn();
    await expect(
      runWrite(
        opened,
        () => ({ changed }),
        () => {
          throw new Error('window gone');
        },
        logError,
      ),
    ).resolves.toEqual({ ok: true, data: { changed } });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
