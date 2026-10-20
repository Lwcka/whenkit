import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorDto, IpcResult, WriteResult } from '../../shared/ipc';
import { installKeyboard } from './keyboard';
import {
  MyNotes,
  NOTES_AUTOSAVE_MS,
  NOTES_RETRY_MS,
  SAVED_MIN_VISIBLE_MS,
} from './my-notes';
import { flushAllNotes } from './notes-flush';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const OK: IpcResult<WriteResult> = { ok: true, data: { changed: [] } };
const failed = (code: ErrorDto['code']): IpcResult<WriteResult> => ({
  ok: false,
  error: { code },
});

type Save = (id: string, notes: string) => Promise<IpcResult<WriteResult>>;

function mount(notes = '', onSave: Save = () => Promise.resolve(OK)) {
  const save = vi.fn(onSave);
  const view = render(<MyNotes entryId="e1" notes={notes} onSave={save} />);
  const field = () => view.container.querySelector('textarea')!;
  const status = () =>
    view.container.querySelector('[role="status"]')?.textContent;
  const type = (text: string) => {
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: text } });
  };
  /** Moves the fake clock and lets the promises it woke up settle. */
  const wait = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const again = (next: string) =>
    view.rerender(<MyNotes entryId="e1" notes={next} onSave={save} />);
  return { ...view, save, field, status, type, wait, again };
}

const HINT = 'se salvează singure · doar tu scrii aici';

describe('MyNotes: layout', () => {
  it('shows a labelled text area with the notes, the placeholder and the hint', () => {
    const view = mount('Gratuit doar la rezoluție mică.');
    expect(view.field().value).toBe('Gratuit doar la rezoluție mică.');
    expect(view.field().placeholder).toBe(
      'Scrie aici ce vrei să-ți amintești.',
    );
    expect(view.getByLabelText('Notițele mele')).toBe(view.field());
    expect(view.status()).toBe(HINT);
    expect(view.container.querySelector('button')).toBeNull();
  });
});

describe('MyNotes: autosave on a pause', () => {
  it('saves once after the pause, shows Salvat for at least 800 ms, then the hint', async () => {
    const view = mount('');
    view.type('Gratuit doar la rezoluție mică.');
    await view.wait(NOTES_AUTOSAVE_MS - 1);
    expect(view.save).not.toHaveBeenCalled();
    expect(view.status()).toBe(HINT);

    await view.wait(1);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.save).toHaveBeenCalledWith(
      'e1',
      'Gratuit doar la rezoluție mică.',
    );
    expect(view.status()).toBe('Salvat');

    await view.wait(SAVED_MIN_VISIBLE_MS - 1);
    expect(view.status()).toBe('Salvat');
    await view.wait(1);
    expect(view.status()).toBe(HINT);
    expect(view.save).toHaveBeenCalledTimes(1);
  });

  it('shows Se salvează… while the write is open', async () => {
    let finish: (result: IpcResult<WriteResult>) => void = () => {};
    const view = mount('', () => new Promise((resolve) => (finish = resolve)));
    view.type('x');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.status()).toBe('Se salvează…');
    await act(async () => finish(OK));
    expect(view.status()).toBe('Salvat');
  });

  it('restarts the pause on every keystroke and saves the last text, once', async () => {
    const view = mount('');
    view.type('a');
    await view.wait(400);
    view.type('ab');
    await view.wait(400);
    expect(view.save).not.toHaveBeenCalled();
    await view.wait(200);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.save).toHaveBeenCalledWith('e1', 'ab');
  });

  it('stores the text exactly as typed, spaces and new lines included', async () => {
    const view = mount('');
    view.type('  una\n\n  doua  \n');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.save).toHaveBeenCalledWith('e1', '  una\n\n  doua  \n');
  });

  it('saves a text typed during a write after that write, never in parallel', async () => {
    const finishers: ((result: IpcResult<WriteResult>) => void)[] = [];
    const view = mount(
      '',
      () => new Promise((resolve) => finishers.push(resolve)),
    );
    view.type('a');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.save).toHaveBeenCalledTimes(1);

    view.type('ab');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.save).toHaveBeenCalledTimes(1);

    await act(async () => finishers[0](OK));
    await view.wait(0);
    expect(view.save).toHaveBeenCalledTimes(2);
    expect(view.save).toHaveBeenLastCalledWith('e1', 'ab');
    await act(async () => finishers[1](OK));
    expect(view.status()).toBe('Salvat');
  });

  it('does not save when the text returns to what is saved', async () => {
    const view = mount('abc');
    view.type('abcd');
    view.type('abc');
    await view.wait(NOTES_AUTOSAVE_MS * 2);
    expect(view.save).not.toHaveBeenCalled();
  });
});

