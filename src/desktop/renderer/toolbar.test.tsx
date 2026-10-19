import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './toolbar';

afterEach(cleanup);

describe('Toolbar zone tabs', () => {
  it('shows each zone with its counter in a tablist', () => {
    render(
      <Toolbar
        zone="toolbox"
        counts={{ toolbox: 53, learn: 1234 }}
        onZoneChange={() => {}}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Zone' })).toBeTruthy();
    const toolbox = screen.getByRole('tab', { name: /^Toolbox/ });
    const learn = screen.getByRole('tab', { name: /^Learn/ });
    expect(toolbox.textContent).toBe('Toolbox53');
    expect(learn.textContent).toBe('Learn1,2k');
    expect(toolbox.getAttribute('aria-selected')).toBe('true');
    expect(learn.getAttribute('aria-selected')).toBe('false');
  });

  it('reports the zone that was clicked', () => {
    const onZoneChange = vi.fn();
    render(
      <Toolbar
        zone="toolbox"
        counts={{ toolbox: 1, learn: 0 }}
        onZoneChange={onZoneChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(onZoneChange).toHaveBeenCalledWith('learn');
  });
});
