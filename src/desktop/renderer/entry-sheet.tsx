import {
  ArrowRight,
  Check,
  ExternalLink as ExternalLinkIcon,
  Flag,
  Pencil,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { isExternalUrl, type EntryDto } from '../../shared/ipc';
import {
  appStrings,
  entryStrings,
  formatCompact,
  formatDate,
  reasonTexts,
  resourceTypeLabels,
  zoneLabels,
} from '../../shared/strings.ro';
import { entrySlot, pulseParity, sheetLinks, shortId } from './catalog-view';
import { ExternalLink } from './external-link';
import { MarkdownContent } from './markdown-content';
import './entry-sheet.css';

export interface EntrySheetProps {
  /** The entry's DTO as the store holds it now: the sheet keeps no copy. */
  entry: EntryDto;
  /** Every entry of the snapshot, to resolve the links. */
  entries: readonly EntryDto[];
  /** The color slot of every category, by id. */
  slots: ReadonlyMap<string, number>;
  /** How many updates from the terminal the entry has had; its parity restarts the pulse. */
  pulses: number;
  /** Opens the sheet of a linked entry (pushes it on the stack). */
  onOpen: (id: string) => void;
  /** Opens a link in the default browser (AD-9); main checks it again. */
  onOpenExternal: (url: string) => void;
}

/**
 * The accent block that opens the entry's URL in the browser (DESIGN,
 * open-in-browser). Absent when the entry has no http(s) URL.
 */
function OpenInBrowser({
  url,
  onOpenExternal,
}: {
  url: string | null;
  onOpenExternal: (url: string) => void;
}) {
  if (!isExternalUrl(url)) return null;
  return (
    <a
      className="open-in-browser"
      href={url}
      onClick={(event) => {
        event.preventDefault();
        onOpenExternal(url);
      }}
    >
      <span className="open-in-browser-text">
        {appStrings.openInBrowser}
        <small className="open-in-browser-url">{url}</small>
      </span>
      <ExternalLinkIcon aria-hidden="true" />
    </a>
  );
}

/** A linked entry as a row: dot, name, what it does, arrow (DESIGN, related-link). */
function RelatedLink({
  target,
  slots,
  onOpen,
}: {
  target: EntryDto;
  slots: ReadonlyMap<string, number>;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="related-link"
      data-slot={entrySlot(target, slots) ?? undefined}
      title={target.name}
      onClick={() => onOpen(target.id)}
    >
      <i className="related-link-dot" aria-hidden="true" />
      <span className="related-link-text">
        <b className="related-link-name">{target.name}</b>
        <small className="related-link-context">{target.whatItDoes}</small>
      </span>
      <ArrowRight aria-hidden="true" className="related-link-arrow" />
    </button>
  );
}

/** One side list of linked entries; absent when it has none. */
function LinkList({
  label,
  targets,
  slots,
  onOpen,
}: {
  label: string;
  targets: readonly EntryDto[];
  slots: ReadonlyMap<string, number>;
  onOpen: (id: string) => void;
}) {
  if (targets.length === 0) return null;
  return (
    <section className="sheet-side-section">
      <h2 className="sheet-section-label">{label}</h2>
      <div className="related-links">
        {targets.map((target) => (
          <RelatedLink
            key={target.id}
            target={target}
            slots={slots}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function Rubric({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="title-block-rubric" data-wide={wide ? '' : undefined}>
      <small className="title-block-label">{label}</small>
      {children}
    </div>
  );
}

/** The corner block of the sheet (DESIGN, title-block); absent rubrics are left out. */
function TitleBlock({ entry }: { entry: EntryDto }) {
  // The rubrics before and after Id pair up in two columns; the last one of a
  // group with an odd count takes the whole row, so no cell stays empty.
  const before: { label: string; content: ReactNode }[] = [
    { label: appStrings.titleBlockZone, content: zoneLabels[entry.zone] },
  ];
  if (entry.resourceType !== null) {
    before.push({
      label: appStrings.titleBlockType,
      content: resourceTypeLabels[entry.resourceType],
    });
  }
  before.push({
    label: appStrings.titleBlockAdded,
    content: formatDate(entry.addedAt),
  });
  if (entry.verifiedAt !== null) {
    before.push({
      label: appStrings.titleBlockVerified,
      content: (
        <>
          {formatDate(entry.verifiedAt)}
          <Check aria-hidden="true" className="icon-sm title-block-check" />
        </>
      ),
    });
  }
  const after: { label: string; content: ReactNode }[] = [];
  if (entry.githubStars !== null) {
    after.push({
      label: appStrings.titleBlockStars,
      content: formatCompact(entry.githubStars),
    });
    if (entry.githubPushedAt !== null) {
      after.push({
        label: appStrings.titleBlockLastCommit,
        content: formatDate(entry.githubPushedAt),
      });
    }
  }
  const rubrics = (group: typeof before) =>
    group.map((rubric, index) => (
      <Rubric
        key={rubric.label}
        label={rubric.label}
        wide={group.length % 2 === 1 && index === group.length - 1}
      >
        {rubric.content}
      </Rubric>
    ));
  return (
    <div className="title-block" aria-label={appStrings.titleBlockLabel}>
      <div className="title-block-head">
        {appStrings.titleBlockHead(entry.kind)}
        <em>{appStrings.titleBlockRevision(entry.revision)}</em>
      </div>
      {rubrics(before)}
      <Rubric label={appStrings.titleBlockId} wide>
        {shortId(entry.id)}
      </Rubric>
      {rubrics(after)}
    </div>
  );
}

/**
 * The full entry, read-only (DESIGN, entry-sheet): everything of the entry
 * model in the main column, the links and the title block in the side panel.
 * Links open in the default browser through `onOpenExternal`, only when they
 * are http(s); the window itself never navigates (AD-9).
 */
export function EntrySheet({
  entry,
  entries,
  slots,
  pulses,
  onOpen,
  onOpenExternal,
}: EntrySheetProps) {
  const root = useRef<HTMLElement>(null);
  // What the entry had counted when the sheet opened does not pulse.
  const mountedPulses = useRef(pulses);
  // The sheet takes the focus, so the keyboard and screen readers are in it.
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);

  const links = sheetLinks(entry, entries);
  const [firstCategory] = entry.categories;
  const mark = (firstCategory?.name ?? entry.name).trim().charAt(0);
  const notes = entry.myNotes.trim() === '' ? null : entry.myNotes;

  return (
    <article
      ref={root}
      className="entry-sheet"
      tabIndex={-1}
      aria-label={appStrings.sheetLabel(entry.name)}
      data-slot={entrySlot(entry, slots) ?? undefined}
      data-pulse={pulseParity(pulses, mountedPulses.current)}
    >
      <div className="sheet-main">
        <header className="sheet-head">
          <div className="sheet-mark" aria-hidden="true">
            {mark.toLocaleUpperCase('ro')}
          </div>
          <div className="sheet-head-text">
            <h1 className="sheet-title">{entry.name}</h1>
            <div className="sheet-subline">
              {entry.url !== null && (
                <ExternalLink
                  href={entry.url}
                  onOpen={onOpenExternal}
                  className="sheet-url"
                >
                  {entry.url}
                </ExternalLink>
              )}
              {entry.resourceType !== null && (
                <span>{resourceTypeLabels[entry.resourceType]}</span>
              )}
              {entry.categories.map((category) => (
                <span
                  key={category.id}
                  className="sheet-category"
                  data-slot={slots.get(category.id) ?? undefined}
                >
                  <i className="sheet-category-dot" aria-hidden="true" />
                  {category.name}
                </span>
              ))}
            </div>
          </div>
        </header>
        {/* The one-column layout shows this copy under the title; the side panel's is hidden there. */}
        <OpenInBrowser url={entry.url} onOpenExternal={onOpenExternal} />
        <p className="sheet-lead">{entry.whatItDoes}</p>

        {entry.situations.length > 0 && (
          <section>
            <h2 className="sheet-section-label">
              {appStrings.sheetSituations(entry.kind, entry.situations.length)}
            </h2>
            <ol className="situation-callouts">
              {entry.situations.map((situation, index) => (
                <li key={index} className="situation-callout">
                  <b className="situation-callout-number">
                    {String(index + 1).padStart(2, '0')}
                  </b>
                  {situation}
                </li>
              ))}
            </ol>
          </section>
        )}

        {entry.content !== null && entry.content.trim() !== '' && (
          <section>
            <h2 className="sheet-section-label">{entryStrings.content}</h2>
            <MarkdownContent
              source={entry.content}
              onOpenExternal={onOpenExternal}
            />
          </section>
        )}

        {entry.sources.length > 0 && (
          <section>
            <h2 className="sheet-section-label">{entryStrings.sources}</h2>
            <ul className="sheet-sources">
              {entry.sources.map((source, index) => (
                <li key={index}>
                  <ExternalLink href={source} onOpen={onOpenExternal}>
                    {source}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.keywords.length > 0 && (
          <section>
            <h2 className="sheet-section-label">{entryStrings.keywords}</h2>
            <ul className="keyword-tags">
              {entry.keywords.map((keyword, index) => (
                <li key={index} className="keyword-tag">
                  {keyword}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="my-notes">
          <h2 className="my-notes-heading">
            <Pencil aria-hidden="true" />
            {entryStrings.myNotes}
          </h2>
          <p
            className="my-notes-text"
            data-empty={notes === null ? '' : undefined}
          >
            {notes ?? appStrings.notesPlaceholder}
          </p>
        </section>
      </div>

      <aside className="sheet-side">
        <OpenInBrowser url={entry.url} onOpenExternal={onOpenExternal} />
        <LinkList
          label={appStrings.sheetChildren(links.children.length)}
          targets={links.children}
          slots={slots}
          onOpen={onOpen}
        />
        <LinkList
          label={appStrings.sheetParents}
          targets={links.parents}
          slots={slots}
          onOpen={onOpen}
        />
        <LinkList
          label={appStrings.sheetRelated(links.related.length)}
          targets={links.related}
          slots={slots}
          onOpen={onOpen}
        />
        {entry.verificationNotes.length > 0 && (
          <section className="sheet-side-section verification-note">
            <h2 className="sheet-section-label">
              <Flag aria-hidden="true" className="icon-sm" />
              {entryStrings.verificationNotes}
            </h2>
            <ul className="verification-note-list">
              {entry.verificationNotes.map((reason, index) => (
                <li key={index}>
                  {reasonTexts[reason.code](reason.params ?? {})}
                </li>
              ))}
            </ul>
          </section>
        )}
        <TitleBlock entry={entry} />
      </aside>
    </article>
  );
}
