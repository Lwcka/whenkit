import path from 'node:path';
import { WhenkitError } from '../../core/errors';
import {
  applyBatch,
  assertForceRefs,
  readBatch,
} from '../../core/import-batch';
import { importReportSchema } from '../../core/import-report-schema';
import { verifyBatch } from '../../core/verification/verify';
import {
  catalogPath,
  readBlockedDomains,
  resolveWorkspace,
} from '../../core/workspace';
import { EXIT_OK } from '../exit-codes';
import {
  extractForce,
  parseArgs,
  printJson,
  printLines,
  type CommandContext,
} from '../command';
import { renderImportReport } from '../render';

/** `whenkit import <lot> [--json] [--force <ref>]…` */
export async function runImport(
  args: readonly string[],
  ctx: CommandContext,
): Promise<number> {
  const { force, rest } = extractForce('import', args);
  const [file] = parseArgs('import', rest, { required: ['lot'], json: true });
  const { deps } = ctx;
  const workspace = resolveWorkspace(deps.env, deps.fs);
  ctx.workspace = workspace;

  // Phase 1 runs before the catalog is opened: an invalid batch touches
  // nothing.
  const batch = readBatch(deps.fs, path.resolve(deps.cwd, file));
  assertForceRefs(batch, force);

  // A workspace without a catalog fails before any link is checked or the
  // blocked-domain list is recreated; opening the store checks it again.
  const dbPath = catalogPath(deps.fs, workspace);
  if (!deps.fs.exists(dbPath)) {
    throw new WhenkitError('CATALOG_NOT_FOUND', { detail: dbPath });
  }

  // Phase 2 holds no transaction (AD-6). OFFLINE stops here: nothing written.
  const verdicts = await verifyBatch(
    batch,
    {
      http: deps.http,
      blockedDomains: readBlockedDomains(workspace, deps),
      retryDelayMs: deps.retryDelayMs,
    },
    force,
  );

  const store = deps.openStore(dbPath);
  let report;
  try {
    report = applyBatch(store, batch, verdicts, {
      clock: deps.clock,
      ids: deps.ids,
      workspace,
      force,
    });
  } finally {
    store.close();
  }

  if (ctx.json) printJson(ctx.io, importReportSchema, report);
  else printLines(ctx.io, renderImportReport(importReportSchema.parse(report)));
  return EXIT_OK;
}
