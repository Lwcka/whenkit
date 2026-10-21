import { catalogSnapshot } from './catalog-snapshot';
import type { CatalogExport, EntryDto, ExportResult, LinkDto } from './dto';
import type { EntryKind } from './entry';
import { WhenkitError } from './errors';
import { fileTimestamp } from './file-stamp';
import type { CatalogStore, Clock, FileSystem } from './ports';
import { slugMap } from './slugify';
import { EXPORT_VERSION } from './versions';

// The export (CAP-13, AD-12): the whole catalog as `catalog.json` plus one
// Markdown file per entry. It only reads.

/**
 * The Romanian texts of the `.md` files, handed in by the caller so core holds
 * none (AD-13).
 */
export interface ExportLabels {
  /** Slug of an entry whose name has no letter or digit. */
  fallbackSlug: string;
  situations: (kind: EntryKind) => string;
  content: string;
  sources: string;
  /** The umbrella concepts an entry hangs under. */
  umbrellas: string;
  /** The concepts hanging under an umbrella. */
  children: string;
  related: string;
  myNotes: string;
}

export interface ExportPorts {
  fs: FileSystem;
  clock: Clock;
}

export interface ExportRequest {
  /** The folder the user picked; the export goes in a new folder inside it. */
  parentDir: string;
  labels: ExportLabels;
}

export type { ExportResult };

/** Every link once: `related` canonical, `parent` from the umbrella (AD-5). */
function linksOf(entries: readonly EntryDto[]): LinkDto[] {
  const links: LinkDto[] = [];
  for (const entry of entries) {
    for (const id of entry.relatedIds) {
      if (entry.id < id) {
        links.push({ type: 'related', fromId: entry.id, toId: id });
      }
    }
    for (const id of entry.childIds) {
      links.push({ type: 'parent', fromId: entry.id, toId: id });
    }
  }
  return links;
}

/**
 * A YAML scalar or list that is also JSON: valid YAML, with every quote and
 * line break escaped. JSON.stringify leaves DEL, the C1 controls, U+2028/2029
 * (line breaks to YAML) and U+FFFE/FFFF as they are, but YAML 1.2 does not
 * allow them in a document, so they are escaped here.
 */
function yaml(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\x7f-\x9f\u2028\u2029\ufffe\uffff]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** A name as the alias of a `[[slug|Name]]` link: no character that breaks it. */
function linkAlias(name: string): string {
  return name.replace(/[|[\]]/g, '-').replace(/\s+/g, ' ');
}

function markdownOf(
  entry: EntryDto,
  slugs: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
  labels: ExportLabels,
): string {
  const front: [string, unknown][] = [
    ['id', entry.id],
    ['kind', entry.kind],
    ['zone', entry.zone],
    ['aliases', [entry.name]],
  ];
  if (entry.url !== null) front.push(['url', entry.url]);
  if (entry.resourceType !== null) {
    front.push(['resourceType', entry.resourceType]);
  }
  front.push(
    ['categories', entry.categories.map((category) => category.name)],
    ['keywords', entry.keywords],
    ['addedAt', entry.addedAt],
  );
  if (entry.verifiedAt !== null) front.push(['verifiedAt', entry.verifiedAt]);
  if (entry.githubStars !== null) {
    front.push(['githubStars', entry.githubStars]);
  }
  if (entry.githubPushedAt !== null) {
    front.push(['githubPushedAt', entry.githubPushedAt]);
  }
  if (entry.githubArchived !== null) {
    front.push(['githubArchived', entry.githubArchived]);
  }
  front.push(['forced', entry.forced]);

  const wikiLinks = (ids: readonly string[]): string[] =>
    ids.flatMap((id) => {
      const slug = slugs.get(id);
      const name = names.get(id);
      return slug === undefined || name === undefined
        ? []
        : [`- [[${slug}|${linkAlias(name)}]]`];
    });
  const list = (items: readonly string[]) => items.map((item) => `- ${item}`);

  const blocks: string[] = [
    `---\n${front.map(([key, value]) => `${key}: ${yaml(value)}`).join('\n')}\n---`,
    `# ${entry.name}`,
  ];
  if (entry.whatItDoes !== '') blocks.push(entry.whatItDoes);
  const sections: [string, string[] | string][] = [
    [labels.situations(entry.kind), list(entry.situations)],
    [labels.content, entry.content ?? ''],
    [labels.sources, list(entry.sources)],
    [labels.umbrellas, wikiLinks(entry.parentIds)],
    [labels.children, wikiLinks(entry.childIds)],
    [labels.related, wikiLinks(entry.relatedIds)],
    [labels.myNotes, entry.myNotes],
  ];
  for (const [heading, body] of sections) {
    const text = Array.isArray(body) ? body.join('\n') : body.trim();
    if (text !== '') blocks.push(`## ${heading}\n\n${text}`);
  }
  return `${blocks.join('\n\n')}\n`;
}

/** A folder name not yet used in `parentDir`: `…_143002`, then `…_143002-2`, … */
function freeFolderName(
  fs: FileSystem,
  parentDir: string,
  base: string,
): string {
  let name = base;
  for (let n = 2; fs.exists(fs.joinPath(parentDir, name)); n += 1) {
    name = `${base}-${n}`;
  }
  return name;
}

/**
 * Exports the catalog into `whenkit-export-<YYYY-MM-DD_HHmmss>/` inside
 * `parentDir`. Everything is read in one synchronous transaction and built in
 * memory first (AD-12); only then are files written. A failed write removes
 * the half-written folder and throws EXPORT_WRITE_FAILED.
 */
export function exportCatalog(
  store: CatalogStore,
  { fs, clock }: ExportPorts,
  { parentDir, labels }: ExportRequest,
): ExportResult {
  const { entries, categories } = catalogSnapshot(store);
  const now = clock.now();

  const catalog: CatalogExport = {
    schemaVersion: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    entries,
    categories,
    links: linksOf(entries),
  };
  const slugs = slugMap(entries, labels.fallbackSlug);
  const names = new Map(entries.map((entry) => [entry.id, entry.name]));
  const files = [
    {
      relative: 'catalog.json',
      text: `${JSON.stringify(catalog, null, 2)}\n`,
    },
    ...entries.map((entry) => ({
      relative: `fise/${slugs.get(entry.id)}.md`,
      text: markdownOf(entry, slugs, names, labels),
    })),
  ];

  const folderName = freeFolderName(
    fs,
    parentDir,
    `whenkit-export-${fileTimestamp(now)}`,
  );
  const folderPath = fs.joinPath(parentDir, folderName);
  try {
    fs.mkdir(fs.joinPath(folderPath, 'fise'));
    for (const { relative, text } of files) {
      fs.writeText(fs.joinPath(folderPath, ...relative.split('/')), text);
    }
  } catch (cause) {
    try {
      fs.removeDir(folderPath);
    } catch {
      // Best effort: the original failure is the one to report.
    }
    throw new WhenkitError('EXPORT_WRITE_FAILED', { cause });
  }
  return { folderName, folderPath };
}
