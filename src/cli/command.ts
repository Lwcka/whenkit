import type { z } from 'zod';
import type {
  CatalogStoreOpener,
  Clock,
  Environment,
  FileSystem,
  IdGenerator,
} from '../core/ports';
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
