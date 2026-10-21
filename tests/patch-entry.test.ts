import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitCodeFor } from '../src/cli/exit-codes';
import { toEntryDto, type EntryDto } from '../src/core/dto';
import type { EntryPatch } from '../src/core/entry-patch';
import { WhenkitError } from '../src/core/errors';
import { applyBatch, parseBatch } from '../src/core/import-batch';
import { patchEntry, type PatchEntryContext } from '../src/core/patch-entry';
import type {
  CatalogStore,
  GitHubClient,
  HttpClient,
  StoredEntry,
} from '../src/core/ports';
import { verifyBatch } from '../src/core/verification/verify';
import { patchEntryResult } from '../src/desktop/main/catalog';
import { errorMessages } from '../src/shared/strings.ro';
import {
  batch,
  concept as baseConcept,
  initialized,
  importReport,
  tool,
  type CliSetup,
} from './cli-harness';
import {
  fixedClock,
  notFoundGithub,
  okHttp,
  sequentialIds,
  testStoreOpener,
  unusedHttp,
} from './helpers';

// `entries:patch` (AD-3, AD-5, AD-7, AD-16): the window's edit of an entry,
// through core's patchEntry on a real catalog, with fake link checks.

const ADDED_AT = '2026-10-13T12:00:00.000Z';
const NOW = '2026-10-21T09:00:00.000Z';

/** dead.dev answers 404, offline.dev has no network, the rest 200. */
const fakeHttp: HttpClient = {
  check: (url) => {
    const host = new URL(url).hostname;
    if (host === 'dead.dev') {
      return Promise.resolve({ kind: 'httpError', status: 404, finalUrl: url });
    }
    if (host === 'offline.dev') return Promise.resolve({ kind: 'offline' });
    if (host === 'walled.dev') {
      return Promise.resolve({ kind: 'httpError', status: 403, finalUrl: url });
    }
    return Promise.resolve({ kind: 'ok', status: 200, finalUrl: url });
  },
};

const okGithub: GitHubClient = {
  repo: () =>
    Promise.resolve({
      kind: 'ok',
      stars: 42,
      pushedAt: '2026-09-01T00:00:00Z',
      archived: false,
    }),
};

function context(
  http: HttpClient = fakeHttp,
  github: GitHubClient = notFoundGithub,
  blockedDomains: string[] = [],
): PatchEntryContext {
  return {
    verification: () => ({
      http,
      github,
      blockedDomains,
      retryDelayMs: 0,
      wait: () => Promise.resolve(),
      now: new Date(NOW),
    }),
    clock: fixedClock(new Date(NOW)),
  };
}

/** A concept with one good source, so a patch has a link to verify. */
function concept(ref: string, overrides: Record<string, unknown> = {}) {
  return baseConcept(ref, {
    sources: ['https://sursa-buna.dev/a'],
    ...overrides,
  });
}

interface Fixture {
  s: CliSetup;
  /** Tools `a` and `b`, concept `k`. */
  a: string;
  b: string;
  k: string;
  store: CatalogStore;
}

const opened: CatalogStore[] = [];

/** Workspace with tools a, b and concept k, all added at ADDED_AT; `a` has notes. */
async function fixture(): Promise<Fixture> {
  const s = await initialized({ clock: fixedClock(new Date(ADDED_AT)) });
  const report = await importReport(
    s,
    batch([tool('a'), tool('b'), concept('k')]),
  );
  const [a, b, k] = report.items.map((item) => String(item.id));
  const store = testStoreOpener()(s.dbPath, {});
  opened.push(store);
  store.writeTransaction((writer) => {
    writer.setEntryNotes(a, 'Notițele mele.');
  });
  return { s, a, b, k, store };
}

afterEach(() => {
  for (const store of opened.splice(0)) store.close();
});

function stored(store: CatalogStore, id: string): StoredEntry {
  const entry = store.entryById(id);
  if (entry === undefined) throw new Error(`no entry ${id}`);
  return entry;
}

