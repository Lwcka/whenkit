import {
  rejectionRemoveOutputSchema,
  rejectionsOutputSchema,
} from '../../core/cli-schemas';
import { toRejectionDto, type RejectionDto } from '../../core/dto';
import { removeRejection } from '../../core/remove-rejection';
import { catalogPath } from '../../core/workspace';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { EXIT_OK } from '../exit-codes';
import {
  extractValueOption,
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
  resolveCommandWorkspace,
  withReadStore,
} from '../command';
import { renderRejectionRemoved, renderRejections } from '../render';

/**
 * `whenkit rejections [--json]`: the rejection journal, oldest first; never
 * writes. `whenkit rejections --remove <id> [--json]`: deletes one journal
 * row by its id.
 */
export function runRejections(
  args: readonly string[],
  ctx: CommandContext,
): number {
  const { value: removeId, rest } = extractValueOption(
    'rejections',
    args,
    '--remove',
    'id',
  );
  parseArgs('rejections', rest, { required: [], json: true });
  const workspace = resolveCommandWorkspace(ctx);

  if (removeId !== undefined) return runRemove(ctx, workspace, removeId);

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

/** Deletes the journal row `id` in one write transaction and prints it. */
function runRemove(ctx: CommandContext, workspace: string, id: string): number {
  const { deps } = ctx;
  const store = deps.openStore(catalogPath(deps.fs, workspace));
  let removed: RejectionDto;
  try {
    removed = removeRejection(store, id);
  } finally {
    store.close();
  }

  if (ctx.json) {
    printJson(ctx.io, rejectionRemoveOutputSchema, {
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace,
      removed,
    });
  } else {
    printLines(ctx.io, renderRejectionRemoved(removed));
  }
  return EXIT_OK;
}
