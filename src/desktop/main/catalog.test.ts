import { describe, expect, it, vi } from 'vitest';
import { WhenkitError } from '../../core/errors';
import type {
  CatalogStore,
  Environment,
  FileSystem,
  StoredEntry,
} from '../../core/ports';
import { runWrite } from './catalog-watch';
import {
  deleteCategoryResult,
  deleteEntryResult,
  mergeCategoriesResult,
  renameCategoryResult,
  errorDtoOf,
  openDesktopCatalog,
  searchResult,
  setNotesResult,
  snapshotResult,
} from './catalog';

const env: Environment = {
  get: (name) => (name === 'WHENKIT_WORKSPACE' ? 'D:\\ws' : undefined),
  appRoot: () => 'C:\\app',
};
const fs = { joinPath: (...parts: string[]) => parts.join('\\') } as FileSystem;

describe('openDesktopCatalog', () => {
  it('returns the resolved workspace with the store', () => {
    const store = {} as CatalogStore;
    const opened = openDesktopCatalog({ env, fs, openStore: () => store });
    expect(opened).toEqual({ ok: true, store, workspace: 'D:\\ws' });
  });

  it('passes an unexpected failure to logError and answers INTERNAL', () => {
    const logged: unknown[] = [];
    const failure = new Error('disk on fire');
    const opened = openDesktopCatalog({
      env,
      fs,
      openStore: () => {
        throw failure;
      },
      logError: (error) => logged.push(error),
    });
    expect(opened).toEqual({ ok: false, code: 'INTERNAL' });
    expect(logged).toEqual([failure]);
  });

  it('does not log a WhenkitError', () => {
    const logged: unknown[] = [];
    const opened = openDesktopCatalog({
      env,
      fs,
      openStore: () => {
        throw new WhenkitError('DATABASE_NEEDS_MIGRATION');
      },
      logError: (error) => logged.push(error),
    });
    expect(opened).toEqual({ ok: false, code: 'DATABASE_NEEDS_MIGRATION' });
    expect(logged).toEqual([]);
  });
});

