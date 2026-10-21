import { describe, expect, it } from 'vitest';
import {
  deleteCategory,
  mergeCategories,
  renameCategory,
} from '../src/core/categories';
import { searchEntries } from '../src/core/search-entries';
import {
  batch,
  count,
  importReport,
  initialized,
  show,
  tool,
  type CliSetup,
} from './cli-harness';
import { errorCodeOf, testStoreOpener } from './helpers';

// Category management (AD-3, AD-5) on the real store, in a temp development
// workspace: rename, merge and delete, with the revision rules and the rows
// of `entry_categories` checked after each.

type Store = ReturnType<ReturnType<typeof testStoreOpener>>;

function onStore<T>(s: CliSetup, fn: (store: Store) => T): T {
  const store = testStoreOpener()(s.dbPath, {});
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

/**
 * Four tools and a concept. `a` has only Imagini & video, `b` has Imagini &
 * video and Design & UI, `c` has Design & UI and AI & LLM, `d` has only
 * Securitate; `k` is a Learn concept with only Securitate.
 */
async function withCatalog() {
  const s = await initialized();
  const report = await importReport(
    s,
    batch([
      tool('a', { categories: ['Imagini & video'] }),
      tool('b', { categories: ['Imagini & video', 'Design & UI'] }),
      tool('c', { categories: ['Design & UI', 'AI & LLM'] }),
      tool('d', { categories: ['Securitate'] }),
      {
        ref: 'k',
        op: 'add',
        kind: 'concept',
        name: 'Concept k',
        categories: ['Securitate'],
        whatItDoes: 'Explică ceva.',
        situations: ['Când aleg'],
        content: '# k',
      },
    ]),
  );
  const ids = Object.fromEntries(
    report.items.map((item) => [item.ref, String(item.id)]),
  );
  return { s, ids };
}

/** The id of the category with this name in the zone. */
function categoryId(
  s: CliSetup,
  zone: 'toolbox' | 'learn',
  name: string,
): string {
  const found = onStore(s, (store) =>
    store.categoriesInZone(zone).find((category) => category.name === name),
  );
  if (found === undefined) throw new Error(`no category ${name}`);
  return found.id;
}

async function names(s: CliSetup, id: string): Promise<string[]> {
  return (await show(s, id)).categories.map((c: { name: string }) => c.name);
}

async function revisionOf(s: CliSetup, id: string): Promise<number> {
  return Number((await show(s, id)).revision);
}

describe('renameCategory', () => {
  it('renames in place: entries show the new name and their revision stays', async () => {
    const { s, ids } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const before = await revisionOf(s, ids.a);

    const result = onStore(s, (store) =>
      renameCategory(store, { id: imagini, name: '  Foto   și video ' }),
    );

    expect(result.changed.map((e) => e.id).sort()).toEqual(
      [ids.a, ids.b].sort(),
    );
    expect(result.changed.every((e) => e.revision === before)).toBe(true);
    expect(result.categories.find((c) => c.id === imagini)?.name).toBe(
      'Foto și video',
    );
    expect(await names(s, ids.a)).toEqual(['Foto și video']);
    expect(await revisionOf(s, ids.a)).toBe(before);
    expect(count(s.dbPath, 'entry_categories')).toBe(7);
    // The full-text index does not hold categories: a content search is intact.
    expect(
      onStore(s, (store) => searchEntries(store, 'util').ids),
    ).toHaveLength(4);
  });

  it('accepts a change of case or accents of the same category', async () => {
    const { s } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const result = onStore(s, (store) =>
      renameCategory(store, { id: imagini, name: 'IMAGINI & VIDEO' }),
    );
    expect(result.categories.find((c) => c.id === imagini)?.name).toBe(
      'IMAGINI & VIDEO',
    );
  });

  it('refuses a name another category of the zone has, by its normalized key', async () => {
    const { s } = await withCatalog();
    const design = categoryId(s, 'toolbox', 'Design & UI');
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          renameCategory(store, { id: design, name: ' imagini &  VIDEO' }),
        ),
      ),
    ).toBe('CATEGORY_NAME_TAKEN');
    expect(categoryId(s, 'toolbox', 'Design & UI')).toBe(design);
  });

  it('allows the name of a category of the other zone', async () => {
    const { s } = await withCatalog();
    const securitate = categoryId(s, 'toolbox', 'Securitate');
    const result = onStore(s, (store) =>
      renameCategory(store, { id: securitate, name: 'Limbaje' }),
    );
    expect(result.categories.filter((c) => c.name === 'Limbaje')).toHaveLength(
      2,
    );
  });

  it('refuses an empty name and an unknown category', async () => {
    const { s } = await withCatalog();
    const design = categoryId(s, 'toolbox', 'Design & UI');
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          renameCategory(store, { id: design, name: '  ' }),
        ),
      ),
    ).toBe('ARGUMENTS_INVALID');
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          renameCategory(store, { id: 'nope', name: 'Nou' }),
        ),
      ),
    ).toBe('CATEGORY_NOT_FOUND');
  });
});

