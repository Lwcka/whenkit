import { toRejectionDto, type RejectionDto } from './dto';
import { WhenkitError } from './errors';
import type { CatalogStore } from './ports';

/**
 * Deletes one row of the rejection journal in one write transaction (AD-3,
 * AD-11) and returns it. An id that is not in the journal of this owner throws
 * REJECTION_NOT_FOUND and deletes nothing.
 */
export function removeRejection(store: CatalogStore, id: string): RejectionDto {
  return store.writeTransaction((writer) => {
    const row = writer.rejections().find((r) => r.id === id);
    if (row === undefined || !writer.deleteRejectionById(id)) {
      throw new WhenkitError('REJECTION_NOT_FOUND', { detail: id });
    }
    return toRejectionDto(row);
  });
}
