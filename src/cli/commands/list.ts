import { listOutputSchema } from '../../core/cli-schemas';
import { toEntrySummaryDto } from '../../core/dto';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
} from '../command';
import { renderEntryList } from '../render';

/** `whenkit list [--json]`: every entry, without `content`. Never writes. */
export function runList(args: readonly string[], ctx: CommandContext): number {
  parseArgs('list', args, { required: [], json: true });
  const { deps } = ctx;
  const workspace = resolveWorkspace(deps.env, deps.fs);
  ctx.workspace = workspace;

  const store = deps.openStore(catalogPath(deps.fs, workspace), {
    readOnly: true,
  });
  let entries;
  try {
    entries = store.entrySummaries().map(toEntrySummaryDto);
  } finally {
    store.close();
  }

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
