import { listOutputSchema } from '../../core/cli-schemas';
import { toEntrySummaryDto } from '../../core/dto';
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
import { renderEntryList } from '../render';

/** `whenkit list [--json]`: every entry, without `content`. Never writes. */
export function runList(args: readonly string[], ctx: CommandContext): number {
  parseArgs('list', args, { required: [], json: true });
  const workspace = resolveCommandWorkspace(ctx);

  const entries = withReadStore(ctx, workspace, (store) =>
    store.entrySummaries().map(toEntrySummaryDto),
  );

  if (ctx.json) {
    printJson(ctx.io, listOutputSchema, {
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace,
      entries,
    });
  } else {
    printLines(ctx.io, renderEntryList(entries));
  }
  return EXIT_OK;
}
