import { describe, expect, it, vi } from 'vitest';
import { WhenkitError } from '../../core/errors';
import type {
  CatalogStore,
  CatalogReader,
  Environment,
  FileSystem,
  StoredEntry,
} from '../../core/ports';
import type { EntryDto } from '../../shared/ipc';
import type { ExportDeps, WriteContext } from './catalog';
import {
  deleteCategoryResult,
  deleteEntryResult,
  mergeCategoriesResult,
  renameCategoryResult,
  errorDtoOf,
  exportCatalogResult,
  openDesktopCatalog,
  openExportFolderResult,
  runWrite,
  searchResult,
  setNotesResult,
  snapshotResult,
} from './catalog';

const env: Environment = {
  get: (name) => (name === 'WHENKIT_WORKSPACE' ? 'D:\\ws' : undefined),
  appRoot: () => 'C:\\app',
};
const fs = { joinPath: (...parts: string[]) => parts.join('\\') } as FileSystem;

const opened = (store: CatalogStore) =>
  ({ ok: true, store, workspace: 'D:ws' }) as const;

/** What a write handler is given: the open catalog and the emit that follows a write. */
const writeContext = (
  store: CatalogStore,
  emit: () => void = vi.fn(),
): WriteContext => ({ opened: opened(store), emit });

/** A write context for a catalog that did not open. */
const closedContext = (): WriteContext => ({
  opened: { ok: false, code: 'DATABASE_TOO_NEW' },
  emit: vi.fn(),
});

