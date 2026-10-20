import { Pencil } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { IpcResult, WriteResult } from '../../shared/ipc';
import { appStrings, entryStrings } from '../../shared/strings.ro';
import { registerNotesFlush } from './notes-flush';
import './my-notes.css';

/** DESIGN motion.notes-autosave (600 ms), mirrored from tokens.css for the timer. */
export const NOTES_AUTOSAVE_MS = 600;
/** DESIGN motion.saved-min-visible (800 ms), mirrored from tokens.css for the timer. */
export const SAVED_MIN_VISIBLE_MS = 800;
/** How long a failed save waits before it is tried again (EXPERIENCE: reîncercare automată). */
export const NOTES_RETRY_MS = 3000;

/** What the right side of the header shows. */
type SaveStatus = 'hint' | 'saving' | 'saved' | 'error';

const STATUS_TEXT: Record<SaveStatus, string> = {
  hint: appStrings.notesHint,
  saving: appStrings.notesSaving,
  saved: appStrings.notesSaved,
  error: appStrings.notesSaveFailed,
};

export interface MyNotesProps {
  /** The entry the notes belong to; the sheet keys this component by it. */
  entryId: string;
  /** The notes as the store holds them now. */
  notes: string;
  /** Saves the notes through the store's `write` (AD-10, AD-16). */
  onSave: (id: string, notes: string) => Promise<IpcResult<WriteResult>>;
}

type Timer = ReturnType<typeof setTimeout> | undefined;

/**
 * „Notițele mele” (DESIGN my-notes, EXPERIENCE my-notes): plain text, always
 * editable, no save button. It saves after a pause, on blur, when the sheet
 * goes away and when the window closes (`notes-flush.ts`, AD-20). A failed
 * save keeps the text and is tried again every few seconds. While the field
 * has focus or a save is pending, a refresh of the entry does not replace the
 * local text.
 */
export function MyNotes({ entryId, notes, onSave }: MyNotesProps) {
  const headingId = useId();
  const [text, setText] = useState(notes);
  const [status, setStatus] = useState<SaveStatus>('hint');
  const [focused, setFocused] = useState(false);

  // What the timers and the unmount cleanup read: always the latest values.
  const textRef = useRef(notes);
  const lastSaved = useRef(notes);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(false);
  const autosaveTimer = useRef<Timer>(undefined);
  const retryTimer = useRef<Timer>(undefined);
  const savedTimer = useRef<Timer>(undefined);
  const onSaveRef = useRef(onSave);
  const entryIdRef = useRef(entryId);
  useEffect(() => {
    onSaveRef.current = onSave;
    entryIdRef.current = entryId;
  });

  // What removes this field from the window's flush registry (notes-flush.ts).
  const unregisterFlush = useRef<(() => void) | undefined>(undefined);

  // A field that is gone has nothing to show: no state is set after unmount.
  const showStatus = (next: (current: SaveStatus) => SaveStatus) => {
    if (mounted.current) setStatus(next);
  };
  // After unmount the field stays registered until its last write settles, so
  // closing the window still flushes a save that is being retried.
  const settled = () => {
    if (mounted.current) return;
    unregisterFlush.current?.();
    unregisterFlush.current = undefined;
  };

  const isPending = () =>
    textRef.current !== lastSaved.current || inFlight.current !== null;

  // Saves what is typed now. Resolves once the attempt is over (saved, failed
  // or nothing to save), so the window can wait for it when it closes.
  const save: () => Promise<void> = useCallback(async () => {
    clearTimeout(autosaveTimer.current);
    clearTimeout(retryTimer.current);
    // One write at a time; the next one starts from what was typed since.
    while (inFlight.current !== null) await inFlight.current;
    const toSave = textRef.current;
    if (toSave === lastSaved.current) {
      showStatus((current) =>
        current === 'error' || current === 'saving' ? 'hint' : current,
      );
      settled();
      return;
    }
    const run = (async () => {
      clearTimeout(savedTimer.current);
      showStatus(() => 'saving');
      let result: IpcResult<WriteResult>;
      try {
        result = await onSaveRef.current(entryIdRef.current, toSave);
      } catch {
        result = { ok: false, error: { code: 'INTERNAL' } };
      }
      if (result.ok) {
        lastSaved.current = toSave;
        if (textRef.current !== toSave) {
          // Typed during the save: that text has its own turn.
          if (mounted.current) {
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = setTimeout(
              () => void save(),
              NOTES_AUTOSAVE_MS,
            );
          }
          return;
        }
        if (mounted.current) {
          setStatus('saved');
          savedTimer.current = setTimeout(
            () =>
              setStatus((current) => (current === 'saved' ? 'hint' : current)),
            SAVED_MIN_VISIBLE_MS,
          );
        }
        settled();
        return;
      }
      showStatus(() => 'error');
      // The text is kept and tried again, also after the field is gone; an
      // entry that vanished will not come back, so that ends the retries.
      if (result.error.code === 'ENTRY_NOT_FOUND') {
        settled();
      } else {
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void save(), NOTES_RETRY_MS);
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      if (inFlight.current === run) inFlight.current = null;
    }
  }, []);

  // Registered while mounted, so closing the window saves what is pending. On
  // unmount (Esc, a related link, a zone switch) the pending text is saved at
  // once, and a failed save keeps being retried (no state is set any more).
  useEffect(() => {
    mounted.current = true;
    unregisterFlush.current = registerNotesFlush(save);
    return () => {
      mounted.current = false;
      clearTimeout(autosaveTimer.current);
      clearTimeout(retryTimer.current);
      clearTimeout(savedTimer.current);
      // Pending text is saved at once and retried until it works; the field
      // leaves the registry when that is over (or right now if nothing is).
      if (isPending()) void save();
      else settled();
    };
  }, [save]);

  // A refresh of the entry shows its notes only while the field is idle.
  useEffect(() => {
    if (focused || isPending()) return;
    textRef.current = notes;
    lastSaved.current = notes;
    setText(notes);
  }, [notes, focused]);

  return (
    <section className="my-notes" data-status={status}>
      <div className="my-notes-head">
        <h2 id={headingId} className="my-notes-heading">
          <Pencil aria-hidden="true" />
          {entryStrings.myNotes}
        </h2>
        <small className="my-notes-status" role="status">
          <span key={status} className="my-notes-status-text">
            {STATUS_TEXT[status]}
          </span>
        </small>
      </div>
      <textarea
        className="my-notes-field"
        aria-labelledby={headingId}
        placeholder={appStrings.notesPlaceholder}
        rows={3}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          void save();
        }}
        onChange={(event) => {
          const value = event.target.value;
          textRef.current = value;
          setText(value);
          clearTimeout(autosaveTimer.current);
          if (value === lastSaved.current) {
            // Back to what is saved: no write is coming, so "Se salvează…"
            // must not stay when nothing is in flight.
            if (inFlight.current === null) {
              setStatus((current) => (current === 'saving' ? 'hint' : current));
            }
          } else {
            autosaveTimer.current = setTimeout(
              () => void save(),
              NOTES_AUTOSAVE_MS,
            );
          }
        }}
      />
    </section>
  );
}
