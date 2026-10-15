import { rejectionsOutputSchema } from '../../core/cli-schemas';
import { toRejectionDto } from '../../core/dto';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
  resolveCommandWorkspace,
  withReadStore,
} from '../command';
import { renderRejections } from '../render';

/** `whenkit rejections [--json]`: the rejection journal, oldest first. Never writes. */
export function runRejections(
  args: readonly string[],
  ctx: CommandContext,
): number {
  parseArgs('rejections', args, { required: [], json: true });
  const workspace = resolveCommandWorkspace(ctx);

  const rejections = withReadStore(ctx, workspace, (store) =>
    store.rejections().map(toRejectionDto),
  );

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
