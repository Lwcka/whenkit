import { CornerDownLeft, Flag, Star } from 'lucide-react';
import type { EntryDto } from '../../shared/ipc';
import {
  appStrings,
  entryStrings,
  kindLabels,
  resourceTypeLabels,
} from '../../shared/strings.ro';
import { cardHost } from './catalog-view';
import './entry-card.css';

/** How many situations a card lists: two in Toolbox, one in Learn. */
const SITUATIONS_SHOWN = { toolbox: 2, learn: 1 } as const;

export interface EntryCardProps {
  entry: EntryDto;
  /** The color slot of the entry's first category. */
  slot: number | null;
  /** Position in the grid: the category tab alternates over three places. */
  index: number;
  tabIndex: 0 | -1;
  onFocus?: () => void;
  /**
   * The text of the arrival tape („Adăugat · acum 3 s”); present only while
   * the entry is a fresh arrival, which also gives the card its ring.
   */
  tape?: string;
  /**
   * Set when an update from the terminal landed. The parity of the store's
   * counter: a change of value restarts the pulse.
   */
  pulse?: 'a' | 'b';
}

function Meta({ entry }: { entry: EntryDto }) {
  const umbrella = entry.kind === 'concept' && entry.childIds.length > 0;
  const host = umbrella ? null : cardHost(entry.url);
  // Without host, type or children the row stays empty but keeps its height.
  return (
    <div className="entry-card-meta">
      {umbrella && (
        <span className="entry-card-host">
          {appStrings.umbrella(entry.childIds.length)}
        </span>
      )}
      {host !== null && <span className="entry-card-host">{host}</span>}
      {entry.resourceType !== null && (
        <span className="entry-card-type">
          {resourceTypeLabels[entry.resourceType]}
        </span>
      )}
    </div>
  );
}

function Footer({ entry, hidden }: { entry: EntryDto; hidden: number }) {
  // Categories arrive sorted by name_key: the first one names the card.
  const [first] = entry.categories;
  const flagged = entry.verificationNotes.length > 0;
  const stars =
    entry.githubStars === null
      ? null
      : appStrings.githubStats(entry.githubStars, entry.githubPushedAt);
  return (
    <footer className="entry-card-footer">
      {first !== undefined && (
        <>
          <i className="entry-card-footer-dot" aria-hidden="true" />
          <span className="entry-card-category">{first.name}</span>{' '}
          {entry.categories.length > 1 && (
            <span className="entry-card-more-categories">
              {appStrings.moreCategories(entry.categories.length - 1)}
            </span>
          )}
        </>
      )}
      <span className="entry-card-footer-meta">
        {flagged && (
          <span className="verification-flag">
            <Flag aria-hidden="true" className="icon-sm" />
            {appStrings.verificationFlag}
          </span>
        )}
        {stars !== null && (
          <span className="entry-card-stars">
            <Star aria-hidden="true" className="icon-sm" />
            {stars}
          </span>
        )}
        {hidden > 0 && (
          <span className="entry-card-more-situations">
            {appStrings.moreSituations(hidden)}
          </span>
        )}
      </span>
    </footer>
  );
}

/**
 * The card of an entry (DESIGN, entry-card). It is a button named by the
 * entry; opening the sheet comes later, so for now it only takes focus, and
 * the selected look shows when the focus came from the keyboard.
 */
export function EntryCard({
  entry,
  slot,
  index,
  tabIndex,
  onFocus,
  tape,
  pulse,
}: EntryCardProps) {
  const shown = SITUATIONS_SHOWN[entry.zone];
  const situations = entry.situations.slice(0, shown);
  return (
    <div
      className="entry-card"
      role="button"
      tabIndex={tabIndex}
      aria-label={entry.name}
      data-zone={entry.zone}
      data-tab={index % 3}
      data-slot={slot ?? undefined}
      data-new={tape === undefined ? undefined : ''}
      data-pulse={pulse}
      onFocus={onFocus}
    >
      {tape !== undefined && (
        <span className="arrival-tape" aria-hidden="true">
          {tape}
        </span>
      )}
      <i className="entry-card-crop" data-corner="start" aria-hidden="true" />
      <i className="entry-card-crop" data-corner="end" aria-hidden="true" />
      <span className="entry-card-hint" aria-hidden="true">
        {appStrings.cardHintKey}
        <CornerDownLeft className="icon-sm" />
        {appStrings.cardHintAction}
      </span>
      <Meta entry={entry} />
      {entry.zone === 'learn' && (
        <span className="kind-stamp" data-kind={entry.kind}>
          {kindLabels[entry.kind]}
        </span>
      )}
      <h3 className="entry-card-title">{entry.name}</h3>
      <p className="entry-card-body">{entry.whatItDoes}</p>
      {situations.length > 0 && (
        <>
          {entry.zone === 'toolbox' && (
            <span className="entry-card-situations-label">
              {entryStrings.situations(entry.kind)}
            </span>
          )}
          <ul className="entry-card-situations">
            {situations.map((situation, position) => (
              <li key={position} className="situation-item">
                {situation}
              </li>
            ))}
          </ul>
        </>
      )}
      <Footer entry={entry} hidden={entry.situations.length - shown} />
    </div>
  );
}

/** The shape of a card with bars instead of text; no animation. */
export function EntryCardSkeleton() {
  return (
    <div className="entry-card-skeleton" aria-hidden="true">
      <span className="entry-card-skeleton-bar" data-bar="meta" />
      <span className="entry-card-skeleton-bar" data-bar="title" />
      <span className="entry-card-skeleton-bar" data-bar="line" />
      <span className="entry-card-skeleton-bar" data-bar="short" />
      <span className="entry-card-skeleton-bar" data-bar="situation" />
    </div>
  );
}
