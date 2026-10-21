import { describe, expect, it } from 'vitest';
import { batchJsonSchemaText } from './batch-json-schema';
import { WhenkitError } from './errors';
import type { Environment, FileSystem, OpenStoreOptions } from './ports';
import { BATCH_SCHEMA_VERSION, TEMPLATE_VERSION } from './versions';
import {
  desktopDataDir,
  initWorkspace,
  isSameOrInside,
  normalizeWorkspacePath,
  readBlockedDomains,
  resolveWorkspace,
  templateOutdated,
} from './workspace';

// In-memory fakes: core tests never touch the disk (AD-2). Paths use `\`.

class FakeFileSystem implements FileSystem {
  readonly files = new Map<string, string>();
  readonly dirs = new Set<string>();
  readonly unreadable = new Set<string>();

  exists(path: string) {
    return this.files.has(path) || this.dirs.has(path);
  }
  mkdir(path: string) {
    this.dirs.add(path);
  }
  removeDir(path: string) {
    this.dirs.delete(path);
  }
  readText(path: string) {
    const text = this.files.get(path);
    if (text === undefined || this.unreadable.has(path)) {
      throw new Error(`cannot read ${path}`);
    }
    return text;
  }
  writeText(path: string, text: string) {
    this.files.set(path, text);
  }
  listFiles(dir: string) {
    const prefix = `${dir}\\`;
    const found = [...this.files.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length).replaceAll('\\', '/'))
      .sort();
    if (found.length === 0) throw new Error(`cannot list ${dir}`);
    return found;
  }
  joinPath(...parts: string[]) {
    return parts.join('\\');
  }
}

const APP_ROOT = 'C:\\Proiecte\\whenkit';
const APPDATA = 'C:\\AppData';
const CONFIG = 'C:\\AppData\\whenkit\\config.json';
const TEMPLATE_LIST =
  'C:\\Proiecte\\whenkit\\workspace-template\\data\\blocked-domains.txt';
const TEMPLATE_TEXT = '# initial\nlibgen.*\npdfdrive.com\n';

const TEMPLATE_DIR = 'C:\\Proiecte\\whenkit\\workspace-template';
const TEMPLATE_CLAUDE = `${TEMPLATE_DIR}\\CLAUDE.md`;
const TEMPLATE_SKILL = `${TEMPLATE_DIR}\\.claude\\skills\\importa\\SKILL.md`;
const TEMPLATE_KEEP = `${TEMPLATE_DIR}\\input\\.gitkeep`;
const TEMPLATE_INPUT = `${TEMPLATE_DIR}\\input\\welcome.txt`;
const TEMPLATE_FILES = [
  TEMPLATE_CLAUDE,
  TEMPLATE_SKILL,
  TEMPLATE_KEEP,
  TEMPLATE_INPUT,
  TEMPLATE_LIST,
].sort();

/** A fake file system holding the app's workspace template. */
function withTemplate(fs = new FakeFileSystem()): FakeFileSystem {
  fs.writeText(TEMPLATE_LIST, TEMPLATE_TEXT);
  fs.writeText(TEMPLATE_CLAUDE, '# runtime\n');
  fs.writeText(TEMPLATE_SKILL, 'skill\n');
  fs.writeText(TEMPLATE_KEEP, '');
  fs.writeText(TEMPLATE_INPUT, 'welcome\n');
  return fs;
}

function fakeEnv(vars: Record<string, string>): Environment {
  return { get: (name) => vars[name], appRoot: () => APP_ROOT };
}

function config(workspace: unknown, configVersion: unknown = 1) {
  return JSON.stringify({ configVersion, workspace });
}

function fakeOpener() {
  const opened: string[] = [];
  const openStore = (dbPath: string, options: OpenStoreOptions) => {
    // init is the only command that creates the catalog file.
    expect(options).toEqual({ create: true });
    opened.push(dbPath);
    return { close: () => {} };
  };
  return { opened, openStore };
}

function codeOf(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof WhenkitError) return error.code;
    throw error;
  }
  throw new Error('expected a WhenkitError');
}

describe('desktopDataDir', () => {
  const fs = new FakeFileSystem();

  it('is desktop next to config.json when packaged', () => {
    expect(desktopDataDir(fakeEnv({ APPDATA: 'C:\\A' }), fs, true)).toBe(
      'C:\\A\\whenkit\\desktop',
    );
  });

  it('is desktop-dev when not packaged', () => {
    expect(desktopDataDir(fakeEnv({ APPDATA: 'C:\\A' }), fs, false)).toBe(
      'C:\\A\\whenkit\\desktop-dev',
    );
  });

  it('is undefined without APPDATA', () => {
    expect(desktopDataDir(fakeEnv({}), fs, true)).toBeUndefined();
    expect(
      desktopDataDir(fakeEnv({ APPDATA: ' ' }), fs, false),
    ).toBeUndefined();
  });
});

