import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Download } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('renders a normal button with its icon and text', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button icon={Download} onClick={onClick}>
        Exportă
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Exportă' });

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(container.querySelector('svg.spin')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('busy: disabled, aria-busy, a spinning loader instead of the icon', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button icon={Download} busy onClick={onClick}>
        Se exportă…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Se exportă…' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('data-busy')).toBe(true);
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.getAttribute('class')).toContain('spin');
    expect(icons[0]?.getAttribute('class')).toContain('lucide-loader-circle');

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('icon-only takes its name and tooltip from title', () => {
    render(<Button iconOnly icon={Download} title="Descarcă" />);
    const button = screen.getByRole('button', { name: 'Descarcă' });
    expect(button.getAttribute('title')).toBe('Descarcă');
    expect(button.hasAttribute('data-icon-only')).toBe(true);
  });

  it('keeps a caller aria-label over the title', () => {
    render(
      <Button iconOnly icon={Download} title="Descarcă" aria-label="Exportă" />,
    );
    expect(screen.getByRole('button', { name: 'Exportă' })).toBeTruthy();
  });

  it('is disabled without being busy', () => {
    render(<Button disabled>Salvează</Button>);
    const button = screen.getByRole('button', { name: 'Salvează' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.hasAttribute('data-busy')).toBe(false);
  });
});
