import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogStore } from '../src/core/ports';
import { watchCatalog } from '../src/desktop/main/catalog-watch';
import { batch, importReport, initialized, tool } from './cli-harness';
import { testStoreOpener } from './helpers';

// AD-10 end to end: the window's connection notices what the CLI writes on
// another connection, and does not notice what it writes itself.

const stores: CatalogStore[] = [];

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

/** The window's own connection: opened for writing, without migrating. */
function windowStore(dbPath: string): CatalogStore {
  const store = testStoreOpener({ idSeries: '9100' })(dbPath, {
    migrate: false,
  });
  stores.push(store);
  return store;
}

/** A watcher whose polls the test fires by hand. */
function watched(store: CatalogStore) {
  let tick: () => void = () => {};
  const emit = vi.fn();
  watchCatalog({
    readVersion: () => store.dataVersion(),
    emit,
    intervalMs: 2000,
    logError: (error) => {
      throw error;
    },
    timers: {
      setInterval: (callback) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {},
    },
  });
  return { emit, poll: () => tick() };
}

describe('data_version', () => {
  it('changes when the CLI imports on another connection, and the watcher emits once', async () => {
    const s = await initialized();
    const store = windowStore(s.dbPath);
    const before = store.dataVersion();
    const { emit, poll } = watched(store);

    poll();
    expect(emit).not.toHaveBeenCalled();

    await importReport(s, batch([tool('a')]));
    expect(store.dataVersion()).not.toBe(before);

    poll();
    expect(emit).toHaveBeenCalledTimes(1);
    poll();
    expect(emit).toHaveBeenCalledTimes(1);

    await importReport(s, batch([tool('b')]));
    poll();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('does not change for a write on the watched connection itself', async () => {
    const s = await initialized();
    const store = windowStore(s.dbPath);
    const before = store.dataVersion();
    const { emit, poll } = watched(store);

    store.writeTransaction((writer) =>
      writer.insertRejection({
        id: 'r1',
        dedupKey: 'url:example.com',
        op: 'add',
        element: { ref: 'x' },
        reasons: [],
        batchSchemaVersion: 1,
        rejectedAt: '2026-10-13T12:00:00.000Z',
      }),
    );

    expect(store.dataVersion()).toBe(before);
    poll();
    expect(emit).not.toHaveBeenCalled();
  });
});
