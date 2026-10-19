import { describe, expect, it } from 'vitest';
import { WhenkitError } from '../../core/errors';
import type { CatalogStore, Environment, FileSystem } from '../../core/ports';
import { openDesktopCatalog, snapshotResult } from './catalog';

const env: Environment = {
  get: (name) => (name === 'WHENKIT_WORKSPACE' ? 'D:\\ws' : undefined),
  appRoot: () => 'C:\\app',
};
const fs = { joinPath: (...parts: string[]) => parts.join('\\') } as FileSystem;

describe('openDesktopCatalog', () => {
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
    expect(snapshotResult({ ok: true, store }, (e) => logged.push(e))).toEqual({
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
      snapshotResult({ ok: true, store: {} as CatalogStore }, () => {
        throw new Error('log down');
      }),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
});
