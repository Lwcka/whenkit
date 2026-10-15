import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES } from '../src/cli/main';
import {
  isBlocked,
  parseBlockedDomains,
} from '../src/core/verification/blocked-domains';
import { BATCH_SCHEMA_VERSION, TEMPLATE_VERSION } from '../src/core/versions';
import { errorMessages } from '../src/shared/strings.ro';
import { fakeAppRoot, runWhenkit, tempDir } from './helpers';

// `whenkit init` end to end on temp dirs: real file system and SQLite, with
// APPDATA, WHENKIT_WORKSPACE and the app root injected (AD-8).

interface Setup {
  root: string;
  appData: string;
  appRoot: string;
  configFile: string;
  vars: Record<string, string | undefined>;
}

function setup(vars: { workspaceEnv?: string } = {}): Setup {
  const root = tempDir();
  const appData = path.join(root, 'AppData');
  const appRoot = fakeAppRoot(path.join(root, 'repo'));
  mkdirSync(appData);
  return {
    root,
    appData,
    appRoot,
    configFile: path.join(appData, 'whenkit', 'config.json'),
    vars: { APPDATA: appData, WHENKIT_WORKSPACE: vars.workspaceEnv },
  };
}

function runCli(s: Setup, args: string[], cwd = s.root) {
  return runWhenkit(args, { vars: s.vars, appRoot: s.appRoot, cwd });
}

function query<T>(dbPath: string, sql: string): T {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(sql).get() as T;
  } finally {
    db.close();
  }
}

const FOLDERS = ['input', 'batches', 'data', path.join('data', 'backups')];

