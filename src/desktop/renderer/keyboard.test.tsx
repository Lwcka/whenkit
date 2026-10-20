import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCAPE_PRIORITY,
  ZOOM_STEPS,
  createZoom,
  frameBindings,
  installKeyboard,
  registerEscape,
} from './keyboard';

// jsdom: the keyboard layer is covered against real DOM events.

let uninstall: (() => void) | undefined;
let cleanups: (() => void)[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
});

function press(
  code: string,
  init: KeyboardEventInit = {},
  target: Element | Document = document,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('single-key bindings', () => {
  it.each([
    ['input', () => document.createElement('input')],
    ['textarea', () => document.createElement('textarea')],
    [
      'contenteditable',
      () => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        return div;
      },
    ],
  ])('do not fire while focus is in %s', (_name, make) => {
    const run = vi.fn();
    uninstall = installKeyboard([
      { code: 'KeyE', run },
      { code: 'BracketLeft', run },
      { code: 'BracketRight', run },
      { code: 'Delete', run },
    ]);
    const field = make();
    document.body.append(field);

    for (const code of ['KeyE', 'BracketLeft', 'BracketRight', 'Delete']) {
      press(code, {}, field);
    }
    expect(run).not.toHaveBeenCalled();

    press('KeyE', {}, document.body);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('still fire Ctrl combinations in a text field', () => {
    const run = vi.fn();
    uninstall = installKeyboard([{ code: 'KeyS', ctrl: true, run }]);
    const input = document.createElement('input');
    document.body.append(input);

    press('KeyS', { ctrlKey: true }, input);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('match the physical key and the exact Ctrl/Alt state', () => {
    const run = vi.fn();
    uninstall = installKeyboard([{ code: 'Digit1', ctrl: true, run }]);

    press('Digit1');
    press('Digit1', { ctrlKey: true, altKey: true });
    press('Digit2', { ctrlKey: true });
    expect(run).not.toHaveBeenCalled();

    press('Digit1', { ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('respect `when`', () => {
    let active = false;
    const run = vi.fn();
    uninstall = installKeyboard([{ code: 'KeyE', run, when: () => active }]);

    press('KeyE');
    expect(run).not.toHaveBeenCalled();
    active = true;
    press('KeyE');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('Esc priority', () => {
  it('runs only the highest active handler', () => {
    uninstall = installKeyboard([]);
    const ran: string[] = [];
    const handler = (name: string, priority: number, active = true) =>
      cleanups.push(
        registerEscape(
          priority,
          () => active,
          () => ran.push(name),
        ),
      );
    handler('activeSearch', ESCAPE_PRIORITY.activeSearch);
    handler('openSheet', ESCAPE_PRIORITY.openSheet);
    handler('searchWithText', ESCAPE_PRIORITY.searchWithText);
    handler('editing', ESCAPE_PRIORITY.editing);
    handler('dialog', ESCAPE_PRIORITY.dialog, false);

    press('Escape');
    expect(ran).toEqual(['editing']);
  });

  it('keeps the order dialog > editing > search text > sheet > search', () => {
    expect(ESCAPE_PRIORITY.dialog).toBeGreaterThan(ESCAPE_PRIORITY.editing);
    expect(ESCAPE_PRIORITY.editing).toBeGreaterThan(
      ESCAPE_PRIORITY.searchWithText,
    );
    expect(ESCAPE_PRIORITY.searchWithText).toBeGreaterThan(
      ESCAPE_PRIORITY.openSheet,
    );
    expect(ESCAPE_PRIORITY.openSheet).toBeGreaterThan(
      ESCAPE_PRIORITY.activeSearch,
    );
  });

  it('does nothing when no handler is active', () => {
    uninstall = installKeyboard([]);
    const run = vi.fn();
    cleanups.push(registerEscape(1, () => false, run));

    const event = press('Escape');
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('fires in a text field', () => {
    uninstall = installKeyboard([]);
    const run = vi.fn();
    cleanups.push(registerEscape(1, () => true, run));
    const input = document.createElement('input');
    document.body.append(input);

    press('Escape', {}, input);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops running after it is unregistered', () => {
    uninstall = installKeyboard([]);
    const run = vi.fn();
    const unregister = registerEscape(1, () => true, run);
    unregister();

    press('Escape');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('zoom', () => {
  it('has the eight steps of 80-200%', () => {
    expect([...ZOOM_STEPS]).toEqual([0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);
  });

  it('steps in and out, clamped at the ends', () => {
    const applied: number[] = [];
    const zoom = createZoom((factor) => applied.push(factor));

    for (let i = 0; i < 8; i++) zoom.zoomIn();
    expect(applied).toEqual([1.1, 1.25, 1.5, 1.75, 2]);
    expect(zoom.factor()).toBe(2);

    applied.length = 0;
    for (let i = 0; i < 8; i++) zoom.zoomOut();
    expect(applied).toEqual([1.75, 1.5, 1.25, 1.1, 1, 0.9, 0.8]);
    expect(zoom.factor()).toBe(0.8);
  });

  it('resets to 100%', () => {
    const applied: number[] = [];
    const zoom = createZoom((factor) => applied.push(factor));
    zoom.zoomIn();
    zoom.zoomIn();
    zoom.reset();
    expect(applied).toEqual([1.1, 1.25, 1]);
  });

  it('reset always applies 100%, even when the index is already there', () => {
    // After a renderer reload Chromium may keep the old zoom while the index
    // is back at 100%: Ctrl+0 must still set the factor.
    const applied: number[] = [];
    const zoom = createZoom((factor) => applied.push(factor));
    zoom.reset();
    expect(applied).toEqual([1]);
    expect(zoom.factor()).toBe(1);
  });

  it('is driven by Ctrl+=, Ctrl+-, Ctrl+0 and the numpad', () => {
    const applied: number[] = [];
    const zoom = createZoom((factor) => applied.push(factor));
    uninstall = installKeyboard(
      frameBindings({
        selectZone: () => {},
        zoom,
        moveCategory: () => {},
        focusSearch: () => {},
      }),
    );

    press('Equal', { ctrlKey: true });
    press('NumpadAdd', { ctrlKey: true });
    press('Minus', { ctrlKey: true });
    press('NumpadSubtract', { ctrlKey: true });
    press('Equal', { ctrlKey: true });
    press('Digit0', { ctrlKey: true });
    press('Equal', { ctrlKey: true });
    press('Numpad0', { ctrlKey: true });
    press('Equal'); // without Ctrl: nothing
    expect(applied).toEqual([1.1, 1.25, 1.1, 1, 1.1, 1, 1.1, 1]);
  });
});

describe('frame bindings', () => {
  it('Ctrl+1 and Ctrl+2 select the zones, also from a text field', () => {
    const selected: number[] = [];
    uninstall = installKeyboard(
      frameBindings({
        selectZone: (index) => selected.push(index),
        zoom: createZoom(() => {}),
        moveCategory: () => {},
        focusSearch: () => {},
      }),
    );
    const input = document.createElement('input');
    document.body.append(input);

    press('Digit2', { ctrlKey: true }, input);
    press('Digit1', { ctrlKey: true }, input);
    expect(selected).toEqual([1, 0]);
  });

  it('[ and ] move the category, but not from a text field', () => {
    const moves: number[] = [];
    uninstall = installKeyboard(
      frameBindings({
        selectZone: () => {},
        zoom: createZoom(() => {}),
        moveCategory: (delta) => moves.push(delta),
        focusSearch: () => {},
      }),
    );
    const input = document.createElement('input');
    document.body.append(input);

    press('BracketRight');
    press('BracketLeft');
    press('BracketRight', {}, input);
    press('BracketLeft', { ctrlKey: true });
    press('BracketRight', { shiftKey: true });
    press('BracketLeft', { shiftKey: true });
    expect(moves).toEqual([1, -1]);
  });

  it('Ctrl+K and Ctrl+F focus the search, also from a text field', () => {
    let focused = 0;
    uninstall = installKeyboard(
      frameBindings({
        selectZone: () => {},
        zoom: createZoom(() => {}),
        moveCategory: () => {},
        focusSearch: () => focused++,
      }),
    );
    const input = document.createElement('input');
    document.body.append(input);

    press('KeyK', { ctrlKey: true });
    press('KeyF', { ctrlKey: true }, input);
    press('KeyK');
    press('KeyF', { ctrlKey: true, altKey: true });
    expect(focused).toBe(2);
  });
});
