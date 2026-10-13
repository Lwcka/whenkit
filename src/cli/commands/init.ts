import path from 'node:path';
import { initWorkspace } from '../../core/workspace';
import { cliStrings } from '../../shared/strings.ro';
import { EXIT_OK } from '../exit-codes';
import { parseArgs, printLines, type CommandContext } from '../command';

/** `whenkit init [cale]` */
export function runInit(args: readonly string[], ctx: CommandContext): number {
  const [target] = parseArgs('init', args, {
    required: [],
    optional: 1,
    json: false,
  });
  const { deps } = ctx;
  const workspace = initWorkspace(
    { path: target === undefined ? undefined : path.resolve(deps.cwd, target) },
    { env: deps.env, fs: deps.fs, openStore: deps.openStore },
  );
  printLines(ctx.io, [cliStrings.initDone(workspace)]);
  return EXIT_OK;
}
