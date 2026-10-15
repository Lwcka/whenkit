import { showOutputSchema } from '../../core/cli-schemas';
import { toEntryDto } from '../../core/dto';
import { WhenkitError } from '../../core/errors';
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
import { renderEntry } from '../render';

/** `whenkit show <id> [--json]`: one complete entry. Never writes. */
export function runShow(args: readonly string[], ctx: CommandContext): number {
  const [id] = parseArgs('show', args, { required: ['id'], json: true });
  const workspace = resolveCommandWorkspace(ctx);

  const stored = withReadStore(ctx, workspace, (store) => store.entryById(id));
  if (stored === undefined) {
    throw new WhenkitError('ENTRY_NOT_FOUND', { detail: id });
  }
  const entry = toEntryDto(stored);

  if (ctx.json) {
    printJson(ctx.io, showOutputSchema, {
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace,
      entry,
    });
  } else {
    printLines(ctx.io, renderEntry(entry));
  }
  return EXIT_OK;
}
