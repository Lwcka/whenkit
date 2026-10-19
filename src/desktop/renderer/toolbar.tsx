import type { EntryDto } from '../../shared/ipc';
import { appStrings, formatCompact, zoneLabels } from '../../shared/strings.ro';
import './toolbar.css';

type Zone = EntryDto['zone'];

export const ZONE_ORDER: readonly Zone[] = ['toolbox', 'learn'];

export interface ToolbarProps {
  zone: Zone;
  counts: Readonly<Record<Zone, number>>;
  onZoneChange: (zone: Zone) => void;
}

/** The toolbar: for now only the two zone tabs, each with its live counter. */
export function Toolbar({ zone, counts, onZoneChange }: ToolbarProps) {
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
            onClick={() => onZoneChange(id)}
          >
            {zoneLabels[id]}
            <span className="zone-tab-count">{formatCompact(counts[id])}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
