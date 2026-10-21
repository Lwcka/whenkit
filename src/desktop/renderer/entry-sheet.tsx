import {
  ArrowRight,
  Check,
  ExternalLink as ExternalLinkIcon,
  Flag,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  isExternalUrl,
  type CategoryDto,
  type EntryDto,
} from '../../shared/ipc';
import {
  appStrings,
  entryStrings,
  formatCompact,
  formatDate,
  reasonTexts,
  resourceTypeLabels,
  rowNumber,
  zoneLabels,
} from '../../shared/strings.ro';
import { entrySlot, pulseParity, sheetLinks, shortId } from './catalog-view';
import type { Draft, FieldErrors } from './edit-draft';
import { EntryEditForm } from './entry-edit-form';
import { ExternalLink } from './external-link';
import { MarkdownContent } from './markdown-content';
import { MyNotes, type MyNotesProps } from './my-notes';
import './entry-sheet.css';

/** The edit mode of the sheet: the form takes the place of the main column's fields. */
export interface SheetEdit {
  draft: Draft;
  /** The user changed these fields of the draft. */
  onChange: (changes: Partial<Draft>) => void;
  errors: FieldErrors;
  /** A save is running: the form is locked. */
  locked: boolean;
  /** The categories of the entry's zone. */
  categories: readonly CategoryDto[];
}

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
  /** Saves the author's notes of an entry (AD-16); the store applies the answer. */
  onSaveNotes: MyNotesProps['onSave'];
  /** Present while the entry is edited. */
  edit?: SheetEdit;
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
  disabled,
}: {
  target: EntryDto;
  slots: ReadonlyMap<string, number>;
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="related-link"
      data-slot={entrySlot(target, slots) ?? undefined}
      title={target.name}
      disabled={disabled}
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
  disabled,
}: {
  label: string;
  targets: readonly EntryDto[];
  slots: ReadonlyMap<string, number>;
  onOpen: (id: string) => void;
  disabled: boolean;
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
            disabled={disabled}
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
 * The full entry (DESIGN, entry-sheet): everything of the entry model in the
 * main column, the links and the title block in the side panel. In reading
 * only „Notițele mele” can be edited here, directly (`MyNotes`); with `edit`
 * the fields Claude writes become a form, and the notes and the side panel
 * stay as they are (the links in it are inactive).
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
  onSaveNotes,
  edit,
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
        {edit !== undefined ? (
          <EntryEditForm
            kind={entry.kind}
            mark={mark.toLocaleUpperCase('ro')}
            draft={edit.draft}
            onChange={edit.onChange}
            errors={edit.errors}
            locked={edit.locked}
            categories={edit.categories}
            slots={slots}
          />
        ) : (
          <>
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
                  {appStrings.sheetSituations(
                    entry.kind,
                    entry.situations.length,
                  )}
                </h2>
                <ol className="situation-callouts">
                  {entry.situations.map((situation, index) => (
                    <li key={index} className="situation-callout">
                      <b className="situation-callout-number">
                        {rowNumber(index)}
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
          </>
        )}

        <MyNotes
          key={entry.id}
          entryId={entry.id}
          notes={entry.myNotes}
          onSave={onSaveNotes}
        />
      </div>

      <aside className="sheet-side">
        <OpenInBrowser url={entry.url} onOpenExternal={onOpenExternal} />
        <LinkList
          label={appStrings.sheetChildren(links.children.length)}
          targets={links.children}
          slots={slots}
          onOpen={onOpen}
          disabled={edit !== undefined}
        />
        <LinkList
          label={appStrings.sheetParents}
          targets={links.parents}
          slots={slots}
          onOpen={onOpen}
          disabled={edit !== undefined}
        />
        <LinkList
          label={appStrings.sheetRelated(links.related.length)}
          targets={links.related}
          slots={slots}
          onOpen={onOpen}
          disabled={edit !== undefined}
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
