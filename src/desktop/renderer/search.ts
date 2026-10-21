import { useEffect, useRef, useState } from 'react';
import type { EntryDto, WhenkitApi } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { toastError } from './toast-store';

/** DESIGN motion.search-debounce (150 ms), mirrored from tokens.css for the timer. */
export const SEARCH_DEBOUNCE_MS = 150;

/** What the search found: the ids (both zones, snapshot order) of one query. */
export interface SearchHits {
  /** The trimmed text these ids answer; the header names it. */
  query: string;
  ids: readonly string[];
}

/**
 * The search of the window (AD-10). The ids are a view parameter, not catalog
 * data, so they live here and not in the catalog store.
 *
 * - A new text is asked for after `SEARCH_DEBOUNCE_MS` without typing; a new
 *   snapshot (`entries` changed) asks again at once, so an arrival that
 *   matches lands in the results.
 * - Only the latest question counts: an answer to an older one is dropped.
 * - Blank text clears at once (`null`). Until the first answer arrives there
 *   is nothing to show, and a failed search keeps the last results and shows
 *   an error toast.
 */
export function useSearch(
  api: Pick<WhenkitApi, 'searchEntries'>,
  text: string,
  entries: readonly EntryDto[],
): SearchHits | null {
  const [found, setFound] = useState<SearchHits | null>(null);
  const latest = useRef(0);
  const askedFor = useRef('');
  const query = text.trim();

  useEffect(() => {
    const question = ++latest.current;
    if (query === '') {
      askedFor.current = '';
      setFound(null);
      return undefined;
    }
    const run = () => {
      void api.searchEntries(query).then(
        (result) => {
          if (question !== latest.current) return;
          if (result.ok) {
            setFound({ query, ids: result.data.ids });
          } else {
            toastError(appStrings.searchFailed);
          }
        },
        () => {
          if (question !== latest.current) return;
          toastError(appStrings.searchFailed);
        },
      );
    };
    // A changed text waits for a pause in typing; the same text asked again
    // (new entries) does not.
    if (askedFor.current === query) {
      run();
      return undefined;
    }
    askedFor.current = query;
    const timer = setTimeout(run, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [api, query, entries]);

  return query === '' ? null : found;
}
