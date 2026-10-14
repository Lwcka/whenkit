import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { openCatalogStore } from '../src/adapters/sqlite/sqlite-catalog-store';
import { WhenkitError } from '../src/core/errors';
import type {
  CatalogStoreOpener,
  Clock,
  Environment,
  GitHubClient,
  HttpClient,
  IdGenerator,
} from '../src/core/ports';

// Shared test fixtures: temp dirs under the OS temp folder and injected
// environments, so no test ever touches the real %APPDATA% or workspace.

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'whenkit-test-'));
  tempDirs.push(dir);
  return dir;
}

/** A clock fixed at a local date-time, so file names are predictable. */
export function fixedClock(date = new Date(2026, 9, 13, 14, 5, 9)): Clock {
  return { now: () => new Date(date) };
}

/**
 * Sequential ids that still look like UUID v4. Generators with different
 * `series` (8000, 9000, a000, b000) never produce the same id.
 */
export function sequentialIds(series = '8000'): IdGenerator {
  let n = 0;
  return {
    newId: () =>
      `00000000-0000-4000-${series}-${String(++n).padStart(12, '0')}`,
  };
}

/**
 * The real SqliteCatalogStore with a fixed clock. Its ids (owner and seeded
 * categories) come from their own series, so they never collide with the
 * ids core generates through the CLI's IdGenerator.
 */
export function testStoreOpener(): CatalogStoreOpener {
  return (dbPath, options) =>
    openCatalogStore(dbPath, {
      ...options,
      clock: fixedClock(),
      ids: sequentialIds('9000'),
      busyTimeoutMs: 100,
    });
}

export function fakeEnvironment(
  vars: Record<string, string | undefined>,
  appRoot: string,
): Environment {
  return { get: (name) => vars[name], appRoot: () => appRoot };
}

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Creates a fake app root at `dir` holding a copy of the repo's
 * `workspace-template/`, which init and import read (AD-17).
 */
export function fakeAppRoot(dir: string): string {
  mkdirSync(dir, { recursive: true });
  cpSync(
    path.join(REPO_ROOT, 'workspace-template'),
    path.join(dir, 'workspace-template'),
    { recursive: true },
  );
  return dir;
}

/** An HttpClient that answers 200 for every link, without any network. */
export const okHttp: HttpClient = {
  check: (url) => Promise.resolve({ kind: 'ok', status: 200, finalUrl: url }),
};

/** A GitHubClient that finds no repository: the import writes no GitHub data. */
export const notFoundGithub: GitHubClient = {
  repo: () => Promise.resolve({ kind: 'notFound' }),
};

/** An HttpClient that fails the test if anything checks a link. */
export const unusedHttp: HttpClient = {
  check: () => Promise.reject(new Error('no link check expected')),
};

/** The code of the WhenkitError that `action` throws. */
export function errorCodeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof WhenkitError) return error.code;
    throw error;
  }
  throw new Error('expected a WhenkitError');
}
