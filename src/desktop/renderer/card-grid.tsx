import { useRef, useState, type KeyboardEvent } from 'react';
import type { EntryDto } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { isGridKey, nextGridIndex } from './catalog-view';
import { EntryCard, EntryCardSkeleton } from './entry-card';
import './card-grid.css';

/** DESIGN motion.stagger-max: the cascade covers the first cards only. */
const STAGGER_MAX = 8;

/** How many columns the browser laid the grid out in (1 when unknown). */
export function gridColumns(grid: HTMLElement): number {
  const tracks = getComputedStyle(grid).gridTemplateColumns.match(/[\d.]+px/g);
  return tracks === null ? 1 : tracks.length;
}

export interface CardGridProps {
  entries: readonly EntryDto[];
  /** The color slot of every category, by id. */
  slots: ReadonlyMap<string, number>;
  /**
   * Identifies the view (zone and category). A new key remounts the grid, so
   * the cards fade in again in a cascade.
   */
  viewKey: string;
}

/**
 * The grid of cards: one Tab stop (roving tabindex), moved by the arrow keys.
 * The card that was last focused stays the stop while focus is elsewhere.
 */
export function CardGrid({ entries, slots, viewKey }: CardGridProps) {
  return <Cards key={viewKey} entries={entries} slots={slots} />;
}

function Cards({ entries, slots }: Pick<CardGridProps, 'entries' | 'slots'>) {
  const list = useRef<HTMLUListElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const found = entries.findIndex((entry) => entry.id === activeId);
  const active = found < 0 ? 0 : found;

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
      return;
    if (!isGridKey(event.code) || list.current === null) return;
    event.preventDefault();
    const next = nextGridIndex(
      active,
      event.code,
      gridColumns(list.current),
      entries.length,
    );
    list.current
      .querySelectorAll<HTMLElement>('[role="button"]')
      [next]?.focus();
  };

  return (
    <ul
      ref={list}
      className="card-grid"
      aria-label={appStrings.cardListLabel}
      onKeyDown={onKeyDown}
    >
      {entries.map((entry, index) => (
        <li
          key={entry.id}
          className="card-grid-item"
          data-stagger={Math.min(index, STAGGER_MAX)}
        >
          <EntryCard
            entry={entry}
            slot={slotOf(entry, slots)}
            index={index}
            tabIndex={index === active ? 0 : -1}
            onFocus={() => setActiveId(entry.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function slotOf(
  entry: EntryDto,
  slots: ReadonlyMap<string, number>,
): number | null {
  // Categories arrive sorted by name_key: the first one colors the card.
  const first = entry.categories[0];
  return first === undefined ? null : (slots.get(first.id) ?? null);
}

/** The placeholder grid shown when the first load is slow. */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="card-grid"
      data-skeleton=""
      role="status"
      aria-busy="true"
      aria-label={appStrings.loadingLabel}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card-grid-item">
          <EntryCardSkeleton />
        </div>
      ))}
    </div>
  );
}
