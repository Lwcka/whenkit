import { describe, expect, it } from 'vitest';
import type { Batch } from './batch-schema';
import type { Zone } from './category-seed';
import { WhenkitError } from './errors';
import { applyBatch, parseBatch, readBatch } from './import-batch';
import { nameKey } from './name-key';
import type {
  CatalogStore,
  CatalogWriter,
  FileSystem,
  NewEntryRow,
  StoredCategory,
  StoredEntry,
} from './ports';
import type { ItemVerdict } from './verification/verify';

// Core tests run on an in-memory fake store (AD-2); the real SQLite store is
// covered in tests/.

class FakeStore implements CatalogStore {
  categories: StoredCategory[] = [];
  entries: (NewEntryRow & { categoryIds: string[] })[] = [];
  transactions = 0;
  /** Revisions of the entries an update rewrote; 1 when absent. */
  revisions = new Map<string, number>();

  constructor(seed: { zone: Zone; name: string }[] = []) {
    seed.forEach(({ zone, name }, index) =>
      this.categories.push({
        id: `seed-${index + 1}`,
        zone,
        name,
        nameKey: nameKey(name),
      }),
    );
  }

  ownerId() {
    return 'owner';
  }
  schemaVersion() {
    return 1;
  }
  close() {}

  categoriesInZone(zone: Zone) {
    return this.categories
      .filter((c) => c.zone === zone)
      .map((c) => ({ ...c }));
  }
  entryById(id: string): StoredEntry | undefined {
    const row = this.entries.find((e) => e.id === id);
    if (row === undefined) return undefined;
    const { categoryIds, ...fields } = row;
    return {
      ...fields,
      ownerId: 'owner',
      categories: this.categories.filter((c) => categoryIds.includes(c.id)),
      myNotes: '',
      githubStars: null,
      githubPushedAt: null,
      githubArchived: null,
      forced: false,
      revision: this.revisions.get(id) ?? 1,
    };
  }
  entrySummaries(): never {
    throw new Error('not used by import');
  }
  entryIdByDedupKey(key: string) {
    return this.entries.find((e) => e.dedupKey === key)?.id;
  }

  writeTransaction<T>(fn: (writer: CatalogWriter) => T): T {
    this.transactions += 1;
    // Writes replace array elements instead of mutating them, so these
    // shallow copies are a full snapshot.
    const snapshot = {
      categories: [...this.categories],
      entries: [...this.entries],
      revisions: new Map(this.revisions),
    };
    const indexOf = (id: string) => {
      const index = this.entries.findIndex((e) => e.id === id);
      if (index < 0) throw new Error(`no entry ${id}`);
      return index;
    };
    const writer: CatalogWriter = {
      categoriesInZone: (zone) => this.categoriesInZone(zone),
      entryById: (id) => this.entryById(id),
      entrySummaries: () => this.entrySummaries(),
      entryIdByDedupKey: (key) => this.entryIdByDedupKey(key),
      updateEntry: (entry) => {
        const index = indexOf(entry.id);
        const old = this.entries[index];
        if (
          this.entries.some(
            (e) => e.id !== entry.id && e.dedupKey === entry.dedupKey,
          )
        ) {
          throw new Error('UNIQUE dedup_key');
        }
        this.entries[index] = {
          ...entry,
          addedAt: old.addedAt,
          categoryIds: old.categoryIds,
        };
        this.revisions.set(entry.id, (this.revisions.get(entry.id) ?? 1) + 1);
      },
      replaceEntryCategories: (entryId, categoryIds) => {
        const index = indexOf(entryId);
        this.entries[index] = {
          ...this.entries[index],
          categoryIds: [...categoryIds],
        };
      },
      insertCategory: (category) => {
        if (this.categories.some((c) => c.id === category.id)) {
          throw new Error('duplicate category id');
        }
        this.categories.push({ ...category });
      },
      insertEntry: (entry) => {
        if (this.entries.some((e) => e.dedupKey === entry.dedupKey)) {
          throw new Error('UNIQUE dedup_key');
        }
        this.entries.push({ ...entry, categoryIds: [] });
      },
      addEntryCategory: (entryId, categoryId) => {
        const index = indexOf(entryId);
        this.entries[index] = {
          ...this.entries[index],
          categoryIds: [...this.entries[index].categoryIds, categoryId],
        };
      },
    };
    try {
      return fn(writer);
    } catch (error) {
      this.categories = snapshot.categories;
      this.entries = snapshot.entries;
      this.revisions = snapshot.revisions;
      throw error;
    }
  }
}

