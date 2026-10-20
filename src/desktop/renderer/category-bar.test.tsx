import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryBar, type CategoryBarItem } from './category-bar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const items: CategoryBarItem[] = [
  { id: null, name: 'Toate', count: 3, slot: null },
  { id: 'a', name: 'AI & LLM', count: 2, slot: 1 },
  { id: 'b', name: 'Imagini & video', count: 1, slot: 2 },
  { id: 'c', name: 'Securitate', count: 0, slot: 3 },
];

const chips = () => screen.getAllByRole('radio');

describe('CategoryBar', () => {
  it('is a single-selection group with a counter on every chip', () => {
    render(<CategoryBar items={items} selectedId="a" onSelect={() => {}} />);

    expect(screen.getByRole('radiogroup', { name: 'Categorii' })).toBeTruthy();
    expect(chips().map((chip) => chip.textContent)).toEqual([
      'Toate 3',
      'AI & LLM 2',
      'Imagini & video 1',
      'Securitate 0',
    ]);
    expect(chips().map((chip) => chip.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    // The color slot goes through an attribute; „Toate” has none.
    expect(chips().map((chip) => chip.getAttribute('data-slot'))).toEqual([
      null,
      '1',
      '2',
      '3',
    ]);
  });

  it('reports the chip that was clicked', () => {
    const onSelect = vi.fn();
    render(<CategoryBar items={items} selectedId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('radio', { name: /^Imagini/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('radio', { name: /^Toate/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('keeps one Tab stop on the selected chip and moves with ← and →', () => {
    const onSelect = vi.fn();
    render(<CategoryBar items={items} selectedId="a" onSelect={onSelect} />);

    expect(chips().map((chip) => chip.tabIndex)).toEqual([-1, 0, -1, -1]);

    chips()[1]?.focus();
    fireEvent.keyDown(chips()[1] as HTMLElement, { code: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('b');
    expect(document.activeElement).toBe(chips()[2]);

    fireEvent.keyDown(chips()[1] as HTMLElement, { code: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('clamps ← and → at the ends', () => {
    const onSelect = vi.fn();
    render(<CategoryBar items={items} selectedId="c" onSelect={onSelect} />);

    fireEvent.keyDown(chips()[3] as HTMLElement, { code: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('c');
  });
});

describe('CategoryBar scrolling', () => {
  /** jsdom has no layout: the row is 400px wide and its content 1000px. */
  function mockOverflow() {
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
  }

  const row = () => screen.getByRole('radiogroup');

  function scrollTo(position: number) {
    Object.defineProperty(row(), 'scrollLeft', {
      configurable: true,
      writable: true,
      value: position,
    });
    fireEvent.scroll(row());
  }

  it('shows no fades or buttons while everything fits', () => {
    render(<CategoryBar items={items} selectedId={null} onSelect={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows only › at the start, then both sides, then only ‹ at the end', () => {
    mockOverflow();
    render(<CategoryBar items={items} selectedId={null} onSelect={() => {}} />);

    expect(
      screen.getByRole('button', { name: 'Categoriile următoare' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Categoriile anterioare' }),
    ).toBeNull();

    scrollTo(200);
    expect(
      screen.getByRole('button', { name: 'Categoriile următoare' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Categoriile anterioare' }),
    ).toBeTruthy();

    scrollTo(600);
    expect(
      screen.queryByRole('button', { name: 'Categoriile următoare' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Categoriile anterioare' }),
    ).toBeTruthy();
  });

  it('scrolls one page with the buttons', () => {
    mockOverflow();
    render(<CategoryBar items={items} selectedId={null} onSelect={() => {}} />);
    scrollTo(0);

    fireEvent.click(
      screen.getByRole('button', { name: 'Categoriile următoare' }),
    );
    expect(row().scrollLeft).toBe(320);
    fireEvent.scroll(row());
    fireEvent.click(
      screen.getByRole('button', { name: 'Categoriile anterioare' }),
    );
    expect(row().scrollLeft).toBe(0);
  });

  it('turns the wheel into sideways scrolling', () => {
    mockOverflow();
    render(<CategoryBar items={items} selectedId={null} onSelect={() => {}} />);
    scrollTo(0);

    fireEvent.wheel(row(), { deltaY: 120 });
    expect(row().scrollLeft).toBe(120);
  });

  it('scrolls the wheel instantly, not through the smooth animation', () => {
    mockOverflow();
    render(<CategoryBar items={items} selectedId={null} onSelect={() => {}} />);
    const scrollBy = vi.fn();
    row().scrollBy = scrollBy;

    fireEvent.wheel(row(), { deltaY: 120 });
    expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'instant' });
  });

  it('brings the active chip into view when the selection changes', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(
      <CategoryBar items={items} selectedId={null} onSelect={() => {}} />,
    );
    scrollIntoView.mockClear();

    rerender(<CategoryBar items={items} selectedId="c" onSelect={() => {}} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(chips()[3]);
    // @ts-expect-error jsdom has no scrollIntoView; remove the stub again.
    delete Element.prototype.scrollIntoView;
  });
});
