import type { RichText } from '../../shared/strings.ro';

// The toast queue (EXPERIENCE, toast): a framework-free external store, read
// through useSyncExternalStore, like the catalog store.

/** Most toasts on screen; a fourth pushes the oldest out. */
export const MAX_TOASTS = 3;

/** `arrival`: an import landed (stripe and small tape in the tape color). */
export type ToastKind = 'info' | 'error' | 'arrival';

/** Plain text, or text with parts in strong. */
export type ToastMessage = string | RichText;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastInput {
  kind: ToastKind;
  message: ToastMessage;
  action?: ToastAction;
}

export interface Toast extends ToastInput {
  id: number;
}

export interface ToastStore {
  /** Oldest first: the newest toast is the last, shown at the bottom. */
  getToasts(): readonly Toast[];
  subscribe(listener: () => void): () => void;
  push(input: ToastInput): number;
  dismiss(id: number): void;
  clear(): void;
}

export function createToastStore(): ToastStore {
  let toasts: readonly Toast[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();

  const set = (next: readonly Toast[]) => {
    toasts = next;
    for (const listener of listeners) listener();
  };

  return {
    getToasts: () => toasts,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push(input) {
      const id = nextId++;
      set([...toasts, { ...input, id }].slice(-MAX_TOASTS));
      return id;
    },
    dismiss(id) {
      if (toasts.some((toast) => toast.id === id)) {
        set(toasts.filter((toast) => toast.id !== id));
      }
    },
    clear() {
      if (toasts.length > 0) set([]);
    },
  };
}

/** The window's one toast queue. */
export const toasts: ToastStore = createToastStore();

/** Shows an error toast on the window's queue. */
export function toastError(message: ToastMessage): number {
  return toasts.push({ kind: 'error', message });
}
