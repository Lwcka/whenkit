import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogSnapshotDto, EntryDto, IpcResult } from '../../shared/ipc';
import { App, type FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import { makeCategory, makeEntry } from './test-fixtures';
import { applyTheme } from './theme';
import { toasts } from './toast-store';

// The sheet of an entry and the way between sheets (CAP-10, Flow 7): the real
// store and the real App.

const imagini = makeCategory('c-img', 'Imagini & video');
const securitate = makeCategory('c-sec', 'Securitate');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const categories = [imagini, securitate, backend];

const removeBg = makeEntry('removebg', {
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: [imagini],
  whatItDoes: 'Scoate fundalul din poze.',
  situations: ['scot fundalul', 'poze de produs'],
  relatedIds: ['photopea'],
});
const photopea = makeEntry('photopea', {
  name: 'Photopea',
  categories: [imagini],
  relatedIds: ['removebg'],
});
const nmap = makeEntry('nmap', { name: 'Nmap', categories: [securitate] });
const umbrella = makeEntry('umbrella', {
  zone: 'learn',
  name: 'Tipuri de API',
  categories: [backend],
  childIds: ['rest', 'graphql'],
  content: 'Comparație\ntabel',
});
const rest = makeEntry('rest', {
  zone: 'learn',
  name: 'REST API',
  categories: [backend],
  parentIds: ['umbrella'],
  relatedIds: ['removebg'],
});
const graphql = makeEntry('graphql', {
  zone: 'learn',
  name: 'GraphQL',
  categories: [backend],
  parentIds: ['umbrella'],
});
const catalog = [removeBg, photopea, nmap, umbrella, rest, graphql];

const api: FrameApi = {
  workspacePath: 'C:\\ws',
  openExternal: () => Promise.resolve({ ok: true, data: null }),
  searchEntries: (text) =>
    Promise.resolve({
      ok: true,
      data: {
        ids: catalog
          .filter((entry) =>
            `${entry.name} ${entry.whatItDoes}`
              .toLowerCase()
              .includes(text.toLowerCase()),
          )
          .map((entry) => entry.id),
      },
    }),
  setNotes: () => Promise.resolve({ ok: true, data: { changed: [] } }),
  setTheme: () => Promise.resolve({ ok: true, data: null }),
  setZoomFactor: () => {},
};

let answers: IpcResult<CatalogSnapshotDto>[];
let store: CatalogStore;

function snapshot(...entries: EntryDto[]): IpcResult<CatalogSnapshotDto> {
  return { ok: true, data: { entries, categories } };
}

// jsdom does no layout, so its scrollTop never keeps what is set.
const scrollTops = new WeakMap<Element, number>();
const scrollTop = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollTop',
);

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  answers = [];
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get() {
      return scrollTops.get(this) ?? 0;
    },
    set(value: number) {
      scrollTops.set(this, value);
    },
  });
  store = createCatalogStore({
    catalogSnapshot: () => {
      const next = answers.shift();
      if (next === undefined) throw new Error('no snapshot queued');
      return Promise.resolve(next);
    },
  });
});

afterEach(() => {
  cleanup();
  if (scrollTop !== undefined) {
    Object.defineProperty(Element.prototype, 'scrollTop', scrollTop);
  }
  document.title = 'WhenKit';
});

async function open(...entries: EntryDto[]) {
  answers.push(snapshot(...(entries.length > 0 ? entries : catalog)));
  render(<App store={store} api={api} />);
  await act(() => store.load());
}

async function reloadWith(...entries: EntryDto[]) {
  answers.push(snapshot(...entries));
  await act(() => store.reload());
}

const card = (name: string) => screen.getByRole('button', { name });
const sheetTitle = () =>
  document.querySelector('.entry-sheet .sheet-title')?.textContent ?? null;
const crumbs = () =>
  [...document.querySelectorAll('.sheet-bar .crumb')].map(
    (crumb) => crumb.textContent,
  );
