import { describe, expect, it } from 'vitest';
import { WhenkitError } from './errors';
import type { Environment, FileSystem, OpenStoreOptions } from './ports';
import {
  initWorkspace,
  isSameOrInside,
  normalizeWorkspacePath,
  resolveWorkspace,
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
  joinPath(...parts: string[]) {
    return parts.join('\\');
  }
}

const APP_ROOT = 'C:\\Proiecte\\whenkit';
const APPDATA = 'C:\\AppData';
const CONFIG = 'C:\\AppData\\whenkit\\config.json';

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
    const fs = new FakeFileSystem();
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
    const fs = new FakeFileSystem();
    fs.writeText(CONFIG, config('D:\\ws'));
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA });
    expect(initWorkspace({}, { env, fs, openStore })).toBe('D:\\ws');
    expect(opened).toEqual(['D:\\ws\\data\\catalog.sqlite']);
  });

  it('does not write config.json when WHENKIT_WORKSPACE is set', () => {
    const fs = new FakeFileSystem();
    const { opened, openStore } = fakeOpener();
    const env = fakeEnv({ APPDATA, WHENKIT_WORKSPACE: 'D:\\dev' });
    expect(initWorkspace({}, { env, fs, openStore })).toBe('D:\\dev');
    expect(opened).toEqual(['D:\\dev\\data\\catalog.sqlite']);
    expect(fs.files.size).toBe(0);
  });

  it('uses the normalized path for folders, catalog and config.json', () => {
    const fs = new FakeFileSystem();
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
    const fs = new FakeFileSystem();
    const env = fakeEnv({ APPDATA });
    const openStore = (): { close(): void } => {
      throw new WhenkitError('MIGRATION_MISMATCH');
    };
    expect(
      codeOf(() => initWorkspace({ path: 'D:\\ws' }, { env, fs, openStore })),
    ).toBe('MIGRATION_MISMATCH');
    expect(fs.files.size).toBe(0);
  });
});
