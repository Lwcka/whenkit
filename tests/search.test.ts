import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { ftsQuery } from '../src/adapters/sqlite/sqlite-catalog-store';
import { searchResultDtoSchema } from '../src/core/dto';
import { searchEntries } from '../src/core/search-entries';
import {
  batch,
  concept,
  importReport,
  initialized,
  material,
  tool,
  type CliSetup,
} from './cli-harness';
import { fixedClock, testStoreOpener } from './helpers';

// Full-text search (CAP-9, AD-5): the query builder on its own, and the
// adapter against a real catalog filled through the CLI import.

const FIRST_BATCH_AT = '2026-10-13T12:00:00.000Z';
const SECOND_BATCH_AT = '2026-10-14T09:30:00.000Z';

describe('ftsQuery', () => {
  it.each([
    ['fundal', '"fundal"*'],
    ['  fundal   video ', '"fundal"* AND "video"*'],
    ['fundal "photo', '"fundal"* AND """photo"*'],
    ['fundal"', '"fundal"""*'],
    ['AND', '"AND"*'],
    ['NEAR(', '"NEAR("*'],
    ['*', null],
    ['-x', '"-x"*'],
    ['a:b', '"a:b"*'],
    ['(', null],
    ['"', null],
    ['fundal - video', '"fundal"* AND "video"*'],
    ['', null],
    ['   ', null],
    ['ștergere', '"ștergere"*'],
    ['remove.bg', '"remove.bg"*'],
  ])('%j gives %j', (text, expected) => {
    expect(ftsQuery(text)).toBe(expected);
  });
});

/** Toolbox entries in the first batch; a concept, a material and a tool in the second. */
async function searchableCatalog(): Promise<CliSetup> {
  const s = await initialized();
  s.deps.clock = fixedClock(new Date(FIRST_BATCH_AT));
  await importReport(
    s,
    batch([
      tool('removebg', {
        name: 'remove.bg',
        whatItDoes: 'Removes the background of an image in seconds.',
        situations: ['When I need a transparent PNG'],
        keywords: ['fundal', 'background', 'png'],
      }),
      tool('photopea', {
        name: 'Photopea',
        whatItDoes: 'Editor de imagini în browser.',
        keywords: ['editor foto'],
      }),
      tool('erase', {
        name: 'Ștergere obiecte',
        whatItDoes: 'Îmagini fără obiecte nedorite.',
        keywords: ['fundal video'],
      }),
    ]),
  );
  s.deps.clock = fixedClock(new Date(SECOND_BATCH_AT));
  await importReport(
    s,
    batch([
      concept('k1', {
        name: 'Webhook',
        whatItDoes: 'Un apel HTTP pornit de server.',
        situations: ['Când aleg o arhitectură'],
        content: '# k1\n\nText lung.',
        keywords: ['fundal'],
      }),
      material('m1', { keywords: ['video', 'fundal'] }),
      tool('newest', {
        name: 'Alt tool',
        whatItDoes: 'Nimic special.',
        keywords: ['altceva'],
      }),
    ]),
  );
  return s;
}

function openStore(s: CliSetup) {
  return testStoreOpener()(s.dbPath, { migrate: false });
}

/** The names of the matching entries, in the order the search returned them. */
function namesFor(s: CliSetup, text: string): string[] {
  const store = openStore(s);
  try {
    const ids = searchEntries(store, text).ids;
    const byId = new Map(
      store.readTransaction((reader) =>
        reader.allEntries().map((entry) => [entry.id, entry.name] as const),
      ),
    );
    return ids.map((id) => byId.get(id) ?? id);
  } finally {
    store.close();
  }
}

