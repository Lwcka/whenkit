import { toEntryDto, type EntryDto } from './dto';
import { WhenkitError } from './errors';
import type { CatalogStore } from './ports';

/**
 * Replaces the author's notes of an entry in one write transaction (AD-3,
 * AD-16) and returns the entry as stored. The notes are kept exactly as
 * typed; `revision`, `verified_at` and the fields Claude writes do not change.
 * An id that is not in the catalog throws ENTRY_NOT_FOUND.
 */
export function setNotes(
  store: CatalogStore,
  id: string,
  notes: string,
): EntryDto {
  return store.writeTransaction((writer) => {
    if (!writer.setEntryNotes(id, notes)) {
      throw new WhenkitError('ENTRY_NOT_FOUND', { detail: id });
    }
    const entry = writer.entryById(id);
    if (entry === undefined) {
      throw new WhenkitError('INTERNAL', { detail: `entry ${id} vanished` });
    }
    return toEntryDto(entry);
  });
}
