import { Trash2 } from 'lucide-react';
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
import {
  appStrings,
  entryStrings,
  errorMessages,
  zoneLabels,
} from '../../shared/strings.ro';
import { AppError } from './app-error';
import { Button } from './button';
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
import { CategoryManager } from './category-manager';
import { ConflictBanner } from './conflict-banner';
import { Dialog } from './dialog';
import {
  changesLinks,
  draftFromEntry,
  hasErrors,
  isDirty,
  issuesByField,
  patchChanges,
  reasonsByField,
  validateDraft,
  withoutErrorsOf,
  type Draft,
  type FieldErrors,
} from './edit-draft';
import { EmptyState } from './empty-state';
import { EntrySheet } from './entry-sheet';
import {
  ESCAPE_PRIORITY,
  createZoom,
  frameBindings,
  installKeyboard,
  isDialogOpen,
  registerEscape,
} from './keyboard';
import './kbd.css';
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
  | 'deleteCategory'
  | 'deleteEntry'
  | 'mergeCategories'
  | 'renameCategory'
  | 'openExternal'
  | 'patchEntry'
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

/** An entry just deleted from the view of the list: its card collapses where it stood. */
interface Leaving {
  entry: EntryDto;
  /** Its place among the entries the list showed. */
  index: number;
  /** The list view it belongs to (the grid remounts on a new one). */
  viewKey: string;
}

