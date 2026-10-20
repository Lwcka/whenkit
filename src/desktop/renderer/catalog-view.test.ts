import { describe, expect, it, vi } from 'vitest';
import type { CategoryDto, EntryDto } from '../../shared/ipc';
import {
  TAPE_LIFETIME_MS,
  arrivalToasts,
  barCategories,
  cardHost,
  categoryCounts,
  categorySlots,
  entriesInView,
  isNew,
  neighborCategoryId,
  nextGridIndex,
  pulseParity,
  searchHits,
  sheetCrumbs,
  sheetLinks,
  shortId,
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

describe('isNew', () => {
  it('lasts the tape lifetime (600 s)', () => {
    expect(TAPE_LIFETIME_MS).toBe(600_000);
    expect(isNew(1000, 1000)).toBe(true);
    expect(isNew(1000, 1000 + TAPE_LIFETIME_MS - 1)).toBe(true);
    expect(isNew(1000, 1000 + TAPE_LIFETIME_MS)).toBe(false);
  });

  it('counts an arrival ahead of a stale clock as new', () => {
    expect(isNew(5000, 4000)).toBe(true);
  });
});

describe('arrivalToasts', () => {
  const backend = category('c-be', 'Backend & API-uri', 'learn');
  const imagini = category('c-img', 'Imagini & video');
  const named = (id: string, zone: EntryDto['zone'], cat?: CategoryDto) => ({
    ...entry(id, zone, cat === undefined ? [] : [cat]),
    name: id,
  });

  it('makes one toast per zone, Toolbox first, whatever the batch order', () => {
    const arrived = [
      named('Webhook', 'learn', backend),
      ...['t1', 't2', 't3', 't4', 't5'].map((id) =>
        named(id, 'toolbox', imagini),
      ),
    ];
    const toasts = arrivalToasts(arrived, vi.fn(), vi.fn());

    expect(toasts.map((toast) => [toast.kind, toast.message])).toEqual([
      ['arrival', [{ strong: '5 fișe noi' }, ' în Toolbox']],
      [
        'arrival',
        ['Fișă nouă: ', { strong: 'Webhook' }, ' · Learn / Backend & API-uri'],
      ],
    ]);
  });

  it('gives „Vezi” to a zone with several entries, which goes to that zone', () => {
    const onSee = vi.fn();
    const [many] = arrivalToasts(
      [named('a', 'learn', backend), named('b', 'learn', backend)],
      onSee,
      vi.fn(),
    );
    expect(many?.action?.label).toBe('Vezi');
    many?.action?.run();
    expect(onSee).toHaveBeenCalledWith('learn');
  });

  it('gives „Deschide” to a single entry, which opens that entry', () => {
    const onSee = vi.fn();
    const onOpen = vi.fn();
    const [one] = arrivalToasts(
      [named('a', 'toolbox', imagini)],
      onSee,
      onOpen,
    );
    expect(one?.action?.label).toBe('Deschide');
    one?.action?.run();
    expect(onOpen).toHaveBeenCalledWith('a');
    expect(onSee).not.toHaveBeenCalled();
  });

  it('names only the zone for an entry without categories', () => {
    const [one] = arrivalToasts([named('Webhook', 'learn')], vi.fn(), vi.fn());
    expect(one?.message).toEqual([
      'Fișă nouă: ',
      { strong: 'Webhook' },
      ' · Learn',
    ]);
  });

  it('makes nothing for no arrivals', () => {
    expect(arrivalToasts([], vi.fn(), vi.fn())).toEqual([]);
  });
});

describe('searchHits', () => {
  const all = [
    entry('t1', 'toolbox', []),
    entry('l1', 'learn', []),
    entry('t2', 'toolbox', []),
    entry('l2', 'learn', []),
    entry('t3', 'toolbox', []),
  ];

  it('keeps the snapshot order, whatever the order of the ids', () => {
    const { inZone } = searchHits(all, ['t3', 't1', 'l2'], 'toolbox');
    expect(inZone.map((e) => e.id)).toEqual(['t1', 't3']);
  });

  it('counts the other zone instead of listing it', () => {
    expect(searchHits(all, ['t1', 'l1', 'l2'], 'toolbox').otherZone).toBe(2);
    const learn = searchHits(all, ['t1', 'l1', 'l2'], 'learn');
    expect(learn.inZone.map((e) => e.id)).toEqual(['l1', 'l2']);
    expect(learn.otherZone).toBe(1);
  });

  it('ignores ids the snapshot does not have and finds nothing for no ids', () => {
    expect(searchHits(all, ['gone'], 'toolbox')).toEqual({
      inZone: [],
      otherZone: 0,
    });
    expect(searchHits(all, [], 'learn')).toEqual({ inZone: [], otherZone: 0 });
  });
});

describe('sheetCrumbs', () => {
  it('names the zone, the first category and the entry', () => {
    const imagini = category('c-img', 'Imagini & video');
    const other = category('c-z', 'Zebre');
    expect(
      sheetCrumbs({
        ...entry('r', 'toolbox', [imagini, other]),
        name: 'remove.bg',
      }),
    ).toEqual(['Toolbox', 'Imagini & video', 'remove.bg']);
  });

  it('leaves the category out when the entry has none', () => {
    expect(
      sheetCrumbs({ ...entry('w', 'learn', []), name: 'Webhook' }),
    ).toEqual(['Learn', 'Webhook']);
  });
});

describe('shortId', () => {
  it('keeps the first and last four characters', () => {
    expect(shortId('7f3c9a10-4b2e-4c1d-8e55-0a1b2c3de21a')).toBe('7f3c…e21a');
  });

  it('leaves a short id alone', () => {
    expect(shortId('abc')).toBe('abc');
  });
});

describe('sheetLinks', () => {
  it('resolves the children, parents and related entries, skipping unknown ids', () => {
    const all = ['a', 'b', 'c', 'd'].map((id) => entry(id, 'learn', []));
    const links = sheetLinks(
      {
        ...entry('x', 'learn', []),
        childIds: ['b', 'ghost', 'a'],
        parentIds: ['d'],
        relatedIds: ['c', 'ghost'],
      },
      all,
    );
    expect(links.children.map((e) => e.id)).toEqual(['b', 'a']);
    expect(links.parents.map((e) => e.id)).toEqual(['d']);
    expect(links.related.map((e) => e.id)).toEqual(['c']);
  });
});

describe('pulseParity', () => {
  it('is quiet while the count is what the view mounted with', () => {
    expect(pulseParity(2, 2)).toBeUndefined();
  });

  it('alternates with every update so the animation restarts', () => {
    expect(pulseParity(1, 0)).toBe('a');
    expect(pulseParity(2, 0)).toBe('b');
    expect(pulseParity(3, 0)).toBe('a');
  });
});
