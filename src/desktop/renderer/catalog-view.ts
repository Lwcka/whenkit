import type { CategoryDto, EntryDto } from '../../shared/ipc';

// The list view derived from the catalog snapshot (AD-10): which categories
// the bar shows, how many entries each holds, which entries a view lists and
// which color slot a category gets. Pure functions; nothing here re-sorts the
// entries, so every view keeps the snapshot order.

export type Zone = EntryDto['zone'];

/** DESIGN, Colors: the category colors are nine slots, then they start over. */
export const CATEGORY_SLOT_COUNT = 9;

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
  const zones: Zone[] = ['toolbox', 'learn'];
  for (const zone of zones) {
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
