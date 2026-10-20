import { X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { appStrings } from '../../shared/strings.ro';
import { Button } from './button';
import './toast.css';
import {
  toasts,
  type Toast,
  type ToastMessage,
  type ToastStore,
} from './toast-store';

/** DESIGN motion.toast-dwell (6 s), mirrored from tokens.css for the timer. */
export const TOAST_DWELL_MS = 6000;
/** DESIGN motion.fade (200 ms): how long a leaving toast fades before it goes. */
export const TOAST_FADE_MS = 200;

function Message({ message }: { message: ToastMessage }) {
  if (typeof message === 'string') return message;
  return message.map((part, index) =>
    typeof part === 'string' ? part : <b key={index}>{part.strong}</b>,
  );
}

function ToastCard({ toast, store }: { toast: Toast; store: ToastStore }) {
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(TOAST_DWELL_MS);

  // The dwell time runs while the mouse is away. Hovering pauses it; leaving
  // resumes with what was left, not with a full dwell.
  useEffect(() => {
    if (hovered || leaving) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - startedAt),
      );
    };
  }, [hovered, leaving]);

  // A toast leaves by fading; only then does the store drop it. (A timer, not
  // animationend: the duration is 0 when animations are off.)
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => store.dismiss(toast.id), TOAST_FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, store, toast.id]);

  const dismiss = () => setLeaving(true);
  return (
    <div
      className="toast"
      data-kind={toast.kind}
      data-leaving={leaving ? '' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {toast.kind === 'arrival' && (
        <span className="toast-tape">{appStrings.arrivalToastTape}</span>
      )}
      <div className="toast-body">
        <p className="toast-message">
          <Message message={toast.message} />
        </p>
        {toast.action !== undefined && (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              toast.action?.run();
              dismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        iconOnly
        icon={X}
        title={appStrings.toastClose}
        className="toast-close"
        onClick={dismiss}
      />
    </div>
  );
}

/**
 * The stack in the bottom-right corner, above the status bar: oldest first,
 * so the newest sits at the bottom. It never takes focus.
 */
export function ToastHost({ store = toasts }: { store?: ToastStore }) {
  const list = useSyncExternalStore(store.subscribe, store.getToasts);
  return (
    <div
      className="toast-host"
      aria-live="polite"
      aria-label={appStrings.toastsLabel}
    >
      {list.map((toast) => (
        <ToastCard key={toast.id} toast={toast} store={store} />
      ))}
    </div>
  );
}