const selectedTab = () =>
  screen
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent?.replace(/\d+$/, '');
const checkedChip = () =>
  screen
    .queryAllByRole('radio')
    .find((chip) => chip.getAttribute('aria-checked') === 'true')?.textContent;
const listShown = () => document.querySelector('.card-grid') !== null;
const keyHints = () =>
  [...document.querySelectorAll('.status-keys kbd')].map((k) => k.textContent);
const pressEscape = () => fireEvent.keyDown(document.body, { code: 'Escape' });
const scroller = () =>
  document.querySelector('.list-view .shell-scroll') as HTMLElement;

describe('App: opening a sheet', () => {
  it('opens on click: the sheet replaces the bar and the grid, the toolbar stays', async () => {
    await open();
    fireEvent.click(card('remove.bg'));

    expect(sheetTitle()).toBe('remove.bg');
    expect(crumbs()).toEqual(['Toolbox', 'Imagini & video', 'remove.bg']);
    expect(document.title).toBe('remove.bg — WhenKit');
    expect(keyHints()).toEqual(['Esc']);
    expect(listShown()).toBe(false);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('searchbox')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(selectedTab()).toBe('Toolbox');
    expect(document.activeElement?.classList.contains('entry-sheet')).toBe(
      true,
    );
  });

  it('opens on Enter from the focused card', async () => {
    await open();
    card('Photopea').focus();
    fireEvent.keyDown(card('Photopea'), { code: 'Enter' });
    expect(sheetTitle()).toBe('Photopea');
  });

  it('goes back with Esc, the „Înapoi” button, Alt+Left and the mouse back button', async () => {
    await open();

    const openAgain = () => {
      fireEvent.click(card('remove.bg'));
      expect(sheetTitle()).toBe('remove.bg');
    };

    openAgain();
    pressEscape();
    expect(listShown()).toBe(true);
    expect(document.title).toBe('WhenKit');
    expect(keyHints()).toEqual(['Ctrl K', 'Enter']);

    openAgain();
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }));
    expect(listShown()).toBe(true);

    openAgain();
    fireEvent.keyDown(document.body, { code: 'ArrowLeft', altKey: true });
    expect(listShown()).toBe(true);

    openAgain();
    fireEvent.mouseDown(document.body, { button: 3 });
    expect(sheetTitle()).toBe('remove.bg');
    const prevented = !fireEvent.mouseUp(document.body, { button: 3 });
    expect(prevented).toBe(true);
    expect(listShown()).toBe(true);
  });

  it('ignores Alt+Left and the mouse back button on the list', async () => {
    await open();
    expect(
      fireEvent.keyDown(document.body, { code: 'ArrowLeft', altKey: true }),
    ).toBe(true);
    expect(fireEvent.mouseUp(document.body, { button: 3 })).toBe(true);
    expect(listShown()).toBe(true);
  });

  it('ignores [ ] , the arrows and Enter in the sheet', async () => {
    await open();
    fireEvent.click(card('remove.bg'));

    for (const code of [
      'BracketLeft',
      'BracketRight',
      'ArrowLeft',
      'ArrowRight',
      'ArrowDown',
      'Enter',
    ]) {
      fireEvent.keyDown(document.activeElement ?? document.body, { code });
    }
    expect(sheetTitle()).toBe('remove.bg');
    expect(crumbs()).toHaveLength(3);

    pressEscape();
    expect(checkedChip()).toMatch(/^Toate/);
  });
});