describe('whenkit init', () => {
  it('creates a new workspace at schema v1 and saves config.json', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    const result = await runCli(s, ['init', workspace]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(workspace);
    for (const folder of FOLDERS) {
      expect(statSync(path.join(workspace, folder)).isDirectory()).toBe(true);
    }
    const dbPath = path.join(workspace, 'data', 'catalog.sqlite');
    expect(
      query(dbPath, 'SELECT max(version) AS v FROM schema_migrations'),
    ).toEqual({ v: 1 });
    expect(JSON.parse(readFileSync(s.configFile, 'utf8'))).toEqual({
      configVersion: 1,
      workspace,
    });
  });

  it('resolves a relative path against the current directory', async () => {
    const s = setup();
    const result = await runCli(s, ['init', 'ws-rel']);
    expect(result.exitCode).toBe(0);
    const workspace = path.join(s.root, 'ws-rel');
    expect(existsSync(path.join(workspace, 'data', 'catalog.sqlite'))).toBe(
      true,
    );
    expect(JSON.parse(readFileSync(s.configFile, 'utf8')).workspace).toBe(
      workspace,
    );
  });

  it('uses WHENKIT_WORKSPACE and does not write config.json', async () => {
    const workspace = path.join(tempDir(), 'dev-ws');
    const s = setup({ workspaceEnv: workspace });
    const result = await runCli(s, ['init']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(workspace);
    expect(existsSync(path.join(workspace, 'data', 'catalog.sqlite'))).toBe(
      true,
    );
    expect(existsSync(path.join(s.appData, 'whenkit'))).toBe(false);
  });

  it('does not write config.json with an explicit path when the env var is set', async () => {
    const s = setup({ workspaceEnv: path.join(tempDir(), 'dev-ws') });
    const result = await runCli(s, ['init', path.join(s.root, 'other')]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(s.configFile)).toBe(false);
  });

  it('reuses the configured workspace on a second init without touching data', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    expect((await runCli(s, ['init', workspace])).exitCode).toBe(0);
    const dbPath = path.join(workspace, 'data', 'catalog.sqlite');
    const owner = query<{ owner_id: string }>(
      dbPath,
      'SELECT owner_id FROM meta',
    ).owner_id;
    writeFileSync(path.join(workspace, 'input', 'note.txt'), 'keep me');

    const again = await runCli(s, ['init']);
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain(workspace);
    expect(
      query(dbPath, 'SELECT count(*) AS n FROM schema_migrations'),
    ).toEqual({ n: 1 });
    expect(query(dbPath, 'SELECT count(*) AS n FROM categories')).toEqual({
      n: 16,
    });
    expect(query(dbPath, 'SELECT owner_id FROM meta')).toEqual({
      owner_id: owner,
    });
    expect(
      readFileSync(path.join(workspace, 'input', 'note.txt'), 'utf8'),
    ).toBe('keep me');
    expect(readdirSync(path.join(workspace, 'data', 'backups'))).toEqual([]);
  });

  it('creates data/blocked-domains.txt from the template and never overwrites it', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    expect((await runCli(s, ['init', workspace])).exitCode).toBe(0);
    const list = path.join(workspace, 'data', 'blocked-domains.txt');
    const template = readFileSync(
      path.join(s.appRoot, 'workspace-template', 'data', 'blocked-domains.txt'),
      'utf8',
    );
    expect(readFileSync(list, 'utf8')).toBe(template);
    expect(template).toMatch(/^libgen\.\*$/m);

    writeFileSync(list, 'exemplu.com\n');
    expect((await runCli(s, ['init'])).exitCode).toBe(0);
    expect(readFileSync(list, 'utf8')).toBe('exemplu.com\n');
  });

  it('ships an initial blocked-domains list with exactly the rules of the spec', () => {
    const rules = parseBlockedDomains(
      readFileSync(
        path.join(
          __dirname,
          '..',
          'workspace-template',
          'data',
          'blocked-domains.txt',
        ),
        'utf8',
      ),
    );
    expect(rules).toEqual([
      'libgen.*',
      'sci-hub.*',
      'z-lib.*',
      'pdfdrive.com',
      '12ft.io',
    ]);
    for (const url of [
      'https://libgen.is/book',
      'https://sci-hub.se/x',
      'https://z-lib.org/',
      'https://www.pdfdrive.com/a',
      'https://12ft.io/proxy',
    ]) {
      expect(isBlocked(url, rules)).toBeDefined();
    }
    expect(isBlocked('https://example.com/', rules)).toBeUndefined();
  });

  it('installs the whole template, the batch schema and the marker, without .gitkeep', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    const template = path.join(s.appRoot, 'workspace-template');
    mkdirSync(path.join(template, '.claude', 'skills'), { recursive: true });
    mkdirSync(path.join(template, 'input'), { recursive: true });
    writeFileSync(path.join(template, '.claude', 'skills', '.gitkeep'), '');
    writeFileSync(path.join(template, '.claude', 'skills', 'x.md'), 'x');
    writeFileSync(path.join(template, 'input', '.gitkeep'), '');
    expect((await runCli(s, ['init', workspace])).exitCode).toBe(0);

    const templateClaude = readFileSync(
      path.join(s.appRoot, 'workspace-template', 'CLAUDE.md'),
      'utf8',
    );
    expect(readFileSync(path.join(workspace, 'CLAUDE.md'), 'utf8')).toBe(
      templateClaude,
    );
    expect(
      readFileSync(path.join(workspace, 'batch.schema.json'), 'utf8'),
    ).toBe((await runCli(s, ['schema'])).stdout);
    expect(
      JSON.parse(
        readFileSync(path.join(workspace, '.whenkit-template.json'), 'utf8'),
      ),
    ).toEqual({
      templateVersion: TEMPLATE_VERSION,
      batchSchemaVersion: BATCH_SCHEMA_VERSION,
    });
    expect(
      existsSync(path.join(workspace, 'data', 'blocked-domains.txt')),
    ).toBe(true);
    for (const dir of [
      workspace,
      path.join(workspace, 'input'),
      path.join(workspace, '.claude', 'skills'),
    ]) {
      expect(readdirSync(dir)).not.toContain('.gitkeep');
    }
  });

  it('restores template-managed files on a second init and keeps the user files', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    expect((await runCli(s, ['init', workspace])).exitCode).toBe(0);
    const claude = path.join(workspace, 'CLAUDE.md');
    const schema = path.join(workspace, 'batch.schema.json');
    const list = path.join(workspace, 'data', 'blocked-domains.txt');
    const note = path.join(workspace, 'input', 'note.txt');
    const old = path.join(workspace, 'old-file.md');
    const originalClaude = readFileSync(claude, 'utf8');
    const originalSchema = readFileSync(schema, 'utf8');
    writeFileSync(claude, 'edited');
    writeFileSync(schema, 'edited');
    writeFileSync(list, 'exemplu.com\n');
    writeFileSync(note, 'keep me');
    writeFileSync(old, 'not in the template any more');
    const dbPath = path.join(workspace, 'data', 'catalog.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(
      "INSERT INTO categories (id, owner_id, zone, name, name_key) SELECT 'extra', owner_id, 'learn', 'Extra', 'extra' FROM meta",
    );
    db.close();

    expect((await runCli(s, ['init'])).exitCode).toBe(0);
    expect(readFileSync(claude, 'utf8')).toBe(originalClaude);
    expect(readFileSync(schema, 'utf8')).toBe(originalSchema);
    expect(readFileSync(list, 'utf8')).toBe('exemplu.com\n');
    expect(readFileSync(note, 'utf8')).toBe('keep me');
    expect(readFileSync(old, 'utf8')).toBe('not in the template any more');
    expect(query(dbPath, 'SELECT count(*) AS n FROM categories')).toEqual({
      n: 17,
    });
  });

  it('fails with exit 4 and creates nothing when the template is missing', async () => {
    const s = setup();
    rmSync(path.join(s.appRoot, 'workspace-template'), { recursive: true });
    const workspace = path.join(s.root, 'ws');
    const result = await runCli(s, ['init', workspace]);

    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain(errorMessages.INTERNAL);
    expect(existsSync(workspace)).toBe(false);
    expect(existsSync(s.configFile)).toBe(false);
  });

  it('installs the /importa and /gaseste skills, the example batch and the shared card rules', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    expect((await runCli(s, ['init', workspace])).exitCode).toBe(0);
    for (const file of [
      ['.claude', 'skills', 'importa', 'SKILL.md'],
      ['.claude', 'skills', 'importa', 'exemplu-lot.json'],
      ['.claude', 'skills', 'gaseste', 'SKILL.md'],
      ['.claude', 'skills', 'reguli-fise.md'],
    ]) {
      expect(existsSync(path.join(workspace, ...file))).toBe(true);
    }
  });

  it('the template CLAUDE.md names every CLI command and the contract files', () => {
    const claude = readFileSync(
      path.join(__dirname, '..', 'workspace-template', 'CLAUDE.md'),
      'utf8',
    );
    for (const name of COMMAND_NAMES) {
      expect(claude).toContain(`whenkit ${name}`);
    }
    for (const needle of [
      '.claude/skills/importa/',
      '.claude/skills/gaseste/',
      '.claude/skills/reguli-fise.md',
      'batch.schema.json',
      'batches/',
      'Notițele mele',
      'data/',
    ]) {
      expect(claude).toContain(needle);
    }
  });

  it.each([
    ['the app root itself', (appRoot: string) => appRoot],
    ['a folder inside it', (appRoot: string) => path.join(appRoot, 'ws')],
    [
      'it in another case with a trailing slash',
      (appRoot: string) => `${appRoot.toUpperCase()}/`,
    ],
  ])('refuses %s with exit 2', async (_label, target) => {
    const s = setup();
    const workspace = target(s.appRoot);
    const result = await runCli(s, ['init', workspace]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(errorMessages.WORKSPACE_INSIDE_REPO);
    expect(readdirSync(s.appRoot)).toEqual(['workspace-template']);
    expect(existsSync(path.join(s.appData, 'whenkit'))).toBe(false);
  });

  it('refuses WHENKIT_WORKSPACE inside the app root', async () => {
    const s = setup();
    s.vars.WHENKIT_WORKSPACE = path.join(s.appRoot, 'ws');
    const result = await runCli(s, ['init']);
    expect(result.exitCode).toBe(2);
    expect(readdirSync(s.appRoot)).toEqual(['workspace-template']);
  });

  // Win32 clamps `..` at the drive root and strips trailing dots and spaces,
  // so these spellings point into the app root (or are refused outright).
  const windowsSpellings: [string, (appRoot: string) => string][] = [
    ['`..` above the drive', (r) => `${r.slice(0, 3)}..\\${r.slice(3)}\\ws`],
    ['a trailing dot', (r) => `${r}.\\ws`],
    ['a trailing space', (r) => `${r} \\ws`],
  ];

  function expectNothingCreated(s: Setup) {
    expect(readdirSync(s.root).sort()).toEqual(['AppData', 'repo']);
    expect(readdirSync(s.appRoot)).toEqual(['workspace-template']);
    expect(readdirSync(s.appData)).toEqual([]);
  }

  it.each(windowsSpellings)(
    'refuses a CLI path with %s and creates nothing',
    async (_label, spell) => {
      const s = setup();
      const result = await runCli(s, ['init', spell(s.appRoot)]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expectNothingCreated(s);
    },
  );

  it.each(windowsSpellings)(
    'refuses WHENKIT_WORKSPACE with %s and creates nothing',
    async (_label, spell) => {
      const s = setup();
      s.vars.WHENKIT_WORKSPACE = spell(s.appRoot);
      const result = await runCli(s, ['init']);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expectNothingCreated(s);
    },
  );

  it('refuses a device path with CONFIG_INVALID, exit 2', async () => {
    const s = setup();
    const result = await runCli(s, ['init', `\\\\?\\${s.root}\\ws`]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(errorMessages.CONFIG_INVALID);
    expectNothingCreated(s);
  });

  it('reads a config.json saved with a UTF-8 byte-order mark', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    mkdirSync(path.dirname(s.configFile));
    writeFileSync(
      s.configFile,
      `﻿${JSON.stringify({ configVersion: 1, workspace })}`,
    );
    const result = await runCli(s, ['init']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(workspace, 'data', 'catalog.sqlite'))).toBe(
      true,
    );
  });

  it('fails with WORKSPACE_NOT_CONFIGURED and creates nothing', async () => {
    const s = setup();
    const result = await runCli(s, ['init']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(errorMessages.WORKSPACE_NOT_CONFIGURED);
    expect(result.stderr).not.toMatch(/\bat\s.+:\d+:\d+/);
    expect(readdirSync(s.root).sort()).toEqual(['AppData', 'repo']);
    expect(readdirSync(s.appData)).toEqual([]);
  });

  it('fails with CONFIG_INVALID on a malformed config.json and creates nothing', async () => {
    const s = setup();
    mkdirSync(path.dirname(s.configFile));
    writeFileSync(s.configFile, '{ "configVersion": 1, ');
    const result = await runCli(s, ['init']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(errorMessages.CONFIG_INVALID);
    expect(readdirSync(s.root).sort()).toEqual(['AppData', 'repo']);
    expect(readFileSync(s.configFile, 'utf8')).toBe('{ "configVersion": 1, ');
  });

  it('exits 3 with MIGRATION_MISMATCH when an applied migration changed', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    await runCli(s, ['init', workspace]);
    const dbPath = path.join(workspace, 'data', 'catalog.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec("UPDATE schema_migrations SET sha256 = 'tampered'");
    db.close();

    const result = await runCli(s, ['init']);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain(errorMessages.MIGRATION_MISMATCH);
    expect(query(dbPath, 'SELECT sha256 FROM schema_migrations')).toEqual({
      sha256: 'tampered',
    });
  });

  it('exits 3 with DATABASE_TOO_NEW for a migration unknown to the code', async () => {
    const s = setup();
    const workspace = path.join(s.root, 'ws');
    await runCli(s, ['init', workspace]);
    const dbPath = path.join(workspace, 'data', 'catalog.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(
      "INSERT INTO schema_migrations (version, name, sha256) VALUES (999, 'future', 'x')",
    );
    db.close();

    const result = await runCli(s, ['init']);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain(errorMessages.DATABASE_TOO_NEW);
  });
});