describe('MyNotes: the saving state', () => {
  it('does not stay on Se salvează… when the text goes back to what was saved during a write', async () => {
    let finish: (result: IpcResult<WriteResult>) => void = () => {};
    const view = mount('', () => new Promise((resolve) => (finish = resolve)));
    view.type('a');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.status()).toBe('Se salvează…');

    // Typed during the write, then taken back before the write ends or after.
    view.type('ab');
    await act(async () => finish(OK));
    expect(view.status()).toBe('Se salvează…');
    view.type('a');
    expect(view.status()).toBe(HINT);

    await view.wait(NOTES_AUTOSAVE_MS * 2);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.status()).toBe(HINT);
  });
});

describe('MyNotes: saving at once', () => {
  it('saves on blur without waiting for the pause', async () => {
    const view = mount('');
    view.type('ceva');
    fireEvent.blur(view.field());
    await view.wait(0);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.save).toHaveBeenCalledWith('e1', 'ceva');
    // The pause that was running is gone: no second write.
    await view.wait(NOTES_AUTOSAVE_MS * 2);
    expect(view.save).toHaveBeenCalledTimes(1);
  });

  it('saves the pending text when the sheet goes away (Esc, a link, a zone switch)', async () => {
    const view = mount('');
    view.type('ceva');
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.save).toHaveBeenCalledWith('e1', 'ceva');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTES_AUTOSAVE_MS * 2);
    });
    expect(view.save).toHaveBeenCalledTimes(1);
  });

  it('does not save on unmount when nothing changed', async () => {
    const view = mount('abc');
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTES_AUTOSAVE_MS * 2);
    });
    expect(view.save).not.toHaveBeenCalled();
  });

  it('saves the pending text when the window asks (flushAllNotes) and answers after the write', async () => {
    let finish: (result: IpcResult<WriteResult>) => void = () => {};
    const view = mount('', () => new Promise((resolve) => (finish = resolve)));
    view.type('inainte de inchidere');
    let done = false;
    const flushing = flushAllNotes().then(() => {
      done = true;
    });
    await view.wait(0);
    expect(view.save).toHaveBeenCalledWith('e1', 'inainte de inchidere');
    expect(done).toBe(false);
    await act(async () => finish(OK));
    await flushing;
    expect(done).toBe(true);
  });

  it('answers the window at once when nothing is pending', async () => {
    const view = mount('abc');
    await act(async () => {
      await flushAllNotes();
    });
    expect(view.save).not.toHaveBeenCalled();
  });

  it('stops answering the window after it is unmounted', async () => {
    const view = mount('');
    view.unmount();
    await act(async () => {
      await flushAllNotes();
    });
    expect(view.save).not.toHaveBeenCalled();
  });
});

describe('MyNotes: unchanged', () => {
  it('writes nothing for a focus and a blur without changes', async () => {
    const view = mount('abc');
    fireEvent.focus(view.field());
    fireEvent.blur(view.field());
    await view.wait(NOTES_AUTOSAVE_MS * 2);
    expect(view.save).not.toHaveBeenCalled();
    expect(view.status()).toBe(HINT);
  });
});

