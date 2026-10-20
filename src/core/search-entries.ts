import type { SearchResultDto } from './dto';
import type { CatalogStore } from './ports';

/**
 * The entries of both zones that match what the user typed (CAP-9): their ids
 * in display order (AD-10). The window splits them by zone and filters its
 * snapshot, so no DTO crosses the bridge twice.
 */
export function searchEntries(
  store: CatalogStore,
  text: string,
): SearchResultDto {
  return {
    ids: store.readTransaction((reader) => reader.searchEntryIds(text)),
  };
}
