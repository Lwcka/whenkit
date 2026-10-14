import { rejectionsOutputSchema } from '../../core/cli-schemas';
import { toRejectionDto } from '../../core/dto';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
} from '../command';
import { renderRejections } from '../render';

/** `whenkit rejections [--json]`: the rejection journal, oldest first. Never writes. */
export function runRejections(
  args: readonly string[],
  ctx: CommandContext,
): number {
  parseArgs('rejections', args, { required: [], json: true });
  const { deps } = ctx;
  const workspace = resolveWorkspace(deps.env, deps.fs);
  ctx.workspace = workspace;

  const store = deps.openStore(catalogPath(deps.fs, workspace), {
    readOnly: true,
  });
  let rejections;
  try {
    rejections = store.rejections().map(toRejectionDto);
  } finally {
    store.close();
  }

  if (ctx.json) {
    printJson(ctx.io, rejectionsOutputSchema, {
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace,
      rejections,
    });
  } else {
    printLines(ctx.io, renderRejections(rejections));
  }
  return EXIT_OK;
}
