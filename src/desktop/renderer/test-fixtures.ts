import type { CategoryDto, EntryDto } from '../../shared/ipc';

// Synthetic catalog data for the renderer tests.

export function makeCategory(
  id: string,
  name: string,
  zone: CategoryDto['zone'] = 'toolbox',
): CategoryDto {
  return { id, zone, name };
}

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
