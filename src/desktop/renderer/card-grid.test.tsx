import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardGrid } from './card-grid';
import { makeEntry } from './test-fixtures';

const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => makeEntry(id));
const slots = new Map<string, number>();

/** jsdom has no layout: the grid says it has `columns` columns of 300px. */
function mockColumns(columns: number) {
  const original = window.getComputedStyle.bind(window);
  const tracks = Array(columns).fill('300px').join(' ');
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const real = original(element, pseudo);
    if (!element.classList.contains('card-grid')) return real;
    return new Proxy(real, {
      get(target, property) {
        if (property === 'gridTemplateColumns') return tracks;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
}

const cards = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.classList.contains('entry-card'));
const stops = () => cards().filter((card) => card.tabIndex === 0);

beforeEach(() => mockColumns(2));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CardGrid', () => {
  it('is one Tab stop: the first card until another takes focus', () => {
    render(<CardGrid entries={entries} slots={slots} viewKey="v" />);

    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'a',
    ]);
    expect(screen.getByRole('list', { name: 'Fișe' })).toBeTruthy();
  });

  it('moves with the arrows by one and by a row, clamped at the ends', () => {
    render(<CardGrid entries={entries} slots={slots} viewKey="v" />);
    const press = (code: string) =>
      fireEvent.keyDown(document.activeElement ?? document.body, { code });

    cards()[0]?.focus();
    press('ArrowLeft');
    expect(document.activeElement).toBe(cards()[0]);
    press('ArrowRight');
    expect(document.activeElement).toBe(cards()[1]);
    press('ArrowDown');
    expect(document.activeElement).toBe(cards()[3]);
    press('ArrowDown');
    expect(document.activeElement).toBe(cards()[4]);
    press('ArrowUp');
    expect(document.activeElement).toBe(cards()[2]);
    press('ArrowUp');
    expect(document.activeElement).toBe(cards()[0]);
  });

  it('keeps the last focused card as the Tab stop when focus leaves', () => {
    render(
      <>
        <button type="button">before</button>
        <CardGrid entries={entries} slots={slots} viewKey="v" />
      </>,
    );

    const third = cards().find(
      (card) => card.getAttribute('aria-label') === 'c',
    );
    act(() => third?.focus());
    act(() => screen.getByText('before').focus());

    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'c',
    ]);
  });

  it('treats an unknown column count as one column', () => {
    vi.restoreAllMocks();
    render(<CardGrid entries={entries} slots={slots} viewKey="v" />);

    cards()[0]?.focus();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      code: 'ArrowDown',
    });
    expect(document.activeElement).toBe(cards()[1]);
  });

  it('opens an entry on click and on Enter, with its id', () => {
    const onOpen = vi.fn();
    render(
      <CardGrid entries={entries} slots={slots} viewKey="v" onOpen={onOpen} />,
    );

    fireEvent.click(cards()[2] as HTMLElement);
    expect(onOpen).toHaveBeenLastCalledWith('c');

    cards()[1]?.focus();
    const notPrevented = fireEvent.keyDown(cards()[1] as HTMLElement, {
      code: 'Enter',
    });
    expect(notPrevented).toBe(false);
    expect(onOpen).toHaveBeenLastCalledWith('b');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('opens on the numpad Enter too', () => {
    const onOpen = vi.fn();
    render(
      <CardGrid entries={entries} slots={slots} viewKey="v" onOpen={onOpen} />,
    );
    fireEvent.keyDown(cards()[3] as HTMLElement, { code: 'NumpadEnter' });
    expect(onOpen).toHaveBeenCalledWith('d');
  });

  it('does not open on Enter with a modifier, or on other keys', () => {
    const onOpen = vi.fn();
    render(
      <CardGrid entries={entries} slots={slots} viewKey="v" onOpen={onOpen} />,
    );
    const card = cards()[0] as HTMLElement;

    fireEvent.keyDown(card, { code: 'Enter', ctrlKey: true });
    fireEvent.keyDown(card, { code: 'Enter', altKey: true });
    fireEvent.keyDown(card, { code: 'Space' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('makes the initial card the Tab stop', () => {
    render(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        initialActiveId="d"
      />,
    );
    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'd',
    ]);
  });

  it('falls back to the first card when the initial one is not in the list', () => {
    render(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        initialActiveId="gone"
      />,
    );
    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'a',
    ]);
  });

  it('caps the cascade at eight cards', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeEntry(`e${index}`),
    );
    const { container } = render(
      <CardGrid entries={many} slots={slots} viewKey="v" />,
    );

    const staggers = [...container.querySelectorAll('li')].map((item) =>
      item.getAttribute('data-stagger'),
    );
    expect(staggers.slice(0, 3)).toEqual(['0', '1', '2']);
    expect(staggers.slice(8)).toEqual(['8', '8', '8', '8']);
  });

  it('colors a card by its first category', () => {
    const colored = makeEntry('x', {
      categories: [{ id: 'c1', zone: 'toolbox', name: 'C1' }],
    });
    render(
      <CardGrid
        entries={[colored]}
        slots={new Map([['c1', 3]])}
        viewKey="toolbox:"
      />,
    );

    expect(cards()[0]?.getAttribute('data-slot')).toBe('3');
  });

  it('starts over on a new view: the first card is the stop again', () => {
    const { rerender } = render(
      <CardGrid entries={entries} slots={slots} viewKey="toolbox:" />,
    );
    act(() => cards()[2]?.focus());
    expect(stops()[0]?.getAttribute('aria-label')).toBe('c');

    rerender(<CardGrid entries={entries} slots={slots} viewKey="toolbox:c1" />);
    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'a',
    ]);
  });
});

