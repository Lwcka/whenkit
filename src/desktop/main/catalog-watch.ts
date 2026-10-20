import type { CatalogStore } from '../../core/ports';
import type { IpcResult, WriteResult } from '../../shared/ipc';
import { errorDtoOf, failure, type DesktopCatalog } from './catalog';

// How the window learns the catalog changed (AD-10), electron-free so tests
// can drive it: a poll of SQLite's data_version for what other processes
// write, and a helper that emits the same event after the window's own writes
// (data_version does not see writes of its own connection).

/** The timer functions the watcher uses; the global ones unless a test injects. */
export interface WatchTimers {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface WatchCatalogOptions {
  /** Reads `PRAGMA data_version` of the window's connection; may throw. */
  readVersion: () => number;
  /** Tells the window the catalog changed. */
  emit: () => void;
  intervalMs: number;
  /** Where read and emit failures are recorded. */
  logError: (error: unknown) => void;
  timers?: WatchTimers;
}

export interface CatalogWatcher {
  stop(): void;
}

const globalTimers: WatchTimers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout),
};

/**
 * Polls `readVersion` every `intervalMs` and calls `emit` when it differs
 * from the last reading. The first reading is the baseline and emits nothing.
 * A failing read is logged once per streak of failures and the polling goes
 * on; the first good reading after a streak emits, since changes may have
 * gone unseen meanwhile. Never throws.
 */
export function watchCatalog({
  readVersion,
  emit,
  intervalMs,
  logError,
  timers = globalTimers,
}: WatchCatalogOptions): CatalogWatcher {
  let last: number | undefined;
  let failing = false;

  const report = (error: unknown) => {
    try {
      logError(error);
    } catch {
      // A broken logger must not stop the polling.
    }
  };

  const poll = () => {
    let version: number;
    try {
      version = readVersion();
    } catch (error) {
      if (!failing) {
        failing = true;
        report(error);
      }
      return;
    }
    const recovered = failing;
    failing = false;
    const changed = last !== undefined && version !== last;
    last = version;
    if (!changed && !recovered) return;
    try {
      emit();
    } catch (error) {
      report(error);
    }
  };

  poll();
  const handle = timers.setInterval(poll, intervalMs);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      timers.clearInterval(handle);
    },
  };
}

/**
 * Runs a write for a future IPC handler: `fn` gets the window's store and
 * answers what it changed. After a successful write it calls `emit`, so the
 * window reloads even though data_version cannot see its own connection's
 * writes. A failure becomes `{ ok: false, error }` with the `ErrorDto` of errorDtoOf:
 * the code, plus the `reasons` and `issues` of a WhenkitError; a failing emit
 * is logged and does not turn the saved write into an error. Never throws.
 */
export async function runWrite<T extends WriteResult>(
  opened: DesktopCatalog,
  fn: (store: CatalogStore) => T | Promise<T>,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<T>> {
  if (!opened.ok) return failure(opened.code);
  let data: T;
  try {
    data = await fn(opened.store);
  } catch (error) {
    return { ok: false, error: errorDtoOf(error, logError) };
  }
  try {
    emit();
  } catch (error) {
    try {
      logError(error);
    } catch {
      // The write is saved; nothing more to do.
    }
  }
  return { ok: true, data };
}
