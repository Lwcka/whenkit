import { batchJsonSchemaText } from './batch-json-schema';
import { WhenkitError } from './errors';
import type { Environment, FileSystem, OpenStoreOptions } from './ports';
import { parseBlockedDomains } from './verification/blocked-domains';
import {
  BATCH_SCHEMA_VERSION,
  CONFIG_VERSION,
  TEMPLATE_VERSION,
} from './versions';

// The single source of the workspace path (AD-8): WHENKIT_WORKSPACE, then
// %APPDATA%\whenkit\config.json, then WORKSPACE_NOT_CONFIGURED. There is no
// hidden default.

export const WORKSPACE_ENV_VAR = 'WHENKIT_WORKSPACE';
const APPDATA_ENV_VAR = 'APPDATA';

/** Folders every workspace has, relative to its root. */
const WORKSPACE_FOLDERS = [
  ['input'],
  ['batches'],
  ['data'],
  ['data', 'backups'],
] as const;

export interface WorkspaceConfig {
  configVersion: number;
  workspace: string;
}

export function catalogPath(fs: FileSystem, workspace: string): string {
  return fs.joinPath(workspace, 'data', 'catalog.sqlite');
}

const BLOCKED_DOMAINS_FILE = 'blocked-domains.txt';

export function blockedDomainsPath(fs: FileSystem, workspace: string): string {
  return fs.joinPath(workspace, 'data', BLOCKED_DOMAINS_FILE);
}

/** Marker of the template version a workspace was initialized with (AD-17). */
const TEMPLATE_MARKER_FILE = '.whenkit-template.json';
const BATCH_SCHEMA_FILE = 'batch.schema.json';

/** First path segments whose files belong to the user: never overwritten. */
const USER_OWNED_ROOTS: readonly string[] = ['data', 'input'];

interface TemplateFile {
  /** The path relative to the template root, one array item per folder or file name. */
  segments: string[];
  text: string;
  /** True for a user file the workspace already has: left alone. */
  skip: boolean;
}

function templateRoot(env: Environment, fs: FileSystem): string {
  return fs.joinPath(env.appRoot(), 'workspace-template');
}

function isUserOwned(segments: readonly string[]): boolean {
  return USER_OWNED_ROOTS.includes(segments[0]);
}

/**
 * Reads every file of `workspace-template/` (recursively, `.gitkeep` files
 * skipped) before anything is written, so a broken install fails with nothing
 * created (AD-11). A file under `data/` or `input/` is the user's: it is
 * planned only when the workspace lacks it. Everything else is template-
 * managed and always planned (AD-17). A missing, empty or unreadable template
 * is INTERNAL.
 */
function planTemplate(
  workspace: string,
  { env, fs }: { env: Environment; fs: FileSystem },
): TemplateFile[] {
  const root = templateRoot(env, fs);
  try {
    const relatives = fs
      .listFiles(root)
      .filter((relative) => relative.split('/').at(-1) !== '.gitkeep');
    if (relatives.length === 0) throw new Error('the template has no files');
    return relatives.map((relative) => {
      const segments = relative.split('/');
      const text = fs.readText(fs.joinPath(root, ...segments));
      const skip =
        isUserOwned(segments) && fs.exists(fs.joinPath(workspace, ...segments));
      return { segments, text, skip };
    });
  } catch (cause) {
    throw new WhenkitError('INTERNAL', {
      cause,
      detail: `cannot read the template ${root}`,
    });
  }
}

/**
 * Template files that shipped in an earlier TEMPLATE_VERSION and no longer do
 * (AD-17), relative to the workspace root with `/` separators. `init` deletes
 * them, even when the user edited them. Append-only: keep an entry for as long
 * as a workspace that still has the file may exist.
 */
const RETIRED_TEMPLATE_PATHS: readonly string[] = [
  // The skill was renamed to /adauga (template version 8).
  '.claude/skills/importa/SKILL.md',
  '.claude/skills/importa/exemplu-lot.json',
];

/**
 * Deletes the retired template files the workspace still has, then the folder
 * of each one that is left without any file (a file of the user's keeps its
 * folder). Missing files are not an error.
 */
