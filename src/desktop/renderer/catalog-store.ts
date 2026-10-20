import type {
  CatalogSnapshotDto,
  CategoryDto,
  EntryDto,
  ErrorDto,
  IpcResult,
  WhenkitApi,
  WriteResult,
} from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { TAPE_LIFETIME_MS } from './catalog-view';
import { toasts as windowToasts, type ToastStore } from './toast-store';

// The renderer's single catalog store (AD-10): a framework-free external
// store, read through useSyncExternalStore. Every view derives from it.
//
// A reload replaces the snapshot whole. Against the entries it already holds,
// the new snapshot is classified by `id` and `revision` only: an unknown id is
// an arrival (only an import creates entries), a higher revision is an update
// from the terminal, a lower one keeps the store's own DTO. The first good
// snapshot of the process is the baseline and classifies nothing.

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; code: ErrorDto['code'] }
  | {
      status: 'ready';
      entries: readonly EntryDto[];
      categories: readonly CategoryDto[];
      /** When each fresh arrival came in (ms), by id; expired ones are dropped on reload. */
      arrivals: ReadonlyMap<string, number>;
      /** How many updates from the terminal each entry has had since the baseline. */
      pulses: ReadonlyMap<string, number>;
    };

export interface CatalogStore {
  getState(): CatalogState;
  subscribe(listener: () => void): () => void;
  /** The first load of the process; the same as `reload`. */
  load(): Promise<void>;
  /**
   * Reads the snapshot again. Reloads never run in parallel: one asked while
   * another runs makes exactly one more run after it. A reload also waits for
   * the writes in flight, so it never sees a write before the write's own
   * answer was applied. Never rejects.
   */
  reload(): Promise<void>;
  /**
   * Runs a write (an IPC call that answers with `changed`, and `removed` for
   * a delete) and applies the entries it changed or removed before anything
   * is compared again.
   */
  write<T extends WriteResult>(
    run: () => Promise<IpcResult<T>>,
  ): Promise<IpcResult<T>>;
  /** Calls `listener` with the entries of each reload that found arrivals. */
  subscribeArrivals(
    listener: (arrived: readonly EntryDto[]) => void,
  ): () => void;
  /**
   * The entry was opened: its arrival (tape, ring, „· N nou” count) is over for
   * good. A no-op when the entry is not a fresh arrival.
   */
  dismissArrival(id: string): void;
}

export interface CatalogStoreOptions {
  /** The clock of the arrivals, in ms; `Date.now` by default. */
  now?: () => number;
  /** Where a failed reload shows its error; the window's queue by default. */
  toasts?: Pick<ToastStore, 'push'>;
}

const INTERNAL: { ok: false; error: ErrorDto } = {
  ok: false,
  error: { code: 'INTERNAL' },
};

