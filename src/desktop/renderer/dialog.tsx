import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ESCAPE_PRIORITY, registerEscape } from './keyboard';
import './dialog.css';

export interface DialogProps {
  /** The headline; it names the dialog for assistive technology. */
  title: string;
  /** The body under the title; it describes the dialog. Its own markup (a `<p className="dialog-body">`, sections, a select). */
  children: ReactNode;
  /** The buttons, right-aligned; the default one (the one that does not destroy) first. */
  actions: ReactNode;
  /** Esc closes the dialog like its „Renunță” button does. */
  onCancel: () => void;
  /** The width: `confirm` is the small confirmation; wider sizes are added with their users. */
  size?: 'confirm';
  /** What takes the focus when the dialog opens; the first button when absent. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog (DESIGN, dialog; EXPERIENCE, dialog): a scrim under the title
 * bar, so the window can still be dragged, and a sheet that opens with the
 * fade and the enter scale. Tab cycles inside it, Esc calls `onCancel`, and on
 * close the focus goes back to the element that had it when the dialog opened.
 * Clicking the scrim does nothing. It is a plain element in a portal, not the
 * native `<dialog>`: the title-bar drag region and jsdom make that one
 * unpredictable.
 */
export function Dialog({
  title,
  children,
  actions,
  onCancel,
  size = 'confirm',
  initialFocusRef,
}: DialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // The Esc handler is registered once and calls through a ref.
  const cancelNow = useRef(onCancel);
  useEffect(() => {
    cancelNow.current = onCancel;
  });
  useEffect(
    () =>
      registerEscape(
        ESCAPE_PRIORITY.dialog,
        () => true,
        () => cancelNow.current(),
      ),
    [],
  );

  // The focus goes in on open and back to the opener on close.
  useLayoutEffect(() => {
    const opener = document.activeElement;
    const root = dialog.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
    (initialFocusRef?.current ?? first ?? root)?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    // Only on open and close; the ref is read once.
  }, []);

  // Tab and Shift+Tab cycle between the dialog's buttons. The listener sits on
  // the document: a button that turned disabled drops the focus on <body>,
  // where a handler on the dialog would never see the key.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Tab' || event.ctrlKey || event.altKey) return;
      const root = dialog.current;
      if (root === null) return;
      const stops = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      event.preventDefault();
      if (stops.length === 0) return;
      const at = stops.findIndex((stop) => stop === document.activeElement);
      const step = event.shiftKey ? -1 : 1;
      const next =
        at < 0
          ? event.shiftKey
            ? stops.length - 1
            : 0
          : (at + step + stops.length) % stops.length;
      stops[next]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return createPortal(
    <div className="dialog-scrim">
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-size={size}
        tabIndex={-1}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <div id={bodyId} className="dialog-content">
          {children}
        </div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
