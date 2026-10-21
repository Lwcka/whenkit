import type { CategoryDto, EntryDto, Zone } from '../../shared/ipc';
import { appStrings, zoneLabels } from '../../shared/strings.ro';
import type { ToastInput } from './toast-store';

// The list view derived from the catalog snapshot (AD-10): which categories
// the bar shows, how many entries each holds, which entries a view lists and
// which color slot a category gets. Pure functions; nothing here re-sorts the
// entries, so every view keeps the snapshot order.

export type { Zone };

/** The order of the zones everywhere: tabs, manager, toasts. */
export const ZONE_ORDER: readonly Zone[] = ['toolbox', 'learn'];

/** DESIGN, Colors: the category colors are nine slots, then they start over. */
const CATEGORY_SLOT_COUNT = 9;

const collator = new Intl.Collator('ro');

/**
 * The color slot (1…9) of every category: in each zone the categories, sorted
 * by `id` as plain text, take the slots in order and then start over. The one
 * place this rule lives (DESIGN, Colors).
 */
export function categorySlots(
  categories: readonly CategoryDto[],
): Map<string, number> {
  const slots = new Map<string, number>();
  for (const zone of ZONE_ORDER) {
    const ids = categories
      .filter((category) => category.zone === zone)
      .map((category) => category.id)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    ids.forEach((id, index) => {
      slots.set(id, (index % CATEGORY_SLOT_COUNT) + 1);
    });
  }
  return slots;
}

/** The categories of a zone in Romanian alphabetical order. */
export function barCategories(
  categories: readonly CategoryDto[],
  zone: Zone,
): CategoryDto[] {
  return categories
    .filter((category) => category.zone === zone)
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** How many entries of the zone each category holds; absent means 0. */
export function categoryCounts(
  entries: readonly EntryDto[],
  zone: Zone,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.zone !== zone) continue;
    for (const category of entry.categories) {
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
    }
  }
  return counts;
}

/** The entries a view lists, in the order of the snapshot. */
export function entriesInView(
  entries: readonly EntryDto[],
  zone: Zone,
  categoryId: string | null,
): EntryDto[] {
  return entries.filter(
    (entry) =>
      entry.zone === zone &&
      (categoryId === null ||
        entry.categories.some((category) => category.id === categoryId)),
  );
}

/**
 * What a search found, split by the zone on screen: the matching entries of
 * `zone`, in the order of the snapshot (nothing here sorts), and how many
 * matches the other zone holds. Ids the snapshot does not know are ignored.
 */
export function searchHits(
  entries: readonly EntryDto[],
  ids: readonly string[],
  zone: Zone,
): { inZone: EntryDto[]; otherZone: number } {
  const wanted = new Set(ids);
  const inZone: EntryDto[] = [];
  let otherZone = 0;
  for (const entry of entries) {
    if (!wanted.has(entry.id)) continue;
    if (entry.zone === zone) inZone.push(entry);
    else otherZone++;
  }
  return { inZone, otherZone };
}

/**
 * The category a zone shows: the remembered one while it is still in the
 * snapshot, otherwise `null` (Toate).
 */
export function viewCategoryId(
  categories: readonly CategoryDto[],
  zone: Zone,
  remembered: string | null,
): string | null {
  if (remembered === null) return null;
  return categories.some(
    (category) => category.id === remembered && category.zone === zone,
  )
    ? remembered
    : null;
}

/**
 * The previous (-1) or next (+1) bar position from `current`, where `null` is
 * Toate and comes first; clamped at both ends.
 */
export function neighborCategoryId(
  bar: readonly CategoryDto[],
  current: string | null,
  delta: -1 | 1,
): string | null {
  const ids: (string | null)[] = [null, ...bar.map((category) => category.id)];
  const index = Math.max(ids.indexOf(current), 0);
  const next = Math.min(Math.max(index + delta, 0), ids.length - 1);
  return ids[next] ?? null;
}

/**
 * The host a card shows: the hostname without `www.`, and for GitHub
 * `github.com/<owner>`. `null` when there is no usable URL.
 */
export function cardHost(url: string | null): string | null {
  if (url === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'github.com') {
    const owner = parsed.pathname.split('/').find((part) => part !== '');
    if (owner !== undefined) return `github.com/${owner}`;
  }
  return host === '' ? null : host;
}

