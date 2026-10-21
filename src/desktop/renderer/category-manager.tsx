import { Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  CategoryDto,
  EntryDto,
  ErrorDto,
  WhenkitApi,
} from '../../shared/ipc';
import {
  appStrings,
  entryCount,
  errorMessages,
  zoneLabels,
} from '../../shared/strings.ro';
import { Button } from './button';
import type { CatalogStore } from './catalog-store';
import {
  barCategories,
  categoryCounts,
  categorySlots,
  ZONE_ORDER,
} from './catalog-view';
import { Dialog } from './dialog';
import { ESCAPE_PRIORITY, registerEscape } from './keyboard';
import { SelectField } from './select-field';
import { TextField } from './text-field';
import { toastError } from './toast-store';
import { useLatest } from './use-latest';
import './category-bar.css';
import './category-manager.css';
import './kbd.css';

/** What the manager needs from the bridge. */
export type CategoryManagerApi = Pick<
  WhenkitApi,
  'renameCategory' | 'mergeCategories' | 'deleteCategory'
>;

export interface CategoryManagerProps {
  /** The live lists of the catalog store: the manager follows them. */
  categories: readonly CategoryDto[];
  entries: readonly EntryDto[];
  api: CategoryManagerApi;
  /** Runs a write through the catalog store, so its answer is applied first. */
  write: CatalogStore['write'];
  /** „Închide” and Esc. */
  onClose: () => void;
}

/** The rename in progress: one row at a time. */
interface Renaming {
  id: string;
  text: string;
  /** What the last attempt said, shown under the field. */
  error: string | null;
}

/** The confirmation that replaces the manager. */
interface Confirming {
  kind: 'merge' | 'delete';
  id: string;
  /** The chosen destination; `''` while nothing is chosen. */
  targetId: string;
}

/** The row button the focus returns to when the manager comes back. */
interface ReturnTo {
  id: string;
  action: Confirming['kind'];
}

/**
 * A delete with nowhere to move the entries: some entry has only this
 * category and it is the only one of its zone.
 */
function deleteBlocked(
  category: CategoryDto,
  zoneRows: readonly CategoryDto[],
  entries: readonly EntryDto[],
): boolean {
  return (
    zoneRows.length < 2 &&
    entriesHolding(entries, category.id).some(
      (entry) => entry.categories.length <= 1,
    )
  );
}

/** The entries that carry the category. */
function entriesHolding(
  entries: readonly EntryDto[],
  categoryId: string,
): EntryDto[] {
  return entries.filter((entry) =>
    entry.categories.some((category) => category.id === categoryId),
  );
}

const sameLetters = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * The stored name of the category that took `name` in the zone of `category`:
 * the one that reads the same ignoring case and accents (core's name_key is
 * the authority; this only decides what to show), or `name` itself.
 */
function existingName(
  categories: readonly CategoryDto[],
  category: CategoryDto,
  name: string,
): string {
  const found = categories.find(
    (other) =>
      other.id !== category.id &&
      other.zone === category.zone &&
      sameLetters.compare(other.name, name) === 0,
  );
  return found?.name ?? name;
}

/**
 * The category manager (CAP-11, EXPERIENCE Flow 5): a wide dialog with the
 * categories of both zones. A name is edited in place; „Unifică…” and
 * „Șterge” open a confirmation that replaces the dialog and returns to it.
 * The lists come from the store, so an import that lands while the dialog is
 * open shows up at once. Every write goes through the store (`write`); a
 * failure is a toast, except a taken name, which is said under the row.
 */