function retireTemplateFiles(workspace: string, fs: FileSystem): void {
  const folders = new Set<string>();
  for (const retired of RETIRED_TEMPLATE_PATHS) {
    const segments = retired.split('/');
    fs.removeFile(fs.joinPath(workspace, ...segments));
    folders.add(segments.slice(0, -1).join('/'));
  }
  // Deepest first, so a nested folder empties before its parent is checked.
  const ordered = [...folders].sort(
    (a, b) => b.split('/').length - a.split('/').length,
  );
  for (const folder of ordered) {
    const dir = fs.joinPath(workspace, ...folder.split('/'));
    if (folder !== '' && isEmptyOfFiles(fs, dir)) fs.removeDir(dir);
  }
}

function isEmptyOfFiles(fs: FileSystem, dir: string): boolean {
  try {
    return fs.exists(dir) && fs.listFiles(dir).length === 0;
  } catch {
    return false;
  }
}

/** Writes the planned template files into the workspace. */
function writeTemplate(
  workspace: string,
  fs: FileSystem,
  plan: readonly TemplateFile[],
): void {
  for (const file of plan) {
    if (file.skip) continue;
    fs.mkdir(fs.joinPath(workspace, ...file.segments.slice(0, -1)));
    fs.writeText(fs.joinPath(workspace, ...file.segments), file.text);
  }
}

/**
 * True when the workspace's template marker is missing or unreadable, its
 * `templateVersion` is lower than the code's, or its `batchSchemaVersion`
 * differs (a changed batch schema makes `batch.schema.json` stale even when
 * `TEMPLATE_VERSION` was not bumped). Never throws (AD-17).
 */
export function templateOutdated(workspace: string, fs: FileSystem): boolean {
  try {
    const parsed: unknown = JSON.parse(
      fs
        .readText(fs.joinPath(workspace, TEMPLATE_MARKER_FILE))
        .replace(/^\uFEFF/, ''),
    );
    if (typeof parsed !== 'object' || parsed === null) return true;
    const { templateVersion, batchSchemaVersion } = parsed as Record<
      string,
      unknown
    >;
    return (
      typeof templateVersion !== 'number' ||
      templateVersion < TEMPLATE_VERSION ||
      batchSchemaVersion !== BATCH_SCHEMA_VERSION
    );
  } catch {
    return true;
  }
}

/**
 * The template text for `data/blocked-domains.txt` when the workspace lacks
 * the file, or undefined when it has it (the file is the user's and is never
 * overwritten, AD-17). Reads only, so callers can fail before creating
 * anything. A missing template is a broken install: INTERNAL.
 */
function missingBlockedDomainsText(
  workspace: string,
  { env, fs }: { env: Environment; fs: FileSystem },
): string | undefined {
  if (fs.exists(blockedDomainsPath(fs, workspace))) return undefined;
  const template = fs.joinPath(
    templateRoot(env, fs),
    'data',
    BLOCKED_DOMAINS_FILE,
  );
  try {
    return fs.readText(template);
  } catch (cause) {
    throw new WhenkitError('INTERNAL', {
      cause,
      detail: `cannot read the template ${template}`,
    });
  }
}

/** Writes the text missingBlockedDomainsText() returned, if any. */
function writeBlockedDomains(
  workspace: string,
  fs: FileSystem,
  text: string | undefined,
): void {
  if (text === undefined) return;
  fs.mkdir(fs.joinPath(workspace, 'data'));
  fs.writeText(blockedDomainsPath(fs, workspace), text);
}

/**
 * Creates `data/blocked-domains.txt` from the app's
 * `workspace-template/data/` when it is missing. Returns the file's path.
 */
function ensureBlockedDomains(
  workspace: string,
  ports: { env: Environment; fs: FileSystem },
): string {
  writeBlockedDomains(
    workspace,
    ports.fs,
    missingBlockedDomainsText(workspace, ports),
  );
  return blockedDomainsPath(ports.fs, workspace);
}

/**
 * The workspace's blocked-domain rules, parsed by parseBlockedDomains().
 * A missing file is first recreated from the template.
 */