describe('App: the stack (Flow 7)', () => {
  it('umbrella, child, Esc, Esc: the list as it was left', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Backend/ }));
    scroller().scrollTop = 240;
    card('Tipuri de API').focus();
    fireEvent.click(card('Tipuri de API'));

    expect(sheetTitle()).toBe('Tipuri de API');
    expect(screen.getByText('Concepte · 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^REST API/ }));
    expect(sheetTitle()).toBe('REST API');
    expect(crumbs()).toEqual(['Learn', 'Backend & API-uri', 'REST API']);
    expect(screen.getByText('Face parte din')).toBeTruthy();

    pressEscape();
    expect(sheetTitle()).toBe('Tipuri de API');
    expect(document.title).toBe('Tipuri de API — WhenKit');

    pressEscape();
    expect(listShown()).toBe(true);
    expect(selectedTab()).toBe('Learn');
    expect(checkedChip()).toMatch(/^Backend/);
    expect(scroller().scrollTop).toBe(240);
    expect(document.activeElement).toBe(card('Tipuri de API'));
    // The origin card is the Tab stop of the new grid.
    expect(card('Tipuri de API').tabIndex).toBe(0);

    pressEscape();
    expect(listShown()).toBe(true);
  });

  it('follows a link to the other zone and returns to the zone it left', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    fireEvent.click(card('REST API'));
    fireEvent.click(screen.getByRole('button', { name: /^remove.bg/ }));

    expect(sheetTitle()).toBe('remove.bg');
    expect(selectedTab()).toBe('Toolbox');
    expect(crumbs()[0]).toBe('Toolbox');

    pressEscape();
    expect(sheetTitle()).toBe('REST API');
    expect(selectedTab()).toBe('Learn');

    pressEscape();
    expect(listShown()).toBe(true);
    expect(selectedTab()).toBe('Learn');
    expect(document.activeElement).toBe(card('REST API'));
  });

  it('a zone tab drops the stack and shows that zone with its remembered category', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    fireEvent.click(card('Nmap'));
    expect(sheetTitle()).toBe('Nmap');

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(listShown()).toBe(true);
    expect(selectedTab()).toBe('Learn');
    expect(document.title).toBe('WhenKit');

    fireEvent.click(screen.getByRole('tab', { name: /^Toolbox/ }));
    expect(checkedChip()).toMatch(/^Securitate/);
    // Nothing is left to restore on a later Esc.
    pressEscape();
    expect(listShown()).toBe(true);
    expect(document.activeElement).not.toBe(card('Nmap'));
  });

  it('Ctrl+2 from a sheet shows the Learn list', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    fireEvent.keyDown(document.body, { code: 'Digit2', ctrlKey: true });

    expect(listShown()).toBe(true);
    expect(selectedTab()).toBe('Learn');
    expect(screen.queryByRole('button', { name: 'remove.bg' })).toBeNull();
  });
});

describe('App: search from a sheet', () => {
  it('typing goes back to the list with the results', async () => {
    await open();
    fireEvent.click(card('remove.bg'));

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'photopea' },
    });
    await screen.findByText('Rezultate pentru „photopea”');

    expect(sheetTitle()).toBeNull();
    expect(listShown()).toBe(true);
    expect(card('Photopea')).toBeTruthy();
    expect(document.title).toBe('WhenKit');
  });

  it('Esc in the box clears the text first and stays on the sheet', async () => {
    await open();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'remove' },
    });
    await screen.findByText('Rezultate pentru „remove”');
    fireEvent.click(card('remove.bg'));
    expect(sheetTitle()).toBe('remove.bg');

    const box = screen.getByRole<HTMLInputElement>('searchbox');
    box.focus();
    fireEvent.keyDown(box, { code: 'Escape' });
    expect(box.value).toBe('');
    expect(sheetTitle()).toBe('remove.bg');

    pressEscape();
    expect(listShown()).toBe(true);
  });

  it('Esc from a sheet opened from results goes back to the results', async () => {
    await open();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'remove' },
    });
    await screen.findByText('Rezultate pentru „remove”');
    fireEvent.click(card('remove.bg'));

    pressEscape();
    expect(screen.getByText('Rezultate pentru „remove”')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe(
      'remove',
    );
    expect(document.activeElement).toBe(card('remove.bg'));
  });
});

