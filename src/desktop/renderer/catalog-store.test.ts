import { describe, expect, it, vi } from 'vitest';
import type {
  CatalogSnapshotDto,
  EntryDto,
  IpcResult,
  WriteResult,
} from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import {
  createCatalogStore,
  type CatalogState,
  type CatalogStore,
} from './catalog-store';
import { TAPE_LIFETIME_MS } from './catalog-view';
import { makeCategory, makeEntry } from './test-fixtures';
import { createToastStore } from './toast-store';

const tools = makeCategory('c-tools', 'Imagini & video');
const learn = makeCategory('c-learn', 'Backend & API-uri', 'learn');

function snapshot(...entries: EntryDto[]): IpcResult<CatalogSnapshotDto> {
  return {
    ok: true,
    data: { entries, categories: [tools, learn] },
  };
}

/** A store whose snapshot answers are queued by the test. */
function harness() {
  let clock = 1_000_000;
  const toastQueue = createToastStore();
  const answers: (() => Promise<IpcResult<CatalogSnapshotDto>>)[] = [];
  const catalogSnapshot = vi.fn(() => {
    const next = answers.shift();
    if (next === undefined) throw new Error('no snapshot queued');
    return next();
  });
  const store = createCatalogStore(
    { catalogSnapshot },
    { now: () => clock, toasts: toastQueue },
  );
  return {
    store,
    toastQueue,
    catalogSnapshot,
    /** Queues the next answer. */
    next(result: IpcResult<CatalogSnapshotDto>) {
      answers.push(() => Promise.resolve(result));
    },
    /** Queues an answer that the test resolves by hand. */
    nextLater() {
      let resolve: (result: IpcResult<CatalogSnapshotDto>) => void = () => {};
      answers.push(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      return (result: IpcResult<CatalogSnapshotDto>) => resolve(result);
    },
    advance(ms: number) {
      clock += ms;
    },
    get now() {
      return clock;
    },
  };
}

function ready(store: CatalogStore) {
  const state = store.getState();
  if (state.status !== 'ready') throw new Error(`state is ${state.status}`);
  return state;
}

const names = (state: CatalogState) =>
  state.status === 'ready' ? state.entries.map((entry) => entry.name) : [];

function entry(
  id: string,
  overrides: Parameters<typeof makeEntry>[1] = {},
): EntryDto {
  return makeEntry(id, { categories: [tools], ...overrides });
}

describe('catalog store: first load', () => {
  it('is ready without arrivals, pulses or listener calls', async () => {
    const h = harness();
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);
    h.next(snapshot(entry('a'), entry('b')));
    await h.store.load();

    const state = ready(h.store);
    expect(names(state)).toEqual(['a', 'b']);
    expect(state.arrivals.size).toBe(0);
    expect(state.pulses.size).toBe(0);
    expect(arrived).not.toHaveBeenCalled();
    expect(h.toastQueue.getToasts()).toEqual([]);
  });

  it('turns a refusal into the error state', async () => {
    const h = harness();
    h.next({ ok: false, error: { code: 'DATABASE_NEEDS_MIGRATION' } });
    await h.store.load();
    expect(h.store.getState()).toEqual({
      status: 'error',
      code: 'DATABASE_NEEDS_MIGRATION',
    });
  });

  it('turns a bridge failure into INTERNAL', async () => {
    const h = harness();
    h.catalogSnapshot.mockImplementationOnce(() =>
      Promise.reject(new Error('bridge')),
    );
    await h.store.load();
    expect(h.store.getState()).toEqual({ status: 'error', code: 'INTERNAL' });
  });

  it('takes the first success after an error as the baseline', async () => {
    const h = harness();
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);
    h.next({ ok: false, error: { code: 'INTERNAL' } });
    await h.store.load();
    h.next(snapshot(entry('a'), entry('b')));
    await h.store.reload();

    const state = ready(h.store);
    expect(names(state)).toEqual(['a', 'b']);
    expect(state.arrivals.size).toBe(0);
    expect(arrived).not.toHaveBeenCalled();
  });
});

