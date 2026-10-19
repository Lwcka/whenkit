import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { EntryDto, WhenkitApi } from '../../shared/ipc';
import { AppError } from './app-error';
import type { CatalogStore } from './catalog-store';
import { createZoom, frameBindings, installKeyboard } from './keyboard';
import { StatusBar } from './status-bar';
import { TitleBar } from './title-bar';
import { ToastHost } from './toast';
import { Toolbar, ZONE_ORDER } from './toolbar';

/** What the frame needs from the bridge. */
export type FrameApi = Pick<
  WhenkitApi,
  'setTheme' | 'setZoomFactor' | 'workspacePath'
>;

export function App({ store, api }: { store: CatalogStore; api: FrameApi }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [zone, setZone] = useState<EntryDto['zone']>('toolbox');

  // The keyboard layer is installed once; the zone state it switches lives here.
  const { setZoomFactor } = api;
  const zoom = useMemo(() => createZoom(setZoomFactor), [setZoomFactor]);
  useEffect(
    () =>
      installKeyboard(
        frameBindings({
          selectZone: (index) => setZone(ZONE_ORDER[index] ?? 'toolbox'),
          zoom,
        }),
      ),
    [zoom],
  );

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <>
        <TitleBar setTheme={api.setTheme} />
        <AppError code={state.code} />
        <ToastHost />
      </>
    );
  }

  // The snapshot arrives in its final order; filtering keeps it.
  const entries = state.entries.filter((entry) => entry.zone === zone);
  const counts = {
    toolbox: state.entries.filter((entry) => entry.zone === 'toolbox').length,
    learn: state.entries.filter((entry) => entry.zone === 'learn').length,
  };

  return (
    <>
      <TitleBar setTheme={api.setTheme} />
      <Toolbar zone={zone} counts={counts} onZoneChange={setZone} />
      <main className="shell">
        <div className="card-grid" role="tabpanel">
          {entries.map((entry) => (
            <article key={entry.id} className="card">
              <h2>{entry.name}</h2>
              <p>{entry.whatItDoes}</p>
            </article>
          ))}
        </div>
      </main>
      <StatusBar
        count={state.entries.length}
        lastAddedAt={state.entries[0]?.addedAt ?? null}
        workspacePath={api.workspacePath}
      />
      <ToastHost />
    </>
  );
}
