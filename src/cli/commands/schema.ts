import { batchJsonSchema } from '../../core/batch-json-schema';
import { EXIT_OK } from '../exit-codes';
import { parseArgs, type CommandContext } from '../command';

/**
 * `whenkit schema`: prints the JSON Schema of the import batch (AD-6, AD-11).
 * Needs no workspace and touches no port: the schema comes from the code.
 */
export function runSchema(
  args: readonly string[],
  ctx: CommandContext,
): number {
  parseArgs('schema', args, { required: [], json: false });
  ctx.io.stdout(`${JSON.stringify(batchJsonSchema(), null, 2)}\n`);
  return EXIT_OK;
}