describe('resolveWorkspace', () => {
  it('prefers WHENKIT_WORKSPACE over config.json', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:\\other'));
    const env = fakeEnv({ WHENKIT_WORKSPACE: 'D:\\dev', APPDATA });
    expect(resolveWorkspace(env, fs)).toBe('D:\\dev');
  });

  it('reads the workspace from config.json', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:\\ws'));
    expect(resolveWorkspace(fakeEnv({ APPDATA }), fs)).toBe('D:\\ws');
  });

  it('ignores an empty WHENKIT_WORKSPACE', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:\\ws'));
    const env = fakeEnv({ WHENKIT_WORKSPACE: ' ', APPDATA });
    expect(resolveWorkspace(env, fs)).toBe('D:\\ws');
  });

  it('fails with WORKSPACE_NOT_CONFIGURED without env var or config', () => {
    const fs = new FakeFileSystem();
    expect(codeOf(() => resolveWorkspace(fakeEnv({ APPDATA }), fs))).toBe(
      'WORKSPACE_NOT_CONFIGURED',
    );
    expect(codeOf(() => resolveWorkspace(fakeEnv({}), fs))).toBe(
      'WORKSPACE_NOT_CONFIGURED',
    );
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['a wrong version', config('D:\\ws', 2)],
    ['a missing workspace', config(undefined)],
    ['a relative workspace', config('ws')],
    ['a drive-less workspace', config('\\Users\\Luca\\Proiecte\\whenkit\\ws')],
    ['a slash-rooted workspace', config('/Users/Luca/ws')],
    ['a device-path workspace', config('\\\\?\\C:\\Proiecte\\whenkit\\ws')],
    ['a non-object', '"D:\\\\ws"'],
    ['null', 'null'],
  ])('fails with CONFIG_INVALID for %s', (_label, text) => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, text);
    expect(codeOf(() => resolveWorkspace(fakeEnv({ APPDATA }), fs))).toBe(
      'CONFIG_INVALID',
    );
  });

  it('fails with CONFIG_INVALID when config.json is unreadable', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:\\ws'));
    fs.unreadable.add(CONFIG);
    expect(codeOf(() => resolveWorkspace(fakeEnv({ APPDATA }), fs))).toBe(
      'CONFIG_INVALID',
    );
  });

  it.each([
    'ws',
    '\\Users\\Luca\\Proiecte\\whenkit\\ws',
    '/ws',
    '\\\\.\\C:\\ws',
  ])('fails with CONFIG_INVALID for WHENKIT_WORKSPACE %s', (value) => {
    const fs = new FakeFileSystem();
    const env = fakeEnv({ WHENKIT_WORKSPACE: value });
    expect(codeOf(() => resolveWorkspace(env, fs))).toBe('CONFIG_INVALID');
  });

  it.each([
    ['C:/ws', 'C:\\ws'],
    ['D:\\ws', 'D:\\ws'],
    ['\\\\server\\share\\ws', '\\\\server\\share\\ws'],
    ['//server/share', '\\\\server\\share'],
  ])('accepts the absolute WHENKIT_WORKSPACE %s as %s', (value, expected) => {
    const fs = new FakeFileSystem();
    const env = fakeEnv({ WHENKIT_WORKSPACE: value });
    expect(resolveWorkspace(env, fs)).toBe(expected);
  });

  it('reads a config.json saved with a UTF-8 byte-order mark', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, `\uFEFF${config('D:\\ws')}`);
    expect(resolveWorkspace(fakeEnv({ APPDATA }), fs)).toBe('D:\\ws');
  });

  it('normalizes the workspace read from config.json', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:/a/./b/../ws/'));
    expect(resolveWorkspace(fakeEnv({ APPDATA }), fs)).toBe('D:\\a\\ws');
  });
});

