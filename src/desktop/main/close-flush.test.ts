import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForNotesFlush } from './close-flush';

/** A reply channel the test can fire by hand. */
function channel() {
  const listeners = new Set<() => void>();
  return {
    onReply: (callback: () => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    reply: () => {
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

describe('waitForNotesFlush', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves flushed on the reply and cleans up', async () => {
    const { onReply, reply, listeners } = channel();
    const request = vi.fn();
    const result = waitForNotesFlush({ request, onReply, timeoutMs: 3000 });
    expect(request).toHaveBeenCalledTimes(1);
    reply();
    await expect(result).resolves.toBe('flushed');
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves timeout when the renderer stays silent, and cleans up', async () => {
    const { onReply, listeners } = channel();
    const result = waitForNotesFlush({
      request: () => undefined,
      onReply,
      timeoutMs: 3000,
    });
    await vi.advanceTimersByTimeAsync(2999);
    expect(listeners.size).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('timeout');
    expect(listeners.size).toBe(0);
  });

  it('resolves once: a reply after the timeout changes nothing', async () => {
    const { onReply, reply } = channel();
    const result = waitForNotesFlush({
      request: () => undefined,
      onReply,
      timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(100);
    reply();
    await expect(result).resolves.toBe('timeout');
  });

  it('takes an immediate reply to the request', async () => {
    const { onReply, reply } = channel();
    const result = waitForNotesFlush({
      request: reply,
      onReply,
      timeoutMs: 3000,
    });
    await expect(result).resolves.toBe('flushed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not wait when the request throws', async () => {
    const { onReply, listeners } = channel();
    const result = waitForNotesFlush({
      request: () => {
        throw new Error('webContents destroyed');
      },
      onReply,
      timeoutMs: 3000,
    });
    await expect(result).resolves.toBe('timeout');
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
