import type { EntryDto, EntrySummaryDto } from '../core/dto';
import type { ImportOutcome, ImportReport } from '../core/import-report-schema';
import type { VerdictReason } from '../core/verification/reason-codes';
import {
  entryStrings,
  importStrings,
  kindLabels,
  outcomeLabels,
  reasonTexts,
  resourceTypeLabels,
  zoneLabels,
} from '../shared/strings.ro';

// Human text outputs, rendered from the same objects the `--json` outputs
// print (AD-14). The words come from src/shared/strings.ro.ts.

export function reasonText(reason: VerdictReason): string {
  return reasonTexts[reason.code](reason.params ?? {});
}

/** `items[0].categories` from a schema issue path. */
export function formatIssuePath(path: readonly (string | number)[]): string {
  return path
    .map((key, index) =>
      typeof key === 'number' ? `[${key}]` : index === 0 ? key : `.${key}`,
    )
    .join('');
}

export function renderImportReport(report: ImportReport): string[] {
  const lines = [importStrings.header(report.workspace)];
  const counts: Record<ImportOutcome, number> = {
    added: 0,
    updated: 0,
    warned: 0,
    rejected: 0,
    duplicate: 0,
  };
  for (const item of report.items) {
    counts[item.outcome] += 1;
    const isUpdate = item.op === 'update';
    const details: string[] = [];
    if (item.id !== undefined) details.push(importStrings.entryId(item.id));
    if (item.duplicateOfId !== undefined) {
      details.push(importStrings.duplicateOf(item.duplicateOfId));
    }
    // An unknown id names no entry, so there is none to stay unchanged.
    const unknownId = item.reasons.some((r) => r.code === 'unknown_id');
    if (isUpdate && item.id === undefined && !unknownId) {
      details.push(importStrings.entryUnchanged);
    }
    const label =
      isUpdate && item.outcome === 'warned'
        ? importStrings.warnedUpdate
        : outcomeLabels[item.outcome];
    const outcome = [label, ...details].join(' ');
    lines.push(
      isUpdate
        ? importStrings.updateItem(item.ref, outcome)
        : importStrings.item(item.ref, outcome),
    );
    for (const reason of item.reasons) {
      lines.push(importStrings.reason(reasonText(reason)));
    }
  }
  if (report.newCategories.length > 0) {
    lines.push(importStrings.newCategoriesHeader);
    for (const category of report.newCategories) {
      lines.push(
        importStrings.newCategory(
          category.name,
          zoneLabels[category.zone],
          category.created,
        ),
      );
    }
  }
  if (report.proposedBlockedDomains.length > 0) {
    lines.push(
      importStrings.proposedBlockedDomains(
        report.proposedBlockedDomains.join(', '),
      ),
    );
  }
  lines.push(importStrings.summary(counts));
  return lines;
}

export function renderEntryList(entries: readonly EntrySummaryDto[]): string[] {
  if (entries.length === 0) return [entryStrings.emptyCatalog];
  return entries.map((entry) =>
    entryStrings.listLine(
      entry.id,
      kindLabels[entry.kind],
      entry.name,
      entry.categories.map((category) => category.name).join(', '),
    ),
  );
}

export function renderEntry(entry: EntryDto): string[] {
  const lines = [
    entry.name,
    entryStrings.kind(kindLabels[entry.kind], zoneLabels[entry.zone]),
  ];
  const field = (label: string, value: string) =>
    lines.push(`${label}: ${value}`);
  const list = (label: string, values: readonly string[]) => {
    if (values.length === 0) return;
    lines.push(`${label}:`);
    for (const value of values) lines.push(`  - ${value}`);
  };

  if (entry.url !== null) field(entryStrings.url, entry.url);
  if (entry.resourceType !== null) {
    field(entryStrings.resourceType, resourceTypeLabels[entry.resourceType]);
  }
  field(
    entryStrings.categories,
    entry.categories.map((category) => category.name).join(', '),
  );
  field(entryStrings.whatItDoes, entry.whatItDoes);
  list(entryStrings.situations(entry.kind), entry.situations);
  if (entry.keywords.length > 0) {
    field(entryStrings.keywords, entry.keywords.join(', '));
  }
  list(entryStrings.sources, entry.sources);
  if (entry.content !== null) {
    lines.push(`${entryStrings.content}:`, entry.content);
  }
  if (entry.myNotes !== '') {
    lines.push(`${entryStrings.myNotes}:`, entry.myNotes);
  }
  field(entryStrings.addedAt, entry.addedAt);
  field(entryStrings.verifiedAt, entry.verifiedAt ?? entryStrings.notVerified);
  list(entryStrings.verificationNotes, entry.verificationNotes.map(reasonText));
  field(entryStrings.id, entry.id);
  return lines;
}
