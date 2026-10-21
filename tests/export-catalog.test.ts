import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { catalogSnapshot } from '../src/core/catalog-snapshot';
import { catalogExportSchema } from '../src/core/dto';
import { exportCatalog } from '../src/core/export-catalog';
import type {
  CatalogStore,
  Clock,
  FileSystem,
  GitHubClient,
} from '../src/core/ports';
import { exportStrings } from '../src/shared/strings.ro';
import {
  batch,
  importReport,
  initialized,
  tool,
  type CliSetup,
} from './cli-harness';
import { errorCodeOf, fixedClock, tempDir, testStoreOpener } from './helpers';

// The export (CAP-13, AD-12) on a real catalog and the real file system.

const github: GitHubClient = {
  repo: () =>
    Promise.resolve({
      kind: 'ok',
      stars: 1200,
      pushedAt: '2026-09-01T10:00:00Z',
      archived: false,
    }),
};

const EXPORT_CLOCK: Clock = fixedClock(new Date(2026, 9, 16, 14, 30, 2));

function concept(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'concept',
    name: `Concept ${ref}`,
    categories: ['Backend & API-uri'],
    whatItDoes: 'Explică ceva.',
    situations: ['Când aleg'],
    content: `# ${ref}\n\nText.`,
    ...overrides,
  };
}

function openStore(s: CliSetup): CatalogStore {
  return testStoreOpener()(s.dbPath, { migrate: false });
}

function runExport(
  store: CatalogStore,
  parentDir: string,
  fs: FileSystem = nodeFileSystem,
  clock: Clock = EXPORT_CLOCK,
) {
  return exportCatalog(
    store,
    { fs, clock },
    { parentDir, labels: exportStrings },
  );
}

/** A catalog with tools, a material, concepts (umbrella, children, related), notes and GitHub data. */
async function fullCatalog() {
  const s = await initialized({ github });
  const report = await importReport(
    s,
    batch([
      tool('a', {
        name: 'remove.bg',
        url: 'https://github.com/o/remove-bg',
        resourceType: 'repo',
        related: ['b'],
        keywords: ['fundal', 'poze'],
      }),
      tool('b', {
        name: 'Photopea | [online]',
        situations: ['scot fundalul', 'editez poze'],
      }),
      {
        ref: 'm',
        op: 'add',
        kind: 'material',
        name: 'Ghid',
        url: 'https://ghid.dev',
        resourceType: 'site',
        categories: ['Backend & API-uri'],
        whatItDoes: 'Învață ceva.',
        situations: ['Când studiez'],
      },
      concept('api', {
        name: 'API',
        children: ['rest', 'graphql'],
        related: ['rest'],
      }),
      concept('rest', {
        name: 'REST',
        sources: ['https://rest.dev/spec'],
      }),
      concept('graphql', { name: 'GraphQL' }),
    ]),
  );
  const ids = Object.fromEntries(
    report.items.map((item) => [item.ref, String(item.id)]),
  );
  const store = openStore(s);
  store.writeTransaction((writer) => {
    writer.setEntryNotes(ids.a, 'Gratuit doar la rezoluție mică.');
  });
  return { s, store, ids };
}

const readExport = (folderPath: string) =>
  catalogExportSchema.parse(
    JSON.parse(readFileSync(path.join(folderPath, 'catalog.json'), 'utf8')),
  );

const readSheet = (folderPath: string, slug: string) =>
  readFileSync(path.join(folderPath, 'fise', `${slug}.md`), 'utf8');

