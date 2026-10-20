import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { EntryDto } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { isGridKey, isNew, nextGridIndex } from './catalog-view';
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
  /** When each fresh arrival came in (ms), by id; an id not in it is not new. */
  arrivals?: ReadonlyMap<string, number>;
  /** How many updates from the terminal each entry has had; its parity restarts the pulse. */
  pulses?: ReadonlyMap<string, number>;
  /** The clock of the tape text and of the tape's lifetime (ms). */
  now?: number;
}

const NONE: ReadonlyMap<string, number> = new Map();

/** The duration of DESIGN motion.slide, read from the token (0 with animations off). */
function slideDuration(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-slide')
    .trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return 0;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : 0;
}

/** Where the cards stood in the last layout, to slide them to the next one. */
interface Layout {
  width: number;
  offsets: Map<string, { x: number; y: number }>;
}

/**
 * The grid of cards: one Tab stop (roving tabindex), moved by the arrow keys.
 * The card that was last focused stays the stop while focus is elsewhere.
 */
export function CardGrid({ viewKey, ...props }: CardGridProps) {
  return <Cards key={viewKey} {...props} />;
}

function Cards({
  entries,
  slots,
  arrivals = NONE,
  pulses = NONE,
  now = 0,
}: Omit<CardGridProps, 'viewKey'>) {
  const list = useRef<HTMLUListElement>(null);
  const layout = useRef<Layout | null>(null);
  // A pulse belongs to the moment of the update: what the grid already counted
  // when it mounted (a card shown again after a view change) does not replay.
  const mountedPulses = useRef(pulses);

  // FLIP: when a card arrives the others move to their new places; each one
  // starts from where it stood and slides (Web Animations, so no inline
  // style). A different width (the window was resized) is not a slide.
  useLayoutEffect(() => {
    const grid = list.current;
    if (grid === null) return;
    const items = Array.from(grid.children) as HTMLElement[];
    const offsets = new Map<string, { x: number; y: number }>();
    entries.forEach((entry, index) => {
      const item = items[index];
      if (item !== undefined) {
        offsets.set(entry.id, { x: item.offsetLeft, y: item.offsetTop });
      }
    });
    const before = layout.current;
    layout.current = { width: grid.offsetWidth, offsets };
    if (before === null || before.width !== grid.offsetWidth) return;
    const duration = slideDuration();
    if (duration <= 0) return;
    entries.forEach((entry, index) => {
      const item = items[index];
      const from = before.offsets.get(entry.id);
      const to = offsets.get(entry.id);
      if (item === undefined || from === undefined || to === undefined) return;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if ((dx === 0 && dy === 0) || typeof item.animate !== 'function') return;
      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing: 'ease-out' },
      );
    });
  });

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
            tape={tapeOf(entry.id, arrivals, now)}
            pulse={pulseOf(entry.id, pulses, mountedPulses.current)}
          />
        </li>
      ))}
    </ul>
  );
}

function tapeOf(
  id: string,
  arrivals: ReadonlyMap<string, number>,
  now: number,
): string | undefined {
  const arrivedAt = arrivals.get(id);
  return arrivedAt !== undefined && isNew(arrivedAt, now)
    ? appStrings.arrivalTape(now - arrivedAt)
    : undefined;
}

function pulseOf(
  id: string,
  pulses: ReadonlyMap<string, number>,
  atMount: ReadonlyMap<string, number>,
): 'a' | 'b' | undefined {
  const count = pulses.get(id) ?? 0;
  if (count === (atMount.get(id) ?? 0)) return undefined;
  return count % 2 === 0 ? 'b' : 'a';
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
