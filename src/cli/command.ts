import type { z } from 'zod';
import type {
  CatalogStore,
  CatalogStoreOpener,
  Clock,
  Environment,
  FileSystem,
  GitHubClient,
  HttpClient,
  IdGenerator,
} from '../core/ports';
import {
  catalogPath,
  resolveWorkspace,
  templateOutdated,
} from '../core/workspace';
import { cliStrings } from '../shared/strings.ro';

// What every command handler shares: the injected ports, the output streams
// and the argument conventions.

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

/** Ports and process facts the CLI runs on; bin.ts injects the real ones. */
export interface CliDeps {
  env: Environment;
  fs: FileSystem;
  clock: Clock;
  ids: IdGenerator;
  /** Opens the catalog database (SqliteCatalogStore in bin.ts). */
  openStore: CatalogStoreOpener;
  /** Checks links during the import's verification (node-http-client in bin.ts). */
  http: HttpClient;
  /** Reads GitHub repo metadata during the verification (node-github-client in bin.ts). */
  github: GitHubClient;
  /** Pause before a link check is retried; 1 s when unset. Tests pass 0. */
  retryDelayMs?: number;
  /** Directory relative paths are resolved against. */
  cwd: string;
}

export interface CommandContext {
  io: CliIo;
  deps: CliDeps;
  /** True when `--json` was given: stdout holds exactly one JSON document. */
  json: boolean;
  /** Set once the command has resolved it; echoed in JSON error documents. */
  workspace: string | null;
}

/** A malformed command line; reported before any port is touched. */
export class UsageError extends Error {
  constructor(readonly text: string) {
    super(text);
    this.name = 'UsageError';
  }
}

export interface ArgSpec {
  /** Names of the required positional arguments, in order. */
  required: readonly string[];
  /** How many optional positionals may follow the required ones. */
  optional?: number;
  /** Whether the command accepts `--json`. */
  json: boolean;
}

/**
 * Returns a command's positional arguments, skipping `--json` when the
 * command accepts it. Any other option, a missing or an extra positional
 * throws a UsageError.
 */
export function parseArgs(
  command: string,
  args: readonly string[],
  spec: ArgSpec,
): string[] {
  const positionals: string[] = [];
  for (const arg of args) {
    if (spec.json && arg === '--json') continue;
    if (arg.startsWith('-')) {
      throw new UsageError(cliStrings.unknownOption(command, arg));
    }
    positionals.push(arg);
  }
  if (positionals.length > spec.required.length + (spec.optional ?? 0)) {
    throw new UsageError(cliStrings.tooManyArguments(command));
  }
  const missing = spec.required[positionals.length];
  if (missing !== undefined) {
    throw new UsageError(cliStrings.missingArgument(command, missing));
  }
  return positionals;
}

/**
 * Pulls the repeatable `--force <ref>` pairs out of `args`; the rest goes to
 * parseArgs. A `--force` without a value (nothing after it, or another
 * option) is a UsageError.
 */
export function extractForce(
  command: string,
  args: readonly string[],
): { force: string[]; rest: string[] } {
  const force: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== '--force') {
      rest.push(arg);
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(cliStrings.missingOptionValue(command, arg, 'ref'));
    }
    force.push(value);
    i += 1;
  }
  return { force, rest };
}

/**
 * Pulls a single `<option> <value>` pair out of `args`; the rest goes to
 * parseArgs. The option without a value (nothing after it, or another
 * option) is a UsageError, and so is a repeated option.
 */
export function extractValueOption(
  command: string,
  args: readonly string[],
  option: string,
  valueName: string,
): { value: string | undefined; rest: string[] } {
  let value: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== option) {
      rest.push(arg);
      continue;
    }
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new UsageError(
        cliStrings.missingOptionValue(command, arg, valueName),
      );
    }
    if (value !== undefined) {
      throw new UsageError(cliStrings.tooManyArguments(command));
    }
    value = next;
    i += 1;
  }
  return { value, rest };
}

/** Validates `document` with its schema, then prints it as the one stdout JSON. */
export function printJson<T>(
  io: CliIo,
  schema: z.ZodType<T>,
  document: T,
): void {
  const valid = schema.parse(document);
  io.stdout(`${JSON.stringify(valid, null, 2)}\n`);
}

/** Prints lines of human text on stdout. */
export function printLines(io: CliIo, lines: readonly string[]): void {
  io.stdout(`${lines.join('\n')}\n`);
}

/**
 * Resolves the workspace for a command, records it in `ctx.workspace` and,
 * when its template is outdated, warns on stderr (AD-17). The warning never
 * changes stdout or the exit code.
 */
export function resolveCommandWorkspace(ctx: CommandContext): string {
  const { deps } = ctx;
  const workspace = resolveWorkspace(deps.env, deps.fs);
  ctx.workspace = workspace;
  if (templateOutdated(workspace, deps.fs)) {
    ctx.io.stderr(`${cliStrings.templateOutdated}\n`);
  }
  return workspace;
}

/**
 * Opens the catalog read-only, runs `read` and always closes the store, so
 * the caller prints only after the database is released.
 */
export function withReadStore<T>(
  ctx: CommandContext,
  workspace: string,
  read: (store: CatalogStore) => T,
): T {
  const { deps } = ctx;
  const store = deps.openStore(catalogPath(deps.fs, workspace), {
    readOnly: true,
  });
  try {
    return read(store);
  } finally {
    store.close();
  }
}