const SEED = [
  { zone: 'toolbox' as const, name: 'Imagini & video' },
  { zone: 'toolbox' as const, name: 'Securitate' },
  { zone: 'learn' as const, name: 'Backend & API-uri' },
  { zone: 'learn' as const, name: 'Securitate' },
];

function counterIds() {
  let n = 0;
  return { newId: () => `id-${++n}` };
}

const NOW = new Date('2026-10-13T12:00:00.000Z');

function context() {
  return { clock: { now: () => NOW }, ids: counterIds(), workspace: 'D:\\ws' };
}

function tool(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'tool',
    name: `Tool ${ref}`,
    url: `https://${ref}.dev`,
    resourceType: 'site',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva util.',
    situations: ['Când am nevoie'],
    ...overrides,
  };
}

function batchText(items: unknown[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({ schemaVersion: 1, items, ...extra });
}

function errorOf(action: () => unknown): WhenkitError {
  try {
    action();
  } catch (error) {
    if (error instanceof WhenkitError) return error;
    throw error;
  }
  throw new Error('expected a WhenkitError');
}

/**
 * Phase 2 verdicts as verification gives them for working links: Claude's
 * flag rejects, every other item is accepted with all its sources. Entries
 * in `overrides` replace the verdict of their ref.
 */
function verdictsFor(
  batch: Batch,
  overrides: Record<string, ItemVerdict> = {},
): Map<string, ItemVerdict> {
  return new Map(
    batch.items.map((item): [string, ItemVerdict] => [
      item.ref,
      overrides[item.ref] ??
        (item.flaggedByClaude !== undefined
          ? {
              outcome: 'rejected',
              reasons: [
                {
                  code: 'flagged_by_claude',
                  params: { text: item.flaggedByClaude },
                },
              ],
              sources: [],
            }
          : {
              outcome: 'accepted',
              reasons: [],
              sources: item.kind === 'concept' ? item.sources : [],
            }),
    ]),
  );
}

function run(
  store: FakeStore,
  items: unknown[],
  extra = {},
  overrides: Record<string, ItemVerdict> = {},
) {
  const batch = parseBatch(batchText(items, extra));
  return applyBatch(store, batch, verdictsFor(batch, overrides), context());
}

describe('parseBatch (phase 1)', () => {
  it('returns the validated batch', () => {
    const batch = parseBatch(`\uFEFF${batchText([tool('a')])}`);
    expect(batch.items).toHaveLength(1);
  });

  it('refuses text that is not JSON with BATCH_INVALID', () => {
    const error = errorOf(() => parseBatch('{ nope'));
    expect(error.code).toBe('BATCH_INVALID');
    expect(error.issues?.[0].path).toEqual([]);
  });

  it('reports schema issues with their paths', () => {
    const error = errorOf(() =>
      parseBatch(batchText([tool('a', { kind: 'book' }), { ref: 'b' }])),
    );
    expect(error.code).toBe('BATCH_INVALID');
    expect(error.issues?.map((issue) => issue.path)).toContainEqual([
      'items',
      0,
      'kind',
    ]);
  });

  it.each([0, 2])('refuses schemaVersion %i as BATCH_SCHEMA_OUTDATED', (v) => {
    const text = JSON.stringify({ schemaVersion: v, items: [tool('a')] });
    expect(errorOf(() => parseBatch(text)).code).toBe('BATCH_SCHEMA_OUTDATED');
  });

  it('treats a non-numeric schemaVersion as an invalid batch', () => {
    const text = JSON.stringify({ schemaVersion: '1', items: [tool('a')] });
    expect(errorOf(() => parseBatch(text)).code).toBe('BATCH_INVALID');
  });

  it('turns an unreadable file into BATCH_INVALID', () => {
    const fs = {
      readText: () => {
        throw new Error('ENOENT');
      },
    } as unknown as FileSystem;
    expect(errorOf(() => readBatch(fs, 'D:\\ws\\batches\\x.json')).code).toBe(
      'BATCH_INVALID',
    );
  });
});

describe('applyBatch (phase 3)', () => {
  it('adds a tool with its category, timestamps and ids, in one transaction', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [
      tool('a', { keywords: ['fundal'], url: 'https://www.A.dev/' }),
    ]);

    expect(store.transactions).toBe(1);
    expect(report).toEqual({
      schemaVersion: 1,
      workspace: 'D:\\ws',
      items: [
        { ref: 'a', op: 'add', outcome: 'added', id: 'id-1', reasons: [] },
      ],
      newCategories: [],
      ignoredLinks: [],
      proposedBlockedDomains: [],
    });
    expect(store.entries).toEqual([
      {
        id: 'id-1',
        kind: 'tool',
        name: 'Tool a',
        url: 'https://www.A.dev/',
        resourceType: 'site',
        whatItDoes: 'Face ceva util.',
        situations: ['Când am nevoie'],
        keywords: ['fundal'],
        sources: [],
        content: null,
        verificationNotes: [],
        dedupKey: 'url:a.dev',
        addedAt: '2026-10-13T12:00:00.000Z',
        verifiedAt: '2026-10-13T12:00:00.000Z',
        categoryIds: ['seed-1'],
      },
    ]);
  });

  it('adds a concept without a link, keyed by its title, in the Learn zone', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [
      {
        ref: 'c',
        op: 'add',
        kind: 'concept',
        name: 'REST',
        categories: ['backend & api-uri'],
        whatItDoes: 'Stil de API.',
        situations: ['Când aleg un API'],
        content: '# REST',
        sources: ['https://restfulapi.net'],
      },
    ]);
    expect(report.items[0].outcome).toBe('added');
    expect(store.entries[0]).toMatchObject({
      url: null,
      resourceType: null,
      content: '# REST',
      sources: ['https://restfulapi.net'],
      dedupKey: 'title:rest',
      categoryIds: ['seed-3'],
    });
  });

  it('matches categories only in the zone of the kind', () => {
    const store = new FakeStore(SEED);
    // "Backend & API-uri" exists, but in Learn; a tool lives in Toolbox.
    const report = run(store, [
      tool('a', { categories: ['Backend & API-uri'] }),
    ]);
    expect(report.items[0]).toEqual({
      ref: 'a',
      op: 'add',
      outcome: 'rejected',
      reasons: [
        { code: 'unknown_category', params: { name: 'Backend & API-uri' } },
      ],
    });
    expect(store.entries).toEqual([]);
  });

  it('rejects an item with an unknown category and adds the others', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [
      tool('a', { categories: ['Imagini & video', 'Nicăieri'] }),
      tool('b'),
    ]);
    expect(report.items.map((i) => [i.ref, i.outcome])).toEqual([
      ['a', 'rejected'],
      ['b', 'added'],
    ]);
    expect(report.items[0].reasons).toEqual([
      { code: 'unknown_category', params: { name: 'Nicăieri' } },
    ]);
    expect(store.entries.map((e) => e.name)).toEqual(['Tool b']);
  });

  it('creates a declared category once, on first use, and reports it', () => {
    const store = new FakeStore(SEED);
    const report = run(
      store,
      [
        tool('a', { categories: ['fonturi'] }),
        tool('b', { categories: ['Fonturi', 'Imagini & video'] }),
      ],
      {
        newCategories: [
          { zone: 'toolbox', name: 'Fonturi' },
          { zone: 'toolbox', name: 'FONTURI' },
          { zone: 'learn', name: 'Nefolosită' },
        ],
      },
    );
    expect(report.items.map((i) => i.outcome)).toEqual(['added', 'added']);
    const created = store.categories.filter((c) => !c.id.startsWith('seed-'));
    expect(created).toEqual([
      { id: 'id-1', zone: 'toolbox', name: 'Fonturi', nameKey: 'fonturi' },
    ]);
    expect(report.newCategories).toEqual([
      { id: 'id-1', zone: 'toolbox', name: 'Fonturi', created: true },
    ]);
    expect(store.entries.map((e) => e.categoryIds)).toEqual([
      ['id-1'],
      ['id-1', 'seed-1'],
    ]);
  });

  it('reuses a declared category that already exists', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [tool('a', { categories: ['securitate'] })], {
      newCategories: [{ zone: 'toolbox', name: 'SECURITATE' }],
    });
    expect(report.newCategories).toEqual([
      { id: 'seed-2', zone: 'toolbox', name: 'Securitate', created: false },
    ]);
    expect(store.categories).toHaveLength(SEED.length);
  });

  it('does not create a declared category used only by a rejected item', () => {
    const store = new FakeStore(SEED);
    const report = run(
      store,
      [tool('a', { categories: ['Fonturi'], flaggedByClaude: 'Dubios' })],
      { newCategories: [{ zone: 'toolbox', name: 'Fonturi' }] },
    );
    expect(report.items[0]).toMatchObject({
      outcome: 'rejected',
      reasons: [{ code: 'flagged_by_claude', params: { text: 'Dubios' } }],
    });
    expect(report.newCategories).toEqual([]);
    expect(store.categories).toHaveLength(SEED.length);
  });

  it('marks a duplicate of the catalog with the existing id', () => {
    const store = new FakeStore(SEED);
    run(store, [tool('a')]);
    const report = run(store, [tool('a2', { url: 'http://www.a.dev/#x' })]);
    expect(report.items[0]).toEqual({
      ref: 'a2',
      op: 'add',
      outcome: 'duplicate',
      duplicateOfId: 'id-1',
      reasons: [{ code: 'duplicate' }],
    });
    expect(store.entries).toHaveLength(1);
  });

  it('marks a repeat of an earlier added item in the same batch', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [
      tool('a'),
      tool('b', { url: 'https://A.dev/' }),
    ]);
    expect(report.items[1]).toEqual({
      ref: 'b',
      op: 'add',
      outcome: 'duplicate',
      reasons: [{ code: 'duplicate', params: { ref: 'a' } }],
    });
    expect(store.entries).toHaveLength(1);
  });

  it('judges a repeat of a rejected item on its own', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [
      tool('a', { categories: ['Nicăieri'] }),
      tool('b', { url: 'https://a.dev' }),
    ]);
    expect(report.items.map((i) => i.outcome)).toEqual(['rejected', 'added']);
  });

  it('lists every item exactly once, in batch order', () => {
    const store = new FakeStore(SEED);
    run(store, [tool('old')]);
    const report = run(store, [
      tool('x', { flaggedByClaude: 'Piratat' }),
      tool('y', { url: 'https://old.dev' }),
      tool('z'),
      tool('w', { categories: ['?'] }),
    ]);
    expect(report.items.map((i) => [i.ref, i.outcome])).toEqual([
      ['x', 'rejected'],
      ['y', 'duplicate'],
      ['z', 'added'],
      ['w', 'rejected'],
    ]);
  });

  it('echoes the proposed blocked domains', () => {
    const store = new FakeStore(SEED);
    const report = run(store, [tool('a')], {
      proposedBlockedDomains: ['libgen.is'],
    });
    expect(report.proposedBlockedDomains).toEqual(['libgen.is']);
  });

  it('writes nothing when the transaction fails midway', () => {
    const store = new FakeStore(SEED);
    const batch = parseBatch(batchText([tool('a'), tool('b')]));
    let calls = 0;
    const ids = {
      newId: () => {
        calls += 1;
        if (calls === 2) throw new Error('boom');
        return `id-${calls}`;
      },
    };
    expect(() =>
      applyBatch(store, batch, verdictsFor(batch), { ...context(), ids }),
    ).toThrow('boom');
    expect(store.entries).toEqual([]);
  });
});

