import { categoriesOutputSchema } from '../../core/cli-schemas';
import { toCategoryDto } from '../../core/dto';
import { ZONES } from '../../core/entry';
import { CLI_OUTPUT_VERSION } from '../../core/versions';
import { catalogPath } from '../../core/workspace';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  resolveCommandWorkspace,
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
  const { deps } = ctx;
  const workspace = resolveCommandWorkspace(ctx);

  const store = deps.openStore(catalogPath(deps.fs, workspace), {
    readOnly: true,
  });
  let categories;
  try {
    categories = ZONES.flatMap((zone) =>
      store.categoriesInZone(zone).map(toCategoryDto),
    );
  } finally {
    store.close();
  }

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
