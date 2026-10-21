import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcResult, WriteResult } from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import {
  CategoryManager,
  type CategoryManagerApi,
  type CategoryManagerProps,
} from './category-manager';
import { installKeyboard } from './keyboard';
import { makeCategory, makeEntry } from './test-fixtures';
import { toasts } from './toast-store';

// The category manager (CAP-11, Flow 5) on its own: lists in, calls out. The
// App-level behavior (store, bar, focus on the toolbar) is in
// app-categories.test.tsx.

const mockups = makeCategory('c-mock', 'Mockup-uri & capturi de cod');
const imagini = makeCategory('c-img', 'Imagini & video');
const design = makeCategory('c-des', 'Design & UI');
const terminal = makeCategory('c-term', 'Terminal & dev tools');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const limbaje = makeCategory('c-lang', 'Limbaje', 'learn');
const solo = makeCategory('c-solo', 'Singura', 'learn');

const categories = [mockups, imagini, design, terminal, backend, limbaje];

const entries = [
  makeEntry('a', { categories: [mockups] }),
  makeEntry('b', { categories: [mockups, design] }),
  makeEntry('c', { categories: [mockups] }),
  makeEntry('d', { categories: [design, imagini] }),
  makeEntry('e', { zone: 'learn', categories: [backend] }),
];

const done: IpcResult<WriteResult> = { ok: true, data: { changed: [] } };

let uninstall: () => void;
let api: {
  [K in keyof CategoryManagerApi]: ReturnType<
    typeof vi.fn<CategoryManagerApi[K]>
  >;
};
let onClose: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  toasts.clear();
  uninstall = installKeyboard([]);
  api = {
    renameCategory: vi.fn(() => Promise.resolve(done)),
    mergeCategories: vi.fn(() => Promise.resolve(done)),
    deleteCategory: vi.fn(() => Promise.resolve(done)),
  };
  onClose = vi.fn();
});

afterEach(() => {
  cleanup();
  uninstall();
});

function mount(overrides: Partial<CategoryManagerProps> = {}) {
  const props: CategoryManagerProps = {
    categories,
    entries,
    api,
    write: (run) => run(),
    onClose,
    ...overrides,
  };
  const view = render(<CategoryManager {...props} />);
  return {
    ...view,
    update: (next: Partial<CategoryManagerProps>) =>
      view.rerender(<CategoryManager {...props} {...next} />),
  };
}

const dialogs = () => screen.queryAllByRole('dialog');
const row = (name: string) => screen.getByRole('listitem', { name });
const button = (scope: HTMLElement, name: RegExp | string) =>
  within(scope).getByRole('button', { name });
const press = (code: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { code });
const rowNames = (zone: 'Toolbox' | 'Learn') =>
  Array.from(
    screen
      .getByRole('heading', { name: zone })
      .parentElement?.querySelectorAll('.category-manager-name') ?? [],
  ).map((node) => node.textContent);

