import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { Toolbar, type ToolbarProps } from './toolbar';

afterEach(cleanup);

const search = (overrides: Partial<ToolbarProps['search']> = {}) => ({
  text: '',
  onChange: () => {},
  inputRef: createRef<HTMLInputElement>(),
  ...overrides,
});

describe('Toolbar zone tabs', () => {
  it('shows each zone with its counter in a tablist', () => {
    render(
      <Toolbar
        zone="toolbox"
        counts={{ toolbox: 53, learn: 1234 }}
        onZoneChange={() => {}}
        search={search()}
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
        search={search()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(onZoneChange).toHaveBeenCalledWith('learn');
  });
});

describe('Toolbar search box', () => {
  it('is a search field with the zone placeholder and the Ctrl K hint', () => {
    const { rerender } = render(
      <Toolbar
        zone="toolbox"
        counts={{ toolbox: 1, learn: 1 }}
        onZoneChange={() => {}}
        search={search()}
      />,
    );

    const field = screen.getByRole<HTMLInputElement>('searchbox', {
      name: 'Caută în fișe',
    });
    expect(field.placeholder).toBe('Ce vrei să faci? ex. „scot fundalul”');
    expect(document.querySelector('.search-box .kbd')?.textContent).toBe(
      'Ctrl K',
    );

    rerender(
      <Toolbar
        zone="learn"
        counts={{ toolbox: 1, learn: 1 }}
        onZoneChange={() => {}}
        search={search()}
      />,
    );
    expect(field.placeholder).toBe('Ce vrei să înțelegi? ex. „aleg un API”');
  });

  it('shows the text it is given and reports typing', () => {
    const onChange = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Toolbar
        zone="toolbox"
        counts={{ toolbox: 1, learn: 1 }}
        onZoneChange={() => {}}
        search={search({ text: 'fundal', onChange, inputRef })}
      />,
    );

    const field = screen.getByRole<HTMLInputElement>('searchbox');
    expect(field.value).toBe('fundal');
    expect(inputRef.current).toBe(field);
    fireEvent.change(field, { target: { value: 'fundal v' } });
    expect(onChange).toHaveBeenCalledWith('fundal v');
  });
});
