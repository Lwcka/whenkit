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

  it('leaves Enter alone: the card does not open anything yet', () => {
    render(<CardGrid entries={entries} slots={slots} viewKey="v" />);

    cards()[1]?.focus();
    const event = fireEvent.keyDown(cards()[1] as HTMLElement, {
      code: 'Enter',
    });
    // Not prevented, and the focus has not moved.
    expect(event).toBe(true);
    expect(document.activeElement).toBe(cards()[1]);
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
