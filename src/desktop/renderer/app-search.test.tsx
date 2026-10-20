import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CatalogSnapshotDto,
  EntryDto,
  IpcResult,
  SearchResultDto,
} from '../../shared/ipc';
import { App, type FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import { makeCategory, makeEntry } from './test-fixtures';
import { applyTheme } from './theme';
import { toasts } from './toast-store';

// The search of the window (CAP-9, EXPERIENCE: search-box): the real store and
// the real App, with a search api that matches words in the snapshot's text.

const imagini = makeCategory('c-img', 'Imagini & video');
const securitate = makeCategory('c-sec', 'Securitate');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const categories = [imagini, securitate, backend];

const tool = (id: string, whatItDoes: string, category = imagini) =>
  makeEntry(id, { name: id, whatItDoes, categories: [category] });
const concept = (id: string, whatItDoes: string) =>
  makeEntry(id, {
    zone: 'learn',
    name: id,
    whatItDoes,
    categories: [backend],
  });

// Snapshot order is the display order.
const catalog = [
  tool('Alfa', 'fundal alb'),
  concept('Webhook', 'fundal ceva'),
  tool('Beta', 'fundal negru', securitate),
  concept('Gamma', 'fundal'),
  tool('Delta', 'altceva'),
  concept('Omega', 'unicorn'),
];

let current: readonly EntryDto[];
let asked: string[];
let failing: boolean;

function snapshot(entries: readonly EntryDto[]): IpcResult<CatalogSnapshotDto> {
  return { ok: true, data: { entries: [...entries], categories } };
}

const api: FrameApi = {
  workspacePath: 'C:\\ws',
  setTheme: () => Promise.resolve({ ok: true, data: null }),
  setZoomFactor: () => {},
  searchEntries: (text) => {
    asked.push(text);
    if (failing) {
      return Promise.resolve({ ok: false, error: { code: 'INTERNAL' } });
    }
    const words = text.toLowerCase().split(/\s+/);
    // The adapter answers in snapshot order, both zones.
    const ids = current
      .filter((entry) =>
        words.every((word) =>
          `${entry.name} ${entry.whatItDoes}`.toLowerCase().includes(word),
        ),
      )
      .map((entry) => entry.id);
    const result: IpcResult<SearchResultDto> = { ok: true, data: { ids } };
    return Promise.resolve(result);
  },
};

let store: CatalogStore;

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  current = catalog;
  asked = [];
  failing = false;
});

afterEach(cleanup);

async function open(entries: readonly EntryDto[] = catalog) {
  current = entries;
  store = createCatalogStore({
    catalogSnapshot: () => Promise.resolve(snapshot(current)),
  });
  render(<App store={store} api={api} />);
  await act(() => store.load());
}

const box = () => screen.getByRole<HTMLInputElement>('searchbox');
const type = (text: string) =>
  fireEvent.change(box(), { target: { value: text } });
const titles = () =>
  Array.from(document.querySelectorAll('.entry-card h3')).map(
    (h) => h.textContent,
  );
const heading = () => document.querySelector('h2')?.textContent;
const checkedChips = () =>
  screen.queryAllByRole('radio').filter((chip) => chip.ariaChecked === 'true');
const checkedChip = () => checkedChips()[0]?.textContent;
const pressEscape = (target: Element = document.body) =>
  fireEvent.keyDown(target, { code: 'Escape' });

/** Types and waits for the results of that text to be on screen. */
async function search(text: string) {
  type(text);
  await screen.findByText(`Rezultate pentru „${text.trim()}”`);
}

describe('App: search results', () => {
  it('lists the matches of the zone in snapshot order, with no chip checked', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    expect(checkedChip()).toMatch(/^Securitate/);

    await search('fundal');

    expect(heading()).toBe('Rezultate pentru „fundal”');
    expect(titles()).toEqual(['Alfa', 'Beta']);
    expect(document.querySelector('.section-header-label')?.textContent).toBe(
      '2 fișe',
    );
    expect(checkedChips()).toEqual([]);
    // The chips are still there and reachable.
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(1);
    expect(asked).toEqual(['fundal']);
  });

  it('waits for a pause in typing before asking', async () => {
    await open();
    type('f');
    type('fu');
    type('fund');
    await screen.findByText('Rezultate pentru „fund”');
    expect(asked).toEqual(['fund']);
  });

  it('requires every word', async () => {
    await open();
    await search('fundal negru');
    expect(titles()).toEqual(['Beta']);
  });

  it('offers the matches of the other zone and switches with the text kept', async () => {
    await open();
    await search('fundal');

    fireEvent.click(screen.getByRole('button', { name: '+2 în Learn' }));

    expect(
      screen.getByRole('tab', { name: /^Learn/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(box().value).toBe('fundal');
    expect(heading()).toBe('Rezultate pentru „fundal”');
    expect(titles()).toEqual(['Webhook', 'Gamma']);
    expect(screen.getByRole('button', { name: '+2 în Toolbox' })).toBeTruthy();
    // No new question: the same ids answer both zones.
    expect(asked).toEqual(['fundal']);
  });

  it('puts the focus on a card of the other zone after the link', async () => {
    await open();
    await search('fundal');
    const link = screen.getByRole('button', { name: '+2 în Learn' });
    link.focus();

    fireEvent.click(link);

    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused?.classList.contains('entry-card')).toBe(true);
      expect(focused?.querySelector('h3')?.textContent).toBe('Webhook');
    });
  });

  it('applies the same text to the zone picked with the tabs', async () => {
    await open();
    await search('fundal');
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(box().value).toBe('fundal');
    expect(titles()).toEqual(['Webhook', 'Gamma']);
  });

  it('shows no link when the other zone has no match', async () => {
    await open();
    await search('altceva');
    expect(titles()).toEqual(['Delta']);
    expect(screen.queryByRole('button', { name: /în Learn/ })).toBeNull();
  });

  it('keeps the category while the text is blank', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    type('   ');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(asked).toEqual([]);
    expect(heading()).toBe('Securitate');
    expect(checkedChip()).toMatch(/^Securitate/);
  });

  it('shows the placeholder of the zone', async () => {
    await open();
    expect(box().placeholder).toBe('Ce vrei să faci? ex. „scot fundalul”');
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(box().placeholder).toBe('Ce vrei să înțelegi? ex. „aleg un API”');
  });
});