describe('exportCatalog', () => {
  it('writes catalog.json equal to the snapshot and one .md per entry', async () => {
    const { store } = await fullCatalog();
    const parent = tempDir();

    const result = runExport(store, parent);
    const snapshot = catalogSnapshot(store);
    store.close();

    expect(result.folderName).toBe('whenkit-export-2026-10-16_143002');
    expect(result.folderPath).toBe(path.join(parent, result.folderName));
    const exported = readExport(result.folderPath);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.exportedAt).toBe(EXPORT_CLOCK.now().toISOString());
    expect(exported.entries).toEqual(snapshot.entries);
    expect(exported.categories).toEqual(snapshot.categories);
    expect(exported.entries.find((e) => e.name === 'remove.bg')).toMatchObject({
      myNotes: 'Gratuit doar la rezoluție mică.',
      githubStars: 1200,
    });
    expect(exported.entries.find((e) => e.name === 'REST')?.content).toBe(
      '# rest\n\nText.',
    );
    expect(readdirSync(path.join(result.folderPath, 'fise')).sort()).toEqual([
      'api.md',
      'ghid.md',
      'graphql.md',
      'photopea-online.md',
      'remove-bg.md',
      'rest.md',
    ]);
  });

  it('lists each link once and every [[slug|Name]] points at an existing file', async () => {
    const { store, ids } = await fullCatalog();
    const { folderPath } = runExport(store, tempDir());
    store.close();

    const { links } = readExport(folderPath);
    const canonical = (x: string, y: string) => {
      const [fromId, toId] = [x, y].sort();
      return { type: 'related', fromId, toId };
    };
    expect(links).toHaveLength(4);
    expect(links).toContainEqual(canonical(ids.a, ids.b));
    expect(links).toContainEqual(canonical(ids.api, ids.rest));
    expect(links).toContainEqual({
      type: 'parent',
      fromId: ids.api,
      toId: ids.rest,
    });
    expect(links).toContainEqual({
      type: 'parent',
      fromId: ids.api,
      toId: ids.graphql,
    });

    const dir = path.join(folderPath, 'fise');
    let count = 0;
    for (const file of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, file), 'utf8');
      for (const match of text.matchAll(/\[\[([^|\]]+)\|([^\]]*)\]\]/g)) {
        count += 1;
        expect(existsSync(path.join(dir, `${match[1]}.md`))).toBe(true);
      }
    }
    // Each link shows on both sides: api lists rest, graphql and rest again
    // as related; rest lists api twice; graphql lists api; a and b list each other.
    expect(count).toBe(8);
  });

  it('writes front matter and headings, and omits empty sections', async () => {
    const { store } = await fullCatalog();
    const { folderPath } = runExport(store, tempDir());
    store.close();

    const text = readSheet(folderPath, 'remove-bg');
    const [, front, body] = text.split('---\n');
    const values = Object.fromEntries(
      front
        .trim()
        .split('\n')
        .map((line) => {
          const at = line.indexOf(': ');
          return [line.slice(0, at), JSON.parse(line.slice(at + 2)) as unknown];
        }),
    );
    expect(values).toMatchObject({
      kind: 'tool',
      zone: 'toolbox',
      aliases: ['remove.bg'],
      url: 'https://github.com/o/remove-bg',
      resourceType: 'repo',
      keywords: ['fundal', 'poze'],
      githubStars: 1200,
      githubArchived: false,
      forced: false,
    });
    expect(body).toContain('# remove.bg');
    expect(body).toContain('## Când o folosesc\n\n- Când am nevoie de el');
    expect(body).toContain('## Resurse înrudite\n\n- [[photopea-online|');
    expect(body).toContain(
      '## Notițele mele\n\nGratuit doar la rezoluție mică.',
    );
    expect(body).not.toContain('## Conținut');
    expect(body).not.toContain('## Surse');
    expect(body).not.toContain('## Umbrele');

    expect(readSheet(folderPath, 'api')).toContain('## Concepte\n\n- [[');
    expect(readSheet(folderPath, 'api')).toContain('## Conținut\n\n# api');
    const rest = readSheet(folderPath, 'rest');
    expect(rest).toContain('## Umbrele\n\n- [[api|API]]');
    expect(rest).toContain('## Surse\n\n- https://rest.dev/spec');
  });

  it('replaces |, [ and ] in the alias of a link', async () => {
    const { store } = await fullCatalog();
    const { folderPath } = runExport(store, tempDir());
    store.close();
    expect(readSheet(folderPath, 'remove-bg')).toContain(
      '[[photopea-online|Photopea - -online-]]',
    );
  });

  it('adds a suffix to the folder when the second is taken', async () => {
    const { store } = await fullCatalog();
    const parent = tempDir();
    const first = runExport(store, parent);
    const second = runExport(store, parent);
    const third = runExport(store, parent);
    store.close();
    expect(first.folderName).toBe('whenkit-export-2026-10-16_143002');
    expect(second.folderName).toBe('whenkit-export-2026-10-16_143002-2');
    expect(third.folderName).toBe('whenkit-export-2026-10-16_143002-3');
    expect(existsSync(first.folderPath)).toBe(true);
  });

  it('exports an empty catalog as empty lists and an empty fise/', async () => {
    const s = await initialized();
    const store = openStore(s);
    const { folderPath } = runExport(store, tempDir());
    store.close();
    const exported = readExport(folderPath);
    expect(exported.entries).toEqual([]);
    expect(exported.links).toEqual([]);
    expect(readdirSync(path.join(folderPath, 'fise'))).toEqual([]);
  });

  it('names colliding entries docker and docker-2, the older one first', async () => {
    const s = await initialized();
    s.deps.clock = fixedClock(new Date('2026-10-13T09:00:00.000Z'));
    await importReport(s, batch([tool('x', { name: 'Dócker' })]));
    s.deps.clock = fixedClock(new Date('2026-10-14T09:00:00.000Z'));
    await importReport(s, batch([tool('y', { name: 'docker' })]));
    const store = openStore(s);
    const { folderPath } = runExport(store, tempDir());
    store.close();
    expect(readdirSync(path.join(folderPath, 'fise')).sort()).toEqual([
      'docker-2.md',
      'docker.md',
    ]);
    expect(readSheet(folderPath, 'docker')).toContain('# Dócker\n');
    expect(readSheet(folderPath, 'docker-2')).toContain('# docker\n');
  });

  it('escapes characters YAML does not allow in the front matter', async () => {
    const odd = [0x7f, 0x85, 0x9f, 0x2028, 0x2029, 0xfffe, 0xffff]
      .map((code) => String.fromCharCode(code))
      .join('');
    const s = await initialized();
    await importReport(s, batch([tool('x', { name: `Odd ${odd} name` })]));
    const store = openStore(s);
    const { folderPath } = runExport(store, tempDir());
    store.close();

    const text = readSheet(folderPath, 'odd-name');
    const [, front] = text.split('---\n');
    // Nothing in the front matter is a character YAML 1.2 forbids or breaks on.
    expect(front).not.toMatch(/[\x7f-\x9f\u2028\u2029\ufffe\uffff]/);
    const aliases = front
      .split('\n')
      .find((line) => line.startsWith('aliases: '));
    expect(JSON.parse(aliases?.slice('aliases: '.length) ?? 'null')).toEqual([
      `Odd ${odd} name`,
    ]);
    for (const escape of [
      'u007f',
      'u0085',
      'u009f',
      'u2028',
      'u2029',
      'ufffe',
      'uffff',
    ]) {
      expect(aliases).toContain(`\\${escape}`);
    }
  });

  it('does not change the catalog', async () => {
    const { store } = await fullCatalog();
    const before = catalogSnapshot(store);
    runExport(store, tempDir());
    expect(catalogSnapshot(store)).toEqual(before);
    store.close();
  });
});

describe('exportCatalog write failures', () => {
  it('removes the half-written folder and reports EXPORT_WRITE_FAILED', async () => {
    const { store } = await fullCatalog();
    const parent = tempDir();
    let writes = 0;
    const failing: FileSystem = {
      ...nodeFileSystem,
      writeText: (target, text) => {
        writes += 1;
        if (writes === 3) throw new Error('disk full');
        nodeFileSystem.writeText(target, text);
      },
    };

    expect(errorCodeOf(() => runExport(store, parent, failing))).toBe(
      'EXPORT_WRITE_FAILED',
    );
    store.close();

    expect(writes).toBe(3);
    expect(readdirSync(parent)).toEqual([]);
  });

  it('still reports the write failure when the cleanup fails too', async () => {
    const { store } = await fullCatalog();
    const failing: FileSystem = {
      ...nodeFileSystem,
      mkdir: () => {
        throw new Error('read-only');
      },
      removeDir: () => {
        throw new Error('locked');
      },
    };
    expect(errorCodeOf(() => runExport(store, tempDir(), failing))).toBe(
      'EXPORT_WRITE_FAILED',
    );
    store.close();
  });
});