describe('App: arrivals and sheets', () => {
  it('opening a fresh arrival ends its tape, ring and count for good', async () => {
    await open(removeBg);
    await reloadWith(photopea, removeBg);
    expect(document.querySelector('.entry-card[data-new]')).not.toBeNull();
    expect(document.querySelector('.section-header-label')?.textContent).toBe(
      '2 fișe · 1 nouă',
    );

    fireEvent.click(card('Photopea'));
    pressEscape();

    expect(document.querySelector('.entry-card[data-new]')).toBeNull();
    expect(document.querySelector('.arrival-tape')).toBeNull();
    expect(document.querySelector('.section-header-label')?.textContent).toBe(
      '2 fișe',
    );
  });

  it('„Deschide” on a single-arrival toast opens that sheet', async () => {
    await open(removeBg);
    await reloadWith(photopea, removeBg);

    fireEvent.click(screen.getByRole('button', { name: 'Deschide' }));
    expect(sheetTitle()).toBe('Photopea');

    pressEscape();
    expect(listShown()).toBe(true);
    expect(document.querySelector('.entry-card[data-new]')).toBeNull();
  });

  it('„Deschide” pushes onto a sheet that is already open', async () => {
    await open(removeBg);
    fireEvent.click(card('remove.bg'));
    await reloadWith(photopea, removeBg);

    fireEvent.click(screen.getByRole('button', { name: 'Deschide' }));
    expect(sheetTitle()).toBe('Photopea');

    pressEscape();
    expect(sheetTitle()).toBe('remove.bg');
    pressEscape();
    expect(listShown()).toBe(true);
  });

  it('a multi-entry toast keeps only „Vezi”', async () => {
    await open(removeBg);
    await reloadWith(nmap, photopea, removeBg);
    expect(screen.queryByRole('button', { name: 'Deschide' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Vezi' })).toBeTruthy();
  });

  it('„Vezi” from a sheet leaves it for the list of that zone', async () => {
    await open(removeBg);
    fireEvent.click(card('remove.bg'));
    await reloadWith(nmap, photopea, removeBg);

    fireEvent.click(screen.getByRole('button', { name: 'Vezi' }));
    expect(listShown()).toBe(true);
    expect(sheetTitle()).toBeNull();
  });

  it('refreshes an open entry in place and pulses it once per update', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    const sheetNode = document.querySelector('.entry-sheet');
    expect(sheetNode?.hasAttribute('data-pulse')).toBe(false);

    await reloadWith(
      { ...removeBg, revision: 2, whatItDoes: 'Fundal scos mai bine.' },
      ...catalog.slice(1),
    );
    const sheetAfter = document.querySelector('.entry-sheet');
    expect(sheetAfter).toBe(sheetNode);
    expect(document.querySelector('.sheet-lead')?.textContent).toBe(
      'Fundal scos mai bine.',
    );
    expect(sheetAfter?.getAttribute('data-pulse')).toBe('a');
    expect(document.querySelector('.title-block-head')?.textContent).toContain(
      'rev. 2',
    );

    await reloadWith(
      { ...removeBg, revision: 3, whatItDoes: 'Din nou.' },
      ...catalog.slice(1),
    );
    expect(
      document.querySelector('.entry-sheet')?.getAttribute('data-pulse'),
    ).toBe('b');
  });

  it('an entry that vanishes leaves the stack: the previous sheet, then the list', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    fireEvent.click(screen.getByRole('button', { name: /^Photopea/ }));
    expect(sheetTitle()).toBe('Photopea');

    await reloadWith(removeBg, nmap, umbrella, rest, graphql);
    await waitFor(() => expect(sheetTitle()).toBe('remove.bg'));
    expect(screen.queryByRole('button', { name: /^Photopea/ })).toBeNull();

    await reloadWith(nmap, umbrella, rest, graphql);
    await waitFor(() => expect(listShown()).toBe(true));
    expect(document.title).toBe('WhenKit');
    expect(keyHints()).toEqual(['Ctrl K', 'Enter']);
  });
});
