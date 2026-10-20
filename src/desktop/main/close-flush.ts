// The close handshake of AD-20, electron-free so tests can drive it: main asks
// the renderer to save the notes still pending and waits for its answer, but
// never longer than a limit, so a hung or crashed renderer cannot keep the
// window open.

export interface NotesFlushOptions {
  /** Asks the renderer to save its pending notes. */
  request: () => void;
  /** Subscribes to the renderer's answer; returns the unsubscribe function. */
  onReply: (callback: () => void) => () => void;
  /** The longest wait for the answer. */
  timeoutMs: number;
  /** Injectable timers; the global ones unless a test provides them. */
  timers?: {
    setTimeout(callback: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
}

/**
 * Sends the request and resolves `'flushed'` on the first reply or `'timeout'`
 * when none comes in time. It resolves once, and removes its listener and its
 * timer either way.
 */
export function waitForNotesFlush({
  request,
  onReply,
  timeoutMs,
  timers = { setTimeout, clearTimeout },
}: NotesFlushOptions): Promise<'flushed' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;
    let handle: unknown;
    const finish = (outcome: 'flushed' | 'timeout') => {
      if (settled) return;
      settled = true;
      timers.clearTimeout(handle);
      unsubscribe();
      resolve(outcome);
    };
    // Listen before asking, so an immediate answer is not missed.
    const unsubscribe = onReply(() => finish('flushed'));
    handle = timers.setTimeout(() => finish('timeout'), timeoutMs);
    try {
      request();
    } catch {
      // The renderer cannot be asked (gone): no answer will come, close now.
      finish('timeout');
    }
  });
}