export function readBlockedDomains(
  workspace: string,
  ports: { env: Environment; fs: FileSystem },
): string[] {
  return parseBlockedDomains(
    ports.fs.readText(ensureBlockedDomains(workspace, ports)),
  );
}

function envValue(env: Environment, name: string): string | undefined {
  const value = env.get(name);
  return value === undefined || value.trim() === '' ? undefined : value;
}

/** `%APPDATA%\whenkit`, or undefined when APPDATA is not set. */
function configDir(env: Environment, fs: FileSystem): string | undefined {
  const appData = envValue(env, APPDATA_ENV_VAR);
  return appData === undefined ? undefined : fs.joinPath(appData, 'whenkit');
}

/** `%APPDATA%\whenkit\config.json`, or undefined when APPDATA is not set. */
export function configPath(
  env: Environment,
  fs: FileSystem,
): string | undefined {
  const dir = configDir(env, fs);
  return dir === undefined ? undefined : fs.joinPath(dir, 'config.json');
}

/**
 * The Electron userData folder (AD-20): `desktop` next to `config.json` for
 * the installed app, `desktop-dev` for `npm start`, so the two never share a
 * profile or a single-instance lock. Undefined when APPDATA is not set.
 */
export function desktopDataDir(
  env: Environment,
  fs: FileSystem,
  packaged: boolean,
): string | undefined {
  const dir = configDir(env, fs);
  return dir === undefined
    ? undefined
    : fs.joinPath(dir, packaged ? 'desktop' : 'desktop-dev');
}

const DRIVE_ROOT = /^([a-zA-Z]):[\\/]/;
const UNC_ROOT = /^[\\/]{2}(?![?.][\\/])([^\\/]+)[\\/]([^\\/]+)(?=[\\/]|$)/;

/**
 * The one normalizer for a workspace path, wherever it comes from. Accepts
 * only a drive path (`C:\…`, `C:/…`) or a UNC path (`\\server\share…`);
 * drive-less `\Users\…` and device paths (`\\?\…`, `\\.\…`) are refused.
 * Returns it with `\` separators, `.` segments dropped and `..` clamped at
 * the root, as Win32 does. A segment ending in `.` or a space is refused:
 * Win32 strips those characters, so the folder would not be the one
 * compared against the app root. Throws CONFIG_INVALID.
 */
export function normalizeWorkspacePath(path: string): string {
  const drive = DRIVE_ROOT.exec(path);
  const unc = drive ? null : UNC_ROOT.exec(path);
  const match = drive ?? unc;
  if (match === null) {
    throw new WhenkitError('CONFIG_INVALID', {
      detail: `not absolute: ${path}`,
    });
  }
  const segments: string[] = unc ? [unc[1], unc[2]] : [];
  const fixed = segments.length;
  for (const segment of path.slice(match[0].length).split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > fixed) segments.pop();
    } else {
      segments.push(segment);
    }
  }
  if (segments.some((segment) => /[. ]$/.test(segment))) {
    throw new WhenkitError('CONFIG_INVALID', {
      detail: `segment ending in a dot or space: ${path}`,
    });
  }
  return drive
    ? `${drive[1]}:\\${segments.join('\\')}`
    : `\\\\${segments.join('\\')}`;
}

function readConfig(fs: FileSystem, path: string): WorkspaceConfig {
  let parsed: unknown;
  try {
    // Windows PowerShell 5.1 writes UTF-8 with a byte-order mark.
    parsed = JSON.parse(fs.readText(path).replace(/^\uFEFF/, ''));
  } catch (cause) {
    throw new WhenkitError('CONFIG_INVALID', { cause, detail: path });
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as WorkspaceConfig).configVersion !== CONFIG_VERSION ||
    typeof (parsed as WorkspaceConfig).workspace !== 'string'
  ) {
    throw new WhenkitError('CONFIG_INVALID', { detail: path });
  }
  return parsed as WorkspaceConfig;
}

/**
 * Resolves the workspace path, normalized by normalizeWorkspacePath; throws
 * a WhenkitError when it cannot.
 */
