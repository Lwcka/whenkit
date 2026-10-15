import { readFileSync } from 'node:fs';
import path from 'node:path';

// The files of workspace-template/ the skill tests read.

export const TEMPLATE = path.join(__dirname, '..', 'workspace-template');

/** The reference batch that ships with the `/importa` skill. */
export const EXAMPLE = path.join(
  TEMPLATE,
  '.claude',
  'skills',
  'importa',
  'exemplu-lot.json',
);

export const read = (file: string) => readFileSync(file, 'utf8');

/** The `key: value` lines of a SKILL.md frontmatter. */
export function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('no frontmatter');
  return Object.fromEntries(
    match[1].split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at), line.slice(at + 1).trim()];
    }),
  );
}
