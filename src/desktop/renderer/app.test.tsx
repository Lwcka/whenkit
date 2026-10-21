import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryDto, IpcResult, CatalogSnapshotDto } from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import { App, type FrameApi } from './app';
import { createCatalogStore } from './catalog-store';
import { applyTheme } from './theme';
import { makeCategory, makeEntry } from './test-fixtures';
import { toasts } from './toast-store';

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
});

afterEach(cleanup);

function fakeApi(overrides: Partial<FrameApi> = {}): FrameApi {
  return {
    workspacePath: 'C:\\Users\\Luca\\Programe\\whenkit',
    searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
    setNotes: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    deleteEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    patchEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    setTheme: () => Promise.resolve({ ok: true, data: null }),
    setZoomFactor: () => {},
    renameCategory: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    mergeCategories: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    deleteCategory: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    openExternal: () => Promise.resolve({ ok: true, data: null }),
    ...overrides,
  };
}

function entry(
  id: string,
  name: string,
  zone: EntryDto['zone'],
  whatItDoes: string,
): EntryDto {
  return {
    id,
    ownerId: 'owner',
    kind: zone === 'toolbox' ? 'tool' : 'concept',
    zone,
    name,
    url: null,
    resourceType: null,
    categories: [],
    relatedIds: [],
    parentIds: [],
    childIds: [],
    whatItDoes,
    situations: [],
    keywords: [],
    sources: [],
    content: null,
    myNotes: '',
    githubStars: null,
    githubPushedAt: null,
    githubArchived: null,
    verificationNotes: [],
    forced: false,
    revision: 1,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
  };
}

async function renderWith(
  result: IpcResult<CatalogSnapshotDto>,
  api: FrameApi = fakeApi(),
) {
  const store = createCatalogStore({
    catalogSnapshot: () => Promise.resolve(result),
  });
  const view = render(<App store={store} api={api} />);
  await act(() => store.load());
  return view;
}

