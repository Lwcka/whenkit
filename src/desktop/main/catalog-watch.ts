import { logQuietly } from './catalog';

// How the window learns the catalog changed (AD-10), electron-free so tests
// can drive it: a poll of SQLite's data_version for what other processes
// write. The window's own writes emit the same event from runWrite
// (catalog.ts), since data_version does not see writes of its own connection.

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

  // A broken logger must not stop the polling.
  const report = (error: unknown) => logQuietly(logError, error);

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
