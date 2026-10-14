import { z } from 'zod';
import { batchSchema } from './batch-schema';
import { WhenkitError } from './errors';

// The batch's JSON Schema (AD-6), derived from the Zod schema so the two never
// drift. It is the *input* shape (defaults are optional), Draft 2020-12.
// JSON Schema cannot express every rule of batchSchema: unique refs and ids
// and the link targets are validated by `whenkit import` and said in the
// `description`s instead. The pairing of `op` and `id` it can express, and
// does below.

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// `then` is the JSON Schema keyword, not a thenable.
/* oxlint-disable unicorn/no-thenable */

/** An `update` must carry `id`; an `add` must not. */
const OP_ID_PAIRING: JsonObject[] = [
  {
    if: { properties: { op: { const: 'update' } }, required: ['op'] },
    then: { required: ['id'] },
  },
  {
    if: { properties: { op: { const: 'add' } }, required: ['op'] },
    then: { not: { required: ['id'] } },
  },
];

/* oxlint-enable unicorn/no-thenable */

export function batchJsonSchema(): JsonObject {
  const schema: JsonObject = z.toJSONSchema(batchSchema, {
    target: 'draft-2020-12',
    io: 'input',
  });

  const properties = schema.properties;
  const items = isObject(properties) ? properties.items : undefined;
  const item = isObject(items) ? items.items : undefined;
  if (!isObject(item)) {
    throw new WhenkitError('INTERNAL', {
      detail: 'the batch JSON Schema has no items.items',
    });
  }
  item.allOf = OP_ID_PAIRING;
  return schema;
}

/**
 * The exact text `whenkit schema` prints and `init` writes to
 * `batch.schema.json`.
 */
export function batchJsonSchemaText(): string {
  return `${JSON.stringify(batchJsonSchema(), null, 2)}\n`;
}
