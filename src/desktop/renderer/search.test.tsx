import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryDto, IpcResult, SearchResultDto } from '../../shared/ipc';
import { SEARCH_DEBOUNCE_MS, useSearch } from './search';
import { makeEntry } from './test-fixtures';
import { toasts } from './toast-store';

beforeEach(() => {
  vi.useFakeTimers();
  toasts.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Answer = IpcResult<SearchResultDto>;

/** An api whose answers the test resolves by hand, in any order. */
function manualApi() {
  const calls: { text: string; resolve: (answer: Answer) => void }[] = [];
  return {
    calls,
    api: {
      searchEntries: (text: string) =>
        new Promise<Answer>((resolve) => {
          calls.push({ text, resolve });
        }),
    },
  };
}

const ok = (...ids: string[]): Answer => ({ ok: true, data: { ids } });

const entries = (...ids: string[]): readonly EntryDto[] =>
  ids.map((id) => makeEntry(id));

function mount(api: ReturnType<typeof manualApi>['api'], initial: string) {
  return renderHook(({ text, list }) => useSearch(api, text, list), {
    initialProps: { text: initial, list: entries('a') },
  });
}

describe('useSearch', () => {
  it('asks only after the debounce, with the trimmed text', async () => {
    const { api, calls } = manualApi();
    const { result } = mount(api, '  fundal ');

    expect(calls).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));
    expect(calls).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(calls.map((call) => call.text)).toEqual(['fundal']);
    expect(result.current).toBeNull();

    await act(async () => calls[0]?.resolve(ok('x', 'y')));
    expect(result.current).toEqual({ query: 'fundal', ids: ['x', 'y'] });
  });

  it('restarts the pause on every keystroke and asks once', async () => {
    const { api, calls } = manualApi();
    const { rerender } = mount(api, 'f');

    for (const text of ['fu', 'fun', 'fund']) {
      await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 10));
      rerender({ text, list: entries('a') });
    }
    expect(calls).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(calls.map((call) => call.text)).toEqual(['fund']);
  });

  it('drops the answer to an older question', async () => {
    const { api, calls } = manualApi();
    const { result, rerender } = mount(api, 'one');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    rerender({ text: 'two', list: entries('a') });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(calls.map((call) => call.text)).toEqual(['one', 'two']);

    // The newer answer comes first, the older one after it.
    await act(async () => calls[1]?.resolve(ok('two-hit')));
    await act(async () => calls[0]?.resolve(ok('one-hit')));
    expect(result.current).toEqual({ query: 'two', ids: ['two-hit'] });
  });

  it('keeps the shown results until the answer to a new text arrives', async () => {
    const { api, calls } = manualApi();
    const { result, rerender } = mount(api, 'one');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    await act(async () => calls[0]?.resolve(ok('a')));

    rerender({ text: 'one more', list: entries('a') });
    expect(result.current?.query).toBe('one');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    await act(async () => calls[1]?.resolve(ok('b')));
    expect(result.current).toEqual({ query: 'one more', ids: ['b'] });
  });

  it('clears at once on blank text and ignores the answer still in flight', async () => {
    const { api, calls } = manualApi();
    const { result, rerender } = mount(api, 'one');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    await act(async () => calls[0]?.resolve(ok('a')));
    expect(result.current).not.toBeNull();

    rerender({ text: 'two', list: entries('a') });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    rerender({ text: '   ', list: entries('a') });
    expect(result.current).toBeNull();

    await act(async () => calls[1]?.resolve(ok('late')));
    expect(result.current).toBeNull();
    // Typing the same text again starts clean: nothing stale comes back.
    rerender({ text: 'one', list: entries('a') });
    expect(result.current).toBeNull();
  });

  it('does not ask for blank text', async () => {
    const { api, calls } = manualApi();
    const { result } = mount(api, '   ');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 3));
    expect(calls).toHaveLength(0);
    expect(result.current).toBeNull();
  });

  it('asks again at once when the entries change', async () => {
    const { api, calls } = manualApi();
    const { result, rerender } = mount(api, 'fundal');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    await act(async () => calls[0]?.resolve(ok('a')));

    // A new snapshot: no pause this time.
    rerender({ text: 'fundal', list: entries('n', 'a') });
    expect(calls.map((call) => call.text)).toEqual(['fundal', 'fundal']);
    await act(async () => calls[1]?.resolve(ok('n', 'a')));
    expect(result.current).toEqual({ query: 'fundal', ids: ['n', 'a'] });
  });

  it('asks the latest text at once when the entries change during the pause', async () => {
    const { api, calls } = manualApi();
    const { rerender } = mount(api, 'one');
    rerender({ text: 'one two', list: entries('a') });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));
    rerender({ text: 'one two', list: entries('n', 'a') });
    expect(calls.map((call) => call.text)).toEqual(['one two']);
  });

  it('keeps the last results and toasts when a search fails', async () => {
    const { api, calls } = manualApi();
    const { result, rerender } = mount(api, 'one');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    await act(async () => calls[0]?.resolve(ok('a')));

    rerender({ text: 'one', list: entries('n', 'a') });
    await act(async () =>
      calls[1]?.resolve({ ok: false, error: { code: 'INTERNAL' } }),
    );
    expect(result.current).toEqual({ query: 'one', ids: ['a'] });
    expect(toasts.getToasts().map((t) => [t.kind, t.message])).toEqual([
      ['error', 'Căutarea nu a reușit.'],
    ]);
  });

  it('treats a rejected bridge call like a failed search', async () => {
    const api = { searchEntries: () => Promise.reject(new Error('bridge')) };
    renderHook(() => useSearch(api, 'one', entries('a')));
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(toasts.getToasts()).toHaveLength(1);
  });
});
