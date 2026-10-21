import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportResultDto, IpcResult } from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import type { FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import {
  fakeFrameApi,
  imagini,
  makeEntry,
  okSnapshot,
  renderApp,
} from './test-fixtures';
import { applyTheme } from './theme';
import { toasts } from './toast-store';

// The export (CAP-13, Flow 6) through the real App and the real store, with a
// fake bridge that answers like main's `catalog:export` channel.

const removeBg = makeEntry('removebg', {
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: [imagini],
  situations: ['scot fundalul'],
});

const FOLDER: ExportResultDto = {
  folderName: 'whenkit-export-2026-10-16_143002',
  folderPath: 'C:\\Users\\Luca\\Documents\\whenkit-export-2026-10-16_143002',
};

let exportCatalog: ReturnType<
  typeof vi.fn<() => Promise<IpcResult<ExportResultDto | null>>>
>;
let openExportFolder: ReturnType<
  typeof vi.fn<(path: string) => Promise<IpcResult<null>>>
>;
let api: FrameApi;
let store: CatalogStore;

beforeEach(() => {
  applyTheme('light');
  toasts.clear();
  exportCatalog = vi.fn(() => Promise.resolve({ ok: true, data: FOLDER }));
  openExportFolder = vi.fn(() => Promise.resolve({ ok: true, data: null }));
  api = fakeFrameApi({ exportCatalog, openExportFolder });
  store = createCatalogStore({
    catalogSnapshot: () => Promise.resolve(okSnapshot([removeBg], [imagini])),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.title = 'WhenKit';
});

async function open() {
  await renderApp(store, api);
}

const exportButton = () =>
  screen.getByRole('button', {
    name: /^(Exportă catalogul|Se exportă…)$/,
  }) as HTMLButtonElement;
const toastHost = () => screen.getByLabelText('Notificări');

describe('App: export', () => {
  it('has an active „Exportă catalogul” button in the toolbar', async () => {
    await open();
    expect(exportButton().disabled).toBe(false);
    expect(exportButton().getAttribute('aria-busy')).toBeNull();
    expect(exportCatalog).not.toHaveBeenCalled();
  });

  it('is busy from the click until main answers', async () => {
    let answer: (result: IpcResult<ExportResultDto | null>) => void = () => {};
    exportCatalog.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    await open();

    fireEvent.click(exportButton());

    expect(exportButton().disabled).toBe(true);
    expect(exportButton().getAttribute('aria-busy')).toBe('true');
    expect(exportButton().textContent).toBe('Se exportă…');
    expect(exportButton().querySelector('.spin')).not.toBeNull();
    // A second click while busy does nothing.
    fireEvent.click(exportButton());
    expect(exportCatalog).toHaveBeenCalledTimes(1);

    await act(async () => answer({ ok: true, data: FOLDER }));

    expect(exportButton().disabled).toBe(false);
    expect(exportButton().textContent).toBe('Exportă catalogul');
  });

  it('announces the folder in a toast whose action opens it', async () => {
    await open();

    await act(async () => fireEvent.click(exportButton()));

    const toast = within(toastHost());
    expect(toast.getByText(FOLDER.folderName).tagName).toBe('B');
    expect(toastHost().textContent).toContain(
      `Catalog exportat: ${FOLDER.folderName}`,
    );
    expect(openExportFolder).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent.click(toast.getByRole('button', { name: 'Deschide folderul' })),
    );

    expect(openExportFolder).toHaveBeenCalledWith(FOLDER.folderPath);
    // No error follows an opened folder.
    expect(toastHost().textContent).not.toContain(errorMessages.INTERNAL);
  });

  it('says so when the folder cannot be opened', async () => {
    openExportFolder.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    await open();
    await act(async () => fireEvent.click(exportButton()));

    await act(async () =>
      fireEvent.click(
        within(toastHost()).getByRole('button', { name: 'Deschide folderul' }),
      ),
    );

    expect(toastHost().textContent).toContain(errorMessages.INTERNAL);
  });

  it('shows nothing when the folder dialog was cancelled', async () => {
    exportCatalog.mockResolvedValue({ ok: true, data: null });
    await open();

    await act(async () => fireEvent.click(exportButton()));

    expect(exportCatalog).toHaveBeenCalledTimes(1);
    expect(toasts.getToasts()).toEqual([]);
    expect(exportButton().disabled).toBe(false);
    expect(exportButton().textContent).toBe('Exportă catalogul');
  });

  it.each(['EXPORT_WRITE_FAILED', 'DATABASE_BUSY', 'INTERNAL'] as const)(
    'toasts the message of %s and releases the button',
    async (code) => {
      exportCatalog.mockResolvedValue({ ok: false, error: { code } });
      await open();

      await act(async () => fireEvent.click(exportButton()));

      expect(toastHost().textContent).toContain(errorMessages[code]);
      expect(exportButton().disabled).toBe(false);
    },
  );

  it('says „Nu am putut scrie în folderul ales.” when the write fails', async () => {
    exportCatalog.mockResolvedValue({
      ok: false,
      error: { code: 'EXPORT_WRITE_FAILED' },
    });
    await open();
    await act(async () => fireEvent.click(exportButton()));
    expect(toastHost().textContent).toContain(
      'Nu am putut scrie în folderul ales.',
    );
  });

  it('stays enabled while an entry is being edited', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'remove.bg' }));
    fireEvent.click(screen.getByRole('button', { name: /Editează/ }));
    expect(document.querySelector('.entry-edit-form')).not.toBeNull();

    // The zone tabs are inactive in edit mode; the export is not.
    expect(
      screen.getByRole<HTMLButtonElement>('tab', { name: /^Learn/ }).disabled,
    ).toBe(true);
    expect(exportButton().disabled).toBe(false);

    await act(async () => fireEvent.click(exportButton()));
    expect(exportCatalog).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.entry-edit-form')).not.toBeNull();
  });
});
