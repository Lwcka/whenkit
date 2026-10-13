import { WhenkitError } from './errors';
import type { Environment, FileSystem, OpenStoreOptions } from './ports';
import { parseBlockedDomains } from './verification/blocked-domains';
import { CONFIG_VERSION } from './versions';

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
    env.appRoot(),
    'workspace-template',
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
 * Minimal `whenkit init` (ticket 10 adds the template): creates the folders,
 * the migrated catalog and, when missing, `data/blocked-domains.txt` from
 * the template, then records the path in config.json unless
 * WHENKIT_WORKSPACE is set (a development run never moves the real
 * configuration). Re-running on an existing workspace changes nothing.
 * Returns the workspace path.
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
  const blockedDomainsText = missingBlockedDomainsText(workspace, { env, fs });

  for (const folder of WORKSPACE_FOLDERS) {
    fs.mkdir(fs.joinPath(workspace, ...folder));
  }
  // The only place that may create the catalog file.
  openStore(catalogPath(fs, workspace), { create: true }).close();
  // The user's file: created when missing, never overwritten (AD-17).
  writeBlockedDomains(workspace, fs, blockedDomainsText);

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
