import { Layers, LoaderCircle, Search, Upload } from 'lucide-react';
import type { RefObject } from 'react';
import type { Zone } from '../../shared/ipc';
import { appStrings, formatCompact, zoneLabels } from '../../shared/strings.ro';
import { ZONE_ORDER } from './catalog-view';
import './kbd.css';
import './toolbar.css';

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
  /** „Exportă catalogul” was pressed. It reads the stored catalog, so it stays active while editing. */
  onExport: () => void;
  /** The export is running: the button is busy (disabled, spinning loader, „Se exportă…”). */
  exporting?: boolean;
  /** The zone tabs, the search box and „Categorii” are inactive (an entry is being edited). */
  disabled?: boolean;
}

/**
 * The toolbar: the two zone tabs, each with its live counter, the search box
 * „Categorii”, which opens the category manager, and „Exportă catalogul”.
 */
export function Toolbar({
  zone,
  counts,
  onZoneChange,
  onOpenCategories,
  onExport,
  exporting = false,
  search,
  disabled = false,
}: ToolbarProps) {
  const exportLabel = exporting
    ? appStrings.exporting
    : appStrings.exportButton;
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
      <button
        type="button"
        className="toolbar-button toolbar-button-primary"
        title={exportLabel}
        aria-label={exportLabel}
        aria-busy={exporting ? true : undefined}
        data-busy={exporting ? '' : undefined}
        disabled={exporting}
        onClick={onExport}
      >
        {exporting ? (
          <LoaderCircle aria-hidden="true" className="spin" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        <span className="toolbar-button-text">{exportLabel}</span>
      </button>
    </div>
  );
}