describe('applyBatch with verification verdicts', () => {
  const concept = {
    ref: 'c',
    op: 'add',
    kind: 'concept',
    name: 'REST',
    categories: ['Backend & API-uri'],
    whatItDoes: 'Stil de API.',
    situations: ['Când aleg un API'],
    content: '# REST',
    sources: ['https://dead.dev', 'https://live.dev'],
  };

  it('stores a warned item with its notes, kept sources and verified_at', () => {
    const store = new FakeStore(SEED);
    const reasons = [
      {
        code: 'source_link_removed' as const,
        params: { url: 'https://dead.dev' },
      },
    ];
    const report = run(
      store,
      [concept],
      {},
      {
        c: { outcome: 'warned', reasons, sources: ['https://live.dev'] },
      },
    );
    expect(report.items).toEqual([
      { ref: 'c', op: 'add', outcome: 'warned', id: 'id-1', reasons },
    ]);
    expect(store.entries[0]).toMatchObject({
      sources: ['https://live.dev'],
      verificationNotes: reasons,
      verifiedAt: '2026-10-13T12:00:00.000Z',
    });
  });

  it('adds an accepted item with a note, keeping the note in the report', () => {
    const store = new FakeStore(SEED);
    const reasons = [{ code: 'blocks_automation' as const }];
    const report = run(
      store,
      [tool('a')],
      {},
      {
        a: { outcome: 'accepted', reasons, sources: [] },
      },
    );
    expect(report.items[0]).toMatchObject({ outcome: 'added', reasons });
    expect(store.entries[0].verificationNotes).toEqual(reasons);
  });

  it('joins rejected verdict reasons with unknown categories, writing nothing', () => {
    const store = new FakeStore(SEED);
    const report = run(
      store,
      [tool('a', { categories: ['Nicăieri'] })],
      {},
      {
        a: {
          outcome: 'rejected',
          reasons: [{ code: 'http_error', params: { status: '404' } }],
          sources: [],
        },
      },
    );
    expect(report.items[0]).toEqual({
      ref: 'a',
      op: 'add',
      outcome: 'rejected',
      reasons: [
        { code: 'http_error', params: { status: '404' } },
        { code: 'unknown_category', params: { name: 'Nicăieri' } },
      ],
    });
    expect(store.entries).toEqual([]);
  });

  it('reports a warned duplicate as a duplicate', () => {
    const store = new FakeStore(SEED);
    run(store, [tool('a')]);
    const report = run(
      store,
      [tool('a2', { url: 'https://a.dev/' })],
      {},
      {
        a2: {
          outcome: 'warned',
          reasons: [{ code: 'no_response_at_import' }],
          sources: [],
        },
      },
    );
    expect(report.items[0].outcome).toBe('duplicate');
  });

  it('refuses a batch whose item has no verdict, writing nothing', () => {
    const store = new FakeStore(SEED);
    const batch = parseBatch(batchText([tool('a')]));
    expect(() => applyBatch(store, batch, new Map(), context())).toThrow(
      WhenkitError,
    );
    expect(store.entries).toEqual([]);
  });
});

