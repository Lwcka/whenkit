import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES } from '../src/cli/main';
import { batchSchema } from '../src/core/batch-schema';
import { showOutputSchema } from '../src/core/cli-schemas';
import { importReportSchema } from '../src/core/import-report-schema';
import { BATCH_SCHEMA_VERSION } from '../src/core/versions';
import { runCli, setup } from './cli-harness';
import { fixedClock } from './helpers';
import { EXAMPLE, TEMPLATE, frontmatter, read } from './skill-files';

// The files `/importa` ships in workspace-template/ hold to the CLI contract
// (ticket 11). What Claude does with them is judged live (hitl); here the
// reference batch is imported for real and SKILL.md is checked for the rules
// each edge case of the ticket depends on.

const SKILL = path.join(TEMPLATE, '.claude', 'skills', 'importa', 'SKILL.md');
const RULES = path.join(TEMPLATE, '.claude', 'skills', 'reguli-fise.md');

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
    const s = setup({ clock: fixedClock() });
    const run = (args: string[]) => runCli(s, args);

    expect((await run(['init'])).exitCode).toBe(0);
    writeFileSync(path.join(s.root, 'lot.json'), read(EXAMPLE));
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
      'params.name',
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
      'a page that does not load still goes into the batch, undocumented',
      [
        '**îl pui totuși în lot**',
        'niciun link din input nu se pierde',
        'doar ce spune inputul',
        '**nedocumentată**',
        '`update`',
        '„Nedocumentată: pagina nu s-a încărcat la import.”',
        'doar fișa minimă de la pasul 2, nimic în plus',
        'fără cuvinte-cheie inventate',
      ],
    ],
    [
      'an undocumented item is visited again on retry',
      ['Un element nedocumentat', 'îl vizitezi din nou cu `WebFetch`'],
    ],
    [
      'leftover batches: the user chooses',
      ['Loturi rămase', 'le reimporți', 'le ștergi'],
    ],
  ])('states the rule for %s', (_label, needles) => {
    for (const needle of needles) {
      expect(skill).toContain(needle);
    }
  });

  it('no longer leaves a link that does not load out of the batch', () => {
    for (const stale of ['nu-l pui în lot', 'linkuri sărite', 'link sărit']) {
      expect(skill).not.toContain(stale);
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

  it('sends a link that does not load to the verification, never only to the user', () => {
    const rules = read(RULES);
    expect(rules).toContain('intră totuși în lot');
    expect(rules).toContain('nedocumentată');
    expect(rules).toContain(
      '„Nedocumentată: pagina nu s-a încărcat la import.”',
    );
    expect(rules).toContain('o singură situație');
    expect(rules).toContain('fără cuvinte-cheie inventate');
    expect(rules).toContain('nu se aplică fișei minime');
    expect(rules).not.toContain('îl raportezi utilizatorului');
  });
});
