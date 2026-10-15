import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { COMMAND_NAMES, main, type CliDeps } from '../src/cli/main';
import { batchSchema } from '../src/core/batch-schema';
import { showOutputSchema } from '../src/core/cli-schemas';
import { importReportSchema } from '../src/core/import-report-schema';
import { BATCH_SCHEMA_VERSION } from '../src/core/versions';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  notFoundGithub,
  okHttp,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// The files `/importa` ships in workspace-template/ hold to the CLI contract
// (ticket 11). What Claude does with them is judged live (hitl); here the
// reference batch is imported for real and SKILL.md is checked for the rules
// each edge case of the ticket depends on.

const TEMPLATE = path.join(__dirname, '..', 'workspace-template');
const SKILL = path.join(TEMPLATE, '.claude', 'skills', 'importa', 'SKILL.md');
const EXAMPLE = path.join(
  TEMPLATE,
  '.claude',
  'skills',
  'importa',
  'exemplu-lot.json',
);
const RULES = path.join(TEMPLATE, '.claude', 'skills', 'reguli-fise.md');

const read = (file: string) => readFileSync(file, 'utf8');

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('no frontmatter');
  return Object.fromEntries(
    match[1].split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at), line.slice(at + 1).trim()];
    }),
  );
}

describe('exemplu-lot.json', () => {
  const example: unknown = JSON.parse(read(EXAMPLE));

  it('passes the batch schema at the current schema version', () => {
    const batch = batchSchema.parse(example);
    expect(batch.schemaVersion).toBe(BATCH_SCHEMA_VERSION);
    expect(batch.items.map((item) => item.kind)).toEqual([
      'tool',
      'material',
      'concept',
      'concept',
      'concept',
      'tool',
    ]);
  });

  it('imports into a fresh workspace: all added but the flagged item, umbrella linked', async () => {
    const root = tempDir();
    const appRoot = fakeAppRoot(path.join(root, 'repo'));
    const appData = path.join(root, 'AppData');
    mkdirSync(appData);
    const workspace = path.join(root, 'ws');
    const deps: CliDeps = {
      env: fakeEnvironment(
        { APPDATA: appData, WHENKIT_WORKSPACE: workspace },
        appRoot,
      ),
      fs: nodeFileSystem,
      clock: fixedClock(),
      ids: sequentialIds(),
      openStore: testStoreOpener(),
      http: okHttp,
      github: notFoundGithub,
      cwd: root,
    };
    const run = async (args: string[]) => {
      let stdout = '';
      const exitCode = await main(
        args,
        { stdout: (text) => (stdout += text), stderr: () => undefined },
        deps,
      );
      return { exitCode, stdout };
    };

    expect((await run(['init'])).exitCode).toBe(0);
    writeFileSync(path.join(root, 'lot.json'), read(EXAMPLE));
    const imported = await run(['import', 'lot.json', '--json']);
    expect(imported.exitCode).toBe(0);
    const report = importReportSchema.parse(JSON.parse(imported.stdout));

    const outcomes = Object.fromEntries(
      report.items.map((item) => [item.ref, item.outcome]),
    );
    expect(outcomes).toEqual({
      'public-apis': 'added',
      'developer-roadmap': 'added',
      'tipuri-de-api': 'added',
      rest: 'added',
      graphql: 'added',
      'filme-gratis': 'rejected',
    });
    expect(
      report.items.find((item) => item.ref === 'filme-gratis')?.reasons,
    ).toContainEqual({
      code: 'flagged_by_claude',
      params: { text: 'distribuție ilegală de conținut cu copyright' },
    });
    expect(report.newCategories).toEqual([]);
    expect(report.proposedBlockedDomains).toEqual(['filme-gratis.example']);

    const idOf = (ref: string) =>
      report.items.find((item) => item.ref === ref)?.id ?? '';
    const shown = await run(['show', idOf('tipuri-de-api'), '--json']);
    const umbrella = showOutputSchema.parse(JSON.parse(shown.stdout)).entry;
    expect([...umbrella.childIds].sort()).toEqual(
      [idOf('rest'), idOf('graphql')].sort(),
    );
    expect(umbrella.sources).toHaveLength(2);
  });
});

describe('SKILL.md', () => {
  const skill = read(SKILL);

  it('has the frontmatter of a skill that may only run whenkit, fetch pages and read files', () => {
    const meta = frontmatter(skill);
    expect(meta.name).toBe('importa');
    expect(meta.description).not.toBe('');
    expect(meta['argument-hint']).toContain('respinse');
    expect(meta['allowed-tools']).toBe('Bash(whenkit:*), WebFetch, Read');
  });

  it('names only real whenkit commands, and the files it depends on', () => {
    const named = [...skill.matchAll(/\bwhenkit ([a-z-]+)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) {
      expect(COMMAND_NAMES).toContain(name);
    }
    for (const needle of [
      'batches/',
      'input/',
      'reguli-fise.md',
      'exemplu-lot.json',
      '--json',
      'respinse',
      '--force <ref>',
      'newCategories',
      'proposedBlockedDomains',
      'flaggedByClaude',
      'batchSchemaVersion',
      'Notițele mele',
    ]) {
      expect(skill).toContain(needle);
    }
  });

  // One row of the ticket's I/O matrix per case: the rule Claude follows.
  it.each([
    [
      'text file: one batch per input file, deleted only after exit 0',
      [
        'Un lot per fișier de input',
        'batches/<calea-fișierului-față-de-input/-cu-extensie>.json',
        'cod 0',
      ],
    ],
    [
      'concept notes: umbrella with children and sources',
      ['concept-umbrelă', 'un singur lot', '`children`', '`sources`'],
    ],
    [
      'link: one-item batch, input/ untouched',
      ['un lot cu un singur element', 'nu atingi `input/`'],
    ],
    [
      'retry: proposes the fix, asks, imports after the agreement',
      [
        'whenkit rejections --json',
        'Arată propunerile',
        'httpss://gutenberg.org',
        'https://gutenberg.org',
        'Fără acord nu imporți nimic',
      ],
    ],
    [
      'invalid batch: fixed from the issues, at most two retries',
      ['`error.issues`', 'cel mult de două ori', 'păstrezi lotul'],
    ],
    [
      'unavailable: stop and keep the batch and the input file',
      ['`OFFLINE`', 'păstrezi lotul și fișierul de input'],
    ],
    [
      'wrong workspace: nothing written',
      [
        'whenkit categories --json',
        '`workspace` din răspuns nu e folderul curent',
        'WHENKIT_WORKSPACE',
        'nu scrii nimic',
      ],
    ],
    [
      'unsupported file: skipped and reported',
      ['nu e acceptat', 'îl lași pe loc', 'sărit'],
    ],
    [
      'flagged content stays in the batch',
      ['păstrezi în lot', '`flaggedByClaude`'],
    ],
    ['malformed URL is sent as written', ['nu-l repari', 'httpss://…']],
    [
      'leftover batches: the user chooses',
      ['Loturi rămase', 'le reimporți', 'le ștergi'],
    ],
  ])('states the rule for %s', (_label, needles) => {
    for (const needle of needles) {
      expect(skill).toContain(needle);
    }
  });
});

describe('reguli-fise.md', () => {
  it('covers every section of the card writing rules', () => {
    const rules = read(RULES);
    for (const section of [
      'Clasificare',
      'Când o folosesc',
      'Cuvinte-cheie',
      'Resurse înrudite',
      'Concepte',
      'Surse',
      'Notițele mele',
    ]) {
      expect(rules).toMatch(new RegExp(`^## ${section}`, 'm'));
    }
  });
});
