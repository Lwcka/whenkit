import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import type {
  CatalogSnapshotDto,
  CategoryDto,
  EntryDto,
  IpcResult,
  WriteResult,
} from '../../shared/ipc';
import { App, type FrameApi } from './app';
import type { CatalogStore } from './catalog-store';

// Synthetic catalog data and a fake bridge for the renderer tests.

export function makeCategory(
  id: string,
  name: string,
  zone: CategoryDto['zone'] = 'toolbox',
): CategoryDto {
  return { id, zone, name };
}

/** Categories the App tests share: two in the Toolbox, one in Learn. */
export const imagini = makeCategory('c-img', 'Imagini & video');
export const securitate = makeCategory('c-sec', 'Securitate');
export const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');

export function makeEntry(
  id: string,
  overrides: Partial<Omit<EntryDto, 'categories'>> & {
    categories?: readonly CategoryDto[];
  } = {},
): EntryDto {
  const zone = overrides.zone ?? 'toolbox';
  return {
    id,
    ownerId: 'owner',
    kind: zone === 'toolbox' ? 'tool' : 'concept',
    zone,
    name: id,
    url: null,
    resourceType: null,
    relatedIds: [],
    parentIds: [],
    childIds: [],
    whatItDoes: `Descriere ${id}.`,
    situations: [],
    keywords: [],
    sources: [],
    content: null,
    myNotes: '',
    githubStars: null,
    githubPushedAt: null,
    githubArchived: null,
    verificationNotes: [],
    forced: false,
    revision: 1,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
    ...overrides,
    categories: (overrides.categories ?? []).map(
      ({ id: categoryId, name }) => ({
        id: categoryId,
        name,
      }),
    ),
  };
}

/** The answer of a write that changed nothing. */
export const okWrite = (): Promise<IpcResult<WriteResult>> =>
  Promise.resolve({ ok: true, data: { changed: [] } });

/** A bridge whose every call succeeds with nothing; tests override what they watch. */
export function fakeFrameApi(overrides: Partial<FrameApi> = {}): FrameApi {
  return {
    workspacePath: 'C:\\ws',
    searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
    setNotes: okWrite,
    deleteEntry: okWrite,
    patchEntry: okWrite,
    setTheme: () => Promise.resolve({ ok: true, data: null }),
    setZoomFactor: () => {},
    renameCategory: okWrite,
    mergeCategories: okWrite,
    deleteCategory: okWrite,
    openExternal: () => Promise.resolve({ ok: true, data: null }),
    exportCatalog: () => Promise.resolve({ ok: true, data: null }),
    openExportFolder: () => Promise.resolve({ ok: true, data: null }),
    ...overrides,
  };
}

/** The answer of `catalog:snapshot` for these entries and categories. */
export function okSnapshot(
  entries: readonly EntryDto[],
  categories: readonly CategoryDto[],
): IpcResult<CatalogSnapshotDto> {
  return {
    ok: true,
    data: { entries: [...entries], categories: [...categories] },
  };
}

/** Renders the App on `store` and waits for the store's first load. */
export async function renderApp(
  store: CatalogStore,
  api: FrameApi = fakeFrameApi(),
) {
  const view = render(createElement(App, { store, api }));
  await act(() => store.load());
  return view;
}