describe('catalog store: classification', () => {
  async function loaded(...entries: EntryDto[]) {
    const h = harness();
    h.next(snapshot(...entries));
    await h.store.load();
    return h;
  }

  it('an unknown id is an arrival, first in the snapshot order', async () => {
    const h = await loaded(entry('a'), entry('b'));
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);
    h.next(snapshot(entry('n'), entry('a'), entry('b')));
    await h.store.reload();

    const state = ready(h.store);
    expect(names(state)).toEqual(['n', 'a', 'b']);
    expect(state.arrivals.get('n')).toBe(h.now);
    expect(state.arrivals.size).toBe(1);
    expect(state.pulses.size).toBe(0);
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(arrived.mock.calls[0]?.[0]).toEqual([entry('n')]);
  });

  it('a higher revision replaces the DTO and pulses once, without an arrival', async () => {
    const h = await loaded(entry('a'), entry('b'));
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);
    h.next(
      snapshot(entry('a', { revision: 2, whatItDoes: 'nou' }), entry('b')),
    );
    await h.store.reload();

    const state = ready(h.store);
    expect(state.entries[0]?.whatItDoes).toBe('nou');
    expect(state.pulses.get('a')).toBe(1);
    expect(state.pulses.has('b')).toBe(false);
    expect(state.arrivals.size).toBe(0);
    expect(arrived).not.toHaveBeenCalled();
    expect(h.toastQueue.getToasts()).toEqual([]);

    h.next(snapshot(entry('a', { revision: 3 }), entry('b')));
    await h.store.reload();
    expect(ready(h.store).pulses.get('a')).toBe(2);
  });

  it('an equal revision pulses nothing', async () => {
    const h = await loaded(entry('a'));
    h.next(snapshot(entry('a')));
    await h.store.reload();
    expect(ready(h.store).pulses.size).toBe(0);
  });

  it('a lower revision keeps the store DTO for that id', async () => {
    const h = await loaded(entry('a', { revision: 5, whatItDoes: 'mine' }));
    h.next(snapshot(entry('a', { revision: 4, whatItDoes: 'older' })));
    await h.store.reload();

    const state = ready(h.store);
    expect(state.entries[0]?.whatItDoes).toBe('mine');
    expect(state.entries[0]?.revision).toBe(5);
    expect(state.pulses.size).toBe(0);
  });

  it('a removed id is gone, with its arrival and pulse', async () => {
    const h = await loaded(entry('a'), entry('b'));
    h.next(snapshot(entry('n'), entry('a', { revision: 2 }), entry('b')));
    await h.store.reload();
    expect(ready(h.store).arrivals.has('n')).toBe(true);
    expect(ready(h.store).pulses.has('a')).toBe(true);

    h.next(snapshot(entry('b')));
    await h.store.reload();
    const state = ready(h.store);
    expect(names(state)).toEqual(['b']);
    expect(state.arrivals.size).toBe(0);
    expect(state.pulses.size).toBe(0);
  });

  it('replaces the categories whole', async () => {
    const h = await loaded(entry('a'));
    h.next({ ok: true, data: { entries: [entry('a')], categories: [learn] } });
    await h.store.reload();
    expect(ready(h.store).categories).toEqual([learn]);
  });

  it('drops an arrival after the tape lifetime, at the next reload', async () => {
    const h = await loaded(entry('a'));
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.has('n')).toBe(true);

    h.advance(TAPE_LIFETIME_MS - 1);
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.has('n')).toBe(true);

    h.advance(1);
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.size).toBe(0);
  });

  it('keeps the arrival time of an arrival across later reloads', async () => {
    const h = await loaded(entry('a'));
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    const arrivedAt = h.now;
    h.advance(5000);
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.get('n')).toBe(arrivedAt);
  });
});

describe('catalog store: failed reload', () => {
  it('keeps the last ready state and shows an error toast', async () => {
    const h = harness();
    h.next(snapshot(entry('a')));
    await h.store.load();
    const before = h.store.getState();

    h.next({ ok: false, error: { code: 'INTERNAL' } });
    await h.store.reload();

    expect(h.store.getState()).toBe(before);
    expect(h.toastQueue.getToasts().map((t) => [t.kind, t.message])).toEqual([
      ['error', appStrings.reloadFailed],
    ]);
  });

  it('classifies against the kept state when a later reload succeeds', async () => {
    const h = harness();
    h.next(snapshot(entry('a')));
    await h.store.load();
    h.next({ ok: false, error: { code: 'INTERNAL' } });
    await h.store.reload();
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.has('n')).toBe(true);
  });
});