describe('App: nothing found', () => {
  it('says so, points to /gaseste and offers no link without matches', async () => {
    await open();
    await search('convertesc un video');

    expect(
      screen.getByText('Nimic pentru „convertesc un video” în Toolbox.'),
    ).toBeTruthy();
    expect(screen.getByText('Am căutat în tot textul fișelor.')).toBeTruthy();
    expect(document.querySelector('.empty-state-command')?.textContent).toBe(
      'Sau cere-i lui Claude, în terminal: /gaseste …',
    );
    expect(screen.queryByRole('button', { name: /în Learn/ })).toBeNull();
    expect(titles()).toEqual([]);
    expect(heading()).toBe('Rezultate pentru „convertesc un video”');
    expect(document.querySelector('.section-header-label')?.textContent).toBe(
      '0 fișe',
    );
  });

  it('adds the link to the other zone, once, when it has matches', async () => {
    await open();
    await search('unicorn');

    expect(screen.getByText('Nimic pentru „unicorn” în Toolbox.')).toBeTruthy();
    const links = screen.getAllByRole('button', { name: '+1 în Learn' });
    expect(links).toHaveLength(1);

    fireEvent.click(links[0] as HTMLElement);
    expect(titles()).toEqual(['Omega']);
  });
});

describe('App: leaving the search', () => {
  it('Esc in the box clears the text and returns to the category before', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    await search('fundal');
    box().focus();

    pressEscape(box());

    expect(box().value).toBe('');
    expect(heading()).toBe('Securitate');
    expect(checkedChip()).toMatch(/^Securitate/);
    expect(titles()).toEqual(['Beta']);
    expect(document.activeElement).toBe(box());
  });

  it('Esc in the list with an active search clears it', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    await search('fundal');
    expect(document.activeElement).not.toBe(box());

    pressEscape();

    expect(box().value).toBe('');
    expect(heading()).toBe('Securitate');
    expect(titles()).toEqual(['Beta']);
  });

  it('Esc does nothing without a search', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    pressEscape();
    expect(heading()).toBe('Securitate');
  });

  it('deleting the text returns to the category before', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    await search('fundal');

    type('');

    expect(heading()).toBe('Securitate');
    expect(checkedChip()).toMatch(/^Securitate/);
  });

  it('clicking a chip ends the search and shows that category', async () => {
    await open();
    await search('fundal');

    fireEvent.click(screen.getByRole('radio', { name: /^Imagini & video/ }));

    expect(box().value).toBe('');
    expect(heading()).toBe('Imagini & video');
    expect(titles()).toEqual(['Alfa', 'Delta']);
  });

  it('[ and ] end the search and move the category', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Imagini & video/ }));
    await search('fundal');

    fireEvent.keyDown(document.body, { code: 'BracketRight' });

    expect(box().value).toBe('');
    expect(heading()).toBe('Securitate');
  });

  it('a late answer does not bring a cleared search back', async () => {
    await open();
    type('fundal');
    type('');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.queryByText(/^Rezultate pentru/)).toBeNull();
    expect(heading()).toBe('Toate');
  });
});

describe('App: the catalog changes during a search', () => {
  it('asks again and lands a matching arrival with its tape', async () => {
    await open();
    await search('fundal');
    expect(titles()).toEqual(['Alfa', 'Beta']);

    const arrival = tool('Nou', 'fundal verde');
    current = [arrival, ...catalog];
    await act(() => store.reload());

    await waitFor(() => expect(titles()).toEqual(['Nou', 'Alfa', 'Beta']));
    expect(document.querySelector('.arrival-tape')).not.toBeNull();
    expect(
      document.querySelector('.section-header-label')?.textContent,
    ).toContain('3 fișe');
    expect(asked).toEqual(['fundal', 'fundal']);
  });

  it('keeps the last results and shows a toast when the search fails', async () => {
    await open();
    await search('fundal');

    failing = true;
    current = [tool('Nou', 'fundal verde'), ...catalog];
    await act(() => store.reload());

    await screen.findByText('Căutarea nu a reușit.');
    expect(titles()).toEqual(['Alfa', 'Beta']);
    expect(heading()).toBe('Rezultate pentru „fundal”');
  });
});

describe('App: Ctrl K', () => {
  it.each(['KeyK', 'KeyF'])(
    '%s focuses the box and selects its text',
    async (code) => {
      await open();
      type('fundal');
      expect(document.activeElement).not.toBe(box());

      fireEvent.keyDown(document.body, { code, ctrlKey: true });

      expect(document.activeElement).toBe(box());
      expect(box().selectionStart).toBe(0);
      expect(box().selectionEnd).toBe('fundal'.length);
    },
  );
});
