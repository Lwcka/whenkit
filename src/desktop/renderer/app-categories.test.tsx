import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CatalogSnapshotDto,
  CategoryDto,
  EntryDto,
  IpcResult,
  WriteResult,
} from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import { App, type FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import { makeCategory, makeEntry } from './test-fixtures';
import { applyTheme } from './theme';
import { toasts } from './toast-store';

// Category management through the real App and the real store, with a fake
// bridge that answers like main's `categories:*` channels (CAP-11, Flow 5).

const mockups = makeCategory('c-mock', 'Mockup-uri & capturi de cod');
const imagini = makeCategory('c-img', 'Imagini & video');
const design = makeCategory('c-des', 'Design & UI');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const initialCategories: CategoryDto[] = [mockups, imagini, design, backend];

const initialEntries: EntryDto[] = [
  makeEntry('a', { name: 'Alfa', categories: [mockups] }),
  makeEntry('b', { name: 'Beta', categories: [mockups, design] }),
  makeEntry('c', { name: 'Gama', categories: [imagini] }),
  makeEntry('l', { zone: 'learn', name: 'Rest', categories: [backend] }),
];

let categories: CategoryDto[];
let entries: EntryDto[];
let api: FrameApi;
let store: CatalogStore;
let rename: ReturnType<
  typeof vi.fn<(id: string, name: string) => Promise<IpcResult<WriteResult>>>
>;
let merge: ReturnType<
  typeof vi.fn<
    (source: string, target: string) => Promise<IpcResult<WriteResult>>
  >
>;
let remove: ReturnType<
  typeof vi.fn<(id: string, target?: string) => Promise<IpcResult<WriteResult>>>
>;

/** What main would answer after moving the entries of `sourceId` to `targetId`. */
function merged(sourceId: string, targetId: string): IpcResult<WriteResult> {
  const target = categories.find((category) => category.id === targetId);
  if (target === undefined) {
    return { ok: false, error: { code: 'CATEGORY_NOT_FOUND' } };
  }
  const changed = entries
    .filter((entry) => entry.categories.some((c) => c.id === sourceId))
    .map((entry) => ({
      ...entry,
      revision: entry.revision + 1,
      categories: [
        ...new Map(
          entry.categories
            .map((c) => (c.id === sourceId ? target : c))
            .map((c) => [c.id, { id: c.id, name: c.name }]),
        ).values(),
      ],
    }));
  categories = categories.filter((category) => category.id !== sourceId);
  entries = entries.map(
    (entry) => changed.find((c) => c.id === entry.id) ?? entry,
  );
  return { ok: true, data: { changed, categories: [...categories] } };
}

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  categories = [...initialCategories];
  entries = [...initialEntries];
  rename = vi.fn((id: string, name: string) => {
    categories = categories.map((c) => (c.id === id ? { ...c, name } : c));
    entries = entries.map((entry) => ({
      ...entry,
      categories: entry.categories.map((c) => (c.id === id ? { id, name } : c)),
    }));
    return Promise.resolve({
      ok: true,
      data: {
        changed: entries.filter((entry) =>
          entry.categories.some((c) => c.id === id),
        ),
        categories: [...categories],
      },
    });
  });
  merge = vi.fn((source: string, target: string) =>
    Promise.resolve(merged(source, target)),
  );
  remove = vi.fn((id: string, target?: string) => {
    if (target !== undefined) return Promise.resolve(merged(id, target));
    categories = categories.filter((category) => category.id !== id);
    return Promise.resolve<IpcResult<WriteResult>>({
      ok: true,
      data: { changed: [], categories: [...categories] },
    });
  });
  api = {
    workspacePath: 'C:\\ws',
    openExternal: () => Promise.resolve({ ok: true, data: null }),
    exportCatalog: () => Promise.resolve({ ok: true, data: null }),
    openExportFolder: () => Promise.resolve({ ok: true, data: null }),
    searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
    setNotes: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    deleteEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    patchEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    setTheme: () => Promise.resolve({ ok: true, data: null }),
    setZoomFactor: () => {},
    renameCategory: rename,
    mergeCategories: merge,
    deleteCategory: remove,
  };
  store = createCatalogStore({
    catalogSnapshot: () =>
      Promise.resolve({
        ok: true,
        data: { entries, categories },
      } satisfies IpcResult<CatalogSnapshotDto>),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.title = 'WhenKit';
});

async function open() {
  render(<App store={store} api={api} />);
  await act(() => store.load());
}

const toolbarButton = () => screen.getByRole('button', { name: 'Categorii' });
const dialog = () => screen.queryByRole('dialog');
const chipTexts = () =>
  screen.getAllByRole('radio').map((radio) => radio.textContent);
const selectedChip = () =>
  screen
    .getAllByRole('radio')
    .find((radio) => radio.getAttribute('aria-checked') === 'true')
    ?.textContent;
const row = (name: string) => screen.getByRole('listitem', { name });
const rowButton = (name: string, action: RegExp) =>
  within(row(name)).getByRole('button', { name: action });
const press = (code: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { code });

async function openManager() {
  toolbarButton().focus();
  fireEvent.click(toolbarButton());
  expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
}

describe('App: category manager', () => {
  it('opens from „Categorii” in the toolbar and gives the focus back on close', async () => {
    await open();
    expect(dialog()).toBeNull();

    await openManager();
    press('Escape');

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(toolbarButton());
  });

  it('closes with „Închide” and returns the focus to the toolbar button', async () => {
    await open();
    await openManager();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Închide/,
      }),
    );
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(toolbarButton());
  });

  it('renames: the bar shows the new name at once and the dialog stays', async () => {
    await open();
    expect(chipTexts()).toEqual([
      'Toate 3',
      'Design & UI 1',
      'Imagini & video 1',
      'Mockup-uri & capturi de cod 2',
    ]);
    await openManager();
    fireEvent.click(rowButton('Mockup-uri & capturi de cod', /^Redenumește/));
    const field = screen.getByRole('textbox', { name: 'Numele categoriei' });
    fireEvent.change(field, { target: { value: 'Mockup-uri' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });

    expect(rename).toHaveBeenCalledWith('c-mock', 'Mockup-uri');
    expect(row('Mockup-uri').textContent).toContain('2 fișe');
    expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
    // The entries keep their revision: a rename is not an edit.
    const state = store.getState();
    expect(
      state.status === 'ready' && state.entries.map((e) => e.revision),
    ).toEqual([1, 1, 1, 1]);

    press('Escape');
    expect(chipTexts()).toContain('Mockup-uri 2');
    expect(chipTexts().join()).not.toContain('Mockup-uri &');
  });

  it('merges: the bar and the counters follow, and the active category falls back to Toate', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Mockup-uri/ }));
    expect(selectedChip()).toBe('Mockup-uri & capturi de cod 2');

    await openManager();
    fireEvent.click(rowButton('Mockup-uri & capturi de cod', /^Unifică…/));
    const box = screen.getByRole('dialog', {
      name: 'Unifică „Mockup-uri & capturi de cod”',
    });
    fireEvent.change(within(box).getByRole('combobox'), {
      target: { value: 'c-des' },
    });
    await act(async () => {
      fireEvent.click(within(box).getByRole('button', { name: 'Unifică' }));
    });

    expect(merge).toHaveBeenCalledWith('c-mock', 'c-des');
    // Back in the manager, which no longer lists the source.
    expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
    expect(
      screen.queryByRole('listitem', { name: 'Mockup-uri & capturi de cod' }),
    ).toBeNull();
    expect(row('Design & UI').textContent).toContain('2 fișe');

    press('Escape');
    expect(selectedChip()).toBe('Toate 3');
    expect(chipTexts()).toEqual([
      'Toate 3',
      'Design & UI 2',
      'Imagini & video 1',
    ]);
  });

  it('deletes with a target: the active category falls back to Toate', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /^Imagini/ }));
    await openManager();
    fireEvent.click(rowButton('Imagini & video', /^Șterge/));
    const box = screen.getByRole('dialog', {
      name: 'Ștergi „Imagini & video”?',
    });
    expect(box.textContent).toContain('1 fișă are doar categoria asta.');
    fireEvent.change(within(box).getByRole('combobox'), {
      target: { value: 'c-des' },
    });
    await act(async () => {
      fireEvent.click(within(box).getByRole('button', { name: 'Șterge' }));
    });

    expect(remove).toHaveBeenCalledWith('c-img', 'c-des');
    press('Escape');
    expect(selectedChip()).toBe('Toate 3');
    expect(chipTexts()).toEqual([
      'Toate 3',
      'Design & UI 2',
      'Mockup-uri & capturi de cod 2',
    ]);
  });

  it('shows a failed write as a toast and keeps the dialog', async () => {
    remove.mockResolvedValue({ ok: false, error: { code: 'DATABASE_BUSY' } });
    await open();
    await openManager();
    fireEvent.click(rowButton('Design & UI', /^Șterge/));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Șterge',
        }),
      );
    });

    expect(toasts.getToasts().map((t) => [t.kind, t.message])).toEqual([
      ['error', errorMessages.DATABASE_BUSY],
    ]);
    expect(
      screen.getByRole('dialog', { name: 'Ștergi „Design & UI”?' }),
    ).toBeTruthy();
    expect(chipTexts()).toContain('Design & UI 1');
  });

  it('lists a category an import adds while it is open', async () => {
    await open();
    await openManager();
    expect(
      screen.queryByRole('listitem', { name: 'Terminal & dev tools' }),
    ).toBeNull();

    categories = [
      ...categories,
      makeCategory('c-term', 'Terminal & dev tools'),
    ];
    await act(() => store.reload());

    expect(row('Terminal & dev tools').textContent).toContain('0 fișe');
    press('Escape');
    expect(chipTexts()).toContain('Terminal & dev tools 0');
  });

  it('is inactive while an entry is edited', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Alfa' }));
    expect(toolbarButton().hasAttribute('disabled')).toBe(false);
    fireEvent.keyDown(document.body, { code: 'KeyE' });
    expect(toolbarButton().hasAttribute('disabled')).toBe(true);
  });
});
