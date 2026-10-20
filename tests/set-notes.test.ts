import { describe, expect, it } from 'vitest';
import { setNotes } from '../src/core/set-notes';
import {
  batch,
  importReport,
  initialized,
  runCli,
  show,
  tool,
  type CliSetup,
} from './cli-harness';
import { errorCodeOf, testStoreOpener } from './helpers';

// `setNotes` (AD-3, AD-16) on the real store, in a temp development
// workspace: the one write of `my_notes`, which no import touches.

async function withTool() {
  const s = await initialized();
  const report = await importReport(s, batch([tool('a')]));
  return { s, id: String(report.items[0].id) };
}

/** Runs `fn` on the workspace's catalog, opened for writing and closed after. */
function onStore<T>(
  s: CliSetup,
  fn: (store: ReturnType<ReturnType<typeof testStoreOpener>>) => T,
): T {
  const store = testStoreOpener()(s.dbPath, {});
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

describe('setNotes', () => {
  it('writes the notes as typed and changes nothing else', async () => {
    const { s, id } = await withTool();
    const before = await show(s, id);

    const typed = '  Merge și pe PNG mari.\n\n  - o listă *simplă*  \n';
    const dto = onStore(s, (store) => setNotes(store, id, typed));

    expect(dto).toEqual({ ...before, myNotes: typed });
    expect(await show(s, id)).toEqual({ ...before, myNotes: typed });
    expect(dto.revision).toBe(before.revision);
    expect(dto.verifiedAt).toBe(before.verifiedAt);
  });

  it('clears the notes with an empty text', async () => {
    const { s, id } = await withTool();
    onStore(s, (store) => setNotes(store, id, 'ceva'));
    const dto = onStore(s, (store) => setNotes(store, id, ''));
    expect(dto.myNotes).toBe('');
  });

  it('throws ENTRY_NOT_FOUND for an unknown id', async () => {
    const { s } = await withTool();
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          setNotes(store, '00000000-0000-4000-8000-0000000000ff', 'x'),
        ),
      ),
    ).toBe('ENTRY_NOT_FOUND');
  });

  it('survives an import update of the entry', async () => {
    const { s, id } = await withTool();
    onStore(s, (store) => setNotes(store, id, 'x'));
    const report = await importReport(
      s,
      batch([tool('a', { op: 'update', id, name: 'Alt nume' })]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'updated', id });
    const after = await show(s, id);
    expect(after.name).toBe('Alt nume');
    expect(after.myNotes).toBe('x');
    expect((await runCli(s, ['list', '--json'])).exitCode).toBe(0);
  });
});
