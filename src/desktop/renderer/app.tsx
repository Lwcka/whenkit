import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { WhenkitApi } from '../../shared/ipc';
import { appStrings, entryStrings, zoneLabels } from '../../shared/strings.ro';
import { AppError } from './app-error';
import { CardGrid, SkeletonGrid } from './card-grid';
import type { CatalogStore } from './catalog-store';
import {
  arrivalToasts,
  barCategories,
  categoryCounts,
  categorySlots,
  entriesInView,
  isNew,
  neighborCategoryId,
  viewCategoryId,
  type Zone,
} from './catalog-view';
import { CategoryBar, type CategoryBarItem } from './category-bar';
import { EmptyState } from './empty-state';
import { createZoom, frameBindings, installKeyboard } from './keyboard';
import { SectionHeader } from './section-header';
import { StatusBar } from './status-bar';
import { TitleBar } from './title-bar';
import { ToastHost } from './toast';
import { toasts } from './toast-store';
import { Toolbar, ZONE_ORDER } from './toolbar';

/** What the frame needs from the bridge. */
export type FrameApi = Pick<
  WhenkitApi,
  'setTheme' | 'setZoomFactor' | 'workspacePath'
>;

/** DESIGN motion.skeleton-delay (200 ms), mirrored from tokens.css for the timer. */
export const SKELETON_DELAY_MS = 200;

/** The arrival tape's clock ticks once a second (EXPERIENCE: „acum 3 s” → „acum 4 s”). */
const TAPE_TICK_MS = 1000;

/** What the view shows when there are no arrivals. */
const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/** The category each zone showed last (kept while the app runs, not across restarts). */
type CategoryByZone = Readonly<Record<Zone, string | null>>;

/** True once `active` has been true for `ms` without a break. */
function useElapsed(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && elapsed;
}