function patch(
  f: Fixture,
  id: string,
  changes: EntryPatch,
  options: {
    ctx?: PatchEntryContext;
    expectedRevision?: number;
  } = {},
): Promise<EntryDto> {
  return patchEntry(f.store, options.ctx ?? context(unusedHttp), {
    id,
    expectedRevision: options.expectedRevision ?? stored(f.store, id).revision,
    changes,
  });
}

async function failureOf(promise: Promise<unknown>): Promise<WhenkitError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof WhenkitError) return error;
    throw error;
  }
  throw new Error('expected a WhenkitError');
}

describe('patchEntry', () => {
  it('saves a text edit without any link check and keeps the rest', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const dto = await patch(f, f.a, {
      whatItDoes: 'Face altceva.',
      situations: ['Când am altă nevoie', 'Când mai am una'],
    });

    expect(dto.revision).toBe(before.revision + 1);
    expect(dto.whatItDoes).toBe('Face altceva.');
    expect(dto.situations).toEqual(['Când am altă nevoie', 'Când mai am una']);
    expect(dto.myNotes).toBe('Notițele mele.');
    expect(dto.verifiedAt).toBe(before.verifiedAt);
    expect(dto.verificationNotes).toEqual(before.verificationNotes);
    expect(dto.githubStars).toBe(before.githubStars);
    expect(dto.addedAt).toBe(before.addedAt);
    expect(dto).toEqual(toEntryDto(stored(f.store, f.a)));
  });

  it('writes nothing for changes equal to the stored values', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const dto = await patch(f, f.a, {
      name: before.name,
      url: before.url,
      situations: before.situations,
      categoryIds: before.categories.map((c) => c.id).reverse(),
    });

    expect(dto).toEqual(toEntryDto(before));
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('verifies a new link, bumps the revision and refreshes the verification', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const dto = await patch(
      f,
      f.a,
      { url: 'https://github.com/owner/repo' },
      { ctx: context(fakeHttp, okGithub) },
    );

    expect(dto.url).toBe('https://github.com/owner/repo');
    expect(dto.revision).toBe(before.revision + 1);
    expect(dto.verifiedAt).toBe(NOW);
    expect(dto.githubStars).toBe(42);
    expect(dto.githubPushedAt).toBe('2026-09-01T00:00:00Z');
    expect(dto.githubArchived).toBe(false);
    expect(dto.myNotes).toBe('Notițele mele.');
    expect(f.store.entryIdByDedupKey('url:github.com/owner/repo')).toBe(f.a);
    expect(f.store.entryIdByDedupKey('url:a.dev')).toBeUndefined();
  });

  it('stores the notes of the verdict (a site that blocks programs)', async () => {
    const f = await fixture();
    const dto = await patch(
      f,
      f.a,
      { url: 'https://walled.dev' },
      { ctx: context() },
    );
    expect(dto.verificationNotes).toEqual([{ code: 'blocks_automation' }]);
  });

  it('rejects a link that does not answer and writes nothing', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const error = await failureOf(
      patch(f, f.a, { url: 'https://dead.dev/x' }, { ctx: context() }),
    );

    expect(error.code).toBe('ENTRY_REJECTED');
    expect(error.reasons).toEqual([
      { code: 'http_error', params: { status: '404' } },
    ]);
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('drops a dead source and notes it', async () => {
    const f = await fixture();
    const before = stored(f.store, f.k);

    const dto = await patch(
      f,
      f.k,
      { sources: ['https://sursa-buna.dev/a', 'https://dead.dev/sursa'] },
      { ctx: context() },
    );

    expect(dto.sources).toEqual(['https://sursa-buna.dev/a']);
    expect(dto.verificationNotes).toEqual([
      {
        code: 'source_link_removed',
        params: { url: 'https://dead.dev/sursa' },
      },
    ]);
    expect(dto.revision).toBe(before.revision + 1);
    expect(dto.verifiedAt).toBe(NOW);
  });

  it('rejects a link on a blocked domain', async () => {
    const f = await fixture();
    const error = await failureOf(
      patch(
        f,
        f.a,
        { url: 'https://evil.dev/tool' },
        { ctx: context(fakeHttp, notFoundGithub, ['evil.dev']) },
      ),
    );
    expect(error.code).toBe('ENTRY_REJECTED');
    expect(error.reasons).toEqual([
      { code: 'blocked_domain', params: { domain: 'evil.dev' } },
    ]);
  });

  it("rejects a link that normalizes to another entry's key", async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const error = await failureOf(
      patch(f, f.a, { url: 'https://www.b.dev/' }, { ctx: context() }),
    );

    expect(error.code).toBe('ENTRY_REJECTED');
    expect(error.reasons).toEqual([
      { code: 'duplicate', params: { name: 'Tool b' } },
    ]);
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('rejects a concept name that collides with another concept', async () => {
    const f = await fixture();
    const second = await importReport(
      f.s,
      batch([concept('z', { name: 'Alt concept', sources: [] })]),
    );
    const z = String(second.items[0]?.id);

    const error = await failureOf(
      patch(f, f.k, { url: null, name: 'Alt concept' }, { ctx: context() }),
    );
    expect(error.code).toBe('ENTRY_REJECTED');
    expect(error.reasons).toEqual([
      { code: 'duplicate', params: { name: 'Alt concept' } },
    ]);
    expect(stored(f.store, z).name).toBe('Alt concept');
  });

  it('clears the journaled rejection of the new key', async () => {
    const f = await fixture();
    // dead.dev is rejected on import and journaled.
    const rejected = await importReport(
      { ...f.s, deps: { ...f.s.deps, http: fakeHttp, retryDelayMs: 0 } },
      batch([tool('dead')]),
    );
    expect(rejected.items[0]?.outcome).toBe('rejected');
    expect(f.store.rejections().map((r) => r.dedupKey)).toEqual([
      'url:dead.dev',
    ]);
    const alive: HttpClient = {
      check: (url) =>
        Promise.resolve({ kind: 'ok', status: 200, finalUrl: url }),
    };

    await patch(f, f.a, { url: 'https://dead.dev' }, { ctx: context(alive) });

    expect(f.store.rejections()).toEqual([]);
  });

  it('keeps the journaled update rejections of the entry', async () => {
    const f = await fixture();
    const update = {
      ...tool('a', { url: 'https://dead.dev' }),
      op: 'update',
      id: f.a,
    };
    await importReport(
      { ...f.s, deps: { ...f.s.deps, http: fakeHttp, retryDelayMs: 0 } },
      batch([update]),
    );
    expect(f.store.rejections()).toHaveLength(1);

    await patch(f, f.a, { whatItDoes: 'Altceva.' });

    expect(f.store.rejections()).toHaveLength(1);
  });

  it("keeps the rejection of an import update under the entry's own key", async () => {
    const f = await fixture();
    const update = {
      ...tool('a'),
      op: 'update',
      id: f.a,
      flaggedByClaude: 'Pare dubios.',
    };
    await importReport(f.s, batch([update]));
    const journaled = f.store.rejections();
    expect(journaled.map((r) => r.dedupKey)).toEqual(['url:a.dev']);

    await patch(f, f.a, { whatItDoes: 'Altceva.' });

    expect(f.store.rejections()).toEqual(journaled);
  });

  it('never builds the verification context for a text edit', async () => {
    const f = await fixture();
    const verification = vi.fn(() => context().verification());
    await patchEntry(
      f.store,
      { verification, clock: fixedClock(new Date(NOW)) },
      {
        id: f.a,
        expectedRevision: stored(f.store, f.a).revision,
        changes: { whatItDoes: 'Altceva.' },
      },
    );
    expect(verification).not.toHaveBeenCalled();
  });

  it('answers ARGUMENTS_INVALID when a category vanishes before the write', async () => {
    const f = await fixture();
    const target = f.store
      .categoriesInZone('toolbox')
      .find((c) => !stored(f.store, f.a).categories.some((k) => k.id === c.id));
    const before = stored(f.store, f.a);
    // A catalog that loses the category right after the first read.
    const racing: CatalogStore = {
      ...f.store,
      readTransaction: (fn) => {
        const result = f.store.readTransaction(fn);
        f.store.writeTransaction(() => undefined);
        return result;
      },
      writeTransaction: (fn) =>
        f.store.writeTransaction((writer) =>
          fn(
            new Proxy(writer, {
              get: (w, property) =>
                property === 'categoriesInZone'
                  ? () => []
                  : (Reflect.get(w, property) as unknown),
            }),
          ),
        ),
    };

    const error = await failureOf(
      patchEntry(racing, context(unusedHttp), {
        id: f.a,
        expectedRevision: before.revision,
        changes: { categoryIds: [target?.id ?? ''] },
      }),
    );

    expect(error.code).toBe('ARGUMENTS_INVALID');
    expect(error.issues?.[0]?.path).toEqual(['categoryIds', 0]);
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('stops with OFFLINE and writes nothing', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const error = await failureOf(
      patch(f, f.a, { url: 'https://offline.dev' }, { ctx: context() }),
    );

    expect(error.code).toBe('OFFLINE');
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('answers CONFLICT for a stale revision and writes nothing', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);

    const error = await failureOf(
      patch(
        f,
        f.a,
        { whatItDoes: 'Altceva.' },
        { expectedRevision: before.revision + 1 },
      ),
    );

    expect(error.code).toBe('CONFLICT');
    expect(stored(f.store, f.a)).toEqual(before);
  });

  it('answers CONFLICT when an import update lands during the verification', async () => {
    const f = await fixture();
    const before = stored(f.store, f.a);
    const update = JSON.stringify(
      batch([
        {
          ...tool('a', { name: 'Tool A din terminal' }),
          op: 'update',
          id: f.a,
        },
      ]),
    );
    let landed = false;
    const racing: HttpClient = {
      check: async (url) => {
        if (!landed) {
          landed = true;
          const parsed = parseBatch(update);
          const verdicts = await verifyBatch(parsed, {
            http: okHttp,
            github: notFoundGithub,
            blockedDomains: [],
            now: new Date(NOW),
          });
          applyBatch(f.store, parsed, verdicts, {
            clock: fixedClock(new Date(NOW)),
            ids: sequentialIds('a000'),
            workspace: f.s.workspace,
          });
        }
        return { kind: 'ok', status: 200, finalUrl: url };
      },
    };

    const error = await failureOf(
      patch(
        f,
        f.a,
        { url: 'https://nou.dev' },
        { ctx: context(racing), expectedRevision: before.revision },
      ),
    );

    expect(landed).toBe(true);
    expect(error.code).toBe('CONFLICT');
    const after = stored(f.store, f.a);
    expect(after.name).toBe('Tool A din terminal');
    expect(after.url).toBe('https://a.dev');
    expect(after.revision).toBe(before.revision + 1);
  });

  it('replaces the categories of an entry and keeps the order irrelevant', async () => {
    const f = await fixture();
    const toolbox = f.store.categoriesInZone('toolbox');
    const current = stored(f.store, f.a).categories.map((c) => c.id);
    const ids = toolbox
      .filter((c) => !current.includes(c.id))
      .slice(0, 2)
      .map((c) => c.id);
    expect(ids).toHaveLength(2);

    const dto = await patch(f, f.a, { categoryIds: ids });

    expect(dto.categories.map((c) => c.id).sort()).toEqual([...ids].sort());
    expect(dto.revision).toBe(2);
  });

  it('edits a concept: content, sources and its link', async () => {
    const f = await fixture();
    const dto = await patch(
      f,
      f.k,
      {
        content: '# Nou\n\nText.',
        url: 'https://concept.dev',
        sources: [],
      },
      { ctx: context() },
    );
    expect(dto.content).toBe('# Nou\n\nText.');
    expect(dto.url).toBe('https://concept.dev');
    expect(dto.sources).toEqual([]);
    expect(f.store.entryIdByDedupKey('url:concept.dev')).toBe(f.k);

    const removed = await patch(f, f.k, { url: null }, { ctx: context() });
    expect(removed.url).toBeNull();
    expect(f.store.entryIdByDedupKey('title:concept k')).toBe(f.k);
  });

  it('keeps forced and its note on a verified edit', async () => {
    const f = await fixture();
    f.store.writeTransaction((writer) => {
      const entry = stored(f.store, f.a);
      writer.updateEntry({
        id: f.a,
        kind: entry.kind,
        name: entry.name,
        url: entry.url,
        resourceType: entry.resourceType,
        whatItDoes: entry.whatItDoes,
        situations: entry.situations,
        keywords: entry.keywords,
        sources: entry.sources,
        content: entry.content,
        verificationNotes: [{ code: 'forced_by_user' }],
        dedupKey: entry.dedupKey,
        forced: true,
        githubStars: null,
        githubPushedAt: null,
        githubArchived: null,
        verifiedAt: entry.verifiedAt,
      });
    });

    const dto = await patch(
      f,
      f.a,
      { url: 'https://walled.dev' },
      { ctx: context() },
    );

    expect(dto.forced).toBe(true);
    expect(dto.verificationNotes).toEqual([
      { code: 'blocks_automation' },
      { code: 'forced_by_user' },
    ]);
  });

  it('answers ENTRY_NOT_FOUND for an unknown id', async () => {
    const f = await fixture();
    const error = await failureOf(
      patchEntry(f.store, context(unusedHttp), {
        id: '00000000-0000-4000-8000-00000000ffff',
        expectedRevision: 1,
        changes: { name: 'X' },
      }),
    );
    expect(error.code).toBe('ENTRY_NOT_FOUND');
  });

  describe('invalid changes', () => {
    const cases: [string, (f: Fixture) => [string, EntryPatch], unknown[]][] = [
      ['an empty name', (f) => [f.a, { name: '  ' }], ['name']],
      ['no category', (f) => [f.a, { categoryIds: [] }], ['categoryIds']],
      [
        'three categories',
        (f) => [
          f.a,
          { categoryIds: f.store.categoriesInZone('toolbox').map((c) => c.id) },
        ],
        ['categoryIds'],
      ],
      [
        'a category of the other zone',
        (f) => [
          f.a,
          { categoryIds: [f.store.categoriesInZone('learn')[0]?.id ?? ''] },
        ],
        ['categoryIds', 0],
      ],
      [
        'an unknown category',
        (f) => [f.a, { categoryIds: ['nu-exista'] }],
        ['categoryIds', 0],
      ],
      [
        'the same category twice',
        (f) => {
          const id = f.store.categoriesInZone('toolbox')[0]?.id ?? '';
          return [f.a, { categoryIds: [id, id] }];
        },
        ['categoryIds'],
      ],
      ['no situation', (f) => [f.a, { situations: [] }], ['situations']],
      ['content on a tool', (f) => [f.a, { content: '# x' }], ['content']],
      ['sources on a tool', (f) => [f.a, { sources: [] }], ['sources']],
      ['url null on a tool', (f) => [f.a, { url: null }], ['url']],
      [
        'a resource type on a concept',
        (f) => [f.k, { resourceType: 'app' }],
        ['resourceType'],
      ],
      ['blank content', (f) => [f.k, { content: ' \n' }], ['content']],
      [
        'an unknown field',
        (f) => [f.a, { kind: 'concept' } as unknown as EntryPatch],
        [],
      ],
      [
        'the notes',
        (f) => [f.a, { myNotes: 'x' } as unknown as EntryPatch],
        [],
      ],
    ];

    it.each(cases)(
      'refuses %s with field issues, no request, nothing written',
      async (_label, build, firstPath) => {
        const f = await fixture();
        const [id, changes] = build(f);
        const before = stored(f.store, id);

        const error = await failureOf(patch(f, id, changes));

        expect(error.code).toBe('ARGUMENTS_INVALID');
        expect(error.issues?.length).toBeGreaterThan(0);
        if (firstPath.length > 0) {
          expect(error.issues?.[0]?.path).toEqual(firstPath);
        }
        expect(stored(f.store, id)).toEqual(before);
      },
    );

    it('refuses changes that are not an object', async () => {
      const f = await fixture();
      const error = await failureOf(
        patch(f, f.a, null as unknown as EntryPatch),
      );
      expect(error.code).toBe('ARGUMENTS_INVALID');
    });
  });
});

describe('patchEntryResult (the entries:patch handler)', () => {
  function deps(f: Fixture, http: HttpClient = unusedHttp) {
    return {
      http,
      github: notFoundGithub,
      clock: fixedClock(new Date(NOW)),
      readBlockedDomains: vi.fn((workspace: string) => {
        expect(workspace).toBe(f.s.workspace);
        return ['evil.dev'];
      }),
      retryDelayMs: 0,
    };
  }
  const contextFor = (f: Fixture, emit: () => void = vi.fn()) => ({
    opened: {
      ok: true,
      store: f.store,
      workspace: f.s.workspace,
    } as const,
    emit,
  });

  it('answers the changed entry and emits', async () => {
    const f = await fixture();
    const emit = vi.fn();
    const d = deps(f);
    const result = await patchEntryResult(
      contextFor(f, emit),
      {
        id: f.a,
        expectedRevision: 1,
        changes: { whatItDoes: 'Altceva.' },
      },
      d,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        changed: [
          expect.objectContaining({
            id: f.a,
            whatItDoes: 'Altceva.',
            revision: 2,
          }),
        ],
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);
    // A text edit never reads the workspace's blocked domains.
    expect(d.readBlockedDomains).not.toHaveBeenCalled();
  });

  it('reads the blocked domains of the workspace and refuses with the reasons', async () => {
    const f = await fixture();
    const emit = vi.fn();
    const d = deps(f, fakeHttp);
    const result = await patchEntryResult(
      contextFor(f, emit),
      {
        id: f.a,
        expectedRevision: 1,
        changes: { url: 'https://evil.dev' },
      },
      d,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ENTRY_REJECTED',
        reasons: [{ code: 'blocked_domain', params: { domain: 'evil.dev' } }],
      },
    });
    expect(d.readBlockedDomains).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('carries the field issues of invalid changes', async () => {
    const f = await fixture();
    const result = await patchEntryResult(
      contextFor(f),
      { id: f.a, expectedRevision: 1, changes: { situations: [] } },
      deps(f),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ARGUMENTS_INVALID',
        issues: [{ path: ['situations'], message: expect.any(String) }],
      },
    });
  });

  it('answers CONFLICT for a stale revision', async () => {
    const f = await fixture();
    const result = await patchEntryResult(
      contextFor(f),
      { id: f.a, expectedRevision: 7, changes: { name: 'Altfel' } },
      deps(f),
    );
    expect(result).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  });

  it.each([
    [undefined],
    [null],
    ['text'],
    [[]],
    [{ expectedRevision: 1, changes: {} }],
    [{ id: 3, expectedRevision: 1, changes: {} }],
    [{ id: 'x', expectedRevision: 1.5, changes: {} }],
    [{ id: 'x', expectedRevision: '1', changes: {} }],
    [{ id: 'x', changes: {} }],
  ])('refuses the payload %j as ARGUMENTS_INVALID', async (payload) => {
    const f = await fixture();
    const emit = vi.fn();
    const d = deps(f);
    await expect(
      patchEntryResult(contextFor(f, emit), payload, d),
    ).resolves.toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
    expect(d.readBlockedDomains).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the startup code when the catalog is not open', async () => {
    const f = await fixture();
    await expect(
      patchEntryResult(
        { opened: { ok: false, code: 'DATABASE_TOO_NEW' }, emit: vi.fn() },
        { id: f.a, expectedRevision: 1, changes: {} },
        deps(f),
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'DATABASE_TOO_NEW' } });
  });
});

describe('the new error codes', () => {
  it('have a Romanian text and a CLI exit code', () => {
    expect(errorMessages.CONFLICT).toBe(
      'Fișa s-a schimbat din terminal între timp. Modificarea nu s-a salvat.',
    );
    expect(errorMessages.ENTRY_REJECTED).toBe(
      'Modificarea nu a trecut verificarea.',
    );
    expect(exitCodeFor.CONFLICT).toBe(1);
    expect(exitCodeFor.ENTRY_REJECTED).toBe(1);
  });
});
