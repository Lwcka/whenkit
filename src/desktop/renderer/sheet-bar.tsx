import { ChevronLeft } from 'lucide-react';
import { appStrings } from '../../shared/strings.ro';
import { Button } from './button';
import './kbd.css';
import './sheet-bar.css';

export interface SheetBarProps {
  /** The breadcrumbs; the last one is the entry on screen. */
  crumbs: readonly string[];
  /** One step down the stack. */
  onBack: () => void;
}

/**
 * The bar of an open sheet (DESIGN, sheet-bar): „Înapoi” with its key, and the
 * breadcrumbs „Toolbox / Imagini & video / remove.bg”. The edit and delete
 * actions come with their own tickets.
 */
export function SheetBar({ crumbs, onBack }: SheetBarProps) {
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
    </div>
  );
}
