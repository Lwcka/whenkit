import { describe, expect, it } from 'vitest';
import { deleteEntry } from '../src/core/delete-entry';
import { searchEntries } from '../src/core/search-entries';
import {
  batch,
  concept,
  count,
  idsByRef,
  importReport,
  initialized,
  onStore,
  runCli,
  show,
  tool,
  type CliSetup,
} from './cli-harness';
import { errorCodeOf } from './helpers';

// `deleteEntry` (AD-3, AD-5) on the real store, in a temp development
// workspace: the row, its links, its categories and its journaled updates go;
// the entries it was linked to come back as stored.

/**
 * Concept `mid` sits under umbrella `top`, has a child `kid`, is related to
 * tool `tool`, has two categories and one journaled (rejected) update.
 */
async function withLinkedEntry() {
  const s = await initialized();
  const report = await importReport(
    s,
    batch([
      concept('top', { name: 'Umbrelă', children: ['mid'] }),
      concept('mid', {
        name: 'Fișa de șters zorila',
        categories: ['Backend & API-uri', 'Limbaje'],
        children: ['kid'],
        related: ['tool'],
      }),
      concept('kid'),
      tool('tool'),
    ]),
  );
  const ids = idsByRef(report);
  await importReport(
    s,
    batch([
      concept('mid', {
        op: 'update',
        id: ids.mid,
        flaggedByClaude: 'dubios',
      }),
    ]),
  );
  return { s, ids };
}

describe('deleteEntry', () => {
  it('removes the entry with its links, categories, journal rows and index entry', async () => {
    const { s, ids } = await withLinkedEntry();
    expect(count(s.dbPath, 'links')).toBe(3);
    expect(count(s.dbPath, 'rejections')).toBe(1);
    const topBefore = await show(s, ids.top);
    expect(found(s, 'zorila')).toEqual([ids.mid]);

    const result = onStore(s, (store) => deleteEntry(store, ids.mid));

    expect(result.removed).toBe(ids.mid);
    expect(result.changed.map((e) => e.id).sort()).toEqual(
      [ids.top, ids.kid, ids.tool].sort(),
    );
    const top = result.changed.find((e) => e.id === ids.top);
    expect(top?.childIds).toEqual([]);
    expect(top?.revision).toBe(topBefore.revision);
    expect(result.changed.find((e) => e.id === ids.tool)?.relatedIds).toEqual(
      [],
    );
    expect(result.changed.find((e) => e.id === ids.kid)?.parentIds).toEqual([]);

    expect(count(s.dbPath, 'links')).toBe(0);
    expect(count(s.dbPath, 'rejections')).toBe(0);
    expect(count(s.dbPath, 'entries')).toBe(3);
    expect(count(s.dbPath, 'entry_categories')).toBe(3);
    expect(found(s, 'zorila')).toEqual([]);
    expect((await runCli(s, ['show', ids.mid, '--json'])).exitCode).not.toBe(0);
  });

  it('changes nothing else for an entry without links', async () => {
    const s = await initialized();
    const report = await importReport(s, batch([tool('a'), tool('b')]));
    const [a, b] = report.items.map((item) => String(item.id));
    const result = onStore(s, (store) => deleteEntry(store, a));
    expect(result).toEqual({ removed: a, changed: [] });
    expect((await show(s, b)).id).toBe(b);
    expect(count(s.dbPath, 'entries')).toBe(1);
  });

  it('throws ENTRY_NOT_FOUND for an unknown id and deletes nothing', async () => {
    const { s } = await withLinkedEntry();
    expect(
      errorCodeOf(() =>
        onStore(s, (store) =>
          deleteEntry(store, '00000000-0000-4000-8000-0000000000ff'),
        ),
      ),
    ).toBe('ENTRY_NOT_FOUND');
    expect(count(s.dbPath, 'entries')).toBe(4);
  });
});

/** The ids the full-text search finds for `text`. */
function found(s: CliSetup, text: string): string[] {
  return onStore(s, (store) => searchEntries(store, text).ids);
}