describe('App', () => {
  it('draws only the title bar while loading', () => {
    const store = createCatalogStore({
      catalogSnapshot: () => new Promise(() => {}),
    });
    render(<App store={store} api={fakeApi()} />);
    expect(screen.getByText('WhenKit')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows Toolbox first and switches zones, keeping the snapshot order', async () => {
    await renderWith({
      ok: true,
      data: {
        categories: [],
        entries: [
          entry('1', 'Zeta tool', 'toolbox', 'Prima.'),
          entry('2', 'Un concept', 'learn', 'Învățare.'),
          entry('3', 'Alfa tool', 'toolbox', 'A doua.'),
          entry('4', 'Alt concept', 'learn', 'Încă una.'),
        ],
      },
    });

    const tabs = screen.getAllByRole('tab');
    // Each tab carries its zone's live counter.
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Toolbox2', 'Learn2']);
    expect(
      screen
        .getByRole('tab', { name: /^Toolbox/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    // Snapshot order, not alphabetical.
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Zeta tool', 'Alfa tool']);
    expect(screen.getByText('Prima.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));

    expect(
      screen.getByRole('tab', { name: /^Learn/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Un concept', 'Alt concept']);
  });

  it.each([
    [
      'WORKSPACE_NOT_CONFIGURED',
      'Nu găsesc workspace-ul.',
      'whenkit init <cale>',
    ],
    [
      'DATABASE_NEEDS_MIGRATION',
      'Catalogul trebuie actualizat.',
      'whenkit init',
    ],
    ['DATABASE_TOO_NEW', 'Catalogul e mai nou decât WhenKit.', undefined],
    ['INTERNAL', 'WhenKit nu a putut porni.', undefined],
  ] as const)('shows only app-error for %s', async (code, title, command) => {
    await renderWith({ ok: false, error: { code } });

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(errorMessages[code])).toBeTruthy();
    expect(screen.getByText(code)).toBeTruthy();
    expect(screen.getByText('Apoi repornește WhenKit.')).toBeTruthy();
    if (command !== undefined) {
      expect(screen.getByText(command)).toBeTruthy();
    }
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows INTERNAL when the bridge itself rejects', async () => {
    const store = createCatalogStore({
      catalogSnapshot: () => Promise.reject(new Error('ipc down')),
    });
    render(<App store={store} api={fakeApi()} />);
    await act(() => store.load());
    expect(screen.getByText('INTERNAL')).toBeTruthy();
  });
});

describe('App frame', () => {
  const snapshot: IpcResult<CatalogSnapshotDto> = {
    ok: true,
    data: {
      categories: [],
      entries: [
        entry('1', 'Zeta tool', 'toolbox', 'Prima.'),
        entry('2', 'Un concept', 'learn', 'Învățare.'),
      ],
    },
  };

  it('switches zones with Ctrl+1 and Ctrl+2', async () => {
    await renderWith(snapshot);

    fireEvent.keyDown(document, { code: 'Digit2', ctrlKey: true });
    expect(
      screen.getByRole('tab', { name: /^Learn/ }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.keyDown(document, { code: 'Digit1', ctrlKey: true });
    expect(
      screen
        .getByRole('tab', { name: /^Toolbox/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('zooms through the bridge on Ctrl+=', async () => {
    const setZoomFactor = vi.fn();
    await renderWith(snapshot, fakeApi({ setZoomFactor }));

    fireEvent.keyDown(document, { code: 'Equal', ctrlKey: true });
    fireEvent.keyDown(document, { code: 'Digit0', ctrlKey: true });
    expect(setZoomFactor.mock.calls).toEqual([[1.1], [1]]);
  });

  it('shows the title bar and the status bar from the catalog store', async () => {
    await renderWith(snapshot);

    expect(screen.getByText('WhenKit')).toBeTruthy();
    expect(screen.getByText('Catalog la zi')).toBeTruthy();
    expect(screen.getByText(/^2 fișe · ultima adăugată /)).toBeTruthy();
  });

  it('keeps the title bar next to the startup error', async () => {
    await renderWith({ ok: false, error: { code: 'INTERNAL' } });

    expect(screen.getByRole('switch')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('Browsing by category', () => {
  const ai = makeCategory('c-ai', 'AI & LLM');
  const imagini = makeCategory('c-img', 'Imagini & video');
  const securitate = makeCategory('c-sec', 'Securitate');
  const backend = makeCategory('c-api', 'Backend & API-uri', 'learn');
  const algoritmi = makeCategory('c-alg', 'Algoritmi', 'learn');

  const categories = [securitate, imagini, ai, backend, algoritmi];
  const entries = [
    makeEntry('Comfy', { categories: [ai, imagini] }),
    makeEntry('Squoosh', { categories: [imagini] }),
    makeEntry('Photopea', { categories: [ai] }),
    makeEntry('Webhook', { zone: 'learn', categories: [backend] }),
  ];
  const snapshot: IpcResult<CatalogSnapshotDto> = {
    ok: true,
    data: { categories, entries },
  };

  const chip = (name: RegExp) => screen.getByRole('radio', { name });
  const chipTexts = () =>
    screen.getAllByRole('radio').map((radio) => radio.textContent);
  const selectedChip = () =>
    screen
      .getAllByRole('radio')
      .find((radio) => radio.getAttribute('aria-checked') === 'true');
  const cardNames = () =>
    screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  const press = (code: string) => fireEvent.keyDown(document, { code });

  it('lists Toate first and the zone categories in Romanian order, with counters', async () => {
    await renderWith(snapshot);

    expect(chipTexts()).toEqual([
      'Toate 3',
      'AI & LLM 2',
      'Imagini & video 2',
      'Securitate 0',
    ]);
    expect(selectedChip()?.textContent).toBe('Toate 3');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Toate');
    expect(screen.getByText('3 fișe')).toBeTruthy();
    expect(cardNames()).toEqual(['Comfy', 'Squoosh', 'Photopea']);
  });

  it('shows only the entries of the chosen category, in snapshot order', async () => {
    await renderWith(snapshot);

    fireEvent.click(chip(/^Imagini/));

    expect(selectedChip()?.textContent).toBe('Imagini & video 2');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Imagini & video',
    );
    expect(screen.getByText('2 fișe')).toBeTruthy();
    // A two-category entry appears under both of its categories, once under Toate.
    expect(cardNames()).toEqual(['Comfy', 'Squoosh']);
    fireEvent.click(chip(/^AI/));
    expect(cardNames()).toEqual(['Comfy', 'Photopea']);
    fireEvent.click(chip(/^Toate/));
    expect(cardNames().filter((name) => name === 'Comfy')).toHaveLength(1);
  });

  it('names a two-category card by its first category and adds +1', async () => {
    await renderWith(snapshot);

    const comfy = screen.getByRole('button', { name: 'Comfy' });
    expect(comfy.querySelector('.entry-card-category')?.textContent).toBe(
      'AI & LLM',
    );
    expect(
      comfy.querySelector('.entry-card-more-categories')?.textContent,
    ).toBe('+1');
  });

  it('stamps the cards of Learn and not those of Toolbox', async () => {
    const { container } = await renderWith(snapshot);

    expect(container.querySelectorAll('.kind-stamp')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    expect(container.querySelectorAll('.kind-stamp')).toHaveLength(1);
  });

  it('moves between categories with ] and [, clamped at the ends', async () => {
    await renderWith(snapshot);

    press('BracketLeft');
    expect(selectedChip()?.textContent).toMatch(/^Toate/);
    press('BracketRight');
    expect(selectedChip()?.textContent).toMatch(/^AI/);
    press('BracketRight');
    press('BracketRight');
    expect(selectedChip()?.textContent).toMatch(/^Securitate/);
    press('BracketRight');
    expect(selectedChip()?.textContent).toMatch(/^Securitate/);
    press('BracketLeft');
    expect(selectedChip()?.textContent).toMatch(/^Imagini/);
  });

  it('ignores [ and ] while typing in a text field', async () => {
    await renderWith(snapshot);
    const input = document.createElement('input');
    document.body.append(input);

    fireEvent.keyDown(input, { code: 'BracketRight' });
    expect(selectedChip()?.textContent).toMatch(/^Toate/);
    input.remove();
  });

  it('remembers the category of each zone while the app runs', async () => {
    await renderWith(snapshot);

    fireEvent.click(chip(/^AI/));
    fireEvent.keyDown(document, { code: 'Digit2', ctrlKey: true });
    // Learn starts on Toate and keeps its own category from here on.
    expect(selectedChip()?.textContent).toMatch(/^Toate/);
    fireEvent.click(chip(/^Backend/));
    fireEvent.keyDown(document, { code: 'Digit1', ctrlKey: true });

    expect(selectedChip()?.textContent).toMatch(/^AI/);
    fireEvent.keyDown(document, { code: 'Digit2', ctrlKey: true });
    expect(selectedChip()?.textContent).toMatch(/^Backend/);
  });

  it('falls back to Toate when the remembered category leaves the snapshot', async () => {
    let result = snapshot;
    const store = createCatalogStore({
      catalogSnapshot: () => Promise.resolve(result),
    });
    render(<App store={store} api={fakeApi()} />);
    await act(() => store.load());
    fireEvent.click(chip(/^Securitate/));
    expect(selectedChip()?.textContent).toMatch(/^Securitate/);

    result = {
      ok: true,
      data: { categories: [ai, imagini, backend, algoritmi], entries },
    };
    await act(() => store.load());

    expect(selectedChip()?.textContent).toMatch(/^Toate/);
    expect(cardNames()).toEqual(['Comfy', 'Squoosh', 'Photopea']);
  });

  it('keeps the grid a single Tab stop and moves with the arrows', async () => {
    await renderWith(snapshot);

    const cards = screen
      .getAllByRole('button')
      .filter((button) => button.classList.contains('entry-card'));
    expect(cards.filter((card) => card.tabIndex === 0)).toHaveLength(1);
    act(() => cards[0]?.focus());
    // jsdom has no layout, so the grid counts as one column: down moves by one.
    fireEvent.keyDown(cards[0] as HTMLElement, { code: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[1]);
    expect(cards.filter((card) => card.tabIndex === 0)).toEqual([cards[1]]);
  });

  it('keeps the focus in the grid when the view changes under it', async () => {
    await renderWith(snapshot);

    const cards = () =>
      screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('entry-card'));
    act(() => cards()[2]?.focus());
    expect(document.activeElement).toBe(cards()[2]);

    press('BracketRight');
    // The grid was remounted: the focus is on the new grid's Tab stop.
    expect(document.activeElement?.classList.contains('entry-card')).toBe(true);
    expect(document.activeElement).toBe(
      cards().find((card) => card.tabIndex === 0),
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, {
      code: 'ArrowDown',
    });
    expect(document.activeElement).toBe(cards()[1]);

    // Across zones too.
    fireEvent.keyDown(document, { code: 'Digit2', ctrlKey: true });
    expect(document.activeElement?.classList.contains('entry-card')).toBe(true);
  });

  it('moves the focus to the checked chip when [ or ] is pressed on a chip', async () => {
    await renderWith(snapshot);

    act(() => chip(/^Toate/).focus());
    press('BracketRight');

    expect(document.activeElement).toBe(selectedChip());
    expect(selectedChip()?.textContent).toMatch(/^AI/);
  });

  it('shows the small empty-state for a category without entries', async () => {
    await renderWith(snapshot);

    fireEvent.click(chip(/^Securitate/));

    expect(screen.getByText('Nicio fișă în „Securitate” încă.')).toBeTruthy();
    expect(screen.getByText('0 fișe')).toBeTruthy();
    expect(screen.queryByText('Catalogul e gol.')).toBeNull();
  });

  it('names the zone in the small empty-state under Toate', async () => {
    await renderWith({
      ok: true,
      data: {
        categories,
        entries: [makeEntry('Unealta', { categories: [ai] })],
      },
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));

    expect(screen.getByText('Nicio fișă în „Learn” încă.')).toBeTruthy();
  });

  it('shows the big empty-state for an empty catalog, with the categories at 0', async () => {
    await renderWith({ ok: true, data: { categories, entries: [] } });

    expect(screen.getByText('Catalogul e gol.')).toBeTruthy();
    expect(screen.getByText('Spune-i lui Claude ce ai găsit:')).toBeTruthy();
    expect(screen.getByText('/importa')).toBeTruthy();
    expect(chipTexts()).toEqual([
      'Toate 0',
      'AI & LLM 0',
      'Imagini & video 0',
      'Securitate 0',
    ]);
  });
});

describe('Startup skeleton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const skeleton = () => screen.queryByRole('status', { name: /Se încarcă/ });

  it('appears only when the snapshot takes longer than 200 ms', () => {
    vi.useFakeTimers();
    const store = createCatalogStore({
      catalogSnapshot: () => new Promise(() => {}),
    });
    const { container } = render(<App store={store} api={fakeApi()} />);

    act(() => vi.advanceTimersByTime(199));
    expect(skeleton()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(skeleton()).not.toBeNull();
    expect(container.querySelectorAll('.entry-card-skeleton')).toHaveLength(6);
    // The title bar is there all along; the toolbar waits for the snapshot.
    expect(screen.getByText('WhenKit')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('never appears when the snapshot arrives sooner', async () => {
    vi.useFakeTimers();
    let resolve: (value: IpcResult<CatalogSnapshotDto>) => void = () => {};
    const store = createCatalogStore({
      catalogSnapshot: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    render(<App store={store} api={fakeApi()} />);

    act(() => vi.advanceTimersByTime(100));
    const loading = store.load();
    resolve({ ok: true, data: { categories: [], entries: [] } });
    await act(() => loading);
    act(() => vi.advanceTimersByTime(500));

    expect(skeleton()).toBeNull();
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});
