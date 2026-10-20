import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { EntryDto, WhenkitApi } from '../../shared/ipc';
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
  searchHits,
  sheetCrumbs,
  viewCategoryId,
  type Zone,
} from './catalog-view';
import { CategoryBar, type CategoryBarItem } from './category-bar';
import { EmptyState } from './empty-state';
import { EntrySheet } from './entry-sheet';
import {
  ESCAPE_PRIORITY,
  createZoom,
  frameBindings,
  installKeyboard,
  registerEscape,
} from './keyboard';
import { useSearch } from './search';
import { SectionHeader } from './section-header';
import { SheetBar } from './sheet-bar';
import { StatusBar } from './status-bar';
import { TitleBar } from './title-bar';
import { ToastHost } from './toast';
import { toasts } from './toast-store';
import { Toolbar, ZONE_ORDER } from './toolbar';

/** What the frame needs from the bridge. */
export type FrameApi = Pick<
  WhenkitApi,
  | 'openExternal'
  | 'searchEntries'
  | 'setNotes'
  | 'setTheme'
  | 'setZoomFactor'
  | 'workspacePath'
>;

/** DESIGN motion.skeleton-delay (200 ms), mirrored from tokens.css for the timer. */
export const SKELETON_DELAY_MS = 200;

/** The arrival tape's clock ticks once a second (EXPERIENCE: „acum 3 s” → „acum 4 s”). */
const TAPE_TICK_MS = 1000;

/** What the search is given before the snapshot is ready. */
const NO_ENTRIES: readonly EntryDto[] = [];

/** What the view shows when there are no arrivals. */
const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/** The category each zone showed last (kept while the app runs, not across restarts). */
type CategoryByZone = Readonly<Record<Zone, string | null>>;

