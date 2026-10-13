import path from 'node:path';
import { version } from '../../package.json';
import { isWhenkitError } from '../core/errors';
import type {
  CatalogStoreOpener,
  Clock,
  Environment,
  FileSystem,
  IdGenerator,
} from '../core/ports';
import { initWorkspace } from '../core/workspace';
import { cliStrings, errorMessages } from '../shared/strings.ro';
import { EXIT_INVALID_INPUT, EXIT_OK, exitCodeFor } from './exit-codes';

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

function runInit(args: readonly string[], io: CliIo, deps: CliDeps): number {
  const option = args.find((arg) => arg.startsWith('-'));
  if (option !== undefined) {
    io.stderr(`${cliStrings.unknownOption('init', option)}\n`);
    return EXIT_INVALID_INPUT;
  }
  if (args.length > 1) {
    io.stderr(`${cliStrings.tooManyArguments('init')}\n`);
    return EXIT_INVALID_INPUT;
  }
  const [target] = args;
  const workspace = initWorkspace(
    { path: target === undefined ? undefined : path.resolve(deps.cwd, target) },
    { env: deps.env, fs: deps.fs, openStore: deps.openStore },
  );
  io.stdout(`${cliStrings.initDone(workspace)}\n`);
  return EXIT_OK;
}

/**
 * Handles the `whenkit` arguments and returns the process exit code.
 * Errors are printed as Romanian text on stderr, never as a stack trace.
 */
export async function main(
  args: readonly string[],
  io: CliIo,
  deps: CliDeps,
): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '--help' || command === '-h') {
    io.stdout(`${cliStrings.usage}\n`);
    return EXIT_OK;
  }

  if (command === '--version' || command === '-v') {
    io.stdout(`${version}\n`);
    return EXIT_OK;
  }

  try {
    if (command === 'init') return runInit(rest, io, deps);
  } catch (error) {
    const code = isWhenkitError(error) ? error.code : 'INTERNAL';
    io.stderr(`${cliStrings.errorPrefix}: ${errorMessages[code]}\n`);
    return exitCodeFor[code];
  }

  io.stderr(`${cliStrings.unknownCommand(command)}\n`);
  return EXIT_INVALID_INPUT;
}
