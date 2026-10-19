import { toCategoryDto, toEntryDto, type CatalogSnapshotDto } from './dto';
import type { CatalogStore } from './ports';

/**
 * The whole catalog for the window (AD-10): every entry of both zones with
 * its content, in display order, and every category, read in one
 * transaction so the two lists agree.
 */
export function catalogSnapshot(store: CatalogStore): CatalogSnapshotDto {
  return store.readTransaction((reader) => ({
    entries: reader.allEntries().map(toEntryDto),
    categories: reader.allCategories().map(toCategoryDto),
  }));
}
