import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  errorOutputSchema,
  listOutputSchema,
  rejectionRemoveOutputSchema,
  rejectionsOutputSchema,
} from '../src/core/cli-schemas';
import type { RejectionDto } from '../src/core/dto';
import { CLI_OUTPUT_VERSION } from '../src/core/versions';
import { errorMessages } from '../src/shared/strings.ro';
import {
  batch,
  importReport,
  initialized,
  runCli,
  tool,
  type CliSetup,
} from './cli-harness';

// `whenkit rejections --remove <id>` (AD-11) end to end through main(): the
// one command that deletes a journal row.

async function journal(s: CliSetup): Promise<RejectionDto[]> {
  const result = await runCli(s, ['rejections', '--json']);
  expect(result.exitCode).toBe(0);
  return rejectionsOutputSchema.parse(JSON.parse(result.stdout)).rejections;
}

async function catalog(s: CliSetup): Promise<string> {
  const result = await runCli(s, ['list', '--json']);
  expect(result.exitCode).toBe(0);
  return JSON.stringify(listOutputSchema.parse(JSON.parse(result.stdout)));
}

/** A journal with two rows (a.dev and b.dev) and one catalog entry. */
async function twoRows() {
  const s = await initialized();
  await importReport(
    s,
    batch([
      tool('a', { url: 'httpss://a.dev' }),
      tool('b', { url: 'httpss://b.dev' }),
      tool('kept'),
    ]),
  );
  const rows = await journal(s);
  expect(rows).toHaveLength(2);
  return { s, rows };
}

describe('whenkit rejections --remove', () => {
  it('deletes the row, prints it, and leaves the other row and the catalog alone', async () => {
    const { s, rows } = await twoRows();
    const catalogBefore = await catalog(s);

    const result = await runCli(s, [
      'rejections',
      '--remove',
      rows[0].id,
      '--json',
    ]);
    expect(result.exitCode).toBe(0);
    expect(
      rejectionRemoveOutputSchema.parse(JSON.parse(result.stdout)),
    ).toEqual({
      schemaVersion: CLI_OUTPUT_VERSION,
      workspace: s.workspace,
      removed: rows[0],
    });
    expect(await journal(s)).toEqual([rows[1]]);
    expect(await catalog(s)).toBe(catalogBefore);
  });

  it('accepts --json before the option too', async () => {
    const { s, rows } = await twoRows();
    const result = await runCli(s, [
      'rejections',
      '--json',
      '--remove',
      rows[1].id,
    ]);
    expect(result.exitCode).toBe(0);
    expect(await journal(s)).toEqual([rows[0]]);
  });

  it('prints one Romanian line with the name of the element', async () => {
    const { s, rows } = await twoRows();
    const result = await runCli(s, ['rejections', '--remove', rows[0].id]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Am șters din jurnalul de respinse: Tool a\n');
    expect(await journal(s)).toHaveLength(1);
  });

  it('refuses an unknown id: exit 1, REJECTION_NOT_FOUND, journal unchanged', async () => {
    const { s, rows } = await twoRows();
    const before = readFileSync(s.dbPath);

    const result = await runCli(s, [
      'rejections',
      '--remove',
      'nope',
      '--json',
    ]);
    expect(result.exitCode).toBe(1);
    const doc = errorOutputSchema.parse(JSON.parse(result.stdout));
    expect(doc.error.code).toBe('REJECTION_NOT_FOUND');
    expect(doc.error.message).toBe(errorMessages.REJECTION_NOT_FOUND);
    expect(await journal(s)).toEqual(rows);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('prints the unknown-id error on stderr without --json', async () => {
    const { s } = await twoRows();
    const result = await runCli(s, ['rejections', '--remove', 'nope']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(errorMessages.REJECTION_NOT_FOUND);
  });

  it('removes a row only once', async () => {
    const { s, rows } = await twoRows();
    expect(
      (await runCli(s, ['rejections', '--remove', rows[0].id])).exitCode,
    ).toBe(0);
    const again = await runCli(s, ['rejections', '--remove', rows[0].id]);
    expect(again.exitCode).toBe(1);
    expect(await journal(s)).toEqual([rows[1]]);
  });

  it.each([
    ['no value', ['--remove']],
    ['another option as value', ['--remove', '--json']],
    ['an extra positional', ['--remove', 'ROW', 'other']],
    ['a repeated option', ['--remove', 'ROW', '--remove', 'ROW']],
  ])('is a usage error with %s: exit 1, nothing deleted', async (_, flags) => {
    const { s, rows } = await twoRows();
    const before = readFileSync(s.dbPath);
    const args = flags.map((flag) => (flag === 'ROW' ? rows[0].id : flag));

    const result = await runCli(s, ['rejections', ...args, '--json']);
    expect(result.exitCode).toBe(1);
    expect(errorOutputSchema.parse(JSON.parse(result.stdout)).error.code).toBe(
      'ARGUMENTS_INVALID',
    );
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
    expect(await journal(s)).toEqual(rows);
  });

  it('leaves the plain listing read-only and unchanged', async () => {
    const { s, rows } = await twoRows();
    const before = readFileSync(s.dbPath);
    expect(await journal(s)).toEqual(rows);
    await runCli(s, ['rejections']);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('clears the old row of a retry whose corrected link changed its dedup key', async () => {
    const s = await initialized();
    await importReport(
      s,
      batch([tool('typo', { url: 'httpss://gutnberg.org' })]),
    );
    const [old] = await journal(s);

    // The corrected link has another dedup key: the old row survives the retry.
    const retry = await importReport(
      s,
      batch([tool('typo', { url: 'https://gutenberg.org' })]),
    );
    expect(retry.items[0]).toMatchObject({ outcome: 'added' });
    expect(await journal(s)).toEqual([old]);

    const result = await runCli(s, [
      'rejections',
      '--remove',
      old.id,
      '--json',
    ]);
    expect(result.exitCode).toBe(0);
    expect(await journal(s)).toEqual([]);
  });
});
