import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { EntryDto } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import {
  entrySlot,
  isGridKey,
  isNew,
  nextGridIndex,
  pulseParity,
} from './catalog-view';
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
  /** Opens the sheet of an entry (click, Enter). */
  onOpen?: (id: string) => void;
  /** The card that is the Tab stop at first (the one a sheet was opened from). */
  initialActiveId?: string;
  /**
   * An entry that was just deleted: its card stays at its old `index`, out of
   * reach, and collapses (motion.slide); the others slide into the gap after.
   */
  leaving?: { entry: EntryDto; index: number };
  /** The leaving card is gone (its animation ended, or animations are off). */
  onLeft?: () => void;
}

const NONE: ReadonlyMap<string, number> = new Map();

/** The duration of DESIGN motion.slide, read from the token (0 with animations off). */
export function slideDuration(): number {
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
  onOpen,
  initialActiveId,
  leaving,
  onLeft,
}: Omit<CardGridProps, 'viewKey'>) {
  const list = useRef<HTMLUListElement>(null);
  const layout = useRef<Layout | null>(null);
  // A pulse belongs to the moment of the update: what the grid already counted
  // when it mounted (a card shown again after a view change) does not replay.
  const mountedPulses = useRef(pulses);
  // A grid that comes back with a card to collapse shows no entrance: the
  // fade-in would hide the collapse. Decided at mount, so the cards do not
  // replay it when the collapse ends.
  const quiet = useRef(leaving !== undefined);

  // The leaving card is drawn only while its collapse can be seen; with
  // animations off it is gone at once.
  const [leftId, setLeftId] = useState<string | null>(null);
  const pending = leaving !== undefined && leftId !== leaving.entry.id;
  const showLeaving =
    pending &&
    slideDuration() > 0 &&
    !entries.some((entry) => entry.id === leaving.entry.id);
  const leavingNow = pending && !showLeaving;
  useEffect(() => {
    if (leavingNow) onLeft?.();
  }, [leavingNow, onLeft]);
  // The card is gone when its own collapse ends (a native listener: it also
  // works where the event is not wired through React, as in jsdom).
  const leavingId = showLeaving ? leaving.entry.id : null;
  useEffect(() => {
    const item = list.current?.querySelector('[data-leaving]');
    if (leavingId === null || !item) return undefined;
    const onEnd = (event: Event) => {
      if (event.target !== item) return;
      setLeftId(leavingId);
      onLeft?.();
    };
    item.addEventListener('animationend', onEnd);
    return () => item.removeEventListener('animationend', onEnd);
  }, [leavingId, onLeft]);

  // FLIP: when a card arrives the others move to their new places; each one
  // starts from where it stood and slides (Web Animations, so no inline
  // style). A different width (the window was resized) is not a slide.
  useLayoutEffect(() => {
    const grid = list.current;
    if (grid === null) return;
    const items = Array.from(grid.children) as HTMLElement[];
    const offsets = new Map<string, { x: number; y: number }>();
    for (const item of items) {
      const id = item.dataset.entryId;
      if (id !== undefined) {
        offsets.set(id, { x: item.offsetLeft, y: item.offsetTop });
      }
    }
    const before = layout.current;
    layout.current = { width: grid.offsetWidth, offsets };
    if (before === null || before.width !== grid.offsetWidth) return;
    const duration = slideDuration();
    if (duration <= 0) return;
    for (const item of items) {
      const id = item.dataset.entryId;
      // The leaving card has its own animation.
      if (id === undefined || item.hasAttribute('data-leaving')) continue;
      const from = before.offsets.get(id);
      const to = offsets.get(id);
      if (from === undefined || to === undefined) continue;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if ((dx === 0 && dy === 0) || typeof item.animate !== 'function')
        continue;
      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing: 'ease-out' },
      );
    }
  });

  const [activeId, setActiveId] = useState<string | null>(
    initialActiveId ?? null,
  );
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
      .querySelectorAll<HTMLElement>(
        '.card-grid-item:not([data-leaving]) [role="button"]',
      )
      [next]?.focus();
  };

  return (
    <ul
      ref={list}
      className="card-grid"
      data-entrance={quiet.current ? 'off' : undefined}
      aria-label={appStrings.cardListLabel}
      onKeyDown={onKeyDown}
    >
      {withLeaving(entries, showLeaving ? leaving : undefined).map(
        ({ entry, index, gone }) =>
          gone ? (
            <li
              key={entry.id}
              className="card-grid-item"
              data-entry-id={entry.id}
              data-leaving=""
              aria-hidden="true"
              inert
            >
              <EntryCard
                entry={entry}
                slot={entrySlot(entry, slots)}
                index={index}
                tabIndex={-1}
              />
            </li>
          ) : (
            <li
              key={entry.id}
              className="card-grid-item"
              data-entry-id={entry.id}
              data-stagger={Math.min(index, STAGGER_MAX)}
            >
              <EntryCard
                entry={entry}
                slot={entrySlot(entry, slots)}
                index={index}
                tabIndex={index === active ? 0 : -1}
                onFocus={() => setActiveId(entry.id)}
                onOpen={() => onOpen?.(entry.id)}
                tape={tapeOf(entry.id, arrivals, now)}
                pulse={pulseParity(
                  pulses.get(entry.id) ?? 0,
                  mountedPulses.current.get(entry.id) ?? 0,
                )}
              />
            </li>
          ),
      )}
    </ul>
  );
}

/**
 * The cards to draw: `entries`, with the leaving card put back at its old
 * place. `index` is the place among `entries` for the cards that stay (the
 * tab stop and the category tab go by it) and the old place for the leaving one.
 */
function withLeaving(
  entries: readonly EntryDto[],
  leaving: { entry: EntryDto; index: number } | undefined,
): { entry: EntryDto; index: number; gone: boolean }[] {
  const drawn = entries.map((entry, index) => ({ entry, index, gone: false }));
  if (leaving === undefined) return drawn;
  const at = Math.min(Math.max(leaving.index, 0), drawn.length);
  drawn.splice(at, 0, {
    entry: leaving.entry,
    index: leaving.index,
    gone: true,
  });
  return drawn;
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
