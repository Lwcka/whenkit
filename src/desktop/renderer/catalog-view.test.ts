import { describe, expect, it } from 'vitest';
import type { CategoryDto, EntryDto } from '../../shared/ipc';
import {
  barCategories,
  cardHost,
  categoryCounts,
  categorySlots,
  entriesInView,
  neighborCategoryId,
  nextGridIndex,
  viewCategoryId,
} from './catalog-view';

function category(
  id: string,
  name: string,
  zone: CategoryDto['zone'] = 'toolbox',
): CategoryDto {
  return { id, zone, name };
}

function entry(
  id: string,
  zone: EntryDto['zone'],
  categories: readonly CategoryDto[],
): EntryDto {
  return {
    id,
    ownerId: 'owner',
    kind: zone === 'toolbox' ? 'tool' : 'concept',
    zone,
    name: id,
    url: null,
    resourceType: null,
    categories: categories.map(({ id: categoryId, name }) => ({
      id: categoryId,
      name,
    })),
    relatedIds: [],
    parentIds: [],
    childIds: [],
    whatItDoes: '',
    situations: [],
    keywords: [],
    sources: [],
    content: null,
    myNotes: '',
    githubStars: null,
    githubPushedAt: null,
    githubArchived: null,
    verificationNotes: [],
    forced: false,
    revision: 1,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
  };
}

describe('categorySlots', () => {
  it('gives slots 1…9 in the order of the ids, as plain text', () => {
    // 'b' sorts before 'c' whatever the order of arrival.
    const slots = categorySlots([
      category('c', 'C'),
      category('a', 'A'),
      category('b', 'B'),
    ]);
    expect([slots.get('a'), slots.get('b'), slots.get('c')]).toEqual([1, 2, 3]);
  });

  it('sorts ids as text, not as locale-aware strings', () => {
    // Plain code-unit order puts uppercase before lowercase.
    const slots = categorySlots([category('a', 'A'), category('B', 'B')]);
    expect(slots.get('B')).toBe(1);
    expect(slots.get('a')).toBe(2);
  });

  it('starts over after nine: the tenth gets slot 1', () => {
    const categories = Array.from({ length: 10 }, (_, index) =>
      category(`id-${index}`, `Categoria ${index}`),
    );
    const slots = categorySlots(categories);
    expect(categories.map((c) => slots.get(c.id))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 1,
    ]);
  });

  it('counts the zones separately', () => {
    const slots = categorySlots([
      category('b', 'B', 'toolbox'),
      category('a', 'A', 'learn'),
      category('c', 'C', 'learn'),
    ]);
    expect(slots.get('b')).toBe(1);
    expect(slots.get('a')).toBe(1);
    expect(slots.get('c')).toBe(2);
  });
});

describe('barCategories', () => {
  it('lists the zone in Romanian alphabetical order, diacritics included', () => {
    const bar = barCategories(
      [
        category('1', 'Țări'),
        category('2', 'Tabele'),
        category('3', 'Zero'),
        category('4', 'Ana'),
        category('5', 'Învățare'),
        category('6', 'Iepuri'),
        category('7', 'Altă zonă', 'learn'),
      ],
      'toolbox',
    );
    // Ț sorts after T (and after Tabele), Î after I.
    expect(bar.map((c) => c.name)).toEqual([
      'Ana',
      'Iepuri',
      'Învățare',
      'Tabele',
      'Țări',
      'Zero',
    ]);
  });
});