describe('CardGrid: arrivals and pulses', () => {
  const now = 1_000_000;

  it('puts the tape only on live arrivals, with the time since they came', () => {
    const { container } = render(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        arrivals={
          new Map([
            ['a', now - 3000],
            ['b', now - 600_000],
          ])
        }
        now={now}
      />,
    );
    const tapes = [...container.querySelectorAll('.arrival-tape')];
    expect(tapes.map((tape) => tape.textContent)).toEqual([
      'Adăugat · acum 3 s',
    ]);
    expect(
      [...container.querySelectorAll('.entry-card[data-new]')].map((card) =>
        card.getAttribute('aria-label'),
      ),
    ).toEqual(['a']);
  });

  it('updates the time on the tape with the clock', () => {
    const arrivals = new Map([['a', now]]);
    const { container, rerender } = render(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        arrivals={arrivals}
        now={now}
      />,
    );
    expect(container.querySelector('.arrival-tape')?.textContent).toBe(
      'Adăugat · acum 0 s',
    );
    rerender(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        arrivals={arrivals}
        now={now + 125_000}
      />,
    );
    expect(container.querySelector('.arrival-tape')?.textContent).toBe(
      'Adăugat · acum 2 min',
    );
  });

  it('pulses a card when its counter changes while mounted, not on mount', () => {
    const { container, rerender } = render(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        pulses={new Map([['a', 1]])}
      />,
    );
    // Counted before this grid mounted: no replay.
    expect(container.querySelector('[data-pulse]')).toBeNull();

    rerender(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        pulses={new Map([['a', 2]])}
      />,
    );
    expect(
      container.querySelector('[aria-label="a"]')?.getAttribute('data-pulse'),
    ).toBe('b');
    rerender(
      <CardGrid
        entries={entries}
        slots={slots}
        viewKey="v"
        pulses={new Map([['a', 3]])}
      />,
    );
    expect(
      container.querySelector('[aria-label="a"]')?.getAttribute('data-pulse'),
    ).toBe('a');
  });

  it('keeps the focus and the Tab stop on a card when another one arrives first', () => {
    const { rerender } = render(
      <CardGrid entries={entries} slots={slots} viewKey="v" />,
    );
    const c = cards().find((card) => card.getAttribute('aria-label') === 'c');
    act(() => c?.focus());
    expect(document.activeElement).toBe(c);

    rerender(
      <CardGrid
        entries={[makeEntry('n'), ...entries]}
        slots={slots}
        viewKey="v"
        arrivals={new Map([['n', now]])}
        now={now}
      />,
    );
    expect(document.activeElement).toBe(c);
    expect(stops().map((card) => card.getAttribute('aria-label'))).toEqual([
      'c',
    ]);
    expect(cards()[0]?.getAttribute('aria-label')).toBe('n');
  });

  describe('sliding', () => {
    let shifted = false;
    const original = HTMLElement.prototype.animate;

    function mockLayout(slide: string) {
      shifted = false;
      // Old cards stand at row 0 first, 100px lower once the new one is first.
      vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
        function (this: HTMLElement) {
          return shifted && this.querySelector('[aria-label="n"]') === null
            ? 100
            : 0;
        },
      );
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        () =>
          ({
            getPropertyValue: (name: string) =>
              name === '--motion-slide' ? slide : '',
            gridTemplateColumns: '300px 300px',
          }) as unknown as CSSStyleDeclaration,
      );
    }

    afterEach(() => {
      HTMLElement.prototype.animate = original;
    });

    it('slides the cards that moved, from where they stood', () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate;
      mockLayout('250ms');
      const { rerender } = render(
        <CardGrid entries={entries} slots={slots} viewKey="v" />,
      );
      expect(animate).not.toHaveBeenCalled();

      shifted = true;
      rerender(
        <CardGrid
          entries={[makeEntry('n'), ...entries]}
          slots={slots}
          viewKey="v"
        />,
      );
      // The five old cards slid; the new one did not.
      expect(animate).toHaveBeenCalledTimes(5);
      expect(animate.mock.calls[0]?.[0]).toEqual([
        { transform: 'translate(0px, -100px)' },
        { transform: 'none' },
      ]);
      expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 250 });
    });

    it('does not slide when animations are off (motion.slide is 0)', () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate;
      mockLayout('0ms');
      const { rerender } = render(
        <CardGrid entries={entries} slots={slots} viewKey="v" />,
      );
      shifted = true;
      rerender(
        <CardGrid
          entries={[makeEntry('n'), ...entries]}
          slots={slots}
          viewKey="v"
        />,
      );
      expect(animate).not.toHaveBeenCalled();
    });
  });
});