describe('searchEntries on a real catalog', () => {
  it('finds a bilingual keyword on an entry with an English description', async () => {
    const s = await searchableCatalog();
    expect(namesFor(s, 'fundal')).toContain('remove.bg');
  });

  it('finds by name, by prefix and across diacritics and case', async () => {
    const s = await searchableCatalog();
    expect(namesFor(s, 'photopea')).toEqual(['Photopea']);
    expect(namesFor(s, 'photo')).toEqual(['Photopea']);
    expect(namesFor(s, 'stergere')).toEqual(['Ștergere obiecte']);
    expect(namesFor(s, 'ȘTERG')).toEqual(['Ștergere obiecte']);
    expect(namesFor(s, 'imag')).toContain('Ștergere obiecte');
    expect(namesFor(s, 'remove.bg')).toEqual(['remove.bg']);
  });

  it('finds in the situations and in the concept content', async () => {
    const s = await searchableCatalog();
    expect(namesFor(s, 'transparent')).toEqual(['remove.bg']);
    expect(namesFor(s, 'lung')).toEqual(['Webhook']);
  });

  it('requires every word, each as a prefix', async () => {
    const s = await searchableCatalog();
    expect(namesFor(s, 'fundal video')).toEqual([
      'Material m1',
      'Ștergere obiecte',
    ]);
    expect(namesFor(s, 'fundal xyz')).toEqual([]);
  });

  it('returns both zones, newest batch first, batch order inside it', async () => {
    const s = await searchableCatalog();
    expect(namesFor(s, 'fundal')).toEqual([
      'Webhook',
      'Material m1',
      'remove.bg',
      'Ștergere obiecte',
    ]);
  });

  it('treats typed full-text syntax as words and never throws', async () => {
    const s = await searchableCatalog();
    for (const text of [
      '"',
      'fundal"',
      'AND',
      'fundal AND',
      'NEAR(',
      'NEAR(fundal',
      '*',
      '-x',
      '-fundal',
      'a:b',
      'name:fundal',
      '(',
      ')',
      'fundal OR video',
      '^fundal',
      '"fundal" "video"',
    ]) {
      expect(() => namesFor(s, text), text).not.toThrow();
    }
    // Operators are plain words: this needs a word starting with „or”.
    expect(namesFor(s, 'fundal OR video')).toEqual([]);
    // Punctuation-only tokens are dropped, so they do not sink the rest.
    expect(namesFor(s, 'fundal -')).toEqual(namesFor(s, 'fundal'));
  });

  it('finds nothing for blank text or text with no letter or digit', async () => {
    const s = await searchableCatalog();
    for (const text of ['', '   ', '\t\n', '*', '- -', '()']) {
      expect(namesFor(s, text), JSON.stringify(text)).toEqual([]);
    }
  });

  it('answers the DTO shape', async () => {
    const s = await searchableCatalog();
    const store = openStore(s);
    const result = searchEntries(store, 'photo');
    store.close();
    expect(searchResultDtoSchema.parse(result)).toEqual(result);
    expect(result.ids).toHaveLength(1);
  });

  it('follows an update of the entry', async () => {
    const s = await searchableCatalog();
    const store = openStore(s);
    const before = store.searchEntryIds('photopea');
    store.close();
    s.deps.clock = fixedClock(new Date('2026-10-15T08:00:00.000Z'));
    await importReport(
      s,
      batch([
        tool('photopea', {
          op: 'update',
          id: before[0],
          name: 'Photopea',
          keywords: ['gimp'],
        }),
      ]),
    );
    expect(namesFor(s, 'gimp')).toEqual(['Photopea']);
    expect(namesFor(s, 'editor')).toEqual([]);
    expect(namesFor(s, 'foto')).toEqual([]);
  });

  it('never returns the entries of another owner', async () => {
    const s = await searchableCatalog();
    const db = new DatabaseSync(s.dbPath);
    try {
      db.exec(`
        INSERT INTO entries
          (id, owner_id, kind, name, url, what_it_does, keywords, dedup_key, added_at)
        VALUES
          ('foreign', 'someone-else', 'tool', 'Strain', 'https://strain.dev',
           'Altcineva', '["fundal"]', 'url:strain.dev', '2026-10-20T00:00:00.000Z')`);
    } finally {
      db.close();
    }
    const found = namesFor(s, 'fundal');
    expect(found).not.toContain('Strain');
    expect(found).toHaveLength(4);
    expect(namesFor(s, 'strain')).toEqual([]);
  });
});
