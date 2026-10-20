import { describe, expect, it, vi } from 'vitest';
import { openExternalResult } from './external-link';

describe('openExternalResult', () => {
  it.each(['https://a.b', 'http://a.b'])('opens %s once', async (url) => {
    const open = vi.fn(() => Promise.resolve());
    const result = await openExternalResult(url, open, vi.fn());
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(url);
    expect(result).toEqual({ ok: true, data: null });
  });

  it.each(['javascript:x', 'file:///c', '', 42, 'not a url', null, undefined])(
    'refuses %j without opening',
    async (url) => {
      const open = vi.fn(() => Promise.resolve());
      const result = await openExternalResult(url, open, vi.fn());
      expect(open).not.toHaveBeenCalled();
      expect(result).toEqual({
        ok: false,
        error: { code: 'ARGUMENTS_INVALID' },
      });
    },
  );

  it('answers INTERNAL and logs when opening fails', async () => {
    const failure = new Error('no browser');
    const logError = vi.fn();
    const result = await openExternalResult(
      'https://a.b',
      () => Promise.reject(failure),
      logError,
    );
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(logError).toHaveBeenCalledWith(failure);
  });

  it('still answers when opening throws synchronously and the logger throws', async () => {
    const result = await openExternalResult(
      'https://a.b',
      () => {
        throw new Error('boom');
      },
      () => {
        throw new Error('log failed');
      },
    );
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
});
