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

// Deleting a sheet (CAP-10, Flow 4): the real store and the real App, with a
// fake bridge that answers like main's `entries:delete`.

const imagini = makeCategory('c-img', 'Imagini & video');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const categories = [imagini, backend];

const removeBg = makeEntry('removebg', {
  name: 'remove.bg',
  categories: [imagini],
  relatedIds: ['photopea'],
});
const photopea = makeEntry('photopea', {
  name: 'Photopea',
  categories: [imagini],
  relatedIds: ['removebg'],
});
const nmap = makeEntry('nmap', { name: 'Nmap', categories: [imagini] });
const umbrella = makeEntry('umbrella', {
  zone: 'learn',
  name: 'Tipuri de API',
  categories: [backend],
  childIds: ['rest', 'graphql'],
});
const rest = makeEntry('rest', {
  zone: 'learn',
  name: 'REST API',
  categories: [backend],
  parentIds: ['umbrella'],
});
const graphql = makeEntry('graphql', {
  zone: 'learn',
  name: 'GraphQL',
  categories: [backend],
  parentIds: ['umbrella'],
});
const securitate = makeCategory('c-sec', 'Securitate');
const lonely = makeEntry('lonely', {
  name: 'Singura',
  categories: [securitate],
});
const catalog = [removeBg, photopea, nmap, umbrella, rest, graphql];

/** What main answers: the entries the deleted one was linked to, without it. */
function answerFor(id: string): IpcResult<WriteResult> {
  const gone = [...catalog, lonely].find((entry) => entry.id === id);
  if (gone === undefined) {
    return { ok: false, error: { code: 'ENTRY_NOT_FOUND' } };
  }
  const linked = new Set([
    ...gone.relatedIds,
    ...gone.parentIds,
    ...gone.childIds,
  ]);
  const without = (ids: readonly string[]) => ids.filter((x) => x !== id);
  const changed = catalog
    .filter((entry) => linked.has(entry.id))
    .map(
      (entry): EntryDto => ({
        ...entry,
        relatedIds: without(entry.relatedIds),
        parentIds: without(entry.parentIds),
        childIds: without(entry.childIds),
      }),
    );
  return { ok: true, data: { changed, removed: [id] } };
}

let deleteEntry: ReturnType<
  typeof vi.fn<(id: string) => Promise<IpcResult<WriteResult>>>