describe('catalog store: reload serialization', () => {
  it('runs one more reload after a burst, never in parallel', async () => {
    const h = harness();
    h.next(snapshot(entry('a')));
    await h.store.load();

    const finishFirst = h.nextLater();
    h.next(snapshot(entry('n2'), entry('n1'), entry('a')));
    const first = h.store.reload();
    const second = h.store.reload();
    const third = h.store.reload();
    expect(h.catalogSnapshot).toHaveBeenCalledTimes(2);

    finishFirst(snapshot(entry('n1'), entry('a')));
    await Promise.all([first, second, third]);

    expect(h.catalogSnapshot).toHaveBeenCalledTimes(3);
    expect(names(h.store.getState())).toEqual(['n2', 'n1', 'a']);
  });

  it('the promise of a reload asked meanwhile covers the extra run', async () => {
    const h = harness();
    h.next(snapshot(entry('a')));
    await h.store.load();

    const finishFirst = h.nextLater();
    const finishSecond = h.nextLater();
    const first = h.store.reload();
    const second = h.store.reload();
    let secondDone = false;
    void second.then(() => {
      secondDone = true;
    });

    finishFirst(snapshot(entry('a')));
    // The extra run starts after the first; both promises wait for it.
    await vi.waitFor(() => expect(h.catalogSnapshot).toHaveBeenCalledTimes(3));
    expect(secondDone).toBe(false);
    finishSecond(snapshot(entry('a')));
    await Promise.all([first, second]);
    expect(secondDone).toBe(true);
  });

  it('delivers arrivals once per reload that found them', async () => {
    const h = harness();
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);
    h.next(snapshot(entry('a')));
    await h.store.load();
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it('stops delivering to an unsubscribed listener', async () => {
    const h = harness();
    const arrived = vi.fn();
    const stop = h.store.subscribeArrivals(arrived);
    h.next(snapshot(entry('a')));
    await h.store.load();
    stop();
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(arrived).not.toHaveBeenCalled();
  });
});

describe('catalog store: own writes', () => {
  async function loaded() {
    const h = harness();
    h.next(snapshot(entry('a', { whatItDoes: 'old' }), entry('b')));
    await h.store.load();
    return h;
  }

  function written(...changed: EntryDto[]): IpcResult<WriteResult> {
    return { ok: true, data: { changed } };
  }

  it('applies the changed DTOs, so the reload that follows sees no update', async () => {
    const h = await loaded();
    const arrived = vi.fn();
    h.store.subscribeArrivals(arrived);

    const result = await h.store.write(() =>
      Promise.resolve(
        written(entry('a', { revision: 5, whatItDoes: 'edited' })),
      ),
    );
    expect(result.ok).toBe(true);
    expect(ready(h.store).entries[0]?.whatItDoes).toBe('edited');
    expect(ready(h.store).pulses.size).toBe(0);

    // catalog:changed arrives with the same revision.
    h.next(
      snapshot(entry('a', { revision: 5, whatItDoes: 'edited' }), entry('b')),
    );
    await h.store.reload();

    const state = ready(h.store);
    expect(state.pulses.size).toBe(0);
    expect(state.arrivals.size).toBe(0);
    expect(arrived).not.toHaveBeenCalled();
  });

  it('makes a reload asked during a write wait for it', async () => {
    const h = await loaded();
    let finishWrite: (result: IpcResult<WriteResult>) => void = () => {};
    const write = h.store.write(
      () =>
        new Promise<IpcResult<WriteResult>>((done) => {
          finishWrite = done;
        }),
    );

    h.next(
      snapshot(entry('a', { revision: 5, whatItDoes: 'edited' }), entry('b')),
    );
    const reload = h.store.reload();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.catalogSnapshot).toHaveBeenCalledTimes(1);

    finishWrite(written(entry('a', { revision: 5, whatItDoes: 'edited' })));
    await write;
    await reload;

    expect(h.catalogSnapshot).toHaveBeenCalledTimes(2);
    expect(ready(h.store).pulses.size).toBe(0);
  });

  it('reads again when a write started while the snapshot was in flight', async () => {
    const h = await loaded();
    const finishRead = h.nextLater();
    const reload = h.store.reload();

    let finishWrite: (result: IpcResult<WriteResult>) => void = () => {};
    const write = h.store.write(
      () =>
        new Promise<IpcResult<WriteResult>>((done) => {
          finishWrite = done;
        }),
    );
    // This snapshot already holds the write's revision: it must not be used.
    finishRead(snapshot(entry('a', { revision: 5 }), entry('b')));
    await Promise.resolve();
    await Promise.resolve();
    expect(ready(h.store).pulses.size).toBe(0);

    h.next(snapshot(entry('a', { revision: 5 }), entry('b')));
    finishWrite(written(entry('a', { revision: 5 })));
    await write;
    await reload;

    expect(h.catalogSnapshot).toHaveBeenCalledTimes(3);
    expect(ready(h.store).pulses.size).toBe(0);
  });

  it('ignores a changed DTO older than what it holds', async () => {
    const h = await loaded();
    await h.store.write(() =>
      Promise.resolve(written(entry('a', { revision: 5, whatItDoes: 'five' }))),
    );
    await h.store.write(() =>
      Promise.resolve(written(entry('a', { revision: 4, whatItDoes: 'four' }))),
    );
    expect(ready(h.store).entries[0]?.whatItDoes).toBe('five');
  });

  it('does not add a changed entry the snapshot lacks; the next reload decides', async () => {
    const h = await loaded();
    await h.store.write(() => Promise.resolve(written(entry('z'))));
    expect(names(h.store.getState())).toEqual(['a', 'b']);

    h.next(snapshot(entry('z'), entry('a'), entry('b')));
    await h.store.reload();
    expect(names(h.store.getState())).toEqual(['z', 'a', 'b']);
  });

  it('drops the removed ids with their pulses and arrivals, and applies the changed DTOs', async () => {
    const h = harness();
    h.next(snapshot(entry('a'), entry('b'), entry('c')));
    await h.store.load();
    // b arrives, a is updated from the terminal.
    h.next(
      snapshot(entry('n'), entry('a', { revision: 2 }), entry('b'), entry('c')),
    );
    await h.store.reload();
    expect([...ready(h.store).arrivals.keys()]).toEqual(['n']);
    expect([...ready(h.store).pulses.keys()]).toEqual(['a']);

    const result = await h.store.write(() =>
      Promise.resolve({
        ok: true as const,
        data: {
          changed: [entry('c', { relatedIds: [] })],
          removed: ['n', 'a'],
        },
      }),
    );
    expect(result.ok).toBe(true);
    const state = ready(h.store);
    expect(names(state)).toEqual(['b', 'c']);
    expect(state.arrivals.size).toBe(0);
    expect(state.pulses.size).toBe(0);

    // catalog:changed arrives with the same catalog: nothing is new.
    h.next(snapshot(entry('b'), entry('c')));
    await h.store.reload();
    expect(names(h.store.getState())).toEqual(['b', 'c']);
    expect(ready(h.store).arrivals.size).toBe(0);
  });

  it('ignores a removed id it does not hold', async () => {
    const h = await loaded();
    const before = h.store.getState();
    await h.store.write(() =>
      Promise.resolve({
        ok: true as const,
        data: { changed: [], removed: ['ghost'] },
      }),
    );
    expect(h.store.getState()).toBe(before);
  });

  it('answers a failed write as it is and changes nothing', async () => {
    const h = await loaded();
    const before = h.store.getState();
    const result = await h.store.write(() =>
      Promise.resolve({ ok: false, error: { code: 'ARGUMENTS_INVALID' } }),
    );
    expect(result).toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
    expect(h.store.getState()).toBe(before);
  });

  it('turns a throwing write into INTERNAL and lets reloads go on', async () => {
    const h = await loaded();
    const result = await h.store.write(() => Promise.reject(new Error('x')));
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    h.next(snapshot(entry('a'), entry('b')));
    await h.store.reload();
    expect(h.catalogSnapshot).toHaveBeenCalledTimes(2);
  });
});

