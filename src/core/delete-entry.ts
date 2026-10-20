import { toEntryDto, type EntryDto } from './dto';
import { WhenkitError } from './errors';
import type { CatalogStore } from './ports';

/**
 * Deletes an entry in one write transaction (AD-3). Its category rows and its
 * links go by cascade and the search index by trigger (AD-5); the journaled
 * `update` rejections that target it go too, since retrying them would fail.
 * Returns the deleted id and the entries it was linked to, as stored after the
 * delete (their link lists no longer hold it); their `revision` does not
 * change, because a cascade is not an edit. An id that is not in the catalog
 * throws ENTRY_NOT_FOUND and deletes nothing.
 */
export function deleteEntry(
  store: CatalogStore,
  id: string,
): { removed: string; changed: EntryDto[] } {
  return store.writeTransaction((writer) => {
    const entry = writer.entryById(id);
    if (entry === undefined) {
      throw new WhenkitError('ENTRY_NOT_FOUND', { detail: id });
    }
    const linkedIds = [
      ...new Set([...entry.relatedIds, ...entry.parentIds, ...entry.childIds]),
    ].sort();
    writer.deleteUpdateRejections(id);
    if (!writer.deleteEntry(id)) {
      throw new WhenkitError('INTERNAL', { detail: `entry ${id} vanished` });
    }
    const changed: EntryDto[] = [];
    for (const linkedId of linkedIds) {
      const linked = writer.entryById(linkedId);
      if (linked !== undefined) changed.push(toEntryDto(linked));
    }
    return { removed: id, changed };
  });
}