describe('categoryCounts and entriesInView', () => {
  const a = category('a', 'A');
  const b = category('b', 'B');
  const learn = category('l', 'L', 'learn');
  const entries = [
    entry('1', 'toolbox', [a]),
    entry('2', 'toolbox', [a, b]),
    entry('3', 'learn', [learn]),
    entry('4', 'toolbox', [b]),
  ];

  it('counts per category within the zone, absent meaning 0', () => {
    const counts = categoryCounts(entries, 'toolbox');
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(2);
    expect(counts.get('l')).toBeUndefined();
  });

  it('lists a whole zone under Toate, in snapshot order', () => {
    expect(entriesInView(entries, 'toolbox', null).map((e) => e.id)).toEqual([
      '1',
      '2',
      '4',
    ]);
  });

  it('lists a category with its entries in snapshot order; two-category entries appear in both', () => {
    expect(entriesInView(entries, 'toolbox', 'a').map((e) => e.id)).toEqual([
      '1',
      '2',
    ]);
    expect(entriesInView(entries, 'toolbox', 'b').map((e) => e.id)).toEqual([
      '2',
      '4',
    ]);
  });

  it('lists nothing for a category without entries', () => {
    expect(entriesInView(entries, 'toolbox', 'zzz')).toEqual([]);
  });
});

describe('viewCategoryId and neighborCategoryId', () => {
  const bar = [category('a', 'A'), category('b', 'B'), category('c', 'C')];

  it('keeps the remembered category while it is in the snapshot of the zone', () => {
    expect(viewCategoryId(bar, 'toolbox', 'b')).toBe('b');
    expect(viewCategoryId(bar, 'learn', 'b')).toBeNull();
    expect(viewCategoryId(bar, 'toolbox', 'gone')).toBeNull();
    expect(viewCategoryId(bar, 'toolbox', null)).toBeNull();
  });

  it('moves one step along the bar, Toate first, clamped at both ends', () => {
    expect(neighborCategoryId(bar, null, 1)).toBe('a');
    expect(neighborCategoryId(bar, 'a', 1)).toBe('b');
    expect(neighborCategoryId(bar, 'c', 1)).toBe('c');
    expect(neighborCategoryId(bar, 'b', -1)).toBe('a');
    expect(neighborCategoryId(bar, 'a', -1)).toBeNull();
    expect(neighborCategoryId(bar, null, -1)).toBeNull();
    expect(neighborCategoryId([], null, 1)).toBeNull();
  });
});

describe('cardHost', () => {
  it.each([
    ['https://www.remove.bg/ro', 'remove.bg'],
    ['https://squoosh.app', 'squoosh.app'],
    ['https://github.com/comfyanonymous/ComfyUI', 'github.com/comfyanonymous'],
    ['https://www.github.com/owner/repo', 'github.com/owner'],
    ['https://github.com/', 'github.com'],
    ['https://docs.example.com/a/b?x=1', 'docs.example.com'],
  ])('%s -> %s', (url, expected) => {
    expect(cardHost(url)).toBe(expected);
  });

  it('gives null for no URL or one that cannot be read', () => {
    expect(cardHost(null)).toBeNull();
    expect(cardHost('not a url')).toBeNull();
  });
});

describe('nextGridIndex', () => {
  it('moves by one with left and right, clamped', () => {
    expect(nextGridIndex(1, 'ArrowRight', 3, 5)).toBe(2);
    expect(nextGridIndex(1, 'ArrowLeft', 3, 5)).toBe(0);
    expect(nextGridIndex(0, 'ArrowLeft', 3, 5)).toBe(0);
    expect(nextGridIndex(4, 'ArrowRight', 3, 5)).toBe(4);
  });

  it('moves by a row with up and down, clamped', () => {
    expect(nextGridIndex(1, 'ArrowDown', 3, 8)).toBe(4);
    expect(nextGridIndex(4, 'ArrowUp', 3, 8)).toBe(1);
    expect(nextGridIndex(1, 'ArrowUp', 3, 8)).toBe(0);
    expect(nextGridIndex(6, 'ArrowDown', 3, 8)).toBe(7);
  });

  it('treats an unknown column count as one', () => {
    expect(nextGridIndex(0, 'ArrowDown', 0, 3)).toBe(1);
    expect(nextGridIndex(2, 'ArrowUp', 1, 3)).toBe(1);
  });

  it('stays at 0 in an empty grid', () => {
    expect(nextGridIndex(0, 'ArrowRight', 3, 0)).toBe(0);
  });
});
