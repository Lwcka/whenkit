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
  EntryPatch,
  EntryPatchInput,
  IpcResult,
  WriteResult,
} from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import { App, type FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import { makeCategory, makeEntry } from './test-fixtures';
import { applyTheme } from './theme';
import { toasts } from './toast-store';

// The edit mode of the sheet (CAP-10, Flow 3): the real store and the real
// App, with a fake `patchEntry` that answers like main's `entries:patch`.

const imagini = makeCategory('c-img', 'Imagini & video');
const securitate = makeCategory('c-sec', 'Securitate');
const design = makeCategory('c-des', 'Design & UI');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const categories = [imagini, securitate, design, backend];

const removeBg = makeEntry('removebg', {
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: [imagini],
  whatItDoes: 'Scoate fundalul din poze.',
  situations: ['scot fundalul', 'poze de produs'],
  keywords: ['fundal'],
  relatedIds: ['photopea'],
  myNotes: 'Gratuit doar la rezoluție mică.',
});
const photopea = makeEntry('photopea', {
  name: 'Photopea',
  url: 'https://photopea.com',
  resourceType: 'site',
  categories: [imagini],
  relatedIds: ['removebg'],
});
const webhook = makeEntry('webhook', {
  zone: 'learn',
  name: 'Webhook',
  url: 'https://example.com/webhook',
  categories: [backend],
  whatItDoes: 'Un apel HTTP trimis la un eveniment.',
  situations: ['primesc evenimente'],
  content: '# Webhook\n\nText.',
  sources: ['https://example.com/a', 'https://example.com/b'],
});
const catalog = [removeBg, photopea, webhook];

/** The entry as main stores it after a patch: the changes applied, one revision up. */
function applyPatch(entry: EntryDto, changes: EntryPatch): EntryDto {
  const { categoryIds, ...fields } = changes;
  return {
    ...entry,
    ...fields,
    categories:
      categoryIds === undefined
        ? entry.categories
        : categoryIds.map((id) => ({
            id,
            name: categories.find((category) => category.id === id)?.name ?? '',
          })),
    revision: entry.revision + 1,
  };
}

type PatchAnswer = Promise<IpcResult<WriteResult>>;

let current: EntryDto[];
let patchEntry: ReturnType<
  typeof vi.fn<(input: EntryPatchInput) => PatchAnswer>
>;
let setNotes: ReturnType<
  typeof vi.fn<(id: string, notes: string) => PatchAnswer>
>;
let api: FrameApi;
let store: CatalogStore;

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  current = catalog;
  patchEntry = vi.fn((input: EntryPatchInput) => {
    const entry = current.find((candidate) => candidate.id === input.id);
    return entry === undefined
      ? Promise.resolve({ ok: false, error: { code: 'ENTRY_NOT_FOUND' } })
      : Promise.resolve({
          ok: true,
          data: { changed: [applyPatch(entry, input.changes)] },
        });
  });
  setNotes = vi.fn(() =>
    Promise.resolve({ ok: true, data: { changed: [] } } as const),
  );
  api = {
    workspacePath: 'C:\\ws',
    openExternal: () => Promise.resolve({ ok: true, data: null }),
    exportCatalog: () => Promise.resolve({ ok: true, data: null }),
    openExportFolder: () => Promise.resolve({ ok: true, data: null }),
    searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
    setNotes,
    deleteEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    patchEntry,
    setTheme: () => Promise.resolve({ ok: true, data: null }),
    setZoomFactor: () => {},
    renameCategory: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    mergeCategories: () => Promise.resolve({ ok: true, data: { changed: [] } }),
    deleteCategory: () => Promise.resolve({ ok: true, data: { changed: [] } }),
  };
  store = createCatalogStore({
    catalogSnapshot: () =>
      Promise.resolve({
        ok: true,
        data: { entries: current, categories },
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

/** The terminal changed the catalog: the store reloads and classifies it. */
async function terminalSets(...entries: EntryDto[]) {
  current = entries;
  await act(() => store.reload());
}

const card = (name: string) => screen.getByRole('button', { name });
const editButton = () => screen.getByRole('button', { name: /Editează/ });
const pressKey = (
  code: string,
  init: KeyboardEventInit = {},
  target: Element = document.body,
) => fireEvent.keyDown(target, { code, ...init });
const sheetTitle = () =>
  document.querySelector('.entry-sheet .sheet-title')?.textContent ?? null;
const formShown = () => document.querySelector('.entry-edit-form') !== null;
const keyHints = () =>
  [...document.querySelectorAll('.status-keys kbd')].map((k) => k.textContent);
const crumbs = () =>
  [...document.querySelectorAll('.crumb')].map((crumb) => crumb.textContent);
const dialog = () => screen.queryByRole('dialog');

const nameField = () => screen.getByLabelText('Nume') as HTMLInputElement;
const linkField = () => screen.getByLabelText('Link') as HTMLInputElement;
const typeField = () => screen.getByLabelText('Tip') as HTMLSelectElement;
const whatItDoesField = () =>
  screen.getByRole('textbox', { name: 'Ce face' }) as HTMLTextAreaElement;
const situationField = (n: number) =>
  screen.getByRole('textbox', { name: `Situația ${n}` }) as HTMLInputElement;
const contentField = () =>
  screen.getByRole('textbox', { name: 'Conținut' }) as HTMLTextAreaElement;
const sourceField = (n: number) =>
  screen.getByRole('textbox', { name: `Sursa ${n}` }) as HTMLInputElement;
const chip = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const saveButton = () =>
  screen.getByRole('button', {
    name: /Salvează|Se salvează|Se verifică/,
  }) as HTMLButtonElement;
const cancelButton = () =>
  screen.getByRole('button', { name: /Renunță/ }) as HTMLButtonElement;
const type = (field: HTMLElement, value: string) =>
  fireEvent.change(field, { target: { value } });

/** Opens `name` and its edit mode. */
async function edit(name = 'remove.bg') {
  await open();
  // The concept lives in Learn.
  if (name === 'Webhook')
    fireEvent.click(screen.getByRole('tab', { name: /Learn/ }));
  fireEvent.click(card(name));
  fireEvent.click(editButton());
  expect(formShown()).toBe(true);
}

async function save() {
  await act(async () => {
    pressKey('KeyS', { ctrlKey: true });
  });
}

/** A promise settled by hand, to hold a save in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('App: entering the edit mode', () => {
  it('shows „Editează” before „Șterge” and the hints of reading', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    const buttons = [
      ...document.querySelectorAll<HTMLElement>('.sheet-bar-actions button'),
    ].map((button) => button.textContent);
    expect(buttons).toEqual(['EditeazăE', 'Șterge']);
    expect(keyHints()).toEqual(['E', 'Esc']);
    expect(formShown()).toBe(false);
  });

  it('opens the form on „Editează” with the focus in „Nume”', async () => {
    await edit();
    expect(nameField().value).toBe('remove.bg');
    expect(document.activeElement).toBe(nameField());
    expect(linkField().value).toBe('https://remove.bg');
    expect(typeField().value).toBe('site');
    expect(whatItDoesField().value).toBe('Scoate fundalul din poze.');
    expect(situationField(1).value).toBe('scot fundalul');
    expect(situationField(2).value).toBe('poze de produs');
    expect(
      screen.getByRole('textbox', { name: 'Cuvântul-cheie 1' }),
    ).toBeTruthy();
    expect(chip('Imagini & video').getAttribute('aria-pressed')).toBe('true');
    // The categories of the other zone are not offered.
    expect(
      screen.queryByRole('button', { name: 'Backend & API-uri' }),
    ).toBeNull();
    // The reading fields are gone, the notes and the side panel stay.
    expect(document.querySelector('.sheet-title')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Notițele mele' })).toBeTruthy();
    expect(document.querySelector('.title-block')).not.toBeNull();
    expect(document.querySelector('.open-in-browser')).not.toBeNull();
  });

  it('opens on the key E, and E typed in a field does nothing', async () => {
    await open();
    fireEvent.click(card('remove.bg'));
    pressKey('KeyE');
    expect(formShown()).toBe(true);
    pressKey('KeyE', {}, nameField());
    expect(formShown()).toBe(true);
    expect(nameField().value).toBe('remove.bg');
  });

  it('shows the bar of editing: the crumbs, „Renunță” + Esc, „Salvează” + Ctrl S', async () => {
    await edit();
    expect(crumbs()).toEqual(['Toolbox', 'Imagini & video', 'remove.bg']);
    expect(cancelButton().textContent).toBe('RenunțăEsc');
    expect(saveButton().textContent).toBe('SalveazăCtrl S');
    expect(screen.queryByRole('button', { name: /Înapoi$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Șterge' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editează/ })).toBeNull();
    expect(keyHints()).toEqual(['Ctrl S', 'Esc']);
  });

  it('makes everything that would leave the form inactive', async () => {
    await edit();
    // Zone tabs, search box and the related links.
    for (const tab of screen.getAllByRole('tab'))
      expect((tab as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(
      true,
    );
    const related = document.querySelector(
      '.related-link',
    ) as HTMLButtonElement;
    expect(related.disabled).toBe(true);
    fireEvent.click(related);

    // Keys.
    pressKey('Digit2', { ctrlKey: true });
    pressKey('ArrowLeft', { altKey: true });
    pressKey('Delete');
    pressKey('KeyE');
    fireEvent.mouseDown(document.body, { button: 3 });
    fireEvent.mouseUp(document.body, { button: 3 });

    expect(formShown()).toBe(true);
    expect(dialog()).toBeNull();
    expect(sheetTitle()).toBeNull();
    expect(nameField().value).toBe('remove.bg');
    expect(
      screen
        .getAllByRole('tab')
        .find((tab) => tab.getAttribute('aria-selected') === 'true')
        ?.textContent?.startsWith('Toolbox'),
    ).toBe(true);
  });

  it('does not open another entry over the form (an arrival toast)', async () => {
    await edit();
    const arrived = makeEntry('nou', { name: 'Nou', categories: [imagini] });
    await terminalSets(arrived, removeBg, photopea, webhook);
    const openToast = toasts
      .getToasts()
      .find((toast) => toast.action !== undefined);
    expect(openToast).toBeDefined();
    act(() => openToast?.action?.run());
    expect(formShown()).toBe(true);
    expect(nameField().value).toBe('remove.bg');
  });
});

describe('App: validation', () => {
  it('an empty name: message under it, „Salvează” inactive, Ctrl+S does nothing', async () => {
    await edit();
    type(nameField(), '  ');
    const message = screen.getByText('Scrie un nume.');
    expect(message.getAttribute('role')).toBe('alert');
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    expect(nameField().getAttribute('aria-describedby')).toBe(message.id);
    expect(saveButton().disabled).toBe(true);
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
    expect(formShown()).toBe(true);
  });

  it('no category', async () => {
    await edit();
    fireEvent.click(chip('Imagini & video'));
    expect(screen.getByText('Alege cel puțin o categorie.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
  });

  it('no non-empty situation', async () => {
    await edit();
    type(situationField(1), '');
    type(situationField(2), '   ');
    expect(screen.getByText('Scrie cel puțin o situație.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
  });

  it('an empty or non-http(s) link of a tool', async () => {
    await edit();
    type(linkField(), '');
    expect(screen.getByText('Scrie linkul.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    type(linkField(), 'remove.bg/ro');
    expect(
      screen.getByText('Linkul trebuie să înceapă cu http:// sau https://.'),
    ).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    type(linkField(), 'https://remove.bg/ro');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it('a concept: a link that is not http(s), and no content', async () => {
    await edit('Webhook');
    // A concept may have no link; the field says nothing for an empty one.
    type(linkField(), '');
    expect(screen.queryByRole('alert')).toBeNull();
    type(linkField(), 'ftp://example.com');
    expect(
      screen.getByText('Linkul trebuie să înceapă cu http:// sau https://.'),
    ).toBeTruthy();
    type(linkField(), 'https://example.com/webhook');
    type(contentField(), '  ');
    expect(screen.getByText('Scrie conținutul.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
  });

  it('a concept has „Conținut” and „Surse” and no „Tip”', async () => {
    await edit('Webhook');
    expect(contentField().value).toBe('# Webhook\n\nText.');
    expect(sourceField(1).value).toBe('https://example.com/a');
    expect(sourceField(2).value).toBe('https://example.com/b');
    expect(screen.queryByLabelText('Tip')).toBeNull();
    expect(screen.getByText('Când îl aleg · 1')).toBeTruthy();
  });
});

describe('App: the category picker', () => {
  it('lets two categories be chosen, then disables the others', async () => {
    await edit();
    expect(chip('Securitate').disabled).toBe(false);
    fireEvent.click(chip('Securitate'));
    expect(chip('Securitate').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Design & UI').disabled).toBe(true);
    // A chosen one can be toggled off again, which frees the others.
    fireEvent.click(chip('Imagini & video'));
    expect(chip('Design & UI').disabled).toBe(false);
    expect(chip('Imagini & video').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('App: the list editors', () => {
  it('„Adaugă situație” adds an empty row and focuses it; the count follows the filled rows', async () => {
    await edit();
    expect(screen.getByText('Când o folosesc · 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă situație' }));
    expect(situationField(3).value).toBe('');
    expect(document.activeElement).toBe(situationField(3));
    expect(screen.getByText('Când o folosesc · 2')).toBeTruthy();
    type(situationField(3), 'vreau o poză de profil');
    expect(screen.getByText('Când o folosesc · 3')).toBeTruthy();
  });

  it('Enter in the last row adds a row', async () => {
    await edit();
    fireEvent.keyDown(situationField(2), { key: 'Enter', code: 'Enter' });
    expect(situationField(3)).toBeTruthy();
    expect(document.activeElement).toBe(situationField(3));
  });

  it('„Adaugă cuvânt-cheie” and „Adaugă sursă” add rows', async () => {
    await edit();
    fireEvent.click(
      screen.getByRole('button', { name: 'Adaugă cuvânt-cheie' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Cuvântul-cheie 2' }),
    ).toBeTruthy();
    cleanup();
    await edit('Webhook');
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă sursă' }));
    expect(sourceField(3)).toBeTruthy();
  });

  it('× removes a row at once, and is inactive on the last situation', async () => {
    await edit();
    const removes = () =>
      screen.getAllByRole('button', {
        name: 'Șterge rândul',
      }) as HTMLButtonElement[];
    // 2 situations + 1 keyword: all ×s active.
    expect(removes().every((button) => !button.disabled)).toBe(true);
    fireEvent.click(removes()[0] as HTMLButtonElement);
    expect(dialog()).toBeNull();
    expect(situationField(1).value).toBe('poze de produs');
    expect(screen.queryByRole('textbox', { name: 'Situația 2' })).toBeNull();
    // One situation left: its × is inactive; the keyword's is not.
    expect(removes()[0]?.disabled).toBe(true);
    expect(removes()[1]?.disabled).toBe(false);
  });
});

describe('App: saving', () => {
  it('sends only the changed field with the revision of the start, then leaves the edit', async () => {
    await edit();
    type(whatItDoesField(), '  Scoate fundalul automat.  ');
    await save();

    expect(patchEntry).toHaveBeenCalledTimes(1);
    expect(patchEntry).toHaveBeenCalledWith({
      id: 'removebg',
      expectedRevision: 1,
      changes: { whatItDoes: 'Scoate fundalul automat.' },
    });
    expect(formShown()).toBe(false);
    expect(sheetTitle()).toBe('remove.bg');
    expect(document.querySelector('.sheet-lead')?.textContent).toBe(
      'Scoate fundalul automat.',
    );
    expect(
      document.querySelector('.entry-sheet')?.getAttribute('data-pulse'),
    ).toBe(null);
    expect(keyHints()).toEqual(['E', 'Esc']);
    expect(document.activeElement?.classList.contains('entry-sheet')).toBe(
      true,
    );
    expect(toasts.getToasts()).toEqual([]);
  });

  it('saves with the „Salvează” button', async () => {
    await edit();
    type(nameField(), 'remove.bg 2');
    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(patchEntry).toHaveBeenCalledWith({
      id: 'removebg',
      expectedRevision: 1,
      changes: { name: 'remove.bg 2' },
    });
    expect(formShown()).toBe(false);
  });

  it('drops the empty rows and sends the categories, the type and a new situation', async () => {
    await edit();
    fireEvent.click(chip('Securitate'));
    type(typeField(), 'app');
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă situație' }));
    type(situationField(3), ' vreau o poză de profil ');
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă situație' }));
    await save();
    expect(patchEntry).toHaveBeenCalledWith({
      id: 'removebg',
      expectedRevision: 1,
      changes: {
        resourceType: 'app',
        categoryIds: ['c-img', 'c-sec'],
        situations: [
          'scot fundalul',
          'poze de produs',
          'vreau o poză de profil',
        ],
      },
    });
    expect(formShown()).toBe(false);
  });

  it('leaves at once, without a call, when nothing changed', async () => {
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă situație' }));
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
    expect(formShown()).toBe(false);
  });

  it("a concept's emptied link goes as null", async () => {
    await edit('Webhook');
    type(linkField(), '');
    await save();
    expect(patchEntry).toHaveBeenCalledWith({
      id: 'webhook',
      expectedRevision: 1,
      changes: { url: null },
    });
  });

  it('a link change: „Se verifică linkul…”, busy, every field locked, then leaves', async () => {
    const answer = deferred<IpcResult<WriteResult>>();
    patchEntry.mockReturnValueOnce(answer.promise);
    await edit();
    type(linkField(), 'https://www.remove.bg/ro');
    await save();

    const busy = saveButton();
    expect(busy.textContent).toBe('Se verifică linkul…');
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(nameField().disabled).toBe(true);
    expect(linkField().disabled).toBe(true);
    expect(whatItDoesField().disabled).toBe(true);
    expect(chip('Imagini & video').disabled).toBe(true);
    expect(situationField(1).disabled).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Adaugă situație',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    // Esc and a second Ctrl+S do nothing meanwhile.
    pressKey('Escape');
    await save();
    expect(dialog()).toBeNull();
    expect(patchEntry).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer.resolve({
        ok: true,
        data: {
          changed: [applyPatch(removeBg, { url: 'https://www.remove.bg/ro' })],
        },
      });
    });
    expect(formShown()).toBe(false);
    expect(document.querySelector('.sheet-url')?.textContent).toBe(
      'https://www.remove.bg/ro',
    );
  });

  it('a text-only save says „Se salvează…”', async () => {
    const answer = deferred<IpcResult<WriteResult>>();
    patchEntry.mockReturnValueOnce(answer.promise);
    await edit();
    type(nameField(), 'Alt nume');
    await save();
    expect(saveButton().textContent).toBe('Se salvează…');
    await act(async () => {
      answer.resolve({
        ok: true,
        data: { changed: [applyPatch(removeBg, { name: 'Alt nume' })] },
      });
    });
    expect(formShown()).toBe(false);
  });

  it("a warned save leaves the edit; the warning is the sheet's verification note", async () => {
    patchEntry.mockResolvedValueOnce({
      ok: true,
      data: {
        changed: [
          {
            ...applyPatch(removeBg, { url: 'https://www.remove.bg/ro' }),
            verificationNotes: [{ code: 'blocks_automation' }],
          },
        ],
      },
    });
    await edit();
    type(linkField(), 'https://www.remove.bg/ro');
    await save();
    expect(formShown()).toBe(false);
    expect(
      document.querySelector('.verification-note-list')?.textContent,
    ).toContain('site-ul blochează accesul automat');
  });
});

describe('App: a refused save', () => {
  it('ENTRY_REJECTED: stays in the edit, nothing lost, the reason under the link', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ENTRY_REJECTED',
        reasons: [{ code: 'http_error', params: { status: '404' } }],
      },
    });
    await edit();
    type(linkField(), 'https://remove.bg/nu-exista');
    type(whatItDoesField(), 'Text nou.');
    await save();

    expect(formShown()).toBe(true);
    const message = screen.getByText(
      'Linkul nu funcționează: site-ul răspunde cu eroarea HTTP 404.',
    );
    expect(message.getAttribute('role')).toBe('alert');
    expect(linkField().getAttribute('aria-invalid')).toBe('true');
    expect(linkField().value).toBe('https://remove.bg/nu-exista');
    expect(whatItDoesField().value).toBe('Text nou.');
    // The fields are unlocked again, the save can be tried again, the focus is on the link.
    expect(linkField().disabled).toBe(false);
    expect(saveButton().textContent).toBe('SalveazăCtrl S');
    expect(document.activeElement).toBe(linkField());
    expect(toasts.getToasts()).toEqual([]);

    // Fixing the link clears its message.
    type(linkField(), 'https://remove.bg/ro');
    expect(screen.queryByText(/Linkul nu funcționează/)).toBeNull();
  });

  it('ENTRY_REJECTED: a reason about a source goes under that row', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ENTRY_REJECTED',
        reasons: [
          {
            code: 'source_blocked_domain',
            params: { url: 'https://example.com/b', domain: 'example.com' },
          },
        ],
      },
    });
    await edit('Webhook');
    type(sourceField(1), 'https://example.com/a');
    type(sourceField(2), ' https://example.com/b ');
    type(sourceField(1), 'https://example.com/a2');
    await save();

    const row = sourceField(2).closest('li') as HTMLElement;
    expect(within(row).getByRole('alert').textContent).toBe(
      'Sursa https://example.com/b e pe un domeniu interzis (regula „example.com”).',
    );
    expect(sourceField(2).getAttribute('aria-invalid')).toBe('true');
    expect(sourceField(1).getAttribute('aria-invalid')).toBeNull();
    expect(linkField().getAttribute('aria-invalid')).toBeNull();
  });

  it('ARGUMENTS_INVALID: the issue is shown under the field of its first path key', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ARGUMENTS_INVALID',
        issues: [{ path: ['categoryIds', 0], message: 'not a category' }],
      },
    });
    await edit();
    type(nameField(), 'Alt nume');
    await save();
    expect(screen.getByText('Valoarea nu e acceptată.')).toBeTruthy();
    expect(formShown()).toBe(true);
  });

  it('OFFLINE: stays in the edit with the message under the link', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'OFFLINE' },
    });
    await edit();
    type(linkField(), 'https://www.remove.bg/ro');
    await save();
    const message = screen.getByText(
      'Nu pot verifica linkul fără internet. Modificarea nu s-a salvat.',
    );
    expect(message.getAttribute('role')).toBe('alert');
    expect(formShown()).toBe(true);
    expect(linkField().value).toBe('https://www.remove.bg/ro');
    expect(toasts.getToasts()).toEqual([]);
  });

  it('DATABASE_BUSY: stays in the edit with an error toast', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'DATABASE_BUSY' },
    });
    await edit();
    type(nameField(), 'Alt nume');
    await save();
    expect(formShown()).toBe(true);
    expect(nameField().value).toBe('Alt nume');
    // No field was refused: the focus comes back to „Salvează”.
    expect(document.activeElement).toBe(saveButton());
    expect(toasts.getToasts()).toEqual([
      expect.objectContaining({
        kind: 'error',
        message: errorMessages.DATABASE_BUSY,
      }),
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('any other code is a toast too', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    await edit();
    type(nameField(), 'Alt nume');
    await save();
    expect(toasts.getToasts()).toEqual([
      expect.objectContaining({ message: errorMessages.INTERNAL }),
    ]);
  });
});

describe('App: the entry changes in the terminal', () => {
  const updated = { ...removeBg, revision: 2, whatItDoes: 'Din terminal.' };

  it('shows the banner, leaves the form as it is, and keeps the banner until the edit ends', async () => {
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    await terminalSets(updated, photopea, webhook);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain(
      'Fișa a fost modificată din terminal. Salvarea ta va fi refuzată.',
    );
    expect(
      within(banner).getByRole('button', { name: 'Reîncarcă fișa' }),
    ).toBeTruthy();
    expect(whatItDoesField().value).toBe('Textul meu.');
    expect(formShown()).toBe(true);
    expect(
      document.querySelector('.entry-sheet')?.getAttribute('data-pulse'),
    ).toBe('a');

    // Still there after more typing.
    type(nameField(), 'Alt nume');
    expect(screen.getByRole('alert')).toBe(banner);
  });

  it('a save then goes with the revision of the start, and CONFLICT keeps the banner and the fields', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFLICT' },
    });
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    await terminalSets(updated, photopea, webhook);
    await save();

    expect(patchEntry).toHaveBeenCalledWith({
      id: 'removebg',
      expectedRevision: 1,
      changes: { whatItDoes: 'Textul meu.' },
    });
    expect(formShown()).toBe(true);
    expect(whatItDoesField().value).toBe('Textul meu.');
    expect(screen.getByRole('button', { name: 'Reîncarcă fișa' })).toBeTruthy();
    expect(toasts.getToasts()).toEqual([]);
  });

  it('the banner stays mounted while a save runs, and a CONFLICT does not mount it again', async () => {
    const answer = deferred<IpcResult<WriteResult>>();
    patchEntry.mockReturnValueOnce(answer.promise);
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    await terminalSets(updated, photopea, webhook);
    const banner = screen.getByRole('alert');
    await save();
    expect(screen.getByRole('alert')).toBe(banner);
    await act(async () => {
      answer.resolve({ ok: false, error: { code: 'CONFLICT' } });
    });
    expect(screen.getByRole('alert')).toBe(banner);
    // No field was refused, so the focus comes back to „Salvează”.
    expect(document.activeElement).toBe(saveButton());
  });

  it('a save that succeeds does not flash the banner', async () => {
    const answer = deferred<IpcResult<WriteResult>>();
    patchEntry.mockReturnValueOnce(answer.promise);
    await edit();
    type(nameField(), 'Alt nume');
    await save();
    await act(async () => {
      // The store applies the saved entry (one revision up) before the edit ends.
      await store.write(() =>
        Promise.resolve({
          ok: true,
          data: { changed: [applyPatch(removeBg, { name: 'Alt nume' })] },
        } as const),
      );
    });
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => {
      answer.resolve({
        ok: true,
        data: { changed: [applyPatch(removeBg, { name: 'Alt nume' })] },
      });
    });
    expect(formShown()).toBe(false);
  });

  it('„Reîncarcă fișa” after a CONFLICT the store had not seen reads the catalog again', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFLICT' },
    });
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    // The terminal changed the entry, but no catalog change reached the store.
    current = [updated, photopea, webhook];
    await save();
    expect(patchEntry).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 1 }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă fișa' }));
    });
    await act(async () => {
      fireEvent.click(
        within(dialog() as HTMLElement).getByRole('button', {
          name: 'Reîncarcă',
        }),
      );
    });
    expect(whatItDoesField().value).toBe('Din terminal.');
    expect(screen.queryByRole('alert')).toBeNull();
    type(nameField(), 'Alt nume');
    await save();
    expect(patchEntry).toHaveBeenLastCalledWith({
      id: 'removebg',
      expectedRevision: 2,
      changes: { name: 'Alt nume' },
    });
  });

  it('CONFLICT shows the banner even when the store has not seen the change yet', async () => {
    patchEntry.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFLICT' },
    });
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    expect(screen.queryByRole('alert')).toBeNull();
    await save();
    expect(screen.getByRole('button', { name: 'Reîncarcă fișa' })).toBeTruthy();
    expect(whatItDoesField().value).toBe('Textul meu.');
  });

  it('„Reîncarcă fișa” on a changed form asks first, then rebuilds the form from the new entry', async () => {
    await edit();
    type(whatItDoesField(), 'Textul meu.');
    await terminalSets(updated, photopea, webhook);
    fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă fișa' }));

    const box = dialog() as HTMLElement;
    expect(within(box).getByRole('heading').textContent).toBe(
      'Reîncarci fișa?',
    );
    expect(box.textContent).toContain('Pierzi ce ai schimbat în fișă.');
    // Back to editing: the form and the banner are as they were.
    fireEvent.click(
      within(box).getByRole('button', { name: /Înapoi la editare/ }),
    );
    expect(dialog()).toBeNull();
    expect(whatItDoesField().value).toBe('Textul meu.');
    expect(screen.getByRole('button', { name: 'Reîncarcă fișa' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă fișa' }));
    await act(async () => {
      fireEvent.click(
        within(dialog() as HTMLElement).getByRole('button', {
          name: 'Reîncarcă',
        }),
      );
    });
    expect(dialog()).toBeNull();
    expect(formShown()).toBe(true);
    expect(document.activeElement).toBe(nameField());
    expect(whatItDoesField().value).toBe('Din terminal.');
    expect(screen.queryByRole('button', { name: 'Reîncarcă fișa' })).toBeNull();

    // The new expectation is the new revision.
    type(nameField(), 'Alt nume');
    await save();
    expect(patchEntry).toHaveBeenCalledWith({
      id: 'removebg',
      expectedRevision: 2,
      changes: { name: 'Alt nume' },
    });
  });

  it('„Reîncarcă fișa” on a clean form reloads without asking', async () => {
    await edit();
    await terminalSets(updated, photopea, webhook);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă fișa' }));
    });
    expect(dialog()).toBeNull();
    expect(whatItDoesField().value).toBe('Din terminal.');
    expect(document.activeElement).toBe(nameField());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(formShown()).toBe(true);
  });

  it('a reload leaves the notes untouched', async () => {
    await edit();
    type(
      screen.getByRole('textbox', { name: 'Notițele mele' }),
      'O notă nouă.',
    );
    await terminalSets(updated, photopea, webhook);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă fișa' }));
    });
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Notițele mele',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('O notă nouă.');
  });

  it('an entry deleted in the terminal ends the edit with the sheet', async () => {
    await edit();
    type(nameField(), 'Alt nume');
    await terminalSets(photopea, webhook);
    expect(formShown()).toBe(false);
    expect(document.querySelector('.entry-sheet')).toBeNull();
    expect(document.querySelector('.card-grid')).not.toBeNull();
    // Opening another entry starts clean.
    fireEvent.click(card('Photopea'));
    expect(formShown()).toBe(false);
  });
});

describe('App: leaving the edit', () => {
  it('a clean form leaves at once with Esc and with „Renunță”', async () => {
    await edit();
    pressKey('Escape');
    expect(formShown()).toBe(false);
    expect(dialog()).toBeNull();
    // The sheet is still open: Esc did not also go back.
    expect(sheetTitle()).toBe('remove.bg');
    expect(document.activeElement?.classList.contains('entry-sheet')).toBe(
      true,
    );

    fireEvent.click(editButton());
    fireEvent.click(cancelButton());
    expect(formShown()).toBe(false);
    expect(dialog()).toBeNull();
    expect(sheetTitle()).toBe('remove.bg');
  });

  it('an added empty row is not a change', async () => {
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă situație' }));
    pressKey('Escape');
    expect(formShown()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('a changed form asks first; „Înapoi la editare” is the default and keeps everything', async () => {
    await edit();
    type(nameField(), 'Alt nume');
    pressKey('Escape');

    const box = dialog() as HTMLElement;
    expect(within(box).getByRole('heading').textContent).toBe(
      'Renunți la modificări?',
    );
    expect(box.textContent).toContain(
      'Ce ai schimbat în „remove.bg” se pierde.',
    );
    const back = within(box).getByRole('button', { name: /Înapoi la editare/ });
    const discard = within(box).getByRole('button', {
      name: 'Aruncă modificările',
    });
    expect(document.activeElement).toBe(back);
    expect(discard.getAttribute('data-variant')).toBe('danger-solid');

    // Esc closes the dialog only.
    pressKey('Escape');
    expect(dialog()).toBeNull();
    expect(formShown()).toBe(true);
    expect(nameField().value).toBe('Alt nume');

    pressKey('Escape');
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', {
        name: /Înapoi la editare/,
      }),
    );
    expect(dialog()).toBeNull();
    expect(nameField().value).toBe('Alt nume');
  });

  it('„Aruncă modificările” leaves the edit and the sheet shows the entry as it was', async () => {
    await edit();
    type(nameField(), 'Alt nume');
    fireEvent.click(cancelButton());
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', {
        name: 'Aruncă modificările',
      }),
    );
    expect(dialog()).toBeNull();
    expect(formShown()).toBe(false);
    expect(sheetTitle()).toBe('remove.bg');
    expect(patchEntry).not.toHaveBeenCalled();
    // A new edit starts from the entry, not from the thrown draft.
    fireEvent.click(editButton());
    expect(nameField().value).toBe('remove.bg');
  });

  it('keeps the keys behind a confirmation quiet', async () => {
    await edit();
    type(nameField(), 'Alt nume');
    pressKey('Escape');
    await save();
    expect(patchEntry).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });
});

describe('App: the notes while editing', () => {
  it('save as in reading and never set the banner', async () => {
    await edit();
    const notes = screen.getByRole('textbox', { name: 'Notițele mele' });
    type(notes, 'Gratuit doar la rezoluție mică. Plus altceva.');
    await act(async () => {
      fireEvent.blur(notes);
    });
    expect(setNotes).toHaveBeenCalledWith(
      'removebg',
      'Gratuit doar la rezoluție mică. Plus altceva.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(formShown()).toBe(true);
  });

  it('a notes write that the store applied does not raise the banner', async () => {
    setNotes.mockResolvedValueOnce({
      ok: true,
      data: { changed: [{ ...removeBg, myNotes: 'Nouă.' }] },
    });
    await edit();
    const notes = screen.getByRole('textbox', { name: 'Notițele mele' });
    type(notes, 'Nouă.');
    await act(async () => {
      fireEvent.blur(notes);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
