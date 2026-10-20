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
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has „Șterge” on the right, which only asks, and no „Editează” yet', () => {
    const onDelete = vi.fn();
    render(
      <SheetBar
        crumbs={['Learn', 'Webhook']}
        onBack={() => {}}
        onDelete={onDelete}
      />,
    );
    const button = screen.getByRole('button', { name: 'Șterge' });
    expect(button.getAttribute('data-variant')).toBe('danger');
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Editează/ })).toBeNull();
  });
});
