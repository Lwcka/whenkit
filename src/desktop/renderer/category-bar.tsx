import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type WheelEvent,
} from 'react';
import { appStrings, formatCompact } from '../../shared/strings.ro';
import './category-bar.css';

export interface CategoryBarItem {
  /** `null` is „Toate”. */
  id: string | null;
  name: string;
  count: number;
  /** The color slot (1…9); `null` for „Toate”. */
  slot: number | null;
}

export interface CategoryBarProps {
  items: readonly CategoryBarItem[];
  selectedId: string | null;
  /** A search is shown: no chip is checked, but the row stays reachable. */
  searching?: boolean;
  onSelect: (id: string | null) => void;
}

/** How much of the visible row one press of ‹ or › moves. */
const PAGE_FRACTION = 0.8;

/**
 * The category bar: single-selection chips in one horizontally scrolling row.
 * The fades and the ‹ › buttons show only on the side that has more to scroll.
 */
export function CategoryBar({
  items,
  selectedId,
  searching = false,
  onSelect,
}: CategoryBarProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = scroller.current;
    if (element === null) return;
    const start = element.scrollLeft > 1;
    const end =
      element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setOverflow((previous) =>
      previous.start === start && previous.end === end
        ? previous
        : { start, end },
    );
  }, []);

  // A stable signature: `items` is a new array on every render of the app.
  const signature = items
    .map((item) => `${item.id ?? ''}|${item.name}|${item.count}`)
    .join('\n');

  useEffect(() => {
    measure();
    const element = scroller.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    // The chips too: their width can change (a font swapping in) without the
    // row's own box changing.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const chip of element.children) observer.observe(chip);
    return () => observer.disconnect();
  }, [measure, signature]);

  // The active chip is brought into view whenever the selection changes.
  useEffect(() => {
    const chip = scroller.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]',
    );
    // jsdom has no scrollIntoView.
    if (typeof chip?.scrollIntoView === 'function') {
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selectedId, searching]);

  const page = (direction: -1 | 1) => {
    const element = scroller.current;
    if (element === null) return;
    element.scrollLeft += direction * element.clientWidth * PAGE_FRACTION;
  };

  // The wheel scrolls the row sideways (EXPERIENCE, Interaction Primitives).
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const element = scroller.current;
    if (element === null || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    // Instant: with smooth scrolling on, reading scrollLeft mid-animation
    // would lose distance on every wheel event.
    if (typeof element.scrollBy === 'function') {
      element.scrollBy({ left: event.deltaY, behavior: 'instant' });
    } else {
      element.scrollLeft += event.deltaY;
    }
  };

  // ← and → move the selection, and the focus with it (a radio group).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
      return;
    const delta =
      event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const current = items.findIndex((item) => item.id === selectedId);
    const next = Math.min(Math.max(current + delta, 0), items.length - 1);
    const target = items[next];
    if (target === undefined) return;
    onSelect(target.id);
    scroller.current
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [next]?.focus();
  };

  const focusable = items.some((item) => item.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? null);

  return (
    <div className="category-bar">
      <span className="category-bar-label">
        <Layers aria-hidden="true" />
        {appStrings.categoryBarLabel}
      </span>
      <div className="category-bar-viewport" onWheel={onWheel}>
        <div
          ref={scroller}
          className="category-bar-chips"
          role="radiogroup"
          aria-label={appStrings.categoryBarLabel}
          onScroll={measure}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => {
            const checked = !searching && item.id === selectedId;
            return (
              <button
                key={item.id ?? 'all'}
                type="button"
                role="radio"
                className="category-chip"
                aria-checked={checked}
                tabIndex={item.id === focusable ? 0 : -1}
                data-slot={item.slot ?? undefined}
                data-all={item.id === null ? '' : undefined}
                onClick={() => onSelect(item.id)}
              >
                <i className="category-chip-dot" aria-hidden="true" />
                {item.name}{' '}
                <span className="category-chip-count">
                  {formatCompact(item.count)}
                </span>
              </button>
            );
          })}
        </div>
        {overflow.start && (
          <>
            <span className="category-bar-fade" data-side="start" />
            <button
              type="button"
              className="category-bar-scroll"
              data-side="start"
              tabIndex={-1}
              aria-label={appStrings.scrollCategoriesBack}
              title={appStrings.scrollCategoriesBack}
              onClick={() => page(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          </>
        )}
        {overflow.end && (
          <>
            <span className="category-bar-fade" data-side="end" />
            <button
              type="button"
              className="category-bar-scroll"
              data-side="end"
              tabIndex={-1}
              aria-label={appStrings.scrollCategoriesForward}
              title={appStrings.scrollCategoriesForward}
              onClick={() => page(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