describe('normalizeWorkspacePath', () => {
  it.each([
    ['C:\\Proiecte\\whenkit\\ws', 'C:\\Proiecte\\whenkit\\ws'],
    ['C:/Proiecte//whenkit/./ws/', 'C:\\Proiecte\\whenkit\\ws'],
    // `..` is clamped at the root, as Win32 does; it never pops the drive.
    ['C:\\..\\Proiecte\\whenkit\\ws', 'C:\\Proiecte\\whenkit\\ws'],
    ['C:\\..\\..', 'C:\\'],
    ['\\\\srv\\share\\..\\..\\ws', '\\\\srv\\share\\ws'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeWorkspacePath(input)).toBe(expected);
  });

  it.each([
    'C:\\Proiecte\\whenkit.\\ws',
    'C:\\Proiecte\\whenkit \\ws',
    'C:\\Proiecte\\whenkit\\ws.',
    'C:\\Proiecte\\whenkit\\...',
    '\\\\srv\\share.\\ws',
    '\\\\server',
    '\\\\?\\C:\\ws',
    'C:ws',
  ])('refuses %s with CONFIG_INVALID', (input) => {
    expect(codeOf(() => normalizeWorkspacePath(input))).toBe('CONFIG_INVALID');
  });
});

describe('isSameOrInside', () => {
  it.each([
    ['C:\\Proiecte\\whenkit', true],
    ['c:/proiecte/WHENKIT/', true],
    ['C:\\Proiecte\\whenkit\\data\\ws', true],
    ['C:\\Proiecte\\other\\..\\whenkit\\ws', true],
    ['C:\\Proiecte\\whenkit-dev', false],
    ['C:\\Proiecte', false],
    ['D:\\Proiecte\\whenkit', false],
  ])('%s → %s', (path, expected) => {
    expect(isSameOrInside(path, APP_ROOT)).toBe(expected);
    expect(isSameOrInside(path, `${APP_ROOT}\\`)).toBe(expected);
  });
});

