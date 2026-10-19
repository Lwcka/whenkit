import { useState, useSyncExternalStore } from 'react';
import { appStrings, zoneLabels } from '../../shared/strings.ro';
import type { EntryDto } from '../../shared/ipc';
import { AppError } from './app-error';
import type { CatalogStore } from './catalog-store';

const ZONE_ORDER: readonly EntryDto['zone'][] = ['toolbox', 'learn'];

export function App({ store }: { store: CatalogStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [zone, setZone] = useState<EntryDto['zone']>('toolbox');

  if (state.status === 'loading') return null;
  if (state.status === 'error') return <AppError code={state.code} />;

  // The snapshot arrives in its final order; filtering keeps it.
  const entries = state.entries.filter((entry) => entry.zone === zone);

  return (
    <main className="shell">
      <div role="tablist" aria-label={appStrings.tablistLabel}>
        {ZONE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={zone === id}
            onClick={() => setZone(id)}
          >
            {zoneLabels[id]}
          </button>
        ))}
      </div>
      <div className="card-grid" role="tabpanel">
        {entries.map((entry) => (
          <article key={entry.id} className="card">
            <h2>{entry.name}</h2>
            <p>{entry.whatItDoes}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
