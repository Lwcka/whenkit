import { describe, expect, it, vi } from 'vitest';
import { flushAllNotes, registerNotesFlush } from './notes-flush';

describe('notes flush registry', () => {
  it('runs every registered flush and waits for all of them', async () => {
    const order: string[] = [];
    const slow = vi.fn(async () => {
      await Promise.resolve();
      await Promise.resolve();
      order.push('slow');
    });
    const quick = vi.fn(() => {
      order.push('quick');
      return Promise.resolve();
    });
    const off = [registerNotesFlush(slow), registerNotesFlush(quick)];
    await flushAllNotes();
    expect(order).toEqual(['quick', 'slow']);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(quick).toHaveBeenCalledTimes(1);
    for (const unregister of off) unregister();
  });

  it('does not call a flush after it is unregistered', async () => {
    const flush = vi.fn(() => Promise.resolve());
    registerNotesFlush(flush)();
    await flushAllNotes();
    expect(flush).not.toHaveBeenCalled();
  });

  it('swallows a failing flush and still runs the others', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('locked')));
    const fine = vi.fn(() => Promise.resolve());
    const off = [registerNotesFlush(failing), registerNotesFlush(fine)];
    await expect(flushAllNotes()).resolves.toBeUndefined();
    expect(fine).toHaveBeenCalledTimes(1);
    for (const unregister of off) unregister();
  });

  it('resolves at once with nothing registered', async () => {
    await expect(flushAllNotes()).resolves.toBeUndefined();
  });
});