describe('mergeCategories', () => {
  it('moves the entries to the target once and bumps their revision', async () => {
    const { s, ids } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const design = categoryId(s, 'toolbox', 'Design & UI');
    const before = {
      a: await revisionOf(s, ids.a),
      b: await revisionOf(s, ids.b),
      c: await revisionOf(s, ids.c),
      d: await revisionOf(s, ids.d),
    };

    const result = onStore(s, (store) =>
      mergeCategories(store, { sourceId: imagini, targetId: design }),
    );

    expect(result.changed.map((e) => e.id).sort()).toEqual(
      [ids.a, ids.b].sort(),
    );
    expect(result.categories.some((c) => c.id === imagini)).toBe(false);
    expect(await names(s, ids.a)).toEqual(['Design & UI']);
    // b had both: the target appears once.
    expect(await names(s, ids.b)).toEqual(['Design & UI']);
    expect(await revisionOf(s, ids.a)).toBe(before.a + 1);
    expect(await revisionOf(s, ids.b)).toBe(before.b + 1);
    expect(await revisionOf(s, ids.c)).toBe(before.c);
    expect(await revisionOf(s, ids.d)).toBe(before.d);
    // a: 1, b: 1 (was 2), c: 2, d: 1, k: 1.
    expect(count(s.dbPath, 'entry_categories')).toBe(6);
  });

  it('refuses another zone, the same category and unknown ones, writing nothing', async () => {
    const { s, ids } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const learnSecurity = categoryId(s, 'learn', 'Securitate');
    const revision = await revisionOf(s, ids.a);

    const attempt = (sourceId: string, targetId: string) =>
      errorCodeOf(() =>
        onStore(s, (store) => mergeCategories(store, { sourceId, targetId })),
      );
    expect(attempt(imagini, learnSecurity)).toBe('ARGUMENTS_INVALID');
    expect(attempt(imagini, imagini)).toBe('ARGUMENTS_INVALID');
    expect(attempt('nope', imagini)).toBe('CATEGORY_NOT_FOUND');
    expect(attempt(imagini, 'nope')).toBe('CATEGORY_NOT_FOUND');

    expect(await revisionOf(s, ids.a)).toBe(revision);
    expect(await names(s, ids.a)).toEqual(['Imagini & video']);
    expect(count(s.dbPath, 'entry_categories')).toBe(7);
  });
});

describe('deleteCategory', () => {
  it('deletes a category with no entries', async () => {
    const { s } = await withCatalog();
    const terminal = categoryId(s, 'toolbox', 'Terminal & dev tools');
    const result = onStore(s, (store) =>
      deleteCategory(store, { id: terminal }),
    );
    expect(result.changed).toEqual([]);
    expect(result.categories.some((c) => c.id === terminal)).toBe(false);
    expect(count(s.dbPath, 'categories')).toBe(15);
  });

  it('removes a shared category from its entries and bumps their revision', async () => {
    const { s, ids } = await withCatalog();
    const design = categoryId(s, 'toolbox', 'Design & UI');
    const before = {
      b: await revisionOf(s, ids.b),
      c: await revisionOf(s, ids.c),
    };

    const result = onStore(s, (store) => deleteCategory(store, { id: design }));

    expect(result.changed.map((e) => e.id).sort()).toEqual(
      [ids.b, ids.c].sort(),
    );
    expect(await names(s, ids.b)).toEqual(['Imagini & video']);
    expect(await names(s, ids.c)).toEqual(['AI & LLM']);
    expect(await revisionOf(s, ids.b)).toBe(before.b + 1);
    expect(await revisionOf(s, ids.c)).toBe(before.c + 1);
    expect(count(s.dbPath, 'entry_categories')).toBe(5);
  });

  it('needs a target when an entry has only this category, and writes nothing without it', async () => {
    const { s, ids } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const revision = await revisionOf(s, ids.a);

    expect(
      errorCodeOf(() =>
        onStore(s, (store) => deleteCategory(store, { id: imagini })),
      ),
    ).toBe('CATEGORY_TARGET_REQUIRED');

    expect(await names(s, ids.a)).toEqual(['Imagini & video']);
    expect(await revisionOf(s, ids.a)).toBe(revision);
    expect(count(s.dbPath, 'categories')).toBe(16);
  });

  it('behaves as a merge with a target of the same zone', async () => {
    const { s, ids } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const design = categoryId(s, 'toolbox', 'Design & UI');
    const revision = await revisionOf(s, ids.a);

    const result = onStore(s, (store) =>
      deleteCategory(store, { id: imagini, targetId: design }),
    );

    expect(result.changed.map((e) => e.id).sort()).toEqual(
      [ids.a, ids.b].sort(),
    );
    expect(await names(s, ids.a)).toEqual(['Design & UI']);
    expect(await names(s, ids.b)).toEqual(['Design & UI']);
    expect(await revisionOf(s, ids.a)).toBe(revision + 1);
    expect(result.categories.some((c) => c.id === imagini)).toBe(false);
  });

  it('refuses a target of another zone and an unknown category', async () => {
    const { s } = await withCatalog();
    const imagini = categoryId(s, 'toolbox', 'Imagini & video');
    const learnSecurity = categoryId(s, 'learn', 'Securitate');
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          deleteCategory(store, { id: imagini, targetId: learnSecurity }),
        ),
      ),
    ).toBe('ARGUMENTS_INVALID');
    expect(
      errorCodeOf(() =>
        onStore(s, (store) => deleteCategory(store, { id: 'nope' })),
      ),
    ).toBe('CATEGORY_NOT_FOUND');
    expect(count(s.dbPath, 'categories')).toBe(16);
  });
});