describe('initWorkspace', () => {
  it('creates the folders and the catalog, then writes config.json', () => {
    const fs = withTemplate();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(initWorkspace({ path: 'D:\\ws' }, { env, fs, openStore })).toBe(
      'D:\\ws',
    );
    for (const dir of ['input', 'batches', 'data', 'data\\backups']) {
      expect(fs.dirs.has(`D:\\ws\\${dir}`)).toBe(true);
    }
    expect(opened).toEqual(['D:\\ws\\data\\catalog.sqlite']);
    expect(JSON.parse(fs.readText(CONFIG))).toEqual({
      configVersion: 1,
      workspace: 'D:\\ws',
    });
  });

  it('uses the resolved workspace when no path is given', () => {
    const fs = withTemplate();
    fs.writeText(CONFIG, config('D:\\ws'));
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(initWorkspace({}, { env, fs, openStore })).toBe('D:\\ws');
    expect(opened).toEqual(['D:\\ws\\data\\catalog.sqlite']);
  });

  it('does not write config.json when WHENKIT_WORKSPACE is set', () => {
    const fs = withTemplate();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA, WHENKIT_WORKSPACE: 'D:\\dev' });
    expect(initWorkspace({}, { env, fs, openStore })).toBe('D:\\dev');
    expect(opened).toEqual(['D:\\dev\\data\\catalog.sqlite']);
    expect([...fs.files.keys()].sort()).toEqual(
      [
        ...TEMPLATE_FILES,
        'D:\\dev\\CLAUDE.md',
        'D:\\dev\\.claude\\skills\\importa\\SKILL.md',
        'D:\\dev\\input\\welcome.txt',
        'D:\\dev\\data\\blocked-domains.txt',
        'D:\\dev\\batch.schema.json',
        'D:\\dev\\.whenkit-template.json',
      ].sort(),
    );
  });

  it('creates data/blocked-domains.txt from the template when missing', () => {
    const fs = withTemplate();
    const { openStore } = fakeOpener();
    initWorkspace(
      { path: 'D:\\ws' },
      { env: fakeEnv({ APPDATA }), fs, openStore },
    );
    expect(fs.readText('D:\\ws\\data\\blocked-domains.txt')).toBe(
      TEMPLATE_TEXT,
    );
  });

  it('creates nothing when the blocked-domains template is missing', () => {
    const fs = new FakeFileSystem();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(
      codeOf(() => initWorkspace({ path: 'D:\\ws' }, { env, fs, openStore })),
    ).toBe('INTERNAL');
    expect(fs.dirs.size + fs.files.size + opened.length).toBe(0);
  });

  it('never overwrites an existing blocked-domains.txt', () => {
    const fs = withTemplate();
    fs.writeText('D:\\ws\\data\\blocked-domains.txt', 'mine.com\n');
    const { openStore } = fakeOpener();
    initWorkspace(
      { path: 'D:\\ws' },
      { env: fakeEnv({ APPDATA }), fs, openStore },
    );
    expect(fs.readText('D:\\ws\\data\\blocked-domains.txt')).toBe('mine.com\n');
  });

  it('uses the normalized path for folders, catalog and config.json', () => {
    const fs = withTemplate();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(initWorkspace({ path: 'D:/x/../ws/' }, { env, fs, openStore })).toBe(
      'D:\\ws',
    );
    expect(fs.dirs.has('D:\\ws\\data\\backups')).toBe(true);
    expect(opened).toEqual(['D:\\ws\\data\\catalog.sqlite']);
    expect(JSON.parse(fs.readText(CONFIG)).workspace).toBe('D:\\ws');
  });

  it.each(['\\\\?\\D:\\ws', '\\\\server', 'ws', 'D:\\ws.\\x'])(
    'refuses the explicit path %s with CONFIG_INVALID and creates nothing',
    (path) => {
      const fs = new FakeFileSystem();
      const { opened, openStore } = fakeOpener();
      const env = fakeEnv({ APPDATA });
      expect(
        codeOf(() => initWorkspace({ path }, { env, fs, openStore })),
      ).toBe('CONFIG_INVALID');
      expect(fs.dirs.size + fs.files.size + opened.length).toBe(0);
    },
  );

  it.each([
    'C:\\Proiecte\\whenkit',
    'c:/proiecte/whenkit/ws',
    'C:\\..\\Proiecte\\whenkit\\ws',
  ])('refuses %s inside the app root and creates nothing', (path) => {
    const fs = new FakeFileSystem();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(codeOf(() => initWorkspace({ path }, { env, fs, openStore }))).toBe(
      'WORKSPACE_INSIDE_REPO',
    );
    expect(fs.dirs.size + fs.files.size + opened.length).toBe(0);
  });

  it.each([
    ['C:\\..\\Proiecte\\whenkit\\ws', 'WORKSPACE_INSIDE_REPO'],
    ['C:\\Proiecte\\whenkit.\\ws', 'CONFIG_INVALID'],
    ['C:\\Proiecte\\whenkit \\ws', 'CONFIG_INVALID'],
  ])('refuses WHENKIT_WORKSPACE=%s with %s', (value, code) => {
    const fs = new FakeFileSystem();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA, WHENKIT_WORKSPACE: value });
    expect(codeOf(() => initWorkspace({}, { env, fs, openStore }))).toBe(code);
    expect(fs.dirs.size + fs.files.size + opened.length).toBe(0);
  });

  it('creates nothing when the workspace is not configured', () => {
    const fs = new FakeFileSystem();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(codeOf(() => initWorkspace({}, { env, fs, openStore }))).toBe(
      'WORKSPACE_NOT_CONFIGURED',
    );
    expect(fs.dirs.size + fs.files.size + opened.length).toBe(0);
  });

  it('creates nothing when config.json is malformed', () => {
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, '{');
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(codeOf(() => initWorkspace({}, { env, fs, openStore }))).toBe(
      'CONFIG_INVALID',
    );
    expect(fs.dirs.size + opened.length).toBe(0);
  });

  it('does not write config.json when the store refuses to open', () => {
    const fs = withTemplate();
    const env = fakeEnv({ APPDATA });
    const openStore = (): { close(): void } => {
      throw new WhenkitError('MIGRATION_MISMATCH');
    };
    expect(
      codeOf(() => initWorkspace({ path: 'D:\\ws' }, { env, fs, openStore })),
    ).toBe('MIGRATION_MISMATCH');
    expect([...fs.files.keys()].sort()).toEqual(TEMPLATE_FILES);
  });
});