describe('applyBatch with op update', () => {
  /** UUID-shaped ids, as the batch schema requires them on an update. */
  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  const LATER = new Date('2026-10-14T08:00:00.000Z');

  /** A context whose ids continue after the first `skip` UUIDs. */
  function uuidContext(now = NOW, skip = 0) {
    let n = skip;
    return {
      clock: { now: () => now },
      ids: { newId: () => uuid(++n) },
      workspace: 'D:\\ws',
    };
  }

  /** A store holding tools `a` (uuid 1) and `b` (uuid 2), added at NOW. */
  function seeded() {
    const store = new FakeStore(SEED);
    const batch = parseBatch(batchText([tool('a'), tool('b')]));
    applyBatch(store, batch, verdictsFor(batch), uuidContext());
    return store;
  }

  function update(ref: string, id: string, overrides = {}) {
    return tool(ref, { op: 'update', id, ...overrides });
  }

  function runUpdate(
    store: FakeStore,
    items: unknown[],
    extra = {},
    overrides: Record<string, ItemVerdict> = {},
  ) {
    const batch = parseBatch(batchText(items, extra));
    return applyBatch(
      store,
      batch,
      verdictsFor(batch, overrides),
      uuidContext(LATER, 2),
    );
  }

  it('replaces Claude fields and categories, keeps addedAt, bumps revision', () => {
    const store = seeded();
    const report = runUpdate(store, [
      update('u', uuid(1), {
        name: 'Tool nou',
        url: 'https://nou.dev',
        resourceType: 'repo',
        categories: ['Securitate'],
        whatItDoes: 'Face altceva.',
        situations: ['Altă situație'],
        keywords: ['nou'],
      }),
    ]);

    expect(report.items).toEqual([
      { ref: 'u', op: 'update', outcome: 'updated', id: uuid(1), reasons: [] },
    ]);
    expect(store.entries[0]).toEqual({
      id: uuid(1),
      kind: 'tool',
      name: 'Tool nou',
      url: 'https://nou.dev',
      resourceType: 'repo',
      whatItDoes: 'Face altceva.',
      situations: ['Altă situație'],
      keywords: ['nou'],
      sources: [],
      content: null,
      verificationNotes: [],
      dedupKey: 'url:nou.dev',
      addedAt: NOW.toISOString(),
      verifiedAt: LATER.toISOString(),
      categoryIds: ['seed-2'],
    });
    expect(store.revisions.get(uuid(1))).toBe(2);
    expect(store.entries).toHaveLength(2);
  });

  it('is not a duplicate of its own entry when it keeps its URL', () => {
    const store = seeded();
    const report = runUpdate(store, [
      update('u', uuid(1), { url: 'https://www.a.dev/', name: 'Alt nume' }),
    ]);
    expect(report.items[0].outcome).toBe('updated');
    expect(store.entries[0]).toMatchObject({
      name: 'Alt nume',
      url: 'https://www.a.dev/',
      dedupKey: 'url:a.dev',
    });
  });

  it('is a duplicate when its new URL is another entry, leaving it unchanged', () => {
    const store = seeded();
    const before = store.entryById(uuid(1));
    const report = runUpdate(store, [
      update('u', uuid(1), { url: 'https://B.dev' }),
    ]);
    expect(report.items[0]).toEqual({
      ref: 'u',
      op: 'update',
      outcome: 'duplicate',
      duplicateOfId: uuid(2),
      reasons: [{ code: 'duplicate' }],
    });
    expect(store.entryById(uuid(1))).toEqual(before);
  });

  it('rejects an update of an unknown id with unknown_id', () => {
    const store = seeded();
    const report = runUpdate(store, [update('u', uuid(99))]);
    expect(report.items[0]).toEqual({
      ref: 'u',
      op: 'update',
      outcome: 'rejected',
      reasons: [{ code: 'unknown_id', params: { id: uuid(99) } }],
    });
    expect(store.entries).toHaveLength(2);
  });

  it('leaves the entry and its revision unchanged when the update is rejected', () => {
    const store = seeded();
    const before = store.entryById(uuid(1));
    const report = runUpdate(
      store,
      [update('u', uuid(1), { url: 'https://dead.dev' })],
      {},
      {
        u: {
          outcome: 'rejected',
          reasons: [{ code: 'http_error', params: { status: '404' } }],
          sources: [],
        },
      },
    );
    expect(report.items[0]).toMatchObject({
      op: 'update',
      outcome: 'rejected',
    });
    expect(store.entryById(uuid(1))).toEqual(before);
    expect(before?.revision).toBe(1);
  });

  it('reports a warned update as warned with op update', () => {
    const store = seeded();
    const reasons = [{ code: 'no_response_at_import' as const }];
    const report = runUpdate(
      store,
      [update('u', uuid(1))],
      {},
      { u: { outcome: 'warned', reasons, sources: [] } },
    );
    expect(report.items[0]).toEqual({
      ref: 'u',
      op: 'update',
      outcome: 'warned',
      id: uuid(1),
      reasons,
    });
    expect(store.entries[0].verificationNotes).toEqual(reasons);
    expect(store.revisions.get(uuid(1))).toBe(2);
  });

  it('may change the kind, matching the categories in the new zone', () => {
    const store = seeded();
    const report = runUpdate(store, [
      {
        ref: 'u',
        op: 'update',
        id: uuid(1),
        kind: 'concept',
        name: 'REST',
        categories: ['Securitate'],
        whatItDoes: 'Stil de API.',
        situations: ['Când aleg un API'],
        content: '# REST',
      },
    ]);
    expect(report.items[0].outcome).toBe('updated');
    expect(store.entries[0]).toMatchObject({
      kind: 'concept',
      url: null,
      resourceType: null,
      content: '# REST',
      dedupKey: 'title:rest',
      // "Securitate" of Learn (seed-4), not the Toolbox one (seed-2).
      categoryIds: ['seed-4'],
    });
  });

  it('rejects a kind change whose categories exist only in the old zone', () => {
    const store = seeded();
    const report = runUpdate(store, [
      update('u', uuid(1), {
        kind: 'material',
        categories: ['Imagini & video'],
      }),
    ]);
    expect(report.items[0]).toMatchObject({
      outcome: 'rejected',
      reasons: [
        { code: 'unknown_category', params: { name: 'Imagini & video' } },
      ],
    });
    expect(store.entries[0].kind).toBe('tool');
  });

  it('counts keys written earlier in the batch, by adds and by updates', () => {
    const store = seeded();
    const report = runUpdate(store, [
      tool('c'),
      update('u1', uuid(1), { url: 'https://c.dev' }),
      update('u2', uuid(2), { url: 'https://moved.dev' }),
      tool('d', { url: 'https://moved.dev/' }),
      // u1 was a duplicate, so entry 1 still holds a.dev.
      tool('e', { url: 'https://a.dev' }),
    ]);
    expect(report.items).toEqual([
      { ref: 'c', op: 'add', outcome: 'added', id: uuid(3), reasons: [] },
      {
        ref: 'u1',
        op: 'update',
        outcome: 'duplicate',
        reasons: [{ code: 'duplicate', params: { ref: 'c' } }],
      },
      {
        ref: 'u2',
        op: 'update',
        outcome: 'updated',
        id: uuid(2),
        reasons: [],
      },
      {
        ref: 'd',
        op: 'add',
        outcome: 'duplicate',
        reasons: [{ code: 'duplicate', params: { ref: 'u2' } }],
      },
      {
        ref: 'e',
        op: 'add',
        outcome: 'duplicate',
        duplicateOfId: uuid(1),
        reasons: [{ code: 'duplicate' }],
      },
    ]);
  });

  it('frees the old key of an updated entry for a later add', () => {
    const store = seeded();
    const report = runUpdate(store, [
      update('u', uuid(1), { url: 'https://new-a.dev' }),
      tool('a2', { url: 'https://a.dev' }),
    ]);
    expect(report.items.map((i) => i.outcome)).toEqual(['updated', 'added']);
  });

  it('creates a declared category once when an update and an add use it', () => {
    const store = seeded();
    const report = runUpdate(
      store,
      [
        update('u', uuid(1), { categories: ['Fonturi'] }),
        tool('c', { categories: ['fonturi'] }),
      ],
      {
        newCategories: [
          { zone: 'toolbox', name: 'Fonturi' },
          { zone: 'toolbox', name: 'FONTURI' },
        ],
      },
    );
    expect(report.newCategories).toEqual([
      { id: uuid(3), zone: 'toolbox', name: 'Fonturi', created: true },
    ]);
    expect(store.entries[0].categoryIds).toEqual([uuid(3)]);
    expect(store.entries[2].categoryIds).toEqual([uuid(3)]);
  });

  it('rolls an update back when a later write fails', () => {
    const store = seeded();
    const before = store.entryById(uuid(1));
    const batch = parseBatch(
      batchText([update('u', uuid(1), { name: 'Nou' }), tool('c')]),
    );
    const ids = {
      newId: (): string => {
        throw new Error('boom');
      },
    };
    expect(() =>
      applyBatch(store, batch, verdictsFor(batch), { ...uuidContext(), ids }),
    ).toThrow('boom');
    expect(store.entryById(uuid(1))).toEqual(before);
    expect(store.revisions.get(uuid(1))).toBeUndefined();
    expect(store.entries).toHaveLength(2);
  });
});
