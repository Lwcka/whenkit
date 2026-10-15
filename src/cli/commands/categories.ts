import { categoriesOutputSchema } from '../../core/cli-schemas';
import { toCategoryDto } from '../../core/dto';
import { ZONES } from '../../core/entry';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  resolveCommandWorkspace,
  withReadStore,
  type CommandContext,
} from '../command';
import { renderCategories } from '../render';

/**
 * `whenkit categories [--json]`: the categories of both zones, Toolbox first,
 * by name within a zone. Never writes.
 */
export function runCategories(
  args: readonly string[],
  ctx: CommandContext,
): number {
  parseArgs('categories', args, { required: [], json: true });
  const workspace = resolveCommandWorkspace(ctx);

  const categories = withReadStore(ctx, workspace, (store) =>
    ZONES.flatMap((zone) => store.categoriesInZone(zone).map(toCategoryDto)),
  );

  if (ctx.json) {
    printJson(ctx.io, categoriesOutputSchema, {
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace,
      categories,
    });
  } else {
    printLines(ctx.io, renderCategories(categories));
  }
  return EXIT_OK;
}