export function createCatalogStore(
  api: Pick<WhenkitApi, 'catalogSnapshot'>,
  { now = Date.now, toasts = windowToasts }: CatalogStoreOptions = {},
): CatalogStore {
  let state: CatalogState = { status: 'loading' };
  /** Whether a good snapshot was already taken: only then can one hold arrivals. */
  let baselined = false;
  const listeners = new Set<() => void>();
  const arrivalListeners = new Set<(arrived: readonly EntryDto[]) => void>();

  const set = (next: CatalogState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const fetchSnapshot = async (): Promise<IpcResult<CatalogSnapshotDto>> => {
    try {
      return await api.catalogSnapshot();
    } catch {
      // The bridge itself failed: the handler contract says it never throws.
      return INTERNAL;
    }
  };

  /** Puts a good snapshot in the store; returns the entries that arrived. */
  const applySnapshot = (snapshot: CatalogSnapshotDto): EntryDto[] => {
    if (state.status !== 'ready' || !baselined) {
      baselined = true;
      set({
        status: 'ready',
        entries: snapshot.entries,
        categories: snapshot.categories,
        arrivals: new Map(),
        pulses: new Map(),
      });
      return [];
    }
    const known = new Map(state.entries.map((entry) => [entry.id, entry]));
    const present = new Set(snapshot.entries.map((entry) => entry.id));
    const at = now();
    const arrivals = new Map<string, number>();
    for (const [id, arrivedAt] of state.arrivals) {
      if (present.has(id) && at - arrivedAt < TAPE_LIFETIME_MS) {
        arrivals.set(id, arrivedAt);
      }
    }
    const pulses = new Map<string, number>();
    for (const [id, count] of state.pulses) {
      if (present.has(id)) pulses.set(id, count);
    }
    const arrived: EntryDto[] = [];
    const entries = snapshot.entries.map((entry) => {
      const before = known.get(entry.id);
      if (before === undefined) {
        arrived.push(entry);
        arrivals.set(entry.id, at);
        return entry;
      }
      if (entry.revision > before.revision) {
        pulses.set(entry.id, (pulses.get(entry.id) ?? 0) + 1);
        return entry;
      }
      // A lower revision is older than what the store already shows.
      return entry.revision < before.revision ? before : entry;
    });
    set({
      status: 'ready',
      entries,
      categories: snapshot.categories,
      arrivals,
      pulses,
    });
    return arrived;
  };

  let pendingWrites = 0;
  let idleWaiters: (() => void)[] = [];
  const writesIdle = (): Promise<void> =>
    pendingWrites === 0
      ? Promise.resolve()
      : new Promise((resolve) => idleWaiters.push(resolve));

  /**
   * Applies what a write changed (the entries it rewrote, the ids it deleted),
   * so it is known before the next reload.
   */
  const applyChanged = ({ changed, removed = [] }: WriteResult) => {
    if (state.status !== 'ready') return;
    let entries = state.entries;
    for (const dto of changed) {
      const index = entries.findIndex((entry) => entry.id === dto.id);
      const before = entries[index];
      // An id the snapshot lacks is left to the next reload: only the
      // snapshot orders entries (AD-10).
      if (before !== undefined && dto.revision >= before.revision) {
        entries = entries.map((entry, at) => (at === index ? dto : entry));
      }
    }
    const gone = new Set(removed);
    if (gone.size > 0 && entries.some((entry) => gone.has(entry.id))) {
      entries = entries.filter((entry) => !gone.has(entry.id));
      const arrivals = new Map(
        [...state.arrivals].filter(([id]) => !gone.has(id)),
      );
      const pulses = new Map([...state.pulses].filter(([id]) => !gone.has(id)));
      set({ ...state, entries, arrivals, pulses });
      return;
    }
    if (entries !== state.entries) set({ ...state, entries });
  };

  const refresh = async () => {
    let result: IpcResult<CatalogSnapshotDto>;
    do {
      // The snapshot is asked for at once when no write is in flight.
      if (pendingWrites > 0) await writesIdle();
      result = await fetchSnapshot();
      // A write that started while the snapshot was read may be in it without
      // its answer applied: read again once it has settled.
    } while (pendingWrites > 0);
    if (!result.ok) {
      if (state.status === 'ready') {
        // The last good catalog stays on screen.
        toasts.push({ kind: 'error', message: appStrings.reloadFailed });
      } else {
        set({ status: 'error', code: result.error.code });
      }
      return;
    }
    const arrived = applySnapshot(result.data);
    if (arrived.length > 0) {
      for (const listener of arrivalListeners) listener(arrived);
    }
  };

  let running: Promise<void> | null = null;
  let again = false;
  const reload = (): Promise<void> => {
    if (running !== null) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await refresh();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: reload,
    reload,
    async write(run) {
      pendingWrites++;
      try {
        const result = await run();
        if (result.ok) applyChanged(result.data);
        return result;
      } catch {
        return INTERNAL;
      } finally {
        pendingWrites--;
        if (pendingWrites === 0) {
          const waiters = idleWaiters;
          idleWaiters = [];
          for (const resolve of waiters) resolve();
        }
      }
    },
    subscribeArrivals(listener) {
      arrivalListeners.add(listener);
      return () => {
        arrivalListeners.delete(listener);
      };
    },
    dismissArrival(id) {
      if (state.status !== 'ready' || !state.arrivals.has(id)) return;
      const arrivals = new Map(state.arrivals);
      arrivals.delete(id);
      set({ ...state, arrivals });
    },
  };
}
