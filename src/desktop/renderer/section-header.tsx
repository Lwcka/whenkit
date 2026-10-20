import { appStrings } from '../../shared/strings.ro';
import './section-header.css';

export interface SectionHeaderProps {
  /** The name of the view: „Toate” or the category. */
  name: string;
  /** The category's color slot; `null` for „Toate”. */
  slot: number | null;
  /** How many entries the view lists. */
  count: number;
  /** How many of them are fresh arrivals; „· N nouă” follows the count. */
  fresh?: number;
}

/** A small colored tab, the name of the view and a dimension line with the count. */
export function SectionHeader({
  name,
  slot,
  count,
  fresh = 0,
}: SectionHeaderProps) {
  return (
    <header className="section-header" data-slot={slot ?? undefined}>
      <h2 className="section-header-name">
        <i className="section-header-tab" aria-hidden="true" />
        {name}
      </h2>
      <span className="section-header-dimension">
        <b className="section-header-cap" aria-hidden="true" />
        <b className="section-header-cap" aria-hidden="true" />
        <span className="section-header-label">
          {appStrings.sectionCount(count, fresh)}
        </span>
      </span>
    </header>
  );
}