/** Where the list stood when a sheet opened over it. */
interface Origin {
  /** The work area's scroll position. */
  scrollTop: number;
  /** The card the sheet was opened from. */
  cardId: string | null;
}

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

  // The sheets on screen: a stack of entry ids whose top is shown in place of
  // the list. The list view itself (zone, category, search text) is untouched
  // while it shows, so only the scroll and the origin card need saving.
  const [stack, setStack] = useState<readonly string[]>([]);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const byId = useMemo(
    () =>
      new Map(
        (state.status === 'ready' ? state.entries : NO_ENTRIES).map(
          (candidate) => [candidate.id, candidate],
        ),
      ),
    [state],
  );
  // An entry that left the catalog leaves the stack.
  const liveStack =
    state.status === 'ready' ? stack.filter((id) => byId.has(id)) : stack;
  const shownEntry = byId.get(liveStack[liveStack.length - 1] ?? '');
  const sheetOpen = shownEntry !== undefined;
  const staleStack = liveStack.length !== stack.length;
  useEffect(() => {
    if (staleStack) setStack(liveStack);
  });
  // The zone tab follows the entry on screen; the list's own zone is kept.
  const shownZone: Zone = shownEntry?.zone ?? zone;

  // One search text for both zones. The category each zone showed before is
  // kept untouched, so clearing the search returns to it.
  const [searchText, setSearchText] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const found = useSearch(
    api,
    searchText,
    state.status === 'ready' ? state.entries : NO_ENTRIES,
  );
  const searching = found !== null;

  const selectedId =
    state.status === 'ready'
      ? viewCategoryId(state.categories, zone, categoryByZone[zone])
      : null;
  // Picking a category ends the search.
  const selectCategory = (id: string | null) => {
    setSearchText('');
    setCategoryByZone((previous) => ({ ...previous, [zone]: id }));
  };
  // The results are a view of their own: a new shown query cascades again.
  const viewKey = searching
    ? `${zone}:q:${found.query}`
    : `${zone}:${selectedId ?? ''}`;

  // The entries the view lists, and which of them still wear their tape. The
  // clock runs only while one does: a second-by-second tick for nothing else.
  const arrivals = state.status === 'ready' ? state.arrivals : NO_COUNTS;
  const pulses = state.status === 'ready' ? state.pulses : NO_COUNTS;
  const hits =
    state.status === 'ready' && found !== null
      ? searchHits(state.entries, found.ids, zone)
      : null;
  const entries =
    state.status !== 'ready'
      ? []
      : hits !== null
        ? hits.inZone
        : entriesInView(state.entries, zone, selectedId);
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

  // Leaving the sheets for good: the origin is forgotten, so the list does not
  // restore it.
  const closeSheet = useCallback(() => {
    setStack((previous) => (previous.length > 0 ? [] : previous));
    setOrigin(null);
  }, []);
  // Opening an entry ends its arrival. From the list the stack starts and the
  // origin is saved; from a sheet the entry is pushed.
  const openEntry = (id: string) => {
    if (!byId.has(id)) return;
    store.dismissArrival(id);
    if (!sheetOpen) {
      const scroller = document.querySelector<HTMLElement>(
        '.list-view .shell-scroll',
      );
      setOrigin({ scrollTop: scroller?.scrollTop ?? 0, cardId: id });
      setStack([id]);
    } else if (liveStack[liveStack.length - 1] !== id) {
      setStack([...liveStack, id]);
    }
  };
  // Back pops one sheet; popping the last one restores the list (below).
  const goBack = () => setStack(liveStack.slice(0, -1));
  // The long-lived listeners (toasts, Esc, keys, mouse) call through refs that
  // always hold the current closures.
  const openRef = useRef(openEntry);
  const backRef = useRef(goBack);
  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => {
    openRef.current = openEntry;
    backRef.current = goBack;
    sheetOpenRef.current = sheetOpen;
  });

  // Every import that lands makes one toast per zone; „Vezi” opens that zone
  // at Toate, and a single arrival's „Deschide” opens its sheet.
  useEffect(
    () =>
      store.subscribeArrivals((arrived) => {
        const see = (target: Zone) => {
          closeSheet();
          setSearchText('');
          setZone(target);
          setCategoryByZone((previous) => ({ ...previous, [target]: null }));
        };
        const open = (id: string) => openRef.current(id);
        for (const toast of arrivalToasts(arrived, see, open))
          toasts.push(toast);
      }),
    [store, closeSheet],
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
      // The category bar is not on screen while a sheet shows.
      if (state.status !== 'ready' || sheetOpen) return;
      selectCategory(
        neighborCategoryId(
          barCategories(state.categories, zone),
          selectedId,
          delta,
        ),
      );
    };
  });

  // Esc clears the search: first from the box (priority 3), then from
  // anywhere in the list (priority 1). The handlers read the text through a
  // ref, so they are registered once.
  const searchTextNow = useRef(searchText);
  useEffect(() => {
    searchTextNow.current = searchText;
  });
  useEffect(() => {
    const clear = () => setSearchText('');
    const hasText = () => searchTextNow.current !== '';
    const unregister = [
      registerEscape(
        ESCAPE_PRIORITY.searchWithText,
        () => hasText() && document.activeElement === searchInput.current,
        clear,
      ),
      registerEscape(ESCAPE_PRIORITY.activeSearch, hasText, clear),
      registerEscape(
        ESCAPE_PRIORITY.openSheet,
        () => sheetOpenRef.current,
        () => backRef.current(),
      ),
    ];
    return () => {
      for (const off of unregister) off();
    };
  }, []);

  // The mouse's back button goes back one sheet too.
  useEffect(() => {
    const MOUSE_BACK = 3;
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === MOUSE_BACK && sheetOpenRef.current)
        event.preventDefault();
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== MOUSE_BACK || !sheetOpenRef.current) return;
      event.preventDefault();
      backRef.current();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // The window title names the entry on screen (Electron follows it).
  const shownName = shownEntry?.name ?? null;
  useEffect(() => {
    document.title =
      shownName === null
        ? appStrings.productName
        : appStrings.sheetWindowTitle(shownName);
  }, [shownName]);

  // The last sheet closed: the list is back as it was left, with the same
  // scroll and the card the sheet was opened from focused.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = sheetOpen;
    if (!was || sheetOpen || origin === null) return;
    const scroller = document.querySelector<HTMLElement>(
      '.list-view .shell-scroll',
    );
    if (scroller !== null) scroller.scrollTop = origin.scrollTop;
    const card = Array.from(
      document.querySelectorAll<HTMLElement>('.card-grid .entry-card'),
    ).find((candidate) => candidate.dataset.entryId === origin.cardId);
    card?.focus({ preventScroll: true });
    setOrigin(null);
  }, [sheetOpen, origin]);

  // Switching zones, from the tabs or Ctrl+1/2, leaves the sheets.
  const changeZone = useCallback(
    (target: Zone) => {
      closeSheet();
      setZone(target);
    },
    [closeSheet],
  );
  // Typing a search from a sheet goes back to the list, in the zone on screen.
  const changeSearch = (text: string) => {
    if (sheetOpen) {
      setZone(shownZone);
      closeSheet();
    }
    setSearchText(text);
  };

  const { setZoomFactor } = api;
  const zoom = useMemo(() => createZoom(setZoomFactor), [setZoomFactor]);
  useEffect(
    () =>
      installKeyboard(
        frameBindings({
          selectZone: (index) => changeZone(ZONE_ORDER[index] ?? 'toolbox'),
          zoom,
          moveCategory: (delta) => moveCategory.current(delta),
          focusSearch: () => {
            searchInput.current?.focus();
            searchInput.current?.select();
          },
          back: () => backRef.current(),
          sheetOpen: () => sheetOpenRef.current,
        }),
      ),
    [zoom, changeZone],
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
  // „+2 în Learn”: the same text, in the other zone.
  const otherZone: Zone = zone === 'toolbox' ? 'learn' : 'toolbox';
  const otherZoneAction =
    hits !== null && hits.otherZone > 0
      ? {
          label: appStrings.searchOtherZone(
            hits.otherZone,
            zoneLabels[otherZone],
          ),
          onClick: () => {
            // The view remounts: put the focus on the new zone's grid.
            focusArea.current = 'grid';
            setZone(otherZone);
          },
        }
      : undefined;
  const tabCounts = {
    toolbox: state.entries.filter((entry) => entry.zone === 'toolbox').length,
    learn: state.entries.filter((entry) => entry.zone === 'learn').length,
  };

  return (
    <>
      <TitleBar setTheme={api.setTheme} />
      <Toolbar
        zone={shownZone}
        counts={tabCounts}
        onZoneChange={changeZone}
        search={{
          text: searchText,
          onChange: changeSearch,
          inputRef: searchInput,
        }}
      />
      {shownEntry !== undefined ? (
        <div
          className="sheet-view"
          role="tabpanel"
          aria-label={zoneLabels[shownZone]}
        >
          <SheetBar crumbs={sheetCrumbs(shownEntry)} onBack={goBack} />
          <main className="shell">
            <div key={shownEntry.id} className="shell-scroll">
              <EntrySheet
                entry={shownEntry}
                entries={state.entries}
                slots={slots}
                pulses={pulses.get(shownEntry.id) ?? 0}
                onOpen={openEntry}
                onOpenExternal={(url) => void api.openExternal(url)}
                onSaveNotes={(id, notes) =>
                  store.write(() => api.setNotes(id, notes))
                }
              />
            </div>
          </main>
        </div>
      ) : (
        <div
          className="list-view"
          role="tabpanel"
          aria-label={zoneLabels[zone]}
        >
          <CategoryBar
            key={zone}
            items={items}
            selectedId={selectedId}
            searching={searching}
            onSelect={selectCategory}
          />
          <main className="shell">
            <div key={viewKey} className="shell-scroll">
              <SectionHeader
                name={
                  found !== null
                    ? appStrings.searchResultsTitle(found.query)
                    : (selected?.name ?? appStrings.allCategories)
                }
                slot={
                  selected === undefined || searching
                    ? null
                    : (slots.get(selected.id) ?? null)
                }
                count={entries.length}
                fresh={freshInView}
                action={entries.length > 0 ? otherZoneAction : undefined}
              />
              {entries.length > 0 ? (
                <CardGrid
                  entries={entries}
                  slots={slots}
                  viewKey={viewKey}
                  arrivals={arrivals}
                  pulses={pulses}
                  now={now}
                  onOpen={openEntry}
                  initialActiveId={origin?.cardId ?? undefined}
                />
              ) : found !== null ? (
                <EmptyState
                  size="small"
                  title={appStrings.searchNothing(
                    found.query,
                    zoneLabels[zone],
                  )}
                  text={appStrings.searchedEverything}
                  command={{
                    lead: appStrings.searchAskClaude,
                    highlight: appStrings.searchAskClaudeCommand,
                  }}
                  action={otherZoneAction}
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
      )}
      <StatusBar
        count={state.entries.length}
        lastAddedAt={state.entries[0]?.addedAt ?? null}
        workspacePath={api.workspacePath}
        keyHints={sheetOpen ? appStrings.sheetKeyHints : undefined}
      />
      <ToastHost />
    </>
  );
}