export function App({ store, api }: { store: CatalogStore; api: FrameApi }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [zone, setZone] = useState<Zone>('toolbox');
  const [categoryByZone, setCategoryByZone] = useState<CategoryByZone>({
    toolbox: null,
    learn: null,
  });
  const slowStart = useElapsed(state.status === 'loading', SKELETON_DELAY_MS);

  const selectedId =
    state.status === 'ready'
      ? viewCategoryId(state.categories, zone, categoryByZone[zone])
      : null;
  const selectCategory = (id: string | null) =>
    setCategoryByZone((previous) => ({ ...previous, [zone]: id }));
  const viewKey = `${zone}:${selectedId ?? ''}`;

  // The entries the view lists, and which of them still wear their tape. The
  // clock runs only while one does: a second-by-second tick for nothing else.
  const arrivals = state.status === 'ready' ? state.arrivals : NO_COUNTS;
  const pulses = state.status === 'ready' ? state.pulses : NO_COUNTS;
  const entries =
    state.status === 'ready'
      ? entriesInView(state.entries, zone, selectedId)
      : [];
  const [now, setNow] = useState(() => Date.now());
  // The clock is stale while no tape is visible: bring it up to date before
  // paint whenever the view or the arrivals change, so an arrival older than
  // the tape lifetime never shows its tape for a frame.
  useLayoutEffect(() => {
    setNow(Date.now());
  }, [viewKey, arrivals]);
  const freshInView = entries.filter((entry) => {
    const arrivedAt = arrivals.get(entry.id);
    return arrivedAt !== undefined && isNew(arrivedAt, now);
  }).length;
  const tapeVisible = freshInView > 0;
  useEffect(() => {
    if (!tapeVisible) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TAPE_TICK_MS);
    return () => clearInterval(timer);
  }, [tapeVisible]);

  // Every import that lands makes one toast per zone; „Vezi” opens that zone
  // at Toate.
  useEffect(
    () =>
      store.subscribeArrivals((arrived) => {
        const see = (target: Zone) => {
          setZone(target);
          setCategoryByZone((previous) => ({ ...previous, [target]: null }));
        };
        for (const toast of arrivalToasts(arrived, see)) toasts.push(toast);
      }),
    [store],
  );

  // A new view remounts the grid (and, across zones, the bar), which would drop
  // the focus to <body>. Where the focus was last decides where it goes back:
  // the new grid's Tab stop, or the checked chip.
  const focusArea = useRef<'grid' | 'bar' | null>(null);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      focusArea.current =
        target instanceof Element
          ? target.closest('.card-grid')
            ? 'grid'
            : target.closest('.category-bar')
              ? 'bar'
              : null
          : null;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  const shownViewKey = useRef(viewKey);
  useLayoutEffect(() => {
    if (shownViewKey.current === viewKey) return;
    shownViewKey.current = viewKey;
    const selector =
      focusArea.current === 'grid'
        ? '.card-grid:not([data-skeleton]) .entry-card[tabindex="0"]'
        : focusArea.current === 'bar'
          ? '.category-bar [role="radio"][aria-checked="true"]'
          : null;
    if (selector !== null)
      document.querySelector<HTMLElement>(selector)?.focus();
  }, [viewKey]);

  // The keyboard layer is installed once; what [ and ] do depends on the view,
  // so the binding calls through a ref that always holds the current action.
  const moveCategory = useRef<(delta: -1 | 1) => void>(() => {});
  useEffect(() => {
    moveCategory.current = (delta) => {
      if (state.status !== 'ready') return;
      selectCategory(
        neighborCategoryId(
          barCategories(state.categories, zone),
          selectedId,
          delta,
        ),
      );
    };
  });

  const { setZoomFactor } = api;
  const zoom = useMemo(() => createZoom(setZoomFactor), [setZoomFactor]);
  useEffect(
    () =>
      installKeyboard(
        frameBindings({
          selectZone: (index) => setZone(ZONE_ORDER[index] ?? 'toolbox'),
          zoom,
          moveCategory: (delta) => moveCategory.current(delta),
        }),
      ),
    [zoom],
  );

  if (state.status === 'loading') {
    // Only the title bar until the snapshot is late enough to show a skeleton.
    return (
      <>
        <TitleBar setTheme={api.setTheme} />
        {slowStart && (
          <main className="shell">
            <div className="shell-scroll">
              <SkeletonGrid />
            </div>
          </main>
        )}
      </>
    );
  }
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
  const slots = categorySlots(state.categories);
  const bar = barCategories(state.categories, zone);
  const counts = categoryCounts(state.entries, zone);
  const zoneEntries = entriesInView(state.entries, zone, null);
  const selected = bar.find((category) => category.id === selectedId);

  const items: CategoryBarItem[] = [
    {
      id: null,
      name: appStrings.allCategories,
      count: zoneEntries.length,
      slot: null,
    },
    ...bar.map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) ?? 0,
      slot: slots.get(category.id) ?? null,
    })),
  ];
  const tabCounts = {
    toolbox: state.entries.filter((entry) => entry.zone === 'toolbox').length,
    learn: state.entries.filter((entry) => entry.zone === 'learn').length,
  };

  return (
    <>
      <TitleBar setTheme={api.setTheme} />
      <Toolbar zone={zone} counts={tabCounts} onZoneChange={setZone} />
      <div className="list-view" role="tabpanel" aria-label={zoneLabels[zone]}>
        <CategoryBar
          key={zone}
          items={items}
          selectedId={selectedId}
          onSelect={selectCategory}
        />
        <main className="shell">
          <div key={viewKey} className="shell-scroll">
            <SectionHeader
              name={selected?.name ?? appStrings.allCategories}
              slot={
                selected === undefined ? null : (slots.get(selected.id) ?? null)
              }
              count={entries.length}
              fresh={freshInView}
            />
            {entries.length > 0 ? (
              <CardGrid
                entries={entries}
                slots={slots}
                viewKey={viewKey}
                arrivals={arrivals}
                pulses={pulses}
                now={now}
              />
            ) : state.entries.length === 0 ? (
              <EmptyState
                size="big"
                title={entryStrings.emptyCatalog}
                text={appStrings.emptyCatalogText}
                command={{
                  highlight: appStrings.emptyCatalogCommand,
                  rest: appStrings.emptyCatalogCommandRest,
                }}
              />
            ) : (
              <EmptyState
                size="small"
                title={appStrings.emptyViewTitle(
                  selected?.name ?? zoneLabels[zone],
                )}
              />
            )}
          </div>
        </main>
      </div>
      <StatusBar
        count={state.entries.length}
        lastAddedAt={state.entries[0]?.addedAt ?? null}
        workspacePath={api.workspacePath}
      />
      <ToastHost />
    </>
  );
}
