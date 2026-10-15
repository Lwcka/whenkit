import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { main, type CliDeps } from '../src/cli/main';
import { showOutputSchema } from '../src/core/cli-schemas';
import type { EntryDto } from '../src/core/dto';
import {
  importReportSchema,
  type ImportReport,
} from '../src/core/import-report-schema';
import type {
  CatalogStoreOpener,
  Clock,
  GitHubClient,
  HttpClient,
} from '../src/core/ports';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  notFoundGithub,
  okHttp,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// The harness the end-to-end CLI tests share: a temp development workspace
// (WHENKIT_WORKSPACE set, APPDATA and the app root faked, so no real config
// is ever touched), `main()` run in-process on the real file system and
// SQLite, and the builders and readers those tests repeat.

export interface CliSetup {
  root: string;
  workspace: string;
  dbPath: string;
  deps: CliDeps;
}

export interface SetupOptions {
  /** False leaves WHENKIT_WORKSPACE unset. */
  workspaceEnv?: boolean;
  openStore?: CatalogStoreOpener;
  /** Link checker; every link answers 200 when unset. */
  http?: HttpClient;
  /** GitHub client; no repository is found when unset. */
  github?: GitHubClient;
  /** Fixed at 2026-10-13T12:00:00Z when unset. */
  clock?: Clock;
  /** Pause before a link check is retried; the CLI default (1 s) when unset. */
  retryDelayMs?: number;
}

export function setup(options: SetupOptions = {}): CliSetup {
  const root = tempDir();
  const appRoot = fakeAppRoot(path.join(root, 'repo'));
  const appData = path.join(root, 'AppData');
  mkdirSync(appData);
  const workspace = path.join(root, 'ws');
  return {
    root,
    workspace,
    dbPath: path.join(workspace, 'data', 'catalog.sqlite'),
    deps: {
      env: fakeEnvironment(
        {
          APPDATA: appData,
          WHENKIT_WORKSPACE:
            options.workspaceEnv === false ? undefined : workspace,
        },
        appRoot,
      ),
      fs: nodeFileSystem,
      clock: options.clock ?? fixedClock(new Date('2026-10-13T12:00:00.000Z')),
      ids: sequentialIds(),
      openStore: options.openStore ?? testStoreOpener(),
      http: options.http ?? okHttp,
      github: options.github ?? notFoundGithub,
      retryDelayMs: options.retryDelayMs,
      cwd: root,
    },
  };
}

export async function runCli(s: CliSetup, args: string[]) {
  let stdout = '';
  let stderr = '';
  const exitCode = await main(
    args,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    s.deps,
  );
  return { exitCode, stdout, stderr };
}

/** A setup whose workspace `whenkit init` has already created. */
export async function initialized(options?: SetupOptions): Promise<CliSetup> {
  const s = setup(options);
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
}

let batchCount = 0;

/** Writes a batch file in the temp root and returns its relative path. */
export function writeBatch(s: CliSetup, content: unknown): string {
  const file = `batch-${++batchCount}.json`;
  writeFileSync(
    path.join(s.root, file),
    typeof content === 'string' ? content : JSON.stringify(content),
  );
  return file;
}

export function batch(items: unknown[], extra: Record<string, unknown> = {}) {
  return { schemaVersion: 1, items, ...extra };
}

export function tool(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'tool',
    name: `Tool ${ref}`,
    url: `https://${ref}.dev`,
    resourceType: 'site',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva util.',
    situations: ['Când am nevoie de el'],
    keywords: ['util'],
    ...overrides,
  };
}

/** Runs `import <batch> --json` and parses the stdout. */
export async function importJson(
  s: CliSetup,
  content: unknown,
  flags: string[] = [],
) {
  const result = await runCli(s, [
    'import',
    writeBatch(s, content),
    '--json',
    ...flags,
  ]);
  return { ...result, json: JSON.parse(result.stdout) as unknown };
}

/** Imports successfully (exit 0) and returns the validated report. */
export async function importReport(
  s: CliSetup,
  content: unknown,
  flags: string[] = [],
): Promise<ImportReport> {
  const result = await importJson(s, content, flags);
  expect(result.exitCode).toBe(0);
  return importReportSchema.parse(result.json);
}

/** `id` may be a report item's `id`, which is optional in the schema. */
export async function show(
  s: CliSetup,
  id: string | undefined,
): Promise<EntryDto> {
  const result = await runCli(s, ['show', String(id), '--json']);
  expect(result.exitCode).toBe(0);
  return showOutputSchema.parse(JSON.parse(result.stdout)).entry;
}

export function count(dbPath: string, table: string): number {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return (
      db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }
    ).n;
  } finally {
    db.close();
  }
}