export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export function isGridKey(code: string): code is GridKey {
  return (
    code === 'ArrowLeft' ||
    code === 'ArrowRight' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown'
  );
}

/**
 * Where an arrow key moves the selection in a grid of `count` cards laid out
 * in `columns` columns: left and right by one, up and down by a row; clamped.
 */
export function nextGridIndex(
  index: number,
  key: GridKey,
  columns: number,
  count: number,
): number {
  if (count <= 0) return 0;
  const step = Math.max(columns, 1);
  const delta =
    key === 'ArrowLeft'
      ? -1
      : key === 'ArrowRight'
        ? 1
        : key === 'ArrowUp'
          ? -step
          : step;
  return Math.min(Math.max(index + delta, 0), count - 1);
}

/** DESIGN motion.tape-lifetime (600 s), mirrored from tokens.css for the clock. */
export const TAPE_LIFETIME_MS = 600_000;

/** True while an arrival's tape, ring and „· N nouă” last (EXPERIENCE, arrival-tape). */
export function isNew(arrivedAt: number, now: number): boolean {
  return now - arrivedAt < TAPE_LIFETIME_MS;
}

/**
 * The toasts of an arrival, one per zone and Toolbox first (EXPERIENCE,
 * toast): a single entry names itself and its category and gets „Deschide”,
 * which calls `onOpen` with its id; several are counted and get „Vezi”, which
 * calls `onSee` with their zone. Zones with no arrival get none.
 */
export function arrivalToasts(
  arrived: readonly EntryDto[],
  onSee: (zone: Zone) => void,
  onOpen: (id: string) => void,
): ToastInput[] {
  const toasts: ToastInput[] = [];
  for (const zone of ZONE_ORDER) {
    const inZone = arrived.filter((entry) => entry.zone === zone);
    const [first] = inZone;
    if (first === undefined) continue;
    if (inZone.length === 1) {
      toasts.push({
        kind: 'arrival',
        message: appStrings.arrivalToastOne(
          first.name,
          zoneLabels[zone],
          first.categories[0]?.name ?? null,
        ),
        action: {
          label: appStrings.arrivalToastOpen,
          run: () => onOpen(first.id),
        },
      });
    } else {
      toasts.push({
        kind: 'arrival',
        message: appStrings.arrivalToastMany(inZone.length, zoneLabels[zone]),
        action: {
          label: appStrings.arrivalToastSee,
          run: () => onSee(zone),
        },
      });
    }
  }
  return toasts;
}

/** The color slot of an entry: the one of its first category, if it has any. */
export function entrySlot(
  entry: EntryDto,
  slots: ReadonlyMap<string, number>,
): number | null {
  // Categories arrive sorted by name_key: the first one colors the entry.
  const first = entry.categories[0];
  return first === undefined ? null : (slots.get(first.id) ?? null);
}

/**
 * The pulse of an update from the terminal: the parity of the store's counter
 * for the entry, once it differs from what was counted when the view mounted.
 * A change of value restarts the animation.
 */
export function pulseParity(
  count: number,
  atMount: number,
): 'a' | 'b' | undefined {
  if (count === atMount) return undefined;
  return count % 2 === 0 ? 'b' : 'a';
}

/** The breadcrumbs of a sheet: „Toolbox / Imagini & video / remove.bg”. */
export function sheetCrumbs(entry: EntryDto): string[] {
  const [first] = entry.categories;
  return [
    zoneLabels[entry.zone],
    ...(first === undefined ? [] : [first.name]),
    entry.name,
  ];
}

/** An id shortened to its first and last four characters: `7f3c…e21a`. */
export function shortId(id: string): string {
  return id.length <= 9 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** The entries a sheet links to, in the order of the entry's own lists. */
export interface SheetLinks {
  children: EntryDto[];
  parents: EntryDto[];
  related: EntryDto[];
}

/** The linked entries of `entry`; ids the snapshot does not know are skipped. */
export function sheetLinks(
  entry: EntryDto,
  entries: readonly EntryDto[],
): SheetLinks {
  const byId = new Map(entries.map((candidate) => [candidate.id, candidate]));
  const pick = (ids: readonly string[]): EntryDto[] =>
    ids.flatMap((id) => {
      const found = byId.get(id);
      return found === undefined ? [] : [found];
    });
  return {
    children: pick(entry.childIds),
    parents: pick(entry.parentIds),
    related: pick(entry.relatedIds),
  };
}