describe('CategoryManager: the list', () => {
  it('shows the title, the intro, both zones and the rows alphabetically with their counts', () => {
    mount();

    const box = screen.getByRole('dialog', { name: 'Categorii' });
    expect(box.textContent).toContain('Categoriile noi apar doar din import.');
    expect(rowNames('Toolbox')).toEqual([
      'Design & UI',
      'Imagini & video',
      'Mockup-uri & capturi de cod',
      'Terminal & dev tools',
    ]);
    expect(rowNames('Learn')).toEqual(['Backend & API-uri', 'Limbaje']);
    expect(row('Mockup-uri & capturi de cod').textContent).toContain('3 fișe');
    expect(row('Imagini & video').textContent).toContain('1 fișă');
    expect(row('Terminal & dev tools').textContent).toContain('0 fișe');
    const mock = within(row('Mockup-uri & capturi de cod'));
    expect(mock.getByRole('button', { name: /^Redenumește/ })).toBeTruthy();
    expect(mock.getByRole('button', { name: /^Unifică…/ })).toBeTruthy();
    expect(mock.getByRole('button', { name: /^Șterge/ })).toBeTruthy();
  });

  it('closes with „Închide” and with Esc', () => {
    mount();
    fireEvent.click(button(screen.getByRole('dialog'), /^Închide/));
    expect(onClose).toHaveBeenCalledTimes(1);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows a category that appears while it is open', () => {
    const view = mount();
    expect(rowNames('Learn')).toEqual(['Backend & API-uri', 'Limbaje']);
    view.update({ categories: [...categories, solo] });
    expect(rowNames('Learn')).toEqual([
      'Backend & API-uri',
      'Limbaje',
      'Singura',
    ]);
  });

  it('disables „Unifică…” for the only category of a zone', () => {
    mount({ categories: [mockups, imagini, backend] });
    expect(
      button(row('Backend & API-uri'), /^Unifică…/).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      button(row('Imagini & video'), /^Unifică…/).hasAttribute('disabled'),
    ).toBe(false);
  });
});

