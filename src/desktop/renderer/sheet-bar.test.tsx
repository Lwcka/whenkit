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
    render(<SheetBar crumbs={['Learn', 'Webhook']} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has no edit or delete actions yet', () => {
    render(<SheetBar crumbs={['Learn', 'Webhook']} onBack={() => {}} />);
    expect(
      screen.queryByRole('button', { name: /Editează|Șterge/ }),
    ).toBeNull();
  });
});