describe('snapshotResult', () => {
  it('passes an unexpected read failure to logError and answers INTERNAL', () => {
    const logged: unknown[] = [];
    // A store without methods: reading the snapshot throws a TypeError.
    const store = {} as CatalogStore;
    expect(
      snapshotResult({ ok: true, store, workspace: 'D:\\ws' }, (e) =>
        logged.push(e),
      ),
    ).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    expect(logged).toHaveLength(1);
  });

  it('keeps the startup code and logs nothing', () => {
    const logged: unknown[] = [];
    expect(
      snapshotResult({ ok: false, code: 'DATABASE_TOO_NEW' }, (e) =>
        logged.push(e),
      ),
    ).toEqual({ ok: false, error: { code: 'DATABASE_TOO_NEW' } });
    expect(logged).toEqual([]);
  });

  it('survives a logError that throws', () => {
    expect(
      snapshotResult(
        { ok: true, store: {} as CatalogStore, workspace: 'D:\\ws' },
        () => {
          throw new Error('log down');
        },
      ),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
});

describe('searchResult', () => {
  const searching = (searchEntryIds: (text: string) => string[]) =>
    ({
      readTransaction: (fn: (reader: unknown) => unknown) =>
        fn({ searchEntryIds }),
    }) as unknown as CatalogStore;

  it('answers the ids the store found', () => {
    const asked: string[] = [];
    const store = searching((text) => {
      asked.push(text);
      return ['a', 'b'];
    });
    expect(
      searchResult({ ok: true, store, workspace: 'D:\\ws' }, 'fundal'),
    ).toEqual({
      ok: true,
      data: { ids: ['a', 'b'] },
    });
    expect(asked).toEqual(['fundal']);
  });

  it.each([[undefined], [null], [42], [{}], [['fundal']]])(
    'refuses %j as ARGUMENTS_INVALID without touching the store',
    (text) => {
      const store = searching(() => {
        throw new Error('must not be asked');
      });
      expect(
        searchResult({ ok: true, store, workspace: 'D:\\ws' }, text),
      ).toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
    },
  );

  it('keeps the code of a WhenkitError and logs nothing', () => {
    const logged: unknown[] = [];
    const store = searching(() => {
      throw new WhenkitError('DATABASE_BUSY');
    });
    expect(
      searchResult({ ok: true, store, workspace: 'D:\\ws' }, 'x', (e) =>
        logged.push(e),
      ),
    ).toEqual({ ok: false, error: { code: 'DATABASE_BUSY' } });
    expect(logged).toEqual([]);
  });

  it('answers INTERNAL for an unexpected throw and logs it', () => {
    const logged: unknown[] = [];
    const store = searching(() => {
      throw new Error('torn read');
    });
    expect(
      searchResult({ ok: true, store, workspace: 'D:\\ws' }, 'x', (e) =>
        logged.push(e),
      ),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(logged).toHaveLength(1);
  });

  it('keeps the startup code', () => {
    expect(searchResult({ ok: false, code: 'DATABASE_TOO_NEW' }, 'x')).toEqual({
      ok: false,
      error: { code: 'DATABASE_TOO_NEW' },
    });
  });
});

describe('setNotesResult', () => {
  const stored = {
    id: 'e1',
    ownerId: 'o',
    kind: 'tool',
    name: 'Tool',
    url: 'https://tool.dev',
    resourceType: 'site',
    categories: [],
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
    dedupKey: 'url:tool.dev',
    revision: 3,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
  } satisfies StoredEntry;

  /** A store whose one entry is `stored`; the notes it is given are kept. */
  const storing = () => {
    let notes = stored.myNotes;
    return {
      writeTransaction: (fn: (writer: unknown) => unknown) =>
        fn({
          setEntryNotes: (id: string, text: string) => {
            if (id !== stored.id) return false;
            notes = text;
            return true;
          },
          entryById: () => ({ ...stored, myNotes: notes }),
        }),
    } as unknown as CatalogStore;
  };
  const opened = (store: CatalogStore) =>
    ({ ok: true, store, workspace: 'D:ws' }) as const;

  it('answers the changed entry and emits', async () => {
    const emit = vi.fn();
    const result = await setNotesResult(
      opened(storing()),
      'e1',
      ' ce notez\n',
      emit,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        changed: [
          expect.objectContaining({
            id: 'e1',
            myNotes: ' ce notez\n',
            revision: 3,
          }),
        ],
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, 'x'],
    [42, 'x'],
    ['e1', undefined],
    ['e1', null],
    ['e1', 7],
  ])(
    'refuses (%j, %j) as ARGUMENTS_INVALID without touching the store',
    async (id, notes) => {
      const emit = vi.fn();
      const store = {
        writeTransaction: () => {
          throw new Error('must not be asked');
        },
      } as unknown as CatalogStore;
      await expect(
        setNotesResult(opened(store), id, notes, emit),
      ).resolves.toEqual({
        ok: false,
        error: { code: 'ARGUMENTS_INVALID' },
      });
      expect(emit).not.toHaveBeenCalled();
    },
  );

  it('answers ENTRY_NOT_FOUND for an unknown id and does not emit', async () => {
    const emit = vi.fn();
    await expect(
      setNotesResult(opened(storing()), 'ghost', 'x', emit),
    ).resolves.toEqual({ ok: false, error: { code: 'ENTRY_NOT_FOUND' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(
      setNotesResult(
        { ok: false, code: 'DATABASE_TOO_NEW' },
        'e1',
        'x',
        vi.fn(),
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'DATABASE_TOO_NEW' } });
  });
});

describe('deleteEntryResult', () => {
  const row = (id: string, links: Partial<StoredEntry> = {}) =>
    ({
      id,
      ownerId: 'o',
      kind: 'tool',
      name: id,
      url: null,
      resourceType: null,
      categories: [],
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
      dedupKey: id,
      revision: 1,
      addedAt: '2026-10-13T12:00:00.000Z',
      verifiedAt: null,
      ...links,
    }) satisfies StoredEntry;

  /** Entry a is linked to b; deleting a leaves b without the link. */
  const linked = () => {
    const rows = new Map([
      ['a', row('a', { relatedIds: ['b'] })],
      ['b', row('b', { relatedIds: ['a'] })],
    ]);
    return {
      writeTransaction: (fn: (writer: unknown) => unknown) =>
        fn({
          entryById: (id: string) => rows.get(id),
          deleteUpdateRejections: () => {},
          deleteEntry: (id: string) => {
            const gone = rows.delete(id);
            for (const [key, value] of rows) {
              rows.set(key, {
                ...value,
                relatedIds: value.relatedIds.filter((other) => other !== id),
              });
            }
            return gone;
          },
        }),
    } as unknown as CatalogStore;
  };
  const opened = (store: CatalogStore) =>
    ({ ok: true, store, workspace: 'D:ws' }) as const;

  it('answers the linked entries as changed and the id as removed, and emits', async () => {
    const emit = vi.fn();
    const result = await deleteEntryResult(opened(linked()), 'a', emit);
    expect(result).toEqual({
      ok: true,
      data: {
        changed: [expect.objectContaining({ id: 'b', relatedIds: [] })],
        removed: ['a'],
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it.each([[undefined], [42], [null], [{}]])(
    'refuses the id %j as ARGUMENTS_INVALID without touching the store',
    async (id) => {
      const emit = vi.fn();
      const store = {
        writeTransaction: () => {
          throw new Error('must not be asked');
        },
      } as unknown as CatalogStore;
      await expect(deleteEntryResult(opened(store), id, emit)).resolves.toEqual(
        {
          ok: false,
          error: { code: 'ARGUMENTS_INVALID' },
        },
      );
      expect(emit).not.toHaveBeenCalled();
    },
  );

  it('answers ENTRY_NOT_FOUND for an unknown id and does not emit', async () => {
    const emit = vi.fn();
    await expect(
      deleteEntryResult(opened(linked()), 'ghost', emit),
    ).resolves.toEqual({ ok: false, error: { code: 'ENTRY_NOT_FOUND' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(
      deleteEntryResult({ ok: false, code: 'DATABASE_TOO_NEW' }, 'a', vi.fn()),
    ).resolves.toEqual({ ok: false, error: { code: 'DATABASE_TOO_NEW' } });
  });
});

describe('category handlers', () => {
  /** Two toolbox categories and one entry `e` that carries `src` only. */
  const fake = () => {
    const categories = new Map([
      ['src', { id: 'src', zone: 'toolbox', name: 'Sursa', nameKey: 'sursa' }],
      ['dst', { id: 'dst', zone: 'toolbox', name: 'Ținta', nameKey: 'tinta' }],
    ]);
    let carried = ['src'];
    const writer = {
      categoryById: (id: string) => categories.get(id),
      categoriesInZone: () => [...categories.values()],
      allCategories: () => [...categories.values()],
      entryIdsWithCategory: (id: string) => (carried.includes(id) ? ['e'] : []),
      entryById: (id: string) =>
        id === 'e'
          ? {
              id: 'e',
              kind: 'tool',
              categories: carried.map((c) => categories.get(c)),
              relatedIds: [],
              parentIds: [],
              childIds: [],
              situations: [],
              keywords: [],
              sources: [],
              verificationNotes: [],
              revision: 1,
            }
          : undefined,
      renameCategory: (id: string, name: string, nameKey: string) => {
        categories.set(id, { ...categories.get(id)!, name, nameKey });
        return true;
      },
      replaceEntryCategories: (_id: string, ids: string[]) => {
        carried = ids;
      },
      bumpRevisions: () => {},
      deleteCategory: (id: string) => categories.delete(id),
    };
    return {
      writeTransaction: (fn: (writer: unknown) => unknown) => fn(writer),
    } as unknown as CatalogStore;
  };
  const opened = (store: CatalogStore) =>
    ({ ok: true, store, workspace: 'D:ws' }) as const;

  it('categories:rename answers the entries and the full category list, and emits', async () => {
    const emit = vi.fn();
    const result = await renameCategoryResult(
      opened(fake()),
      'src',
      'Nou',
      emit,
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        changed: [{ id: 'e', categories: [{ id: 'src', name: 'Nou' }] }],
        categories: [
          { id: 'src', zone: 'toolbox', name: 'Nou' },
          { id: 'dst', zone: 'toolbox', name: 'Ținta' },
        ],
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('categories:rename answers CATEGORY_NAME_TAKEN without emitting', async () => {
    const emit = vi.fn();
    await expect(
      renameCategoryResult(opened(fake()), 'src', 'tinta', emit),
    ).resolves.toEqual({ ok: false, error: { code: 'CATEGORY_NAME_TAKEN' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('categories:merge moves the entries and lists the categories left', async () => {
    const emit = vi.fn();
    const result = await mergeCategoriesResult(
      opened(fake()),
      'src',
      'dst',
      emit,
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        changed: [{ id: 'e', categories: [{ id: 'dst' }] }],
        categories: [{ id: 'dst' }],
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('categories:delete without a target refuses a category some entry holds alone', async () => {
    const emit = vi.fn();
    await expect(
      deleteCategoryResult(opened(fake()), 'src', undefined, emit),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'CATEGORY_TARGET_REQUIRED' },
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('categories:delete with a target merges', async () => {
    const result = await deleteCategoryResult(
      opened(fake()),
      'src',
      'dst',
      vi.fn(),
    );
    expect(result).toMatchObject({
      ok: true,
      data: { categories: [{ id: 'dst' }] },
    });
  });

  it('refuses arguments that are not strings without touching the store', async () => {
    const store = {
      writeTransaction: () => {
        throw new Error('must not be asked');
      },
    } as unknown as CatalogStore;
    const invalid = { ok: false, error: { code: 'ARGUMENTS_INVALID' } };
    await expect(
      renameCategoryResult(opened(store), 1, 'x', vi.fn()),
    ).resolves.toEqual(invalid);
    await expect(
      renameCategoryResult(opened(store), 'a', undefined, vi.fn()),
    ).resolves.toEqual(invalid);
    await expect(
      mergeCategoriesResult(opened(store), 'a', {}, vi.fn()),
    ).resolves.toEqual(invalid);
    await expect(
      deleteCategoryResult(opened(store), 'a', 5, vi.fn()),
    ).resolves.toEqual(invalid);
    await expect(
      deleteCategoryResult(opened(store), null, undefined, vi.fn()),
    ).resolves.toEqual(invalid);
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(
      renameCategoryResult(
        { ok: false, code: 'DATABASE_TOO_NEW' },
        'a',
        'b',
        vi.fn(),
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'DATABASE_TOO_NEW' } });
  });
});

describe('errorDtoOf', () => {
  it('keeps the reasons and issues of a WhenkitError', () => {
    const error = new WhenkitError('ENTRY_REJECTED', {
      reasons: [{ code: 'http_error', params: { status: '404' } }],
      issues: [{ path: ['url', 0], message: 'bad' }],
    });
    expect(errorDtoOf(error, () => {})).toEqual({
      code: 'ENTRY_REJECTED',
      reasons: [{ code: 'http_error', params: { status: '404' } }],
      issues: [{ path: ['url', 0], message: 'bad' }],
    });
  });

  it('answers the code alone when there is nothing to carry', () => {
    expect(errorDtoOf(new WhenkitError('CONFLICT'), () => {})).toEqual({
      code: 'CONFLICT',
    });
  });

  it('logs and hides an unexpected error', () => {
    const logged: unknown[] = [];
    const failure = new Error('boom');
    expect(errorDtoOf(failure, (e) => logged.push(e))).toEqual({
      code: 'INTERNAL',
    });
    expect(logged).toEqual([failure]);
  });

  it('reaches the window through runWrite', async () => {
    const result = await runWrite(
      { ok: true, store: {} as CatalogStore, workspace: 'D:ws' },
      () => {
        throw new WhenkitError('ENTRY_REJECTED', {
          reasons: [{ code: 'blocked_domain', params: { domain: 'x.dev' } }],
        });
      },
      vi.fn(),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ENTRY_REJECTED',
        reasons: [{ code: 'blocked_domain', params: { domain: 'x.dev' } }],
      },
    });
  });
});