export function CategoryManager({
  categories,
  entries,
  api,
  write,
  onClose,
}: CategoryManagerProps) {
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState<ReturnTo | null>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  // A failed write unlocks the controls it had disabled, and a focused control
  // that turns disabled loses the focus: it is put back once the lock is off.
  const refocus = useRef<'rename' | 'confirm' | null>(null);
  useLayoutEffect(() => {
    if (busy || refocus.current === null) return;
    const target = refocus.current;
    refocus.current = null;
    if (target === 'rename') renameInput.current?.focus();
    else
      (
        document.querySelector<HTMLElement>('.dialog select') ??
        cancelButton.current
      )?.focus();
  }, [busy]);

  const slots = categorySlots(categories);
  const byId = new Map(categories.map((category) => [category.id, category]));

  // A category that vanished (merged or deleted from the terminal) ends what
  // was going on with it, unless the write that removed it is still running.
  const confirmed = confirming === null ? undefined : byId.get(confirming.id);
  const renamed = renaming === null ? undefined : byId.get(renaming.id);
  useEffect(() => {
    if (confirming !== null && confirmed === undefined && !busy) {
      setConfirming(null);
    }
    if (renaming !== null && renamed === undefined && !busy) setRenaming(null);
  });

  // Esc cancels only the rename (a second Esc closes the manager).
  const renamingNow = useLatest(renaming !== null);
  useEffect(
    () =>
      registerEscape(
        ESCAPE_PRIORITY.renaming,
        () => renamingNow.current,
        () => setRenaming(null),
      ),
    [],
  );

  // The field takes the focus when a rename starts; the row's button gets it
  // back when the rename ends.
  const renamingId = renaming?.id ?? null;
  const wasRenaming = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (renamingId !== null) {
      renameInput.current?.focus();
      renameInput.current?.select();
    } else if (wasRenaming.current !== null) {
      document
        .querySelector<HTMLElement>(
          `[data-rename-button="${wasRenaming.current}"]`,
        )
        ?.focus();
    }
    wasRenaming.current = renamingId;
  }, [renamingId]);

  const fail = (code: ErrorDto['code']) => {
    toastError(errorMessages[code]);
  };

  const startRename = (category: CategoryDto) => {
    if (busy) return;
    setRenaming({ id: category.id, text: category.name, error: null });
  };

  const saveRename = async () => {
    if (renaming === null || busy) return;
    const category = byId.get(renaming.id);
    if (category === undefined) return;
    const name = renaming.text.trim().replace(/\s+/g, ' ');
    if (name === '') {
      setRenaming({ ...renaming, error: appStrings.editErrors.name });
      return;
    }
    if (name === category.name) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    const result = await write(() => api.renameCategory(category.id, name));
    setBusy(false);
    if (result.ok) {
      setRenaming(null);
      return;
    }
    refocus.current = 'rename';
    const { code } = result.error;
    if (code === 'CATEGORY_NAME_TAKEN') {
      // The row stays in rename, with the way out under it.
      setRenaming((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              error: appStrings.categoryNameTaken(
                existingName(categories, category, name),
                zoneLabels[category.zone],
              ),
            },
      );
      return;
    }
    fail(code);
  };

  const askConfirmation = (kind: Confirming['kind'], category: CategoryDto) => {
    if (busy) return;
    setRenaming(null);
    setReturnTo({ id: category.id, action: kind });
    setConfirming({ kind, id: category.id, targetId: '' });
  };

  const backToList = () => {
    if (!busy) setConfirming(null);
  };

  // The two dialogs have different keys: swapping them is a new mount, so the
  // new one takes the focus and animates in (a shared instance would not).
  if (confirming !== null && confirmed !== undefined) {
    const held = entriesHolding(entries, confirmed.id);
    const sole = held.filter((entry) => entry.categories.length <= 1).length;
    const targets = barCategories(categories, confirmed.zone).filter(
      (category) => category.id !== confirmed.id,
    );
    const target = targets.find(
      (category) => category.id === confirming.targetId,
    );
    const chosen = target?.id ?? '';
    const isMerge = confirming.kind === 'merge';
    const needsTarget = isMerge || sole > 0;

    const confirm = async () => {
      if (busy || (needsTarget && chosen === '')) return;
      setBusy(true);
      const result = await write(() =>
        isMerge
          ? api.mergeCategories(confirmed.id, chosen)
          : api.deleteCategory(confirmed.id, needsTarget ? chosen : undefined),
      );
      setBusy(false);
      if (result.ok) {
        setReturnTo(null);
        setConfirming(null);
        return;
      }
      // The confirmation stays: the toast says why nothing was written.
      refocus.current = 'confirm';
      fail(result.error.code);
    };

    return (
      <Dialog
        key="confirm"
        title={
          isMerge
            ? appStrings.categoryMergeTitle(confirmed.name)
            : appStrings.categoryDeleteTitle(confirmed.name)
        }
        actions={
          <>
            <Button ref={cancelButton} onClick={backToList}>
              {appStrings.cancel}
              <kbd className="kbd">Esc</kbd>
            </Button>
            <Button
              variant="danger-solid"
              icon={isMerge ? undefined : Trash2}
              busy={busy}
              disabled={needsTarget && chosen === ''}
              onClick={() => void confirm()}
            >
              {isMerge
                ? busy
                  ? appStrings.categoryMergeBusy
                  : appStrings.categoryMergeConfirm
                : busy
                  ? appStrings.categoryDeleteBusy
                  : appStrings.categoryDelete}
            </Button>
          </>
        }
        onCancel={backToList}
        initialFocusRef={cancelButton}
      >
        {!isMerge && (
          <p className="dialog-body">
            {sole > 0
              ? appStrings.categorySoleEntries(sole)
              : held.length > 0
                ? appStrings.categoryDeleteShared(held.length)
                : appStrings.categoryDeleteEmpty}
          </p>
        )}
        {needsTarget && (
          <SelectField
            label={appStrings.categoryMoveTo}
            placeholder={appStrings.categoryChoose}
            value={chosen}
            options={targets.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            disabled={busy}
            onChange={(targetId) => setConfirming({ ...confirming, targetId })}
          />
        )}
        {isMerge && (target !== undefined || held.length === 0) && (
          <p className="category-manager-consequence">
            {appStrings.categoryMergeConsequence(
              held.length,
              confirmed.name,
              target?.name ?? '',
            )}
          </p>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      key="manager"
      title={appStrings.categoryManagerTitle}
      size="wide"
      actions={
        <Button onClick={onClose}>
          {appStrings.categoryManagerClose}
          <kbd className="kbd">Esc</kbd>
        </Button>
      }
      onCancel={onClose}
      initialFocusRef={returnTo === null ? undefined : returnButton}
    >
      <p className="dialog-body">{appStrings.categoryManagerIntro}</p>
      <div className="category-manager-list">
        {ZONE_ORDER.map((zone) => {
          const rows = barCategories(categories, zone);
          const counts = categoryCounts(entries, zone);
          return (
            <section key={zone} className="category-manager-section">
              <h3 className="category-manager-section-label">
                {zoneLabels[zone]}
              </h3>
              {rows.length === 0 ? (
                <p className="category-manager-empty">
                  {appStrings.categoryZoneEmpty}
                </p>
              ) : (
                <ul className="category-manager-rows">
                  {rows.map((category) => {
                    const rename =
                      renaming?.id === category.id ? renaming : null;
                    const returns = returnTo?.id === category.id;
                    return (
                      <li
                        key={category.id}
                        className="category-manager-row"
                        aria-label={category.name}
                        data-slot={slots.get(category.id)}
                        data-renaming={rename !== null ? '' : undefined}
                      >
                        <i
                          className="category-manager-dot"
                          aria-hidden="true"
                        />
                        {rename !== null ? (
                          <>
                            <TextField
                              ariaLabel={appStrings.categoryNameLabel}
                              value={rename.text}
                              inputRef={renameInput}
                              disabled={busy}
                              error={rename.error ?? undefined}
                              onChange={(text) =>
                                setRenaming({ ...rename, text, error: null })
                              }
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                void saveRename();
                              }}
                            />
                            <span className="category-manager-hints">
                              <kbd className="kbd">Enter</kbd>
                              {appStrings.categoryRenameSave}
                              <kbd className="kbd">Esc</kbd>
                              {appStrings.categoryRenameCancel}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="category-manager-name">
                              {category.name}
                            </span>
                            <span className="category-manager-count">
                              {entryCount(counts.get(category.id) ?? 0)}
                            </span>
                            <span className="category-manager-actions">
                              <Button
                                variant="ghost"
                                className="category-manager-button"
                                data-rename-button={category.id}
                                aria-label={appStrings.categoryActionLabel(
                                  appStrings.categoryRename,
                                  category.name,
                                )}
                                disabled={busy}
                                onClick={() => startRename(category)}
                              >
                                {appStrings.categoryRename}
                              </Button>
                              <Button
                                ref={
                                  returns && returnTo.action === 'merge'
                                    ? returnButton
                                    : undefined
                                }
                                variant="ghost"
                                className="category-manager-button"
                                aria-label={appStrings.categoryActionLabel(
                                  appStrings.categoryMerge,
                                  category.name,
                                )}
                                disabled={busy || rows.length < 2}
                                onClick={() =>
                                  askConfirmation('merge', category)
                                }
                              >
                                {appStrings.categoryMerge}
                              </Button>
                              <Button
                                ref={
                                  returns && returnTo.action === 'delete'
                                    ? returnButton
                                    : undefined
                                }
                                variant="ghost"
                                className="category-manager-button"
                                data-danger=""
                                aria-label={appStrings.categoryActionLabel(
                                  appStrings.categoryDelete,
                                  category.name,
                                )}
                                title={
                                  deleteBlocked(category, rows, entries)
                                    ? appStrings.categoryDeleteBlocked
                                    : undefined
                                }
                                disabled={
                                  busy || deleteBlocked(category, rows, entries)
                                }
                                onClick={() =>
                                  askConfirmation('delete', category)
                                }
                              >
                                {appStrings.categoryDelete}
                              </Button>
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