describe('CategoryManager: renaming in place', () => {
  const start = () => {
    fireEvent.click(button(row('Mockup-uri & capturi de cod'), /^Redenumește/));
    return screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Numele categoriei',
    });
  };

  it('turns the row into a focused field with the hints', () => {
    mount();
    const field = start();
    expect(field.value).toBe('Mockup-uri & capturi de cod');
    expect(document.activeElement).toBe(field);
    expect(
      row('Mockup-uri & capturi de cod').querySelector(
        '.category-manager-hints',
      )?.textContent,
    ).toBe('EntersalveazăEscrenunță');
    // The count and the buttons are hidden while renaming.
    expect(
      within(row('Mockup-uri & capturi de cod')).queryByRole('button'),
    ).toBeNull();
  });

  it('saves with Enter and returns the focus to „Redenumește”', async () => {
    mount();
    const field = start();
    fireEvent.change(field, { target: { value: ' Mockup-uri ' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });

    expect(api.renameCategory).toHaveBeenCalledWith('c-mock', 'Mockup-uri');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(
      button(row('Mockup-uri & capturi de cod'), /^Redenumește/),
    );
  });

  it('writes nothing when the name did not change', async () => {
    mount();
    const field = start();
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });
    expect(api.renameCategory).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('asks for a name when the field is empty, without writing', async () => {
    mount();
    const field = start();
    fireEvent.change(field, { target: { value: '   ' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });
    expect(api.renameCategory).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Scrie un nume.');
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('cancels with Esc and only then closes with the second Esc', () => {
    mount();
    start();

    press('Escape');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogs()).toHaveLength(1);

    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.renameCategory).not.toHaveBeenCalled();
  });

  it('says a taken name under the row and stays in the rename', async () => {
    api.renameCategory.mockResolvedValue({
      ok: false,
      error: { code: 'CATEGORY_NAME_TAKEN' },
    });
    mount();
    const field = start();
    fireEvent.change(field, { target: { value: 'design & ui' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'Există deja „Design & UI” în Toolbox. Folosește „Unifică…”.',
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(toasts.getToasts()).toEqual([]);

    // Typing again clears the message.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alt' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows any other failure as an error toast and keeps the dialog', async () => {
    api.renameCategory.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_BUSY' },
    });
    mount();
    const field = start();
    fireEvent.change(field, { target: { value: 'Alt nume' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });

    expect(toasts.getToasts().map((t) => [t.kind, t.message])).toEqual([
      ['error', errorMessages.DATABASE_BUSY],
    ]);
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(dialogs()).toHaveLength(1);
  });
});

describe('CategoryManager: „Unifică…”', () => {
  const open = () =>
    fireEvent.click(button(row('Mockup-uri & capturi de cod'), /^Unifică…/));

  it('replaces the manager with a confirmation whose select starts empty', () => {
    mount();
    open();

    const box = screen.getByRole('dialog', {
      name: 'Unifică „Mockup-uri & capturi de cod”',
    });
    expect(dialogs()).toHaveLength(1);
    const select = within(box).getByRole<HTMLSelectElement>('combobox', {
      name: 'Mut fișele în',
    });
    expect(select.value).toBe('');
    expect(
      Array.from(select.options).map((option) => option.textContent),
    ).toEqual([
      'Alege o categorie',
      'Design & UI',
      'Imagini & video',
      'Terminal & dev tools',
    ]);
    expect(button(box, 'Unifică').hasAttribute('disabled')).toBe(true);
    expect(box.querySelector('.category-manager-consequence')).toBeNull();
    expect(document.activeElement).toBe(button(box, /^Renunță/));
  });

  it('says the consequence once a target is chosen, then merges', async () => {
    mount();
    open();
    const box = screen.getByRole('dialog');
    fireEvent.change(within(box).getByRole('combobox'), {
      target: { value: 'c-des' },
    });

    expect(
      box.querySelector('.category-manager-consequence')?.textContent,
    ).toBe(
      'Mut cele 3 fișe în „Design & UI” și șterg „Mockup-uri & capturi de cod”?',
    );
    expect(button(box, 'Unifică').hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(button(box, 'Unifică'));
    });

    expect(api.mergeCategories).toHaveBeenCalledWith('c-mock', 'c-des');
    expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
    expect(dialogs()).toHaveLength(1);
  });

  it('says the singular for one entry and the empty case for none', () => {
    mount();
    fireEvent.click(button(row('Imagini & video'), /^Unifică…/));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'c-des' },
    });
    expect(
      document.querySelector('.category-manager-consequence')?.textContent,
    ).toBe('Mut fișa în „Design & UI” și șterg „Imagini & video”?');

    cleanup();
    mount();
    fireEvent.click(button(row('Terminal & dev tools'), /^Unifică…/));
    expect(
      document.querySelector('.category-manager-consequence')?.textContent,
    ).toBe('Șterg „Terminal & dev tools”. Nu are fișe.');
  });

  it.each([['Renunță button'], ['Esc']])(
    'returns to the manager with %s, the focus on the row button that opened it',
    (how) => {
      mount();
      open();
      if (how === 'Esc') press('Escape');
      else fireEvent.click(button(screen.getByRole('dialog'), /^Renunță/));

      expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
      expect(api.mergeCategories).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(
        button(row('Mockup-uri & capturi de cod'), /^Unifică…/),
      );
    },
  );

  it('stays on the confirmation and toasts the error when the write fails', async () => {
    api.mergeCategories.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_BUSY' },
    });
    mount();
    open();
    const box = screen.getByRole('dialog');
    fireEvent.change(within(box).getByRole('combobox'), {
      target: { value: 'c-des' },
    });
    await act(async () => {
      fireEvent.click(button(box, 'Unifică'));
    });

    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe(
      box.getAttribute('aria-labelledby'),
    );
    expect(
      screen.getByRole('dialog', {
        name: 'Unifică „Mockup-uri & capturi de cod”',
      }),
    ).toBeTruthy();
    expect(toasts.getToasts().map((t) => t.message)).toEqual([
      errorMessages.DATABASE_BUSY,
    ]);
    expect(document.activeElement).toBe(
      within(screen.getByRole('dialog')).getByRole('combobox'),
    );
  });
});