describe('catalog store: subscribers', () => {
  it('notifies state subscribers on each change and honors unsubscribe', async () => {
    const h = harness();
    const listener = vi.fn();
    const stop = h.store.subscribe(listener);
    h.next(snapshot(entry('a')));
    await h.store.load();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    h.next(snapshot(entry('a'), entry('b')));
    await h.store.reload();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('catalog store: dismissArrival', () => {
  async function withArrival() {
    const h = harness();
    h.next(snapshot(entry('a')));
    await h.store.load();
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    return h;
  }

  it('drops the arrival and tells the subscribers', async () => {
    const h = await withArrival();
    expect(ready(h.store).arrivals.has('n')).toBe(true);
    const listener = vi.fn();
    h.store.subscribe(listener);

    h.store.dismissArrival('n');

    const state = ready(h.store);
    expect(state.arrivals.has('n')).toBe(false);
    expect(names(state)).toEqual(['n', 'a']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stays gone after the next reload', async () => {
    const h = await withArrival();
    h.store.dismissArrival('n');
    h.next(snapshot(entry('n'), entry('a')));
    await h.store.reload();
    expect(ready(h.store).arrivals.size).toBe(0);
  });

  it('is a no-op for an entry that is not an arrival', async () => {
    const h = await withArrival();
    const listener = vi.fn();
    h.store.subscribe(listener);
    const before = h.store.getState();

    h.store.dismissArrival('a');
    h.store.dismissArrival('unknown');

    expect(h.store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('is a no-op before the catalog is ready', () => {
    const h = harness();
    h.store.dismissArrival('n');
    expect(h.store.getState()).toEqual({ status: 'loading' });
  });
});
