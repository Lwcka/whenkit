// The renderer's one keyboard layer (EXPERIENCE, Interaction Primitives).
// Bindings go by the physical key (`event.code`), not the character, so they
// work on the Romanian keyboard, where `[` and `]` produce „ă” and „î”.

/** The zoom steps of the whole interface (EXPERIENCE: 80–200%). */
export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
const ZOOM_DEFAULT_INDEX = ZOOM_STEPS.indexOf(1);

export interface Zoom {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** The factor applied now. */
  factor(): number;
}

/** Steps through ZOOM_STEPS, clamped at the ends; `apply` sets the factor. */
export function createZoom(apply: (factor: number) => void): Zoom {
  let index = ZOOM_DEFAULT_INDEX;
  const move = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), ZOOM_STEPS.length - 1);
    if (clamped === index) return;
    index = clamped;
    apply(ZOOM_STEPS[index] ?? 1);
  };
  return {
    zoomIn: () => move(index + 1),
    zoomOut: () => move(index - 1),
    // Always applies: after a reload Chromium may still hold the old zoom
    // while this index is back at 100%.
    reset: () => {
      index = ZOOM_DEFAULT_INDEX;
      apply(1);
    },
    factor: () => ZOOM_STEPS[index] ?? 1,
  };
}

/** True when Ctrl, Alt, Meta or Shift is held: a plain key press has none. */
export function hasModifier(event: {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

export interface Binding {
  /** `event.code` value(s), e.g. `Digit1` or `['Equal', 'NumpadAdd']`. */
  code: string | readonly string[];
  /** Ctrl and Alt must match exactly (absent = not pressed); Shift only when given. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  run: (event: KeyboardEvent) => void;
  /** The binding applies only while this is true (the context). */
  when?: () => boolean;
  /** Keeps working while a dialog is open (zoom); the others are muted. */
  allowInDialog?: boolean;
}

/** Esc priorities, highest first: the first active one is the only one that runs. */
export const ESCAPE_PRIORITY = {
  /** The rename row of the category manager: Esc cancels only the rename. */
  renaming: 6,
  dialog: 5,
  editing: 4,
  searchWithText: 3,
  openSheet: 2,
  activeSearch: 1,
} as const;

interface EscapeHandler {
  priority: number;
  isActive: () => boolean;
  run: () => void;
}

const escapeHandlers = new Set<EscapeHandler>();

/**
 * Registers an Esc handler. When Esc is pressed, only the active handler with
 * the highest priority runs; with none active, nothing happens. Returns the
 * function that unregisters it.
 */
export function registerEscape(
  priority: number,
  isActive: () => boolean,
  run: () => void,
): () => void {
  const handler: EscapeHandler = { priority, isActive, run };
  escapeHandlers.add(handler);
  return () => {
    escapeHandlers.delete(handler);
  };
}

function runEscape(event: KeyboardEvent): void {
  let best: EscapeHandler | undefined;
  for (const handler of escapeHandlers) {
    if (!handler.isActive()) continue;
    if (best === undefined || handler.priority > best.priority) best = handler;
  }
  if (best === undefined) return;
  event.preventDefault();
  best.run();
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when typing goes into the element: single keys must not fire there. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (TEXT_TAGS.has(target.tagName)) return true;
  // jsdom has no isContentEditable; the attribute covers it.
  const attribute = target.getAttribute('contenteditable');
  return (
    target.isContentEditable === true ||
    (attribute !== null && attribute !== 'false')
  );
}

/** True while a modal dialog is on screen: the keys behind it must stay quiet. */
export function isDialogOpen(target: Document): boolean {
  return target.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

function matches(binding: Binding, event: KeyboardEvent): boolean {
  const codes =
    typeof binding.code === 'string' ? [binding.code] : binding.code;
  return (
    codes.includes(event.code) &&
    !event.metaKey &&
    event.ctrlKey === (binding.ctrl ?? false) &&
    event.altKey === (binding.alt ?? false) &&
    (binding.shift === undefined || event.shiftKey === binding.shift)
  );
}

/**
 * Installs the single `keydown` listener. Esc goes to the priority dispatcher
 * (it fires in text fields too); a binding without Ctrl or Alt is a single key
 * and does not fire while focus is in a text field. While a dialog is open only
 * the bindings marked `allowInDialog` fire. Returns the uninstaller.
 */
export function installKeyboard(
  bindings: readonly Binding[],
  target: Document = document,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      runEscape(event);
      return;
    }
    for (const binding of bindings) {
      if (!matches(binding, event)) continue;
      if (binding.allowInDialog !== true && isDialogOpen(target)) continue;
      const singleKey = binding.ctrl !== true && binding.alt !== true;
      if (singleKey && isTextField(event.target)) continue;
      if (binding.when !== undefined && !binding.when()) continue;
      event.preventDefault();
      binding.run(event);
      return;
    }
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

/**
 * The frame's bindings: Ctrl+1/2 switch zones, Ctrl+K and Ctrl+F focus the
 * search box (from anywhere, also from a text field), Ctrl+= / − / 0 zoom
 * (also numpad), [ and ] move to the previous / next category (single keys:
 * they do nothing in a text field), Alt+← goes back one sheet while one is
 * open (it also works in a text field), Delete asks to delete the sheet on
 * screen (a single key too), E opens the sheet on screen in edit mode (a
 * single key), and Ctrl+S saves the edit (also from a text field). While an
 * entry is edited, everything that would leave the form is inactive.
 */
export function frameBindings({
  selectZone,
  zoom,
  moveCategory,
  focusSearch,
  back,
  sheetOpen,
  requestDelete,
  editing,
  startEdit,
  save,
}: {
  selectZone: (index: 0 | 1) => void;
  zoom: Zoom;
  moveCategory: (delta: -1 | 1) => void;
  focusSearch: () => void;
  back: () => void;
  sheetOpen: () => boolean;
  requestDelete: () => void;
  /** An entry is being edited. */
  editing: () => boolean;
  startEdit: () => void;
  save: () => void;
}): Binding[] {
  const reading = () => sheetOpen() && !editing();
  return [
    { code: ['KeyK', 'KeyF'], ctrl: true, run: () => focusSearch() },
    { code: 'BracketLeft', shift: false, run: () => moveCategory(-1) },
    { code: 'BracketRight', shift: false, run: () => moveCategory(1) },
    { code: 'ArrowLeft', alt: true, when: reading, run: () => back() },
    {
      code: 'Delete',
      shift: false,
      when: reading,
      run: () => requestDelete(),
    },
    { code: 'KeyE', shift: false, when: reading, run: () => startEdit() },
    { code: 'KeyS', ctrl: true, when: editing, run: () => save() },
    {
      code: 'Digit1',
      ctrl: true,
      when: () => !editing(),
      run: () => selectZone(0),
    },
    {
      code: 'Digit2',
      ctrl: true,
      when: () => !editing(),
      run: () => selectZone(1),
    },
    {
      code: ['Equal', 'NumpadAdd'],
      ctrl: true,
      allowInDialog: true,
      run: () => zoom.zoomIn(),
    },
    {
      code: ['Minus', 'NumpadSubtract'],
      ctrl: true,
      allowInDialog: true,
      run: () => zoom.zoomOut(),
    },
    {
      code: ['Digit0', 'Numpad0'],
      ctrl: true,
      allowInDialog: true,
      run: () => zoom.reset(),
    },
  ];
}
