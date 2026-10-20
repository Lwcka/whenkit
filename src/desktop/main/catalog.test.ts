import { describe, expect, it } from 'vitest';
import { WhenkitError } from '../../core/errors';
import type { CatalogStore, Environment, FileSystem } from '../../core/ports';
import { openDesktopCatalog, searchResult, snapshotResult } from './catalog';

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
