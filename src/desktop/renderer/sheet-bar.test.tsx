import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SheetBar } from './sheet-bar';

afterEach(cleanup);

describe('SheetBar', () => {
  it('shows „Înapoi” with its key and the breadcrumbs, the last one current', () => {
    const { container } = render(
      <SheetBar
        crumbs={['Toolbox', 'Imagini & video', 'remove.bg']}
        onBack={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /Înapoi/ }).textContent).toBe(
      'ÎnapoiEsc',
    );
    expect(
      [...container.querySelectorAll('.crumb')].map(
        (crumb) => crumb.textContent,
      ),
    ).toEqual(['Toolbox', 'Imagini & video', 'remove.bg']);
    const current = container.querySelector('.crumb[data-current]');
    expect(current?.textContent).toBe('remove.bg');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(
      screen.getByRole('navigation', { name: 'Poziția fișei' }),
    ).toBeTruthy();
  });

  it('calls onBack on click', () => {
    const onBack = vi.fn();
    render(
      <SheetBar
        crumbs={['Learn', 'Webhook']}
        onBack={onBack}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has „Editează” with its key before „Șterge”, and „Șterge” only asks', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SheetBar
        crumbs={['Learn', 'Webhook']}
        onBack={() => {}}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    const edit = screen.getByRole('button', { name: /Editează/ });
    expect(edit.textContent).toBe('EditeazăE');
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);

    const button = screen.getByRole('button', { name: 'Șterge' });
    expect(button.getAttribute('data-variant')).toBe('danger');
    expect(
      edit.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  describe('while editing', () => {
    const editing = (overrides = {}) => ({
      onCancel: vi.fn(),
      onSave: vi.fn(),
      saveDisabled: false,
      saving: null,
      ...overrides,
    });

    it('swaps „Înapoi” and „Șterge” for „Renunță” and „Salvează”, keeping the crumbs', () => {
      const state = editing();
      render(
        <SheetBar
          crumbs={['Toolbox', 'remove.bg']}
          onBack={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          editing={state}
        />,
      );
      expect(screen.queryByRole('button', { name: /Înapoi/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Șterge/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Editează/ })).toBeNull();
      expect(document.querySelectorAll('.crumb')).toHaveLength(2);

      const cancel = screen.getByRole('button', { name: /Renunță/ });
      expect(cancel.textContent).toBe('RenunțăEsc');
      expect(cancel.getAttribute('data-variant')).toBe('ghost');
      const save = screen.getByRole('button', { name: /Salvează/ });
      expect(save.textContent).toBe('SalveazăCtrl S');
      expect(save.getAttribute('data-variant')).toBe('primary');
      fireEvent.click(cancel);
      fireEvent.click(save);
      expect(state.onCancel).toHaveBeenCalledTimes(1);
      expect(state.onSave).toHaveBeenCalledTimes(1);
    });

    it('disables „Salvează” when the form is invalid', () => {
      render(
        <SheetBar
          crumbs={['Toolbox', 'remove.bg']}
          onBack={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          editing={editing({ saveDisabled: true })}
        />,
      );
      expect(
        (screen.getByRole('button', { name: /Salvează/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it('shows „Se verifică linkul…” while links are checked and „Se salvează…” otherwise, busy', () => {
      const { rerender } = render(
        <SheetBar
          crumbs={['Toolbox', 'remove.bg']}
          onBack={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          editing={editing({ saving: 'links' })}
        />,
      );
      const busy = screen.getByRole('button', { name: 'Se verifică linkul…' });
      expect(busy.getAttribute('aria-busy')).toBe('true');
      expect(
        (screen.getByRole('button', { name: /Renunță/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);

      rerender(
        <SheetBar
          crumbs={['Toolbox', 'remove.bg']}
          onBack={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          editing={editing({ saving: 'text' })}
        />,
      );
      expect(screen.getByRole('button', { name: 'Se salvează…' })).toBeTruthy();
    });
  });
});