describe('CategoryManager: „Șterge”', () => {
  const open = (name: string) => fireEvent.click(button(row(name), /^Șterge/));

  it('asks for a target when an entry has only this category, and moves on delete', async () => {
    mount();
    // Imagini & video: entry d also has Design & UI, so use Mockup-uri
    // (a and c have only it).
    open('Mockup-uri & capturi de cod');
    const box = screen.getByRole('dialog', {
      name: 'Ștergi „Mockup-uri & capturi de cod”?',
    });
    expect(box.textContent).toContain(
      '2 fișe au doar categoria asta. Alege unde le muți, ca să nu rămână fără categorie.',
    );
    expect(button(box, 'Șterge').hasAttribute('disabled')).toBe(true);

    fireEvent.change(within(box).getByRole('combobox'), {
      target: { value: 'c-img' },
    });
    expect(button(box, 'Șterge').hasAttribute('disabled')).toBe(false);
    await act(async () => {
      fireEvent.click(button(box, 'Șterge'));
    });

    expect(api.deleteCategory).toHaveBeenCalledWith('c-mock', 'c-img');
    expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
  });

  it('says the singular for one entry that has only the category', () => {
    mount({
      entries: [makeEntry('x', { categories: [imagini] })],
    });
    open('Imagini & video');
    expect(screen.getByRole('dialog').textContent).toContain(
      '1 fișă are doar categoria asta. Alege unde o muți, ca să nu rămână fără categorie.',
    );
  });

  it('has no select when every entry keeps another category', async () => {
    mount();
    open('Imagini & video');
    const box = screen.getByRole('dialog', {
      name: 'Ștergi „Imagini & video”?',
    });
    expect(within(box).queryByRole('combobox')).toBeNull();
    expect(box.textContent).toContain(
      'Fișa care o are rămâne cu cealaltă categorie.',
    );
    expect(button(box, 'Șterge').hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(button(box, 'Șterge'));
    });
    expect(api.deleteCategory).toHaveBeenCalledWith('c-img', undefined);
  });

  it('deletes a category with no entries without a select', async () => {
    mount();
    open('Terminal & dev tools');
    const box = screen.getByRole('dialog');
    expect(within(box).queryByRole('combobox')).toBeNull();
    expect(box.textContent).toContain('Categoria nu are fișe.');
    await act(async () => {
      fireEvent.click(button(box, 'Șterge'));
    });
    expect(api.deleteCategory).toHaveBeenCalledWith('c-term', undefined);
  });

  it('stays on the confirmation and toasts when the write fails', async () => {
    api.deleteCategory.mockResolvedValue({
      ok: false,
      error: { code: 'CATEGORY_TARGET_REQUIRED' },
    });
    mount();
    open('Terminal & dev tools');
    await act(async () => {
      fireEvent.click(button(screen.getByRole('dialog'), 'Șterge'));
    });
    expect(
      screen.getByRole('dialog', { name: 'Ștergi „Terminal & dev tools”?' }),
    ).toBeTruthy();
    expect(toasts.getToasts().map((t) => t.message)).toEqual([
      errorMessages.CATEGORY_TARGET_REQUIRED,
    ]);
    expect(document.activeElement).toBe(
      button(screen.getByRole('dialog'), /^Renunță/),
    );
  });

  it('disables „Șterge” of the only category of a zone that an entry holds alone, with the reason', () => {
    mount({
      categories: [mockups, backend],
      entries: [makeEntry('x', { categories: [mockups] })],
    });
    const blocked = button(row('Mockup-uri & capturi de cod'), /^Șterge/);
    expect(blocked.hasAttribute('disabled')).toBe(true);
    expect(blocked.getAttribute('title')).toBe(
      'Unele fișe au doar categoria asta și nu există alta în zonă.',
    );
    // Learn's only category holds no entry alone: it can go.
    const free = button(row('Backend & API-uri'), /^Șterge/);
    expect(free.hasAttribute('disabled')).toBe(false);
    expect(free.getAttribute('title')).toBeNull();
  });

  it('goes back to the list when the category vanishes under the confirmation', () => {
    const view = mount();
    open('Terminal & dev tools');
    expect(screen.getByRole('dialog', { name: /^Ștergi/ })).toBeTruthy();
    view.update({
      categories: categories.filter((category) => category.id !== 'c-term'),
    });
    expect(screen.getByRole('dialog', { name: 'Categorii' })).toBeTruthy();
  });
});
