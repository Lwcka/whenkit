import { Layers, Search } from 'lucide-react';
import type { RefObject } from 'react';
import type { EntryDto } from '../../shared/ipc';
import { appStrings, formatCompact, zoneLabels } from '../../shared/strings.ro';
import './kbd.css';
import './toolbar.css';

type Zone = EntryDto['zone'];

export const ZONE_ORDER: readonly Zone[] = ['toolbox', 'learn'];

export interface ToolbarProps {
  zone: Zone;
  counts: Readonly<Record<Zone, number>>;
  onZoneChange: (zone: Zone) => void;
  /** The search box: its text is kept by the owner; Ctrl K focuses `inputRef`. */
  search: {
    text: string;
    onChange: (text: string) => void;
    inputRef: RefObject<HTMLInputElement | null>;
  };
  /** „Categorii” was pressed: the owner opens the category manager. */
  onOpenCategories: () => void;
  /** The zone tabs, the search box and „Categorii” are inactive (an entry is being edited). */
  disabled?: boolean;
}

/**
 * The toolbar: the two zone tabs, each with its live counter, the search box
 * and „Categorii”, which opens the category manager.
 */
export function Toolbar({
  zone,
  counts,
  onZoneChange,
  onOpenCategories,
  search,
  disabled = false,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div
        className="zone-tabs"
        role="tablist"
        aria-label={appStrings.tablistLabel}
      >
        {ZONE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="zone-tab"
            aria-selected={zone === id}
            disabled={disabled}
            onClick={() => onZoneChange(id)}
          >
            {zoneLabels[id]}
            <span className="zone-tab-count">{formatCompact(counts[id])}</span>
          </button>
        ))}
      </div>
      <div className="search-box">
        <Search aria-hidden="true" />
        <input
          ref={search.inputRef}
          className="search-box-input"
          type="search"
          value={search.text}
          placeholder={appStrings.searchPlaceholder[zone]}
          aria-label={appStrings.searchLabel}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => search.onChange(event.target.value)}
        />
        <kbd className="kbd">{appStrings.searchShortcut}</kbd>
      </div>
      <button
        type="button"
        className="toolbar-button"
        title={appStrings.categoriesButton}
        aria-label={appStrings.categoriesButton}
        disabled={disabled}
        onClick={onOpenCategories}
      >
        <Layers aria-hidden="true" />
        <span className="toolbar-button-text">
          {appStrings.categoriesButton}
        </span>
      </button>
    </div>
  );
}
