import { Ajv2020 } from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { batchSchema } from './batch-schema';
import { batchJsonSchema } from './batch-json-schema';

const ID = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';

const tool = {
  ref: 't',
  op: 'add',
  kind: 'tool',
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: ['Imagini & video'],
  whatItDoes: 'Elimină fundalul.',
  situations: ['Când vreau fundal transparent'],
};

const concept = {
  ref: 'c',
  op: 'add',
  kind: 'concept',
  name: 'REST',
  categories: ['Backend & API-uri'],
  whatItDoes: 'Stil de arhitectură.',
  situations: ['Când aleg forma unui API'],
  content: '# REST',
  children: ['0b9c6a52-3d4e-4f60-8a71-2b3c4d5e6f70'],
  related: [ID],
};

const batch = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  items,
  ...extra,
});

// `strict: false`: zod adds `default` and `format` annotations that ajv's
// strict mode would only warn about.
const validate = new Ajv2020({ strict: false }).compile(batchJsonSchema());

describe('batchJsonSchema', () => {
  it('is Draft 2020-12 and compiles', () => {
    expect(batchJsonSchema().$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
  });

  it('accepts a correct batch, which batchSchema also accepts', () => {
    const input = batch(
      [tool, concept, { ...tool, ref: 'u', op: 'update', id: ID }],
      { newCategories: [{ zone: 'toolbox', name: 'Fonturi' }] },
    );
    expect(validate(input)).toBe(true);
    expect(batchSchema.safeParse(input).error?.issues).toBeUndefined();
  });

  it('describes the input shape: defaults are not required', () => {
    expect(validate(batch([tool]))).toBe(true);
  });

  it.each([
    ['an unknown item field', batch([{ ...tool, myNotes: 'x' }])],
    ['an unknown top-level field', { ...batch([tool]), extra: 1 }],
    ['an update without id', batch([{ ...tool, op: 'update' }])],
    ['an add with an id', batch([{ ...tool, id: ID }])],
    ['children on a tool', batch([{ ...tool, children: ['x'] }])],
    ['a tool without url', batch([{ ...tool, url: undefined }])],
    ['an empty batch', batch([])],
    ['another schemaVersion', { ...batch([tool]), schemaVersion: 2 }],
  ])('rejects %s', (_name, input) => {
    expect(validate(input)).toBe(false);
  });

  it('says the rules it cannot express in descriptions', () => {
    const text = JSON.stringify(batchJsonSchema());
    expect(text).toContain('Unique within the batch');
    expect(text).toContain('ref of another item of this batch');
    expect(text).toContain('Every target must be a concept');
  });
});
