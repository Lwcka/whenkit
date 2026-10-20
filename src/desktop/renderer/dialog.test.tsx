import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';
import { installKeyboard } from './keyboard';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installKeyboard([]);
});

afterEach(() => {
  cleanup();
  uninstall();
});

const press = (code: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, {
    code,
    ...init,
  });

function Host({
  onCancel = () => {},
  initialFocus,
}: {
  onCancel?: () => void;
  initialFocus?: 'cancel' | 'confirm';
}) {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)}>Opener</button>
      <button>Other</button>
      {open && (
        <Dialog
          title="Ștergi fișa „X”?"
          actions={
            <>
              <button
                ref={cancel}
                onClick={() => {
                  onCancel();
                  setOpen(false);
                }}
              >
                Renunță
              </button>
              <button ref={confirm}>Șterge</button>
            </>
          }
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          initialFocusRef={initialFocus === 'confirm' ? confirm : cancel}
        >
          Nu se poate anula.
        </Dialog>
      )}
    </>
  );
}

function openDialog() {
  const opener = screen.getByRole('button', { name: 'Opener' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('Dialog', () => {
  it('is a modal dialog named by its title and described by its text, in a portal', () => {
    const { container } = render(<Host />);
    openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Ștergi fișa „X”?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
    expect(dialog.getAttribute('data-size')).toBe('confirm');
    // The body is a plain container: the caller brings its own markup.
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
        ?.tagName,
    ).toBe('DIV');
    expect(dialog.textContent).toContain('Nu se poate anula.');
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.closest('.dialog-scrim')?.parentElement).toBe(document.body);
  });

  it('puts the focus on the initial ref, or on the first button without one', () => {
    render(<Host />);
    openDialog();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Renunță' }),
    );
    cleanup();

    render(<Host initialFocus="confirm" />);
    openDialog();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Șterge' }),
    );
  });

  it('cycles Tab and Shift+Tab between its buttons only', () => {
    render(<Host />);
    openDialog();
    const cancel = screen.getByRole('button', { name: 'Renunță' });
    const confirm = screen.getByRole('button', { name: 'Șterge' });

    expect(document.activeElement).toBe(cancel);
    press('Tab');
    expect(document.activeElement).toBe(confirm);
    press('Tab');
    expect(document.activeElement).toBe(cancel);
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it('brings the focus back in when it was lost to <body>', () => {
    render(<Host />);
    openDialog();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    press('Tab');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Renunță' }),
    );
  });

  it('calls onCancel on Esc, and the focus returns to the opener', () => {
    const onCancel = vi.fn();
    render(<Host onCancel={onCancel} />);
    const opener = openDialog();

    press('Escape');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('returns the focus to the opener when a button closes it', () => {
    render(<Host />);
    const opener = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Renunță' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('does nothing when the scrim is clicked', () => {
    const onCancel = vi.fn();
    render(<Host onCancel={onCancel} />);
    openDialog();
    const scrim = document.querySelector('.dialog-scrim') as HTMLElement;
    fireEvent.click(scrim);
    fireEvent.mouseDown(scrim);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