>;
let api: FrameApi;
let store: CatalogStore;

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  deleteEntry = vi.fn((id: string) => Promise.resolve(answerFor(id)));
  api = {
    workspacePath: 'C:\\ws',
    openExternal: () => Promise.resolve({ ok: true, data: null }),
    searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
    setNotes: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    deleteEntry,
    patchEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    setTheme: () => Promise.resolve({ ok: true, data: null }),
    setZoomFactor: () => {},
  };
  const snapshot: IpcResult<CatalogSnapshotDto> = {
    ok: true,
    data: { entries: catalog, categories },
  };
  store = createCatalogStore({
    catalogSnapshot: () => Promise.resolve(snapshot),
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

const card = (name: string) => screen.getByRole('button', { name });
const dialog = () => screen.queryByRole('dialog');
const deleteButton = () =>
  document.querySelector<HTMLElement>(
    '.sheet-bar-actions button[data-variant="danger"]',
  );
const sheetTitle = () =>
  document.querySelector('.entry-sheet .sheet-title')?.textContent ?? null;
const listShown = () => document.querySelector('.card-grid') !== null;
const tabCount = (zone: 'Toolbox' | 'Learn') =>
  screen
    .getAllByRole('tab')
    .find((tab) => tab.textContent?.startsWith(zone))
    ?.textContent?.replace(zone, '');
const pressKey = (code: string, target: Element = document.body) =>
  fireEvent.keyDown(target, { code });

/** Opens the sheet of `name` and the confirmation with the sheet-bar button. */
async function askToDelete(name = 'remove.bg') {
  fireEvent.click(card(name));
  fireEvent.click(screen.getByRole('button', { name: 'Șterge' }));
  expect(dialog()).not.toBeNull();
}

const confirm = async () => {
  await act(async () => {
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', { name: 'Șterge' }),
    );
  });
};

describe('App: deleting a sheet', () => {
  it('opens the confirmation from „Șterge” in the sheet-bar, focus on „Renunță”', async () => {
    await open();
    await askToDelete();

    const box = screen.getByRole('dialog', {
      name: 'Ștergi fișa „remove.bg”?',
    });
    expect(box.textContent).toContain(
      'Se șterg și legăturile ei cu alte fișe. Nu se poate anula.',
    );
    expect(document.activeElement).toBe(
      within(box).getByRole('button', { name: /^Renunță/ }),
    );
    expect(deleteEntry).not.toHaveBeenCalled();
    expect(sheetTitle()).toBe('remove.bg');
  });

  it('opens the confirmation with the Delete key', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    pressKey('Delete');
    expect(screen.getByRole('dialog', { name: 'Ștergi fișa „remove.bg”?' }));
  });

  it('keeps focus in the dialog: Tab cycles between „Renunță” and „Șterge”', async () => {
    await open();
    await askToDelete();
    const box = dialog() as HTMLElement;
    const cancel = within(box).getByRole('button', { name: /^Renunță/ });
    const remove = within(box).getByRole('button', { name: 'Șterge' });

    expect(document.activeElement).toBe(cancel);
    pressKey('Tab', cancel);
    expect(document.activeElement).toBe(remove);
    pressKey('Tab', remove);
    expect(document.activeElement).toBe(cancel);
    pressKey('Tab', cancel);
    fireEvent.keyDown(remove, { code: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  describe('Cancel', () => {
    it('Esc closes only the dialog; the entry and the sheet stay, focus on „Șterge”', async () => {
      await open();
      await askToDelete();

      pressKey('Escape');

      expect(dialog()).toBeNull();
      expect(sheetTitle()).toBe('remove.bg');
      expect(deleteEntry).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(deleteButton());
      // A second Esc goes back, as always.
      pressKey('Escape');
      expect(listShown()).toBe(true);
    });

    it('„Renunță” closes it the same way', async () => {
      await open();
      await askToDelete();
      fireEvent.click(screen.getByRole('button', { name: /^Renunță/ }));

      expect(dialog()).toBeNull();
      expect(sheetTitle()).toBe('remove.bg');
      expect(document.activeElement).toBe(deleteButton());
    });

    it('after the Delete key, Esc also returns the focus to „Șterge”', async () => {
      await open();
      fireEvent.click(card('remove.bg'));
      pressKey('Delete');
      pressKey('Escape');
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(deleteButton());
    });
  });

  describe('Confirm', () => {
    it('shows the button busy while it runs, then is back on the list without the entry', async () => {
      let answer: (result: IpcResult<WriteResult>) => void = () => {};
      deleteEntry.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
      await open();
      expect(tabCount('Toolbox')).toBe('3');
      await askToDelete();

      await confirm();
      const busy = within(dialog() as HTMLElement).getByRole('button', {
        name: /Se șterge/,
      });
      expect(busy.getAttribute('aria-busy')).toBe('true');
      expect((busy as HTMLButtonElement).disabled).toBe(true);
      // Esc does not close it while it runs.
      pressKey('Escape');
      expect(dialog()).not.toBeNull();

      await act(async () => answer(answerFor('removebg')));

      expect(deleteEntry).toHaveBeenCalledWith('removebg');
      expect(dialog()).toBeNull();
      expect(listShown()).toBe(true);
      expect(screen.queryByRole('button', { name: 'remove.bg' })).toBeNull();
      expect(card('Photopea')).toBeTruthy();
      expect(tabCount('Toolbox')).toBe('2');
      expect(document.querySelector('.section-header')?.textContent).toContain(
        '2',
      );
      expect(toasts.getToasts()).toEqual([]);
    });

    it('lands on the same zone, category and scroll the sheet was opened from', async () => {
      await open();
      fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
      fireEvent.click(screen.getByRole('radio', { name: /^Backend/ }));
      await askToDelete('GraphQL');
      await confirm();

      expect(listShown()).toBe(true);
      expect(
        screen
          .getAllByRole('tab')
          .find((tab) => tab.getAttribute('aria-selected') === 'true')
          ?.textContent,
      ).toMatch(/^Learn/);
      expect(
        screen
          .getAllByRole('radio')
          .find((chip) => chip.getAttribute('aria-checked') === 'true')
          ?.textContent,
      ).toMatch(/^Backend/);
      expect(screen.queryByRole('button', { name: 'GraphQL' })).toBeNull();
      // The focus moved to the card that took its place (the last one now).
      expect(document.activeElement).toBe(card('REST API'));
    });

    it('the sheet of a linked entry no longer lists it', async () => {
      await open();
      await askToDelete();
      await confirm();

      fireEvent.click(card('Photopea'));
      expect(sheetTitle()).toBe('Photopea');
      expect(screen.queryByText(/Resurse înrudite/)).toBeNull();
      expect(screen.queryByText('remove.bg')).toBeNull();
    });

    it('collapses the card where it stood, then removes it', async () => {
      // The slide token is on: jsdom has no CSS, so the check is stubbed.
      const original = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (element, pseudo) => {
          const real = original(element, pseudo);
          return new Proxy(real, {
            get(target, property) {
              if (property === 'getPropertyValue') {
                return (name: string) =>
                  name === '--motion-slide'
                    ? '250ms'
                    : target.getPropertyValue(name);
              }
              const value = Reflect.get(target, property, target);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        },
      );
      await open();
      await askToDelete('Photopea');
      await confirm();

      const leaving = document.querySelector('[data-leaving]');
      expect(leaving).not.toBeNull();
      expect(leaving?.textContent).toContain('Photopea');
      expect(leaving?.getAttribute('aria-hidden')).toBe('true');
      expect(
        [...document.querySelectorAll('.card-grid-item')].map(
          (item) => (item as HTMLElement).dataset.entryId,
        ),
      ).toEqual(['removebg', 'photopea', 'nmap']);
      expect(screen.queryByRole('button', { name: 'Photopea' })).toBeNull();

      await act(async () => {
        leaving?.dispatchEvent(new Event('animationend'));
      });
      expect(document.querySelector('[data-leaving]')).toBeNull();
    });
  });

  describe('Busy', () => {
    it('closes the dialog, keeps the sheet and shows the error toast', async () => {
      deleteEntry.mockResolvedValueOnce({
        ok: false,
        error: { code: 'DATABASE_BUSY' },
      });
      await open();
      await askToDelete();
      await confirm();

      expect(dialog()).toBeNull();
      expect(sheetTitle()).toBe('remove.bg');
      expect(document.querySelector('[data-leaving]')).toBeNull();
      expect(toasts.getToasts()).toEqual([
        expect.objectContaining({
          kind: 'error',
          message: errorMessages.DATABASE_BUSY,
        }),
      ]);
      expect(tabCount('Toolbox')).toBe('3');
    });

    it('shows the text of any other code too', async () => {
      deleteEntry.mockResolvedValueOnce({
        ok: false,
        error: { code: 'ENTRY_NOT_FOUND' },
      });
      await open();
      await askToDelete();
      await confirm();
      expect(toasts.getToasts()).toEqual([
        expect.objectContaining({ message: errorMessages.ENTRY_NOT_FOUND }),
      ]);
      expect(sheetTitle()).toBe('remove.bg');
    });
  });

  describe('Keys', () => {
    it('Delete does nothing in the list', async () => {
      await open();
      pressKey('Delete');
      expect(dialog()).toBeNull();
      expect(deleteEntry).not.toHaveBeenCalled();
    });

    it('Delete does nothing in a text field of the sheet (the notes)', async () => {
      await open();
      fireEvent.click(card('remove.bg'));
      const notes = screen.getByRole('textbox');
      notes.focus();
      pressKey('Delete', notes);
      expect(dialog()).toBeNull();
    });

    it('Delete does nothing while the dialog is open', async () => {
      await open();
      await askToDelete();
      pressKey('Delete');
      pressKey('Delete', screen.getByRole('button', { name: /^Renunță/ }));
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(deleteEntry).not.toHaveBeenCalled();
    });

    it('the other single keys and Alt+Left are quiet while the dialog is open', async () => {
      await open();
      await askToDelete();
      fireEvent.keyDown(document.body, { code: 'ArrowLeft', altKey: true });
      fireEvent.keyDown(document.body, { code: 'Digit2', ctrlKey: true });
      expect(sheetTitle()).toBe('remove.bg');
      expect(dialog()).not.toBeNull();
    });
  });

  describe('Stack', () => {
    it('deleting a child opened from its umbrella lands back on the umbrella, which no longer lists it', async () => {
      await open();
      fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
      fireEvent.click(card('Tipuri de API'));
      expect(screen.getByText('Concepte · 2')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^REST API/ }));
      expect(sheetTitle()).toBe('REST API');

      fireEvent.click(screen.getByRole('button', { name: 'Șterge' }));
      await confirm();

      expect(dialog()).toBeNull();
      expect(sheetTitle()).toBe('Tipuri de API');
      expect(screen.getByText('Concepte · 1')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^REST API/ })).toBeNull();

      // Back from the umbrella is the list, which no longer has the child.
      pressKey('Escape');
      expect(listShown()).toBe(true);
      expect(screen.queryByRole('button', { name: 'REST API' })).toBeNull();
    });

    it('a dialog for an entry that left the catalog closes with it', async () => {
      await open();
      await askToDelete('Nmap');
      // The entry goes away under the dialog (deleted from the terminal).
      await act(() =>
        store.write(() =>
          Promise.resolve({
            ok: true as const,
            data: { changed: [], removed: ['nmap'] },
          }),
        ),
      );
      expect(dialog()).toBeNull();
      expect(listShown()).toBe(true);

      // The old id is forgotten: another sheet opens its own confirmation.
      fireEvent.click(card('Photopea'));
      fireEvent.click(screen.getByRole('button', { name: 'Șterge' }));
      expect(
        screen.getByRole('dialog', { name: 'Ștergi fișa „Photopea”?' }),
      ).toBeTruthy();
    });

    it('a dialog left open by a popped stack does not come back with its entry', async () => {
      await open();
      await askToDelete('Nmap');
      // The same sheet shown again later must not open the dialog by itself.
      pressKey('Escape');
      pressKey('Escape');
      expect(listShown()).toBe(true);
      fireEvent.click(card('Nmap'));
      expect(dialog()).toBeNull();
      pressKey('Delete');
      expect(dialog()).not.toBeNull();
    });
  });

  describe('the mouse back button', () => {
    it('does not pop the sheet behind the dialog', async () => {
      await open();
      await askToDelete();
      fireEvent.mouseDown(document.body, { button: 3 });
      fireEvent.mouseUp(document.body, { button: 3 });
      expect(sheetTitle()).toBe('remove.bg');
      expect(dialog()).not.toBeNull();

      pressKey('Escape');
      fireEvent.mouseDown(document.body, { button: 3 });
      fireEvent.mouseUp(document.body, { button: 3 });
      expect(listShown()).toBe(true);
    });
  });

  describe('the last card of a view', () => {
    it('leaves no collapsing card behind, so a later import shows no ghost', async () => {
      const entries = [...catalog, lonely];
      let current = entries;
      store = createCatalogStore({
        catalogSnapshot: () =>
          Promise.resolve({
            ok: true,
            data: { entries: current, categories: [...categories, securitate] },
          }),
      });
      // Animations on, so a collapsing card would be drawn.
      const original = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (element, pseudo) => {
          const real = original(element, pseudo);
          return new Proxy(real, {
            get(target, property) {
              if (property === 'getPropertyValue') {
                return (name: string) =>
                  name === '--motion-slide'
                    ? '250ms'
                    : target.getPropertyValue(name);
              }
              const value = Reflect.get(target, property, target);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        },
      );
      await open();
      fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
      await askToDelete('Singura');
      await confirm();

      expect(listShown()).toBe(false);
      expect(document.querySelector('[data-leaving]')).toBeNull();

      // An import lands in the same view.
      const fresh = makeEntry('fresh', {
        name: 'Nouă',
        categories: [securitate],
      });
      current = [fresh, ...entries.filter((entry) => entry.id !== 'lonely')];
      await act(() => store.reload());
      expect(card('Nouă')).toBeTruthy();
      expect(document.querySelector('[data-leaving]')).toBeNull();
      expect(screen.queryByText('Singura')).toBeNull();
    });
  });
});
