import { z } from 'zod';
import {
  categoryDtoSchema,
  entryDtoSchema,
  entrySummaryDtoSchema,
  rejectionDtoSchema,
} from './dto';
import { ERROR_CODES } from './errors';
import { CLI_OUTPUT_VERSION } from './versions';

// The `--json` outputs other than the import report (AD-11, AD-14). Each
// command prints exactly one of these documents on stdout, errors included.

const outputVersion = z.literal(CLI_OUTPUT_VERSION);

export const listOutputSchema = z.strictObject({
  schemaVersion: outputVersion,
  workspace: z.string(),
  entries: z.array(entrySummaryDtoSchema),
});

export type ListOutput = z.infer<typeof listOutputSchema>;

export const showOutputSchema = z.strictObject({
  schemaVersion: outputVersion,
  workspace: z.string(),
  entry: entryDtoSchema,
});

export type ShowOutput = z.infer<typeof showOutputSchema>;

export const rejectionsOutputSchema = z.strictObject({
  schemaVersion: outputVersion,
  workspace: z.string(),
  /** The rejection journal, oldest first. */
  rejections: z.array(rejectionDtoSchema),
});

export type RejectionsOutput = z.infer<typeof rejectionsOutputSchema>;

export const categoriesOutputSchema = z.strictObject({
  schemaVersion: outputVersion,
  workspace: z.string(),
  /** Toolbox first, then Learn; by name within a zone. */
  categories: z.array(categoryDtoSchema),
});

export type CategoriesOutput = z.infer<typeof categoriesOutputSchema>;

export const errorOutputSchema = z.strictObject({
  schemaVersion: outputVersion,
  /** The resolved workspace, or null when it could not be resolved. */
  workspace: z.string().nullable(),
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    issues: z
      .array(
        z.strictObject({
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

export type ErrorOutput = z.infer<typeof errorOutputSchema>;
