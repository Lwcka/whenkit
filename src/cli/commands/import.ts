import path from 'node:path';
import { applyBatch, readBatch } from '../../core/import-batch';
import { importReportSchema } from '../../core/import-report-schema';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import { EXIT_OK } from '../exit-codes';
import {
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
} from '../command';
import { renderImportReport } from '../render';

/** `whenkit import <lot> [--json]` */
export function runImport(
  args: readonly string[],
  ctx: CommandContext,
): number {
  const [file] = parseArgs('import', args, { required: ['lot'], json: true });
  const { deps } = ctx;
  const workspace = resolveWorkspace(deps.env, deps.fs);
  ctx.workspace = workspace;

  // Phase 1 runs before the catalog is opened: an invalid batch touches
  // nothing.
  const batch = readBatch(deps.fs, path.resolve(deps.cwd, file));

  const store = deps.openStore(catalogPath(deps.fs, workspace));
  let report;
  try {
    report = applyBatch(store, batch, {
      clock: deps.clock,
      ids: deps.ids,
      workspace,
    });
  } finally {
    store.close();
  }

  if (ctx.json) printJson(ctx.io, importReportSchema, report);
  else printLines(ctx.io, renderImportReport(importReportSchema.parse(report)));
  return EXIT_OK;
}