describe('initWorkspace template copy', () => {
  const env = fakeEnv({ APPDATA });
  const run = (fs: FakeFileSystem) =>
    initWorkspace(
      { path: 'D:\\ws' },
      { env, fs, openStore: fakeOpener().openStore },
    );
  const SKILL = 'D:\\ws\\.claude\\skills\\importa\\SKILL.md';

  it('copies every template file, skips .gitkeep and writes schema and marker', () => {
    const fs = withTemplate();
    run(fs);
    expect(fs.readText('D:\\ws\\CLAUDE.md')).toBe('# runtime\n');
    expect(fs.readText(SKILL)).toBe('skill\n');
    expect(fs.readText('D:\\ws\\input\\welcome.txt')).toBe('welcome\n');
    expect(fs.exists('D:\\ws\\input\\.gitkeep')).toBe(false);
    expect(fs.readText('D:\\ws\\batch.schema.json')).toBe(
      batchJsonSchemaText(),
    );
    expect(JSON.parse(fs.readText('D:\\ws\\.whenkit-template.json'))).toEqual({
      templateVersion: TEMPLATE_VERSION,
      batchSchemaVersion: BATCH_SCHEMA_VERSION,
    });
  });

  it('overwrites template-managed files and keeps the user files', () => {
    const fs = withTemplate();
    fs.writeText('D:\\ws\\CLAUDE.md', 'edited');
    fs.writeText(SKILL, 'edited');
    fs.writeText('D:\\ws\\input\\welcome.txt', 'mine');
    fs.writeText('D:\\ws\\data\\blocked-domains.txt', 'mine');
    fs.writeText('D:\\ws\\data\\catalog.sqlite', 'db');
    fs.writeText('D:\\ws\\old-skill.md', 'left the template');
    fs.writeText('D:\\ws\\batch.schema.json', 'stale');
    run(fs);
    expect(fs.readText('D:\\ws\\CLAUDE.md')).toBe('# runtime\n');
    expect(fs.readText(SKILL)).toBe('skill\n');
    expect(fs.readText('D:\\ws\\batch.schema.json')).toBe(
      batchJsonSchemaText(),
    );
    expect(fs.readText('D:\\ws\\input\\welcome.txt')).toBe('mine');
    expect(fs.readText('D:\\ws\\data\\blocked-domains.txt')).toBe('mine');
    expect(fs.readText('D:\\ws\\data\\catalog.sqlite')).toBe('db');
    expect(fs.readText('D:\\ws\\old-skill.md')).toBe('left the template');
  });

  it('creates nothing when one template file is unreadable', () => {
    const fs = withTemplate();
    fs.unreadable.add(TEMPLATE_CLAUDE);
    const { opened, openStore } = fakeOpener();
    expect(
      codeOf(() => initWorkspace({ path: 'D:\\ws' }, { env, fs, openStore })),
    ).toBe('INTERNAL');
    expect(fs.dirs.size + opened.length).toBe(0);
    expect([...fs.files.keys()].sort()).toEqual(TEMPLATE_FILES);
  });
});

describe('templateOutdated', () => {
  const MARKER = 'D:\\ws\\.whenkit-template.json';
  const current = {
    templateVersion: TEMPLATE_VERSION,
    batchSchemaVersion: BATCH_SCHEMA_VERSION,
  };
  const marker = (value: unknown) => {
    const fs = new FakeFileSystem();
    fs.writeText(MARKER, JSON.stringify(value));
    return fs;
  };

  it('is false for the current versions', () => {
    expect(templateOutdated('D:\\ws', marker(current))).toBe(false);
  });

  it('is false for a newer template version', () => {
    const newer = { ...current, templateVersion: TEMPLATE_VERSION + 1 };
    expect(templateOutdated('D:\\ws', marker(newer))).toBe(false);
  });

  it.each([
    ['version 0', { ...current, templateVersion: 0 }],
    [
      'another batch schema version',
      { ...current, batchSchemaVersion: BATCH_SCHEMA_VERSION + 1 },
    ],
    ['a missing batch schema version', { templateVersion: TEMPLATE_VERSION }],
    ['a non-numeric version', { ...current, templateVersion: 'x' }],
    ['null', null],
  ])('is true for %s', (_label, value) => {
    expect(templateOutdated('D:\\ws', marker(value))).toBe(true);
  });

  it('is true for a missing, unparseable or unreadable marker', () => {
    expect(templateOutdated('D:\\ws', new FakeFileSystem())).toBe(true);
    const bad = new FakeFileSystem();
    bad.writeText(MARKER, '{');
    expect(templateOutdated('D:\\ws', bad)).toBe(true);
    const locked = marker(current);
    locked.unreadable.add(MARKER);
    expect(templateOutdated('D:\\ws', locked)).toBe(true);
  });
});

describe('readBlockedDomains', () => {
  const LIST = 'D:\\ws\\data\\blocked-domains.txt';
  const env = fakeEnv({});

  it('parses the workspace list', () => {
    const fs = withTemplate();
    fs.writeText(LIST, '# mine\nWWW.Exemplu.com\n\nsci-hub.*  # comment\n');
    expect(readBlockedDomains('D:\\ws', { env, fs })).toEqual([
      'exemplu.com',
      'sci-hub.*',
    ]);
  });

  it('recreates a missing list from the template, then uses it', () => {
    const fs = withTemplate();
    expect(readBlockedDomains('D:\\ws', { env, fs })).toEqual([
      'libgen.*',
      'pdfdrive.com',
    ]);
    expect(fs.readText(LIST)).toBe(TEMPLATE_TEXT);
  });

  it('fails with INTERNAL when the template is missing too', () => {
    const fs = new FakeFileSystem();
    expect(codeOf(() => readBlockedDomains('D:\\ws', { env, fs }))).toBe(
      'INTERNAL',
    );
    expect(fs.files.size).toBe(0);
  });
});
