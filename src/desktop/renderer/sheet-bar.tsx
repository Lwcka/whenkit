import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import { appStrings } from '../../shared/strings.ro';
import { Button } from './button';
import './kbd.css';
import './sheet-bar.css';

/** The sheet-bar while the entry is edited. */
export interface SheetBarEditing {
  /** „Renunță”: leaves the edit (asks first when the form has changes). */
  onCancel: () => void;
  /** „Salvează”. */
  onSave: () => void;
  /** The form is invalid: „Salvează” is inactive. */
  saveDisabled: boolean;
  /** A save is running; `links` when core verifies the links first (a slow save). */
  saving: 'text' | 'links' | null;
}

export interface SheetBarProps {
  /** The breadcrumbs; the last one is the entry on screen. */
  crumbs: readonly string[];
  /** One step down the stack. */
  onBack: () => void;
  /** „Editează”: opens the entry in edit mode. */
  onEdit: () => void;
  /** „Șterge”: asks for the confirmation, never deletes by itself. */
  onDelete: () => void;
  /** The delete button, so the focus can return to it when the dialog closes. */
  deleteRef?: Ref<HTMLButtonElement>;
  /** Present while the entry is edited. */
  editing?: SheetBarEditing;
}

/**
 * The bar of an open sheet (DESIGN, sheet-bar): „Înapoi” with its key, and the
 * breadcrumbs „Toolbox / Imagini & video / remove.bg”, and on the right
 * „Editează” and „Șterge” (it opens a confirmation). While the entry is
 * edited, „Înapoi” and „Șterge” go away and „Renunță” and „Salvează” take the
 * place of the actions; the breadcrumbs stay.
 */
export function SheetBar({
  crumbs,
  onBack,
  onEdit,
  onDelete,
  deleteRef,
  editing,
}: SheetBarProps) {
  return (
    <div className="sheet-bar">
      {editing === undefined && (
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
          {appStrings.sheetBack}
          <kbd className="kbd">Esc</kbd>
        </Button>
      )}
      <nav aria-label={appStrings.sheetCrumbsLabel}>
        <ol className="sheet-bar-crumbs">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li
                key={index}
                className="crumb"
                data-current={last ? '' : undefined}
                aria-current={last ? 'page' : undefined}
              >
                {crumb}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="sheet-bar-actions">
        {editing === undefined ? (
          <>
            <Button icon={Pencil} onClick={onEdit}>
              {appStrings.edit}
              <kbd className="kbd">E</kbd>
            </Button>
            <Button
              ref={deleteRef}
              variant="danger"
              icon={Trash2}
              onClick={onDelete}
            >
              {appStrings.deleteEntry}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              disabled={editing.saving !== null}
              onClick={editing.onCancel}
            >
              {appStrings.cancel}
              <kbd className="kbd">Esc</kbd>
            </Button>
            <Button
              variant="primary"
              busy={editing.saving !== null}
              disabled={editing.saveDisabled}
              onClick={editing.onSave}
            >
              {editing.saving === 'links'
                ? appStrings.verifyingLink
                : editing.saving === 'text'
                  ? appStrings.saving
                  : appStrings.save}
              {editing.saving === null && <kbd className="kbd">Ctrl S</kbd>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