/** An entry open in edit mode (CAP-10, EXPERIENCE Flow 3). */
interface EditState {
  entryId: string;
  /** The entry as it was when the edit began or was last reloaded: what the draft is compared with. */
  base: EntryDto;
  /** The user's own copy; it never follows the store's DTO (AD-10). */
  draft: Draft;
  /** The revision the edit started on, refreshed only by „Reîncarcă fișa” (AD-16). */
  expectedRevision: number;
  /** What the last save's answer says about the fields. */
  errors: FieldErrors;
  /** A save answered CONFLICT. */
  conflict: boolean;
  /** The banner was on screen when the save began: it stays while the save runs. */
  bannerHeld: boolean;
  /** A save is running; 'links' when core verifies the links first. */
  saving: 'text' | 'links' | null;
  /** The confirmation on screen over the form. */
  confirm: 'cancel' | 'reload' | null;
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
  // Deleting (CAP-10, Flow 4): the sheet asks for a confirmation, only the
  // dialog's solid button deletes. The id keeps the dialog on its own entry.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  // The category manager (CAP-11): a dialog over whatever the window shows.
  const [managingCategories, setManagingCategories] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const backToEditingButton = useRef<HTMLButtonElement>(null);
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
  // A collapsing card belongs to the view it left; another view forgets it.
  useEffect(() => {
    if (leaving !== null && leaving.viewKey !== viewKey) setLeaving(null);
  });
  // Opening an entry ends its arrival. From the list the stack starts and the
  // origin is saved; from a sheet the entry is pushed.
  const openEntry = (id: string) => {
    // Nothing opens over a form that is being edited.
    if (!byId.has(id) || editing) return;
    store.dismissArrival(id);
    setLeaving(null);
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
  const requestDeleteRef = useRef(() => {});
  const editingRef = useRef(false);
  const startEditRef = useRef(() => {});
  const saveEditRef = useRef(() => {});
  const requestCancelRef = useRef(() => {});
  useEffect(() => {
    openRef.current = openEntry;
    backRef.current = goBack;
    sheetOpenRef.current = sheetOpen;
    requestDeleteRef.current = requestDelete;
    editingRef.current = editing;
    startEditRef.current = startEdit;
    saveEditRef.current = () => void saveEdit();
    requestCancelRef.current = requestCancel;
  });

  // „Șterge” in the sheet-bar and the Delete key only open the confirmation. The
  // focus goes to the button first, so Esc and „Renunță” bring it back there.
  const requestDelete = () => {
    if (shownEntry === undefined || confirmingDelete !== null || editing)
      return;
    deleteButton.current?.focus();
    setConfirmingDelete(shownEntry.id);
  };
  // The confirmation belongs to the entry on screen: when that changes under
  // it (deleted from the terminal, stack popped) it is forgotten, unless the
  // delete of that entry is running.
  useEffect(() => {
    if (
      confirmingDelete !== null &&
      !deleting &&
      confirmingDelete !== shownEntry?.id
    )
      setConfirmingDelete(null);
  });
  const cancelDelete = () => {
    if (!deleting) setConfirmingDelete(null);
  };
  const confirmDelete = async () => {
    if (shownEntry === undefined || deleting) return;
    const { id } = shownEntry;
    // Deleting the only sheet brings the list back: its card collapses there,
    // unless it was the last card of the view (an empty state follows).
    const index = entries.findIndex((candidate) => candidate.id === id);
    if (liveStack.length === 1 && index >= 0 && entries.length > 1) {
      setLeaving({ entry: shownEntry, index, viewKey });
    }
    setDeleting(true);
    const result = await store.write(() => api.deleteEntry(id));
    setDeleting(false);
    setConfirmingDelete(null);
    if (!result.ok) {
      // The sheet stays; the toast says why.
      setLeaving(null);
      toasts.push({ kind: 'error', message: errorMessages[result.error.code] });
      return;
    }
    // The entry left the store, so it left the stack: back from it lands on the
    // sheet below, or on the list (above).
  };

  // Editing (CAP-10, Flow 3): the draft, the confirmations and the save live
  // here because the key bindings, the sheet-bar and the dialogs all need them.
  // An edit belongs to the entry on screen: when that changes under it (the
  // entry vanished, the stack was popped) it is forgotten.
  const [edit, setEdit] = useState<EditState | null>(null);
  const editing = edit !== null && shownEntry?.id === edit.entryId;
  const activeEdit = editing ? edit : null;
  useEffect(() => {
    if (edit !== null && !editing) setEdit(null);
  });
  const localErrors: FieldErrors =
    activeEdit !== null && shownEntry !== undefined
      ? validateDraft(activeEdit.draft, shownEntry.kind)
      : {};
  const editInvalid = hasErrors(localErrors);
  const editDirty =
    activeEdit !== null && isDirty(activeEdit.draft, activeEdit.base);
  // The terminal updated the entry while it was edited, or a save said so.
  // While a save runs the banner is as it was when the save began: it does not
  // vanish and come back with the answer, and the save's own revision bump
  // does not raise it.
  const showConflict =
    activeEdit !== null &&
    shownEntry !== undefined &&
    (activeEdit.saving !== null
      ? activeEdit.bannerHeld || activeEdit.conflict
      : activeEdit.conflict ||
        shownEntry.revision > activeEdit.expectedRevision);

  const startEdit = () => {
    if (shownEntry === undefined || editing || confirmingDelete !== null)
      return;
    setEdit({
      entryId: shownEntry.id,
      base: shownEntry,
      draft: draftFromEntry(shownEntry),
      expectedRevision: shownEntry.revision,
      errors: {},
      conflict: false,
      bannerHeld: false,
      saving: null,
      confirm: null,
    });
  };
  const changeDraft = (changes: Partial<Draft>) =>
    setEdit((previous) =>
      previous === null || previous.saving !== null
        ? previous
        : {
            ...previous,
            draft: { ...previous.draft, ...changes },
            errors: withoutErrorsOf(
              previous.errors,
              Object.keys(changes) as (keyof Draft)[],
            ),
          },
    );
  const setConfirm = (confirm: EditState['confirm']) =>
    setEdit((previous) =>
      previous === null ? previous : { ...previous, confirm },
    );
  // „Renunță” and Esc: a clean form leaves at once, a changed one asks first.
  const requestCancel = () => {
    if (activeEdit === null || activeEdit.saving !== null) return;
    if (activeEdit.confirm !== null) return;
    if (editDirty) setConfirm('cancel');
    else setEdit(null);
  };
  // „Reîncarcă fișa”: the store reads the catalog again (a refused save leaves
  // it behind), then the form is rebuilt from the entry as it is now, with its
  // revision as the new expectation; the banner goes and the focus is in „Nume”.
  const focusName = useRef(false);
  const reloadEdit = async () => {
    if (activeEdit === null) return;
    const id = activeEdit.entryId;
    await store.reload();
    const latest = store.getState();
    const fresh =
      latest.status === 'ready'
        ? latest.entries.find((candidate) => candidate.id === id)
        : undefined;
    // An entry that vanished ends its edit by itself.
    if (fresh === undefined) return;
    focusName.current = true;
    setEdit((previous) =>
      previous?.entryId !== id
        ? previous
        : {
            ...previous,
            base: fresh,
            draft: draftFromEntry(fresh),
            expectedRevision: fresh.revision,
            errors: {},
            conflict: false,
            bannerHeld: false,
            confirm: null,
          },
    );
  };
  const requestReload = () => {
    if (activeEdit === null || activeEdit.saving !== null) return;
    if (activeEdit.confirm !== null) return;
    if (editDirty) setConfirm('reload');
    else void reloadEdit();
  };
  // Ctrl+S and „Salvează”: only the changed fields go, with the revision the
  // edit started on (AD-16). Core verifies; the window only maps the answer.
  const saveEdit = async () => {
    if (activeEdit === null || activeEdit.saving !== null) return;
    if (activeEdit.confirm !== null || editInvalid) return;
    const { entryId, draft, base, expectedRevision } = activeEdit;
    const changes = patchChanges(draft, base);
    if (Object.keys(changes).length === 0) {
      setEdit(null);
      return;
    }
    setEdit((previous) =>
      previous === null
        ? previous
        : {
            ...previous,
            errors: {},
            bannerHeld: showConflict,
            saving: changesLinks(changes) ? 'links' : 'text',
          },
    );
    const result = await store.write(() =>
      api.patchEntry({ id: entryId, expectedRevision, changes }),
    );
    if (result.ok) {
      setEdit((previous) => (previous?.entryId === entryId ? null : previous));
      return;
    }
    const { error } = result;
    let errors: FieldErrors = {};
    if (error.code === 'ENTRY_REJECTED')
      errors = reasonsByField(error.reasons ?? [], draft);
    else if (error.code === 'ARGUMENTS_INVALID')
      errors = issuesByField(error.issues ?? []);
    else if (error.code === 'OFFLINE') errors = { url: appStrings.editOffline };
    const conflict = error.code === 'CONFLICT';
    // Anything the form cannot show under a field or in the banner is a toast.
    if (!conflict && !hasErrors(errors))
      toasts.push({ kind: 'error', message: errorMessages[error.code] });
    setEdit((previous) =>
      previous?.entryId === entryId
        ? {
            ...previous,
            errors,
            conflict: previous.conflict || conflict,
            saving: null,
          }
        : previous,
    );
    // A refused save emits no catalog change: read the catalog, so the banner
    // and „Reîncarcă fișa” see the revision that refused it.
    if (conflict) void store.reload();
  };
  // After a failed save the fields unlock: the focus goes to the first one
  // that was refused, or to „Salvează” when none is (it was lost when the form
  // locked). After a reload it goes to „Nume”.
  const wasSaving = useRef(false);
  useEffect(() => {
    const saving = activeEdit?.saving != null;
    if (activeEdit !== null && wasSaving.current && !saving) {
      (
        document.querySelector<HTMLElement>(
          '.entry-edit-form [aria-invalid="true"]',
        ) ??
        document.querySelector<HTMLElement>(
          '.sheet-bar [data-variant="primary"]',
        )
      )?.focus();
    }
    wasSaving.current = saving;
    if (focusName.current && activeEdit !== null) {
      focusName.current = false;
      document
        .querySelector<HTMLElement>('.entry-edit-form input')
        ?.focus({ preventScroll: true });
    }
  });
  // Leaving the edit puts the focus back on the sheet, as when it opened.
  const wasEditing = useRef(false);
  useLayoutEffect(() => {
    const was = wasEditing.current;
    wasEditing.current = editing;
    if (was && !editing)
      document
        .querySelector<HTMLElement>('.entry-sheet')
        ?.focus({ preventScroll: true });
  }, [editing]);

  // Every import that lands makes one toast per zone; „Vezi” opens that zone
  // at Toate, and a single arrival's „Deschide” opens its sheet.
  useEffect(
    () =>
      store.subscribeArrivals((arrived) => {
        const see = (target: Zone) => {
          if (editingRef.current) return;
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
        ESCAPE_PRIORITY.editing,
        () => editingRef.current,
        () => requestCancelRef.current(),
      ),
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
    // Behind a modal dialog the sheet stays, as with Alt+Left.
    const backOpen = () => sheetOpenRef.current && !isDialogOpen(document);
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === MOUSE_BACK && backOpen()) event.preventDefault();
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== MOUSE_BACK || !backOpen()) return;
      event.preventDefault();
      // The form is left only by „Renunță” or a save.
      if (!editingRef.current) backRef.current();
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
  const leavingRef = useRef(leaving);
  useEffect(() => {
    leavingRef.current = leaving;
  });
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = sheetOpen;
    if (!was || sheetOpen || origin === null) return;
    const scroller = document.querySelector<HTMLElement>(
      '.list-view .shell-scroll',
    );
    if (scroller !== null) scroller.scrollTop = origin.scrollTop;
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.card-grid-item:not([data-leaving]) .entry-card',
      ),
    );
    const gone = leavingRef.current;
    const card =
      cards.find((candidate) => candidate.dataset.entryId === origin.cardId) ??
      // The card was deleted: its place goes to the card that took it.
      (gone?.entry.id === origin.cardId
        ? cards[Math.min(gone.index, cards.length - 1)]
        : undefined);
    card?.focus({ preventScroll: true });
    setOrigin(null);
  }, [sheetOpen, origin]);

  // Switching zones, from the tabs or Ctrl+1/2, leaves the sheets.
  const changeZone = useCallback(
    (target: Zone) => {
      if (editingRef.current) return;
      closeSheet();
      setZone(target);
    },
    [closeSheet],
  );
  // Typing a search from a sheet goes back to the list, in the zone on screen.
  const changeSearch = (text: string) => {
    if (editing) return;
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
          requestDelete: () => requestDeleteRef.current(),
          editing: () => editingRef.current,
          startEdit: () => startEditRef.current(),
          save: () => saveEditRef.current(),
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
        onOpenCategories={() => setManagingCategories(true)}
        search={{
          text: searchText,
          onChange: changeSearch,
          inputRef: searchInput,
        }}
        disabled={editing}
      />
      {shownEntry !== undefined ? (
        <div
          className="sheet-view"
          role="tabpanel"
          aria-label={zoneLabels[shownZone]}
        >
          <SheetBar
            crumbs={sheetCrumbs(shownEntry)}
            onBack={goBack}
            onEdit={startEdit}
            onDelete={requestDelete}
            deleteRef={deleteButton}
            editing={
              activeEdit === null
                ? undefined
                : {
                    onCancel: requestCancel,
                    onSave: () => void saveEdit(),
                    saveDisabled: editInvalid,
                    saving: activeEdit.saving,
                  }
            }
          />
          <main className="shell">
            <div key={shownEntry.id} className="shell-scroll">
              {showConflict && <ConflictBanner onReload={requestReload} />}
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
                edit={
                  activeEdit === null
                    ? undefined
                    : {
                        draft: activeEdit.draft,
                        onChange: changeDraft,
                        errors: { ...activeEdit.errors, ...localErrors },
                        locked: activeEdit.saving !== null,
                        categories: state.categories.filter(
                          (category) => category.zone === shownEntry.zone,
                        ),
                      }
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
                  leaving={leaving?.viewKey === viewKey ? leaving : undefined}
                  onLeft={() => setLeaving(null)}
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
        keyHints={
          editing
            ? appStrings.editKeyHints
            : sheetOpen
              ? appStrings.sheetKeyHints
              : undefined
        }
      />
      {shownEntry !== undefined && activeEdit?.confirm === 'cancel' && (
        <Dialog
          title={appStrings.discardTitle}
          actions={
            <>
              <Button
                ref={backToEditingButton}
                onClick={() => setConfirm(null)}
              >
                {appStrings.backToEditing}
                <kbd className="kbd">Esc</kbd>
              </Button>
              <Button variant="danger-solid" onClick={() => setEdit(null)}>
                {appStrings.discardChanges}
              </Button>
            </>
          }
          onCancel={() => setConfirm(null)}
          initialFocusRef={backToEditingButton}
        >
          <p className="dialog-body">
            {appStrings.discardBody(shownEntry.name)}
          </p>
        </Dialog>
      )}
      {activeEdit?.confirm === 'reload' && (
        <Dialog
          title={appStrings.reloadEntryTitle}
          actions={
            <>
              <Button
                ref={backToEditingButton}
                onClick={() => setConfirm(null)}
              >
                {appStrings.backToEditing}
                <kbd className="kbd">Esc</kbd>
              </Button>
              <Button variant="danger-solid" onClick={() => void reloadEdit()}>
                {appStrings.reloadEntryConfirm}
              </Button>
            </>
          }
          onCancel={() => setConfirm(null)}
          initialFocusRef={backToEditingButton}
        >
          <p className="dialog-body">{appStrings.reloadEntryBody}</p>
        </Dialog>
      )}
      {shownEntry !== undefined && confirmingDelete === shownEntry.id && (
        <Dialog
          title={appStrings.deleteEntryTitle(shownEntry.name)}
          actions={
            <>
              <Button ref={cancelButton} onClick={cancelDelete}>
                {appStrings.cancel}
                <kbd className="kbd">Esc</kbd>
              </Button>
              <Button
                variant="danger-solid"
                icon={Trash2}
                busy={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? appStrings.deleteEntryBusy : appStrings.deleteEntry}
              </Button>
            </>
          }
          onCancel={cancelDelete}
          initialFocusRef={cancelButton}
        >
          <p className="dialog-body">{appStrings.deleteEntryBody}</p>
        </Dialog>
      )}
      {managingCategories && (
        <CategoryManager
          categories={state.categories}
          entries={state.entries}
          api={api}
          write={store.write}
          onClose={() => setManagingCategories(false)}
        />
      )}
      <ToastHost />
    </>
  );
}
