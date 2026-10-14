import { describe, expect, it } from 'vitest';
import { batchSchema } from './batch-schema';

const tool = {
  ref: 't1',
  op: 'add',
  kind: 'tool',
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: ['Imagini & video'],
  whatItDoes: 'Elimină automat fundalul unei imagini.',
  situations: ['Când vreau fundal transparent'],
};

const concept = {
  ref: 'c1',
  op: 'add',
  kind: 'concept',
  name: 'REST',
  categories: ['Backend & API-uri'],
  whatItDoes: 'Stil de arhitectură pentru API-uri.',
  situations: ['Când aleg forma unui API'],
  content: '# REST\n\n| a | b |',
};

function batch(items: unknown[], extra: Record<string, unknown> = {}) {
  return { schemaVersion: 1, items, ...extra };
}

function paths(input: unknown) {
  const result = batchSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('batchSchema', () => {
  it('accepts a tool and a concept and fills the defaults', () => {
    const parsed = batchSchema.parse(batch([tool, concept]));
    expect(parsed.newCategories).toEqual([]);
    expect(parsed.proposedBlockedDomains).toEqual([]);
    expect(parsed.items[0]).toMatchObject({ kind: 'tool', keywords: [] });
    expect(parsed.items[1]).toMatchObject({
      kind: 'concept',
      keywords: [],
      sources: [],
    });
  });

  it('accepts a material, declared categories and a Claude verdict', () => {
    const parsed = batchSchema.parse(
      batch(
        [
          {
            ...tool,
            kind: 'material',
            resourceType: 'repo',
            categories: ['Interviuri', 'Fonturi'],
            flaggedByClaude: 'Conținut piratat',
          },
        ],
        {
          newCategories: [{ zone: 'learn', name: 'Fonturi' }],
          proposedBlockedDomains: ['libgen.is'],
        },
      ),
    );
    expect(parsed.items[0].flaggedByClaude).toBe('Conținut piratat');
  });

  it.each([
    ['an unknown item field', [{ ...tool, myNotes: 'x' }], 'items.0'],
    ['an unknown top-level field', [tool], ''],
    ['a missing url on a tool', [{ ...tool, url: undefined }], 'items.0.url'],
    ['a bad kind', [{ ...tool, kind: 'book' }], 'items.0.kind'],
    [
      'a bad resourceType',
      [{ ...tool, resourceType: 'x' }],
      'items.0.resourceType',
    ],
    ['an unknown op', [{ ...tool, op: 'delete' }], 'items.0.op'],
    [
      'three categories',
      [{ ...tool, categories: ['a', 'b', 'c'] }],
      'items.0.categories',
    ],
    ['no categories', [{ ...tool, categories: [] }], 'items.0.categories'],
    ['no situations', [{ ...tool, situations: [] }], 'items.0.situations'],
    ['a blank name', [{ ...tool, name: '  ' }], 'items.0.name'],
    [
      'a resourceType on a concept',
      [{ ...concept, resourceType: 'site' }],
      'items.0',
    ],
    [
      'a concept without content',
      [{ ...concept, content: undefined }],
      'items.0.content',
    ],
    ['a related link (ticket 7)', [{ ...tool, related: ['x'] }], 'items.0'],
  ])('refuses %s', (label, items, path) => {
    const input =
      label === 'an unknown top-level field'
        ? batch(items, { ownerId: 'x' })
        : batch(items);
    expect(paths(input)).toContain(path);
  });

  it.each(['   ', '\n', '\t \n'])(
    'refuses blank concept content %j',
    (content) => {
      expect(paths(batch([{ ...concept, content }]))).toContain(
        'items.0.content',
      );
    },
  );

  it('keeps concept content verbatim, whitespace included', () => {
    const content = '\n# REST\n\n';
    const parsed = batchSchema.parse(batch([{ ...concept, content }]));
    expect(parsed.items[0]).toMatchObject({ content });
  });

  it('requires schemaVersion and at least one item', () => {
    expect(paths({ items: [tool] })).toContain('schemaVersion');
    expect(paths(batch([]))).toContain('items');
  });

  it('refuses a ref used twice', () => {
    expect(paths(batch([tool, { ...tool, url: 'https://x.dev' }]))).toEqual([
      'items.1.ref',
    ]);
  });

  it('refuses the same category twice on one item, by name_key', () => {
    expect(
      paths(
        batch([
          { ...tool, categories: ['Imagini & video', 'imagini &  VIDEO'] },
        ]),
      ),
    ).toEqual(['items.0.categories']);
  });
});

describe('batchSchema op update', () => {
  const ID = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';
  const OTHER_ID = '0b9e8d7c-6a5f-4e3d-8c2b-1a0f9e8d7c6b';
  const update = { ...tool, ref: 'u1', op: 'update', id: ID };

  it('accepts an update with the id of its entry, and an add next to it', () => {
    const parsed = batchSchema.parse(batch([update, tool]));
    expect(parsed.items[0]).toMatchObject({ op: 'update', id: ID });
    expect(parsed.items[1]).toMatchObject({ op: 'add' });
    expect(parsed.items[1].id).toBeUndefined();
  });

  it('accepts an update that changes the kind', () => {
    const parsed = batchSchema.parse(
      batch([{ ...concept, ref: 'u1', op: 'update', id: ID }]),
    );
    expect(parsed.items[0]).toMatchObject({ kind: 'concept', id: ID });
  });

  it.each([
    ['an update without an id', [{ ...update, id: undefined }], 'items.0.id'],
    ['an add with an id', [{ ...tool, id: ID }], 'items.0.id'],
    ['an id that is not a UUID', [{ ...update, id: 'abc' }], 'items.0.id'],
  ])('refuses %s', (_label, items, path) => {
    expect(paths(batch(items))).toContain(path);
  });

  it('refuses the same id twice in one batch', () => {
    expect(
      paths(batch([update, { ...update, ref: 'u2', url: 'https://x.dev' }])),
    ).toEqual(['items.1.id']);
  });

  it('lowercases the id, so differently cased ids are the same entry', () => {
    const parsed = batchSchema.parse(
      batch([{ ...update, id: ID.toUpperCase() }]),
    );
    expect(parsed.items[0].id).toBe(ID);
    expect(
      paths(
        batch([
          update,
          { ...update, ref: 'u2', id: ID.toUpperCase(), url: 'https://x.dev' },
        ]),
      ),
    ).toEqual(['items.1.id']);
  });

  it('accepts two updates of different entries', () => {
    expect(
      batchSchema.safeParse(
        batch([update, { ...update, ref: 'u2', id: OTHER_ID }]),
      ).success,
    ).toBe(true);
  });
});
