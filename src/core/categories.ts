import {
  toCategoryDto,
  toEntryDtos,
  type CategoryDto,
  type EntryDto,
} from './dto';
import { issuesError, vanishedError, WhenkitError } from './errors';
import { nameKey } from './name-key';
import type { CatalogStore, CatalogWriter, StoredCategory } from './ports';

// The window's category management (AD-3, AD-5): rename, merge and delete.
// Each is one write transaction. A merge or a delete that moves entries
// bumps their `revision`; a rename never does, because the entries' own
// content does not change (AD-5).

/** What a category write answers with (AD-10). */
export interface CategoryWriteResult {
  /** The entries that carry or carried the category, as stored after the write. */
  changed: EntryDto[];
  /** Every category after the write, by zone and then name. */
  categories: CategoryDto[];
}

function invalid(path: string, message: string): WhenkitError {
  return issuesError('ARGUMENTS_INVALID', [{ path: [path], message }]);
}

function requireId(path: string, value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    throw invalid(path, `${path} must be a non-empty string`);
  }
  return value;
}

function requireCategory(writer: CatalogWriter, id: string): StoredCategory {
  const category = writer.categoryById(id);
  if (category === undefined) {
    throw new WhenkitError('CATEGORY_NOT_FOUND', { detail: id });
  }
  return category;
}

function finish(
  writer: CatalogWriter,
  entryIds: string[],
): CategoryWriteResult {
  return {
    changed: toEntryDtos(writer, entryIds),
    categories: writer.allCategories().map(toCategoryDto),
  };
}

/** Moves every entry of `source` to `target` (same zone) and deletes `source`. */
function mergeInto(
  writer: CatalogWriter,
  source: StoredCategory,
  target: StoredCategory,
): CategoryWriteResult {
  if (source.id === target.id) {
    throw invalid('targetId', 'the target must differ from the source');
  }
  if (source.zone !== target.zone) {
    throw invalid('targetId', 'the target must be in the same zone');
  }
  const entryIds = writer.entryIdsWithCategory(source.id);
  for (const entryId of entryIds) {
    const entry = writer.entryById(entryId);
    if (entry === undefined) continue;
    const next = new Set(
      entry.categories.map((category) =>
        category.id === source.id ? target.id : category.id,
      ),
    );
    writer.replaceEntryCategories(entryId, [...next]);
  }
  writer.bumpRevisions(entryIds);
  if (!writer.deleteCategory(source.id)) {
    throw vanishedError('category', source.id);
  }
  return finish(writer, entryIds);
}

/**
 * Renames a category. The name is trimmed; an empty one is ARGUMENTS_INVALID.
 * Another category of the zone with the same `name_key` is
 * CATEGORY_NAME_TAKEN; the category's own key (a change of case or accents)
 * is allowed. `revision` of the entries does not change.
 */
export function renameCategory(
  store: CatalogStore,
  input: { id: unknown; name: unknown },
): CategoryWriteResult {
  const id = requireId('id', input.id);
  if (typeof input.name !== 'string') {
    throw invalid('name', 'name must be a string');
  }
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name === '') throw invalid('name', 'name must not be empty');
  return store.writeTransaction((writer) => {
    const category = requireCategory(writer, id);
    const key = nameKey(name);
    const taken = writer
      .categoriesInZone(category.zone)
      .some((other) => other.id !== id && other.nameKey === key);
    if (taken) throw new WhenkitError('CATEGORY_NAME_TAKEN', { detail: name });
    if (!writer.renameCategory(id, name, key)) {
      throw vanishedError('category', id);
    }
    return finish(writer, writer.entryIdsWithCategory(id));
  });
}

/**
 * Merges `sourceId` into `targetId` of the same zone: the source's entries
 * carry the target once, their `revision` grows by one and the source is
 * deleted. Unknown ids are CATEGORY_NOT_FOUND; the same id or two zones are
 * ARGUMENTS_INVALID.
 */
export function mergeCategories(
  store: CatalogStore,
  input: { sourceId: unknown; targetId: unknown },
): CategoryWriteResult {
  const sourceId = requireId('sourceId', input.sourceId);
  const targetId = requireId('targetId', input.targetId);
  return store.writeTransaction((writer) =>
    mergeInto(
      writer,
      requireCategory(writer, sourceId),
      requireCategory(writer, targetId),
    ),
  );
}

/**
 * Deletes a category. When some entry has only this category, a `targetId`
 * of the same zone is required (CATEGORY_TARGET_REQUIRED otherwise, nothing
 * written) and the delete is a merge. Without such entries the category is
 * removed from the entries that keep another one (their `revision` grows).
 * A given `targetId` always makes it a merge.
 */
export function deleteCategory(
  store: CatalogStore,
  input: { id: unknown; targetId?: unknown },
): CategoryWriteResult {
  const id = requireId('id', input.id);
  const targetId =
    input.targetId === undefined || input.targetId === null
      ? undefined
      : requireId('targetId', input.targetId);
  return store.writeTransaction((writer) => {
    const category = requireCategory(writer, id);
    if (targetId !== undefined) {
      return mergeInto(writer, category, requireCategory(writer, targetId));
    }
    const entryIds = writer.entryIdsWithCategory(id);
    const entries = entryIds.flatMap((entryId) => {
      const entry = writer.entryById(entryId);
      return entry === undefined ? [] : [entry];
    });
    if (entries.some((entry) => entry.categories.length <= 1)) {
      throw new WhenkitError('CATEGORY_TARGET_REQUIRED', { detail: id });
    }
    for (const entry of entries) {
      writer.replaceEntryCategories(
        entry.id,
        entry.categories
          .filter((other) => other.id !== id)
          .map((other) => other.id),
      );
    }
    writer.bumpRevisions(entryIds);
    if (!writer.deleteCategory(id)) {
      throw vanishedError('category', id);
    }
    return finish(writer, entryIds);
  });
}