export function resolveWorkspace(env: Environment, fs: FileSystem): string {
  const fromEnv = envValue(env, WORKSPACE_ENV_VAR);
  if (fromEnv !== undefined) return normalizeWorkspacePath(fromEnv);
  const path = configPath(env, fs);
  if (path === undefined || !fs.exists(path)) {
    throw new WhenkitError('WORKSPACE_NOT_CONFIGURED');
  }
  return normalizeWorkspacePath(readConfig(fs, path).workspace);
}

/**
 * Path segments for comparison: `/` and `\` are equivalent, case is ignored,
 * empty and `.` segments vanish and `..` climbs one level.
 */
function pathSegments(path: string): string[] {
  const segments: string[] = [];
  for (const segment of path.toLowerCase().split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments;
}

/** True when `path` equals `root` or lies inside it. */
export function isSameOrInside(path: string, root: string): boolean {
  const target = pathSegments(path);
  const base = pathSegments(root);
  return (
    target.length >= base.length &&
    base.every((segment, index) => target[index] === segment)
  );
}

export interface InitWorkspacePorts {
  env: Environment;
  fs: FileSystem;
  /** A CatalogStoreOpener; init only creates the catalog and closes it. */
  openStore: (dbPath: string, options: OpenStoreOptions) => { close(): void };
}

/**
 * `whenkit init` (AD-17): creates the folders and the migrated catalog,
 * copies `workspace-template/` (template-managed files are overwritten, the
 * user's files under `data/` and `input/` are created only when missing),
 * deletes the retired template files (RETIRED_TEMPLATE_PATHS, plus their
 * folder when it is left without files), writes `batch.schema.json` and,
 * last, `.whenkit-template.json`, then records the path in config.json unless
 * WHENKIT_WORKSPACE is set (a development run never moves the real
 * configuration). Re-running keeps the catalog and the user's files. Returns
 * the workspace path.
 */
export function initWorkspace(
  options: { path?: string },
  { env, fs, openStore }: InitWorkspacePorts,
): string {
  // Every later use (repo check, folders, catalog, config.json, the returned
  // value) sees the normalized path only.
  const workspace =
    options.path === undefined
      ? resolveWorkspace(env, fs)
      : normalizeWorkspacePath(options.path);
  if (isSameOrInside(workspace, env.appRoot())) {
    throw new WhenkitError('WORKSPACE_INSIDE_REPO', { detail: workspace });
  }

  const writeConfig = envValue(env, WORKSPACE_ENV_VAR) === undefined;
  const dir = writeConfig ? configDir(env, fs) : undefined;
  if (writeConfig && dir === undefined) {
    throw new WhenkitError('WORKSPACE_NOT_CONFIGURED', {
      detail: 'APPDATA is not set',
    });
  }

  // Read before anything is created: a missing template fails with nothing
  // written (AD-11).
  const plan = planTemplate(workspace, { env, fs });

  for (const folder of WORKSPACE_FOLDERS) {
    fs.mkdir(fs.joinPath(workspace, ...folder));
  }
  // The only place that may create the catalog file.
  openStore(catalogPath(fs, workspace), { create: true }).close();
  writeTemplate(workspace, fs, plan);
  retireTemplateFiles(workspace, fs);
  fs.writeText(
    fs.joinPath(workspace, BATCH_SCHEMA_FILE),
    batchJsonSchemaText(),
  );
  // Last: an interrupted init leaves the old marker, so commands still warn.
  const marker = {
    templateVersion: TEMPLATE_VERSION,
    batchSchemaVersion: BATCH_SCHEMA_VERSION,
  };
  fs.writeText(
    fs.joinPath(workspace, TEMPLATE_MARKER_FILE),
    `${JSON.stringify(marker, null, 2)}\n`,
  );

  if (dir !== undefined) {
    const content: WorkspaceConfig = {
      configVersion: CONFIG_VERSION,
      workspace,
    };
    fs.mkdir(dir);
    fs.writeText(
      fs.joinPath(dir, 'config.json'),
      `${JSON.stringify(content, null, 2)}\n`,
    );
  }
  return workspace;
}
