import { ChevronLeft, Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import { appStrings } from '../../shared/strings.ro';
import { Button } from './button';
import './kbd.css';
import './sheet-bar.css';

export interface SheetBarProps {
  /** The breadcrumbs; the last one is the entry on screen. */
  crumbs: readonly string[];
  /** One step down the stack. */
  onBack: () => void;
  /** „Șterge”: asks for the confirmation, never deletes by itself. */
  onDelete: () => void;
  /** The delete button, so the focus can return to it when the dialog closes. */
  deleteRef?: Ref<HTMLButtonElement>;
}

/**
 * The bar of an open sheet (DESIGN, sheet-bar): „Înapoi” with its key, and the
 * breadcrumbs „Toolbox / Imagini & video / remove.bg”, and „Șterge” on the
 * right (it opens a confirmation). „Editează” comes with its own ticket.
 */
export function SheetBar({
  crumbs,
  onBack,
  onDelete,
  deleteRef,
}: SheetBarProps) {
  return (
    <div className="sheet-bar">
      <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
        {appStrings.sheetBack}
        <kbd className="kbd">Esc</kbd>
      </Button>
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
        <Button
          ref={deleteRef}
          variant="danger"
          icon={Trash2}
          onClick={onDelete}
        >
          {appStrings.deleteEntry}
        </Button>
      </div>
    </div>
  );
}