describe('MyNotes: a failed save', () => {
  it('keeps the text, shows the error and retries every 3 s until it works', async () => {
    const answers = [failed('DATABASE_BUSY'), failed('INTERNAL'), OK];
    const view = mount('', () => Promise.resolve(answers.shift() ?? OK));
    view.type('important');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(view.status()).toBe('Nu s-a salvat. Încerc din nou.');
    expect(view.field().value).toBe('important');
    expect(
      view.container.querySelector('.my-notes')?.getAttribute('data-status'),
    ).toBe('error');

    await view.wait(NOTES_RETRY_MS - 1);
    expect(view.save).toHaveBeenCalledTimes(1);
    await view.wait(1);
    expect(view.save).toHaveBeenCalledTimes(2);
    expect(view.status()).toBe('Nu s-a salvat. Încerc din nou.');

    await view.wait(NOTES_RETRY_MS);
    expect(view.save).toHaveBeenCalledTimes(3);
    expect(view.save).toHaveBeenLastCalledWith('e1', 'important');
    expect(view.status()).toBe('Salvat');

    // Saved: the retries are over.
    await view.wait(NOTES_RETRY_MS * 3);
    expect(view.save).toHaveBeenCalledTimes(3);
  });

  it('stops retrying when the entry has vanished', async () => {
    const view = mount('', () => Promise.resolve(failed('ENTRY_NOT_FOUND')));
    view.type('x');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.status()).toBe('Nu s-a salvat. Încerc din nou.');
    await view.wait(NOTES_RETRY_MS * 3);
    expect(view.save).toHaveBeenCalledTimes(1);
  });

  it('treats a rejected call like a failed save', async () => {
    const view = mount('', () => Promise.reject(new Error('bridge')));
    view.type('x');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.status()).toBe('Nu s-a salvat. Încerc din nou.');
    await view.wait(NOTES_RETRY_MS);
    expect(view.save).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying after the field is gone, until the write works', async () => {
    const answers = [
      failed('DATABASE_BUSY'),
      failed('DATABASE_BUSY'),
      failed('DATABASE_BUSY'),
      OK,
    ];
    const view = mount('', () => Promise.resolve(answers.shift() ?? OK));
    view.type('x');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.save).toHaveBeenCalledTimes(1);

    // Esc: the unmount tries again at once, and again every 3 s.
    view.unmount();
    await view.wait(0);
    expect(view.save).toHaveBeenCalledTimes(2);
    await view.wait(NOTES_RETRY_MS);
    expect(view.save).toHaveBeenCalledTimes(3);
    await view.wait(NOTES_RETRY_MS);
    expect(view.save).toHaveBeenCalledTimes(4);
    expect(view.save).toHaveBeenLastCalledWith('e1', 'x');

    // Saved: the retries and the registration are over.
    await view.wait(NOTES_RETRY_MS * 3);
    expect(view.save).toHaveBeenCalledTimes(4);
    await act(async () => {
      await flushAllNotes();
    });
    expect(view.save).toHaveBeenCalledTimes(4);
  });

  it('still flushes a save that is being retried after the field is gone', async () => {
    const answers = [failed('DATABASE_BUSY'), failed('DATABASE_BUSY'), OK];
    const view = mount('', () => Promise.resolve(answers.shift() ?? OK));
    view.type('x');
    await view.wait(NOTES_AUTOSAVE_MS);
    view.unmount();
    await view.wait(0);
    expect(view.save).toHaveBeenCalledTimes(2);

    // The window closes before the next retry: it asks, and the write is made.
    await act(async () => {
      await flushAllNotes();
    });
    expect(view.save).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after the field is gone when the entry vanished', async () => {
    const view = mount('', () => Promise.resolve(failed('ENTRY_NOT_FOUND')));
    view.type('x');
    view.unmount();
    await view.wait(NOTES_RETRY_MS * 3);
    expect(view.save).toHaveBeenCalledTimes(1);
  });

  it('goes back to the hint when the text returns to the saved one', async () => {
    const view = mount('abc', () => Promise.resolve(failed('DATABASE_BUSY')));
    view.type('abcd');
    await view.wait(NOTES_AUTOSAVE_MS);
    expect(view.status()).toBe('Nu s-a salvat. Încerc din nou.');
    view.type('abc');
    await view.wait(NOTES_RETRY_MS);
    expect(view.status()).toBe(HINT);
    expect(view.save).toHaveBeenCalledTimes(1);
  });
});

describe('MyNotes: a live refresh of the entry', () => {
  it('keeps the local text while the field has focus', async () => {
    const view = mount('vechi');
    view.type('ce scriu acum');
    view.again('venit din altă parte');
    expect(view.field().value).toBe('ce scriu acum');
  });

  it('keeps the local text while a save is pending, even after the blur', async () => {
    let finish: (result: IpcResult<WriteResult>) => void = () => {};
    const view = mount(
      'vechi',
      () => new Promise((resolve) => (finish = resolve)),
    );
    view.type('ce scriu acum');
    fireEvent.blur(view.field());
    await view.wait(0);
    view.again('venit din altă parte');
    expect(view.field().value).toBe('ce scriu acum');
    await act(async () => finish(OK));
    // The store now holds what was saved.
    view.again('ce scriu acum');
    expect(view.field().value).toBe('ce scriu acum');
  });

  it('shows the notes of the entry when the field is idle', () => {
    const view = mount('vechi');
    view.again('nou, din DTO');
    expect(view.field().value).toBe('nou, din DTO');
  });

  it('takes the entry notes once the field loses focus with nothing pending', () => {
    const view = mount('vechi');
    fireEvent.focus(view.field());
    view.again('nou, din DTO');
    expect(view.field().value).toBe('vechi');
    fireEvent.blur(view.field());
    expect(view.field().value).toBe('nou, din DTO');
  });
});

describe('MyNotes: keys', () => {
  it('lets [, ] and E type text: single keys are inactive in the field', () => {
    const pressed: string[] = [];
    const uninstall = installKeyboard([
      { code: 'BracketLeft', run: () => pressed.push('[') },
      { code: 'BracketRight', run: () => pressed.push(']') },
      { code: 'KeyE', run: () => pressed.push('E') },
    ]);
    const view = mount('');
    view.field().focus();
    for (const code of ['BracketLeft', 'BracketRight', 'KeyE']) {
      const allowed = fireEvent.keyDown(view.field(), { code });
      // Not prevented: the browser types the character.
      expect(allowed).toBe(true);
    }
    expect(pressed).toEqual([]);
    uninstall();
  });
});
