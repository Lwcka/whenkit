import { version } from '../../package.json';
import { errorOutputSchema } from '../core/cli-schemas';
import { isWhenkitError, type ErrorCode } from '../core/errors';
import { CLI_OUTPUT_VERSION } from '../core/versions';
import { cliStrings, errorMessages } from '../shared/strings.ro';
import {
  UsageError,
  printJson,
  type CliDeps,
  type CliIo,
  type CommandContext,
} from './command';
import { runImport } from './commands/import';
import { runInit } from './commands/init';
import { runList } from './commands/list';
import { runSchema } from './commands/schema';
import { runShow } from './commands/show';
import {
  EXIT_INTERNAL,
  EXIT_INVALID_INPUT,
  EXIT_OK,
  exitCodeFor,
} from './exit-codes';
import { formatIssuePath } from './render';

export type { CliDeps, CliIo } from './command';

interface Command {
  run: (
    args: readonly string[],
    ctx: CommandContext,
  ) => number | Promise<number>;
  /** Whether the command speaks the `--json` contract (AD-11). */
  json: boolean;
}

const COMMANDS: Record<string, Command> = {
  init: { run: runInit, json: false },
  import: { run: runImport, json: true },
  list: { run: runList, json: true },
  show: { run: runShow, json: true },
  schema: { run: runSchema, json: false },
};

/** Prints an error: one JSON document on stdout with `--json`, else stderr text. */
function reportError(ctx: CommandContext, error: unknown): number {
  if (error instanceof UsageError) {
    if (ctx.json) {
      printErrorDocument(ctx, 'ARGUMENTS_INVALID', error.text);
    } else {
      ctx.io.stderr(`${error.text}\n`);
    }
    return EXIT_INVALID_INPUT;
  }

  const code: ErrorCode = isWhenkitError(error) ? error.code : 'INTERNAL';
  const issues = isWhenkitError(error) ? error.issues : undefined;
  if (ctx.json) {
    printErrorDocument(ctx, code, errorMessages[code], issues);
  } else {
    const lines = [`${cliStrings.errorPrefix}: ${errorMessages[code]}`];
    for (const issue of issues ?? []) {
      lines.push(
        cliStrings.issueLine(formatIssuePath(issue.path), issue.message),
      );
    }
    ctx.io.stderr(`${lines.join('\n')}\n`);
  }
  return exitCodeFor[code];
}

function printErrorDocument(
  ctx: CommandContext,
  code: ErrorCode,
  message: string,
  issues?: readonly { path: (string | number)[]; message: string }[],
): void {
  printJson(ctx.io, errorOutputSchema, {
    schemaVersion: CLI_OUTPUT_VERSION,
    workspace: ctx.workspace,
    error: {
      code,
      message,
      ...(issues === undefined ? {} : { issues: [...issues] }),
    },
  });
}

/**
 * Handles the `whenkit` arguments and returns the process exit code.
 * Errors are printed as Romanian text on stderr, or as one JSON document on
 * stdout with `--json`; never as a stack trace.
 */
export async function main(
  args: readonly string[],
  io: CliIo,
  deps: CliDeps,
): Promise<number> {
  const [name, ...rest] = args;

  if (name === undefined || name === '--help' || name === '-h') {
    io.stdout(`${cliStrings.usage}\n`);
    return EXIT_OK;
  }

  if (name === '--version' || name === '-v') {
    io.stdout(`${version}\n`);
    return EXIT_OK;
  }

  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (command === undefined) {
    // `whenkit lst --json` or `whenkit --json list`: the caller asked for
    // JSON, so it gets the one error document (AD-11).
    return reportError(
      { io, deps, json: args.includes('--json'), workspace: null },
      new UsageError(cliStrings.unknownCommand(name)),
    );
  }

  const ctx: CommandContext = {
    io,
    deps,
    json: command.json && rest.includes('--json'),
    workspace: null,
  };
  try {
    // Awaited here, so an async command's failure is reported like a sync one.
    return await command.run(rest, ctx);
  } catch (error) {
    try {
      return reportError(ctx, error);
    } catch {
      // The error document itself failed its schema: a bug, never silent.
      io.stderr(`${cliStrings.errorPrefix}: ${errorMessages.INTERNAL}\n`);
      return EXIT_INTERNAL;
    }
  }
}