/** A stored entry: a tool with no links, notes or categories. */
function storedEntry(overrides: Partial<StoredEntry> = {}): StoredEntry {
  return {
    id: 'e1',
    ownerId: 'o',
    kind: 'tool',
    name: 'Tool',
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
    dedupKey: 'e1',
    revision: 1,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
    ...overrides,
  };
}

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
  const stored = storedEntry({
    url: 'https://tool.dev',
    resourceType: 'site',
    dedupKey: 'url:tool.dev',
    revision: 3,
  });

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

  it('answers the changed entry and emits', async () => {
    const emit = vi.fn();
    const result = await setNotesResult(
      writeContext(storing(), emit),
      'e1',
      ' ce notez\n',
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
        setNotesResult(writeContext(store, emit), id, notes),
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
      setNotesResult(writeContext(storing(), emit), 'ghost', 'x'),
    ).resolves.toEqual({ ok: false, error: { code: 'ENTRY_NOT_FOUND' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(setNotesResult(closedContext(), 'e1', 'x')).resolves.toEqual({
      ok: false,
      error: { code: 'DATABASE_TOO_NEW' },
    });
  });
});

describe('deleteEntryResult', () => {
  const row = (id: string, links: Partial<StoredEntry> = {}) =>
    storedEntry({ id, name: id, dedupKey: id, ...links });

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

  it('answers the linked entries as changed and the id as removed, and emits', async () => {
    const emit = vi.fn();
    const result = await deleteEntryResult(writeContext(linked(), emit), 'a');
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
      await expect(
        deleteEntryResult(writeContext(store, emit), id),
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
      deleteEntryResult(writeContext(linked(), emit), 'ghost'),
    ).resolves.toEqual({ ok: false, error: { code: 'ENTRY_NOT_FOUND' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(deleteEntryResult(closedContext(), 'a')).resolves.toEqual({
      ok: false,
      error: { code: 'DATABASE_TOO_NEW' },
    });
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

  it('categories:rename answers the entries and the full category list, and emits', async () => {
    const emit = vi.fn();
    const result = await renameCategoryResult(
      writeContext(fake(), emit),
      'src',
      'Nou',
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
      renameCategoryResult(writeContext(fake(), emit), 'src', 'tinta'),
    ).resolves.toEqual({ ok: false, error: { code: 'CATEGORY_NAME_TAKEN' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('categories:merge moves the entries and lists the categories left', async () => {
    const emit = vi.fn();
    const result = await mergeCategoriesResult(
      writeContext(fake(), emit),
      'src',
      'dst',
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
      deleteCategoryResult(writeContext(fake(), emit), 'src', undefined),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'CATEGORY_TARGET_REQUIRED' },
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('categories:delete with a target merges', async () => {
    const result = await deleteCategoryResult(
      writeContext(fake()),
      'src',
      'dst',
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
      renameCategoryResult(writeContext(store), 1, 'x'),
    ).resolves.toEqual(invalid);
    await expect(
      renameCategoryResult(writeContext(store), 'a', undefined),
    ).resolves.toEqual(invalid);
    await expect(
      mergeCategoriesResult(writeContext(store), 'a', {}),
    ).resolves.toEqual(invalid);
    await expect(
      deleteCategoryResult(writeContext(store), 'a', 5),
    ).resolves.toEqual(invalid);
    await expect(
      deleteCategoryResult(writeContext(store), null, undefined),
    ).resolves.toEqual(invalid);
  });

  it('keeps the startup code when the catalog is not open', async () => {
    await expect(
      renameCategoryResult(closedContext(), 'a', 'b'),
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

describe('exportCatalogResult', () => {
  const written: Record<string, string> = {};
  const exportFs: FileSystem = {
    exists: () => false,
    mkdir: () => {},
    removeDir: () => {},
    readText: () => '',
    writeText: (path, text) => {
      written[path] = text;
    },
    listFiles: () => [],
    joinPath: (...parts) => parts.join('/'),
  };
  const deps: ExportDeps = {
    fs: exportFs,
    clock: { now: () => new Date(2026, 9, 16, 14, 30, 2) },
    labels: {
      fallbackSlug: 'fisa',
      situations: () => 'Situații',
      content: 'Conținut',
      sources: 'Surse',
      umbrellas: 'Umbrele',
      children: 'Concepte',
      related: 'Înrudite',
      myNotes: 'Notițe',
    },
  };
  const emptyStore = {
    readTransaction: <T>(fn: (reader: CatalogReader) => T): T =>
      fn({
        allEntries: () => [],
        allCategories: () => [],
      } as unknown as CatalogReader),
  } as unknown as CatalogStore;
  const open = { ok: true, store: emptyStore, workspace: 'D:/ws' } as const;

  it('answers null for a cancelled dialog and writes nothing', () => {
    for (const key of Object.keys(written)) delete written[key];
    expect(exportCatalogResult(open, undefined, deps, vi.fn())).toEqual({
      ok: true,
      data: null,
    });
    expect(written).toEqual({});
  });

  it('answers the folder it created', () => {
    expect(exportCatalogResult(open, 'D:/out', deps, vi.fn())).toEqual({
      ok: true,
      data: {
        folderName: 'whenkit-export-2026-10-16_143002',
        folderPath: 'D:/out/whenkit-export-2026-10-16_143002',
      },
    });
    expect(Object.keys(written)).toEqual([
      'D:/out/whenkit-export-2026-10-16_143002/catalog.json',
    ]);
  });

  it('keeps the startup code when the catalog is not open', () => {
    const logged = vi.fn();
    expect(
      exportCatalogResult(
        { ok: false, code: 'DATABASE_NEEDS_MIGRATION' },
        'D:/out',
        deps,
        logged,
      ),
    ).toEqual({ ok: false, error: { code: 'DATABASE_NEEDS_MIGRATION' } });
    expect(
      exportCatalogResult(
        { ok: false, code: 'DATABASE_NEEDS_MIGRATION' },
        undefined,
        deps,
        logged,
      ),
    ).toEqual({ ok: false, error: { code: 'DATABASE_NEEDS_MIGRATION' } });
    expect(logged).not.toHaveBeenCalled();
  });

  it('answers EXPORT_WRITE_FAILED when the disk refuses, and logs the disk error', () => {
    const logged = vi.fn();
    const diskError = new Error('read-only');
    const failing: ExportDeps = {
      ...deps,
      fs: {
        ...exportFs,
        writeText: () => {
          throw diskError;
        },
      },
    };
    expect(exportCatalogResult(open, 'D:/out', failing, logged)).toEqual({
      ok: false,
      error: { code: 'EXPORT_WRITE_FAILED' },
    });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(diskError);
    // A logger that throws does not turn the answer into a throw.
    expect(
      exportCatalogResult(open, 'D:/out', failing, () => {
        throw new Error('log full');
      }),
    ).toEqual({ ok: false, error: { code: 'EXPORT_WRITE_FAILED' } });
  });

  it('logs an unexpected failure and answers INTERNAL', () => {
    const logged = vi.fn();
    const broken = {
      ok: true,
      store: {} as CatalogStore,
      workspace: 'D:/ws',
    } as const;
    expect(exportCatalogResult(broken, 'D:/out', deps, logged)).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe('openExportFolderResult', () => {
  const exported = new Set(['D:/out/whenkit-export-1']);

  it('opens a folder this session exported', async () => {
    const opener = vi.fn(() => Promise.resolve(''));
    expect(
      await openExportFolderResult(
        'D:/out/whenkit-export-1',
        exported,
        opener,
        vi.fn(),
      ),
    ).toEqual({ ok: true, data: null });
    expect(opener).toHaveBeenCalledWith('D:/out/whenkit-export-1');
  });

  it.each(['C:/Windows', 'D:/out', '', 7, null, undefined])(
    'refuses %j without opening anything',
    async (path) => {
      const opener = vi.fn(() => Promise.resolve(''));
      expect(
        await openExportFolderResult(path, exported, opener, vi.fn()),
      ).toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
      expect(opener).not.toHaveBeenCalled();
    },
  );

  it('answers INTERNAL and logs when the shell reports an error', async () => {
    const logged = vi.fn();
    expect(
      await openExportFolderResult(
        'D:/out/whenkit-export-1',
        exported,
        () => Promise.resolve('Failed to open path'),
        logged,
      ),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe('runWrite', () => {
  const store = {} as CatalogStore;
  const open = { ok: true, store, workspace: 'D:\\ws' } as const;
  const changed: readonly EntryDto[] = [];

  it('emits after a successful write and answers with its result', async () => {
    const emit = vi.fn();
    const fn = vi.fn((given: CatalogStore) => {
      expect(given).toBe(store);
      return { changed };
    });
    await expect(runWrite(open, fn, emit)).resolves.toEqual({
      ok: true,
      data: { changed },
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('awaits an asynchronous write before it emits', async () => {
    const order: string[] = [];
    const result = await runWrite(
      open,
      async () => {
        await Promise.resolve();
        order.push('written');
        return { changed };
      },
      () => order.push('emitted'),
    );
    expect(result.ok).toBe(true);
    expect(order).toEqual(['written', 'emitted']);
  });

  it('answers the code of a WhenkitError and does not emit', async () => {
    const emit = vi.fn();
    const logError = vi.fn();
    await expect(
      runWrite(
        open,
        () => {
          throw new WhenkitError('ARGUMENTS_INVALID');
        },
        emit,
        logError,
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'ARGUMENTS_INVALID' } });
    expect(emit).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('answers INTERNAL for any other throw, logged, without emitting', async () => {
    const emit = vi.fn();
    const logError = vi.fn();
    const failure = new Error('disk on fire');
    await expect(
      runWrite(open, () => Promise.reject(failure), emit, logError),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(emit).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(failure);
  });

  it('answers the startup code when the catalog did not open', async () => {
    const fn = vi.fn(() => ({ changed }));
    const emit = vi.fn();
    await expect(
      runWrite({ ok: false, code: 'DATABASE_NEEDS_MIGRATION' }, fn, emit),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'DATABASE_NEEDS_MIGRATION' },
    });
    expect(fn).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps a saved write an answer when emit throws', async () => {
    const logError = vi.fn();
    await expect(
      runWrite(
        open,
        () => ({ changed }),
        () => {
          throw new Error('window gone');
        },
        logError,
      ),
    ).resolves.toEqual({ ok: true, data: { changed } });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
