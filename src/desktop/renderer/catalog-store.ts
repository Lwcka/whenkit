import type {
  CategoryDto,
  EntryDto,
  ErrorDto,
  WhenkitApi,
} from '../../shared/ipc';

// The renderer's single catalog store (AD-10): a framework-free external
// store, read through useSyncExternalStore. Every view derives from it.

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; code: ErrorDto['code'] }
  | {
      status: 'ready';
      entries: readonly EntryDto[];
      categories: readonly CategoryDto[];
    };

export interface CatalogStore {
  getState(): CatalogState;
  subscribe(listener: () => void): () => void;
  load(): Promise<void>;
}

export function createCatalogStore(
  api: Pick<WhenkitApi, 'catalogSnapshot'>,
): CatalogStore {
  let state: CatalogState = { status: 'loading' };
  const listeners = new Set<() => void>();

  const set = (next: CatalogState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load() {
      try {
        const result = await api.catalogSnapshot();
        set(
          result.ok
            ? {
                status: 'ready',
                entries: result.data.entries,
                categories: result.data.categories,
              }
            : { status: 'error', code: result.error.code },
        );
      } catch {
        // The bridge itself failed: the handler contract says it never throws.
        set({ status: 'error', code: 'INTERNAL' });
      }
    },
  };
}
