import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES } from '../src/cli/main';
import { importReportSchema } from '../src/core/import-report-schema';
import { listOutputSchema, showOutputSchema } from '../src/core/cli-schemas';
import { runCli, setup } from './cli-harness';
import { fixedClock } from './helpers';
import { EXAMPLE, TEMPLATE, frontmatter, read } from './skill-files';

// The `/gaseste` skill shipped in workspace-template/ holds to the CLI
// contract (ticket 12). What Claude does with it is judged live (hitl); here
// SKILL.md is checked for the rule behind each case of the ticket, and the two
// commands it may run are shown not to write.

const SKILL = path.join(TEMPLATE, '.claude', 'skills', 'gaseste', 'SKILL.md');

describe('SKILL.md', () => {
  const skill = read(SKILL);

  it('has the frontmatter of a skill that may only run list, show and read files', () => {
    const meta = frontmatter(skill);
    expect(meta.name).toBe('gaseste');
    expect(meta.description).not.toBe('');
    expect(meta['argument-hint']).toBe("'<problema ta>'");
    expect(meta['allowed-tools']).toBe(
      'Bash(whenkit list:*), Bash(whenkit show:*), Read',
    );
  });

  it('names only real whenkit commands, and only the read-only ones it may run', () => {
    const named = [...skill.matchAll(/\bwhenkit ([a-z-]+)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) {
      expect(COMMAND_NAMES).toContain(name);
    }
    for (const needle of [
      '--json',
      'situations',
      'reguli-fise.md',
      '/adauga',
    ]) {
      expect(skill).toContain(needle);
    }
    // `whenkit import` appears only in the sentence that forbids it.
    for (const name of new Set(named)) {
      expect(['list', 'show', 'import']).toContain(name);
    }
    expect(named.filter((name) => name === 'import')).toHaveLength(1);
    expect(skill).toContain('Nu rulezi `whenkit import`');
  });

  // One row of the ticket's I/O matrix per case: the rule Claude follows.
  it.each([
    [
      'match: by meaning, best first, situations quoted verbatim, at most 5',
      [
        'după înțeles, nu după cuvinte',
        '**cel mult 5**',
        '**întocmai**',
        '`situations`',
        '`keywords`',
        '`categories[].name`',
      ],
    ],
    [
      'concept: show is used to read the content',
      ['whenkit show <id> --json', '`kind: "concept"`', '`content`'],
    ],
    [
      'no match: says so plainly, invents nothing, suggests /adauga',
      [
        'nu am găsit nimic în catalog',
        'fără nicio resursă inventată',
        '/adauga <link>',
      ],
    ],
    [
      'no argument: asks the problem, runs nothing',
      ['lipsește sau e gol', 'nu rulezi nicio comandă'],
    ],
    ['error: shows the message and stops', ['`error.message`', 'te oprești']],
    [
      'other workspace: says which catalog was searched',
      ['`workspace` din răspuns nu e folderul curent', 'în ce catalog'],
    ],
    [
      'flags: forced and archived entries',
      [
        '`forced: true`',
        'verificare ocolită de utilizator',
        '`githubArchived: true`',
        'arhivată',
      ],
    ],
    [
      'read-only: no writes, no web search',
      [
        '**nu scrii nimic**',
        'nu cauți pe web',
        'Nu rulezi `whenkit import`',
        'Notițele mele',
      ],
    ],
  ])('states the rule for %s', (_label, needles) => {
    for (const needle of needles) {
      expect(skill).toContain(needle);
    }
  });
});

describe('the commands /gaseste runs', () => {
  it('only read: list is byte-identical before and after list and show', async () => {
    const s = setup({ clock: fixedClock() });
    const run = (args: string[]) => runCli(s, args);

    expect((await run(['init'])).exitCode).toBe(0);
    writeFileSync(path.join(s.root, 'lot.json'), read(EXAMPLE));
    const imported = await run(['import', 'lot.json', '--json']);
    expect(imported.exitCode).toBe(0);
    const report = importReportSchema.parse(JSON.parse(imported.stdout));

    const first = await run(['list', '--json']);
    expect(first.exitCode).toBe(0);
    const listed = listOutputSchema.parse(JSON.parse(first.stdout));
    expect(listed.entries.length).toBeGreaterThan(0);
    const maxRevision = (entries: typeof listed.entries) =>
      Math.max(...entries.map((entry) => entry.revision));

    const concept = report.items.find((item) => item.ref === 'rest')?.id ?? '';
    expect(concept).not.toBe('');
    const shown = await run(['show', concept, '--json']);
    expect(shown.exitCode).toBe(0);
    expect(
      showOutputSchema.parse(JSON.parse(shown.stdout)).entry.content,
    ).not.toBe('');

    const second = await run(['list', '--json']);
    expect(second.stdout).toBe(first.stdout);
    expect(
      maxRevision(listOutputSchema.parse(JSON.parse(second.stdout)).entries),
    ).toBe(maxRevision(listed.entries));
  });
});
