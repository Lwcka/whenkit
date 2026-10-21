import {
  app,
  BrowserWindow,
  dialog,
  type IpcMainEvent,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  shell,
} from 'electron';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { createProcessEnvironment } from '../../adapters/env/process-environment';
import { nodeFileSystem } from '../../adapters/fs/node-file-system';
import { createGitHubClient } from '../../adapters/github/node-github-client';
import { createHttpClient } from '../../adapters/http/node-http-client';
import { openCatalogStore } from '../../adapters/sqlite/sqlite-catalog-store';
import { randomIdGenerator, systemClock } from '../../adapters/system';
import {
  desktopDataDir,
  readBlockedDomains,
  resolveWorkspace,
} from '../../core/workspace';
import {
  IPC_CHANNELS,
  isTheme,
  WORKSPACE_ARGUMENT_PREFIX,
  type IpcResult,
  type Theme,
} from '../../shared/ipc';
import {
  appStrings,
  exportStrings,
  mainStrings,
} from '../../shared/strings.ro';
import {
  openDesktopCatalog,
  patchEntryResult,
  searchResult,
  setNotesResult,
  deleteCategoryResult,
  deleteEntryResult,
  exportCatalogResult,
  failure,
  openExportFolderResult,
  mergeCategoriesResult,
  renameCategoryResult,
  snapshotResult,
} from './catalog';
import { watchCatalog, type CatalogWatcher } from './catalog-watch';
import { waitForNotesFlush } from './close-flush';
import { createErrorReporter } from './error-log';
import { openExternalResult } from './external-link';
import { isAppNavigation } from './navigation';
import {
  nativeThemeSettings,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from './theme';
import {
  readWindowState,
  writeWindowState,
  type WindowState,
} from './window-state';

/** The window never waits long for a lock held by the CLI (AD-4). */
const DESKTOP_BUSY_TIMEOUT_MS = 2000;
/** How often main looks for writes of other processes (AD-10). */
const CATALOG_POLL_INTERVAL_MS = 2000;
/**
 * How long closing waits for the renderer to save its pending notes (AD-20).
 * The store's busy timeout is 2 s, so one save blocked by a lock still fits.
 */
const NOTES_FLUSH_TIMEOUT_MS = 3000;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const STATE_FILE = 'window-state.json';
const LOG_FILE = 'whenkit.log';

/** Where unexpected errors are logged: `<workspace>\data\whenkit.log`, when data/ exists. */
function resolveLogPath(
  env: ReturnType<typeof createProcessEnvironment>,
): string | undefined {
  try {
    const dataDir = path.join(resolveWorkspace(env, nodeFileSystem), 'data');
    return existsSync(dataDir) ? path.join(dataDir, LOG_FILE) : undefined;
  } catch {
    return undefined;
  }
}

function main(): void {
  // 1. Dev only: `npm start` does not load .env (the CLI's cli:dev does).
  // Without it the dev window would resolve the real workspace (AD-19).
  // Packaged builds never read it. It runs before anything resolves a path.
  if (!app.isPackaged) {
    const envFile = path.join(app.getAppPath(), '.env');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }

  // 2. userData beside config.json, before the lock and before `ready`
  // (AD-20): the dev and the installed app never share a profile or a lock.
  // __filename: the CJS main bundle has no usable import.meta.url.
  const env = createProcessEnvironment(__filename);
  const userData = desktopDataDir(env, nodeFileSystem, app.isPackaged);
  if (userData === undefined) {
    dialog.showErrorBox(mainStrings.noAppDataTitle, mainStrings.noAppDataBody);
    app.exit(1);
    return;
  }
  mkdirSync(userData, { recursive: true });
  app.setPath('userData', userData);

  // 3. One instance per profile.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  let mainWindow: BrowserWindow | undefined;
  /** The window, unless it is not created yet or already destroyed. */
  const liveWindow = (): BrowserWindow | undefined =>
    mainWindow !== undefined && !mainWindow.isDestroyed()
      ? mainWindow
      : undefined;
  app.on('second-instance', () => {
    const window = liveWindow();
    if (window === undefined) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  // 4. Unexpected errors: a dialog and the workspace log (AD-19).
  const reporter = createErrorReporter({
    logPath: resolveLogPath(env),
    append: (file, text) => appendFileSync(file, text, 'utf8'),
    showDialog: (logPath) =>
      dialog.showErrorBox(
        mainStrings.unexpectedErrorTitle,
        mainStrings.unexpectedErrorBody(logPath),
      ),
    now: () => new Date(),
  });
  process.on('uncaughtException', (error) => reporter.report(error));
  process.on('unhandledRejection', (reason) => reporter.report(reason));

  const appUrl =
    MAIN_WINDOW_VITE_DEV_SERVER_URL ||
    pathToFileURL(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    ).href;

  // AD-9: the window shows the app's own page only, whatever it is asked to
  // open or attach.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => {
      if (!isAppNavigation(event.url, appUrl)) event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  const statePath = path.join(userData, STATE_FILE);
  /** What window-state.json holds; main is its only writer (AD-20). */
  let saved: WindowState = {};

  const saveState = (window: BrowserWindow): boolean => {
    try {
      if (!window.isDestroyed()) saved.bounds = window.getNormalBounds();
      writeWindowState(statePath, saved);
      return true;
    } catch (error) {
      reporter.log(error);
      return false;
    }
  };

  const createWindow = (theme: Theme, workspace: string | null) => {
    const { backgroundColor, titleBarOverlay } = nativeThemeSettings(theme);
    const window = new BrowserWindow({
      ...(saved.bounds ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }),
      center: saved.bounds === undefined,
      // Shown after the maximize below, so a maximized window never flashes
      // at its normal size.
      show: false,
      minWidth: WINDOW_MIN_WIDTH,
      minHeight: WINDOW_MIN_HEIGHT,
      title: appStrings.productName,
      titleBarStyle: 'hidden',
      titleBarOverlay,
      backgroundColor,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        // Set explicitly (AD-9) so a default change in Electron cannot weaken them.
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        // The workspace is resolved once, here; the renderer reads it from
        // its launch arguments (no channel needed). The theme is not passed:
        // the renderer follows prefers-color-scheme, which Electron ties to
        // nativeTheme.themeSource (AD-20).
        additionalArguments:
          workspace === null
            ? []
            : [`${WORKSPACE_ARGUMENT_PREFIX}${workspace}`],
      },
    });
    mainWindow = window;
    // The saved normal bounds stay the restore size and pick the screen.
    if (saved.maximized === true) window.maximize();
    window.show();
    // Kept current from the events: a minimized maximized window stays so.
    window.on('maximize', () => {
      saved.maximized = true;
    });
    window.on('unmaximize', () => {
      delete saved.maximized;
    });
    // AD-20: the first `close` is held back until the renderer has saved its
    // pending notes (or the wait ran out); the second one saves the window
    // state and lets the window go.
    let notesFlushed = false;
    let flushing = false;
    window.on('close', (event) => {
      if (!notesFlushed && !window.webContents.isDestroyed()) {
        event.preventDefault();
        if (flushing) return;
        flushing = true;
        const { webContents } = window;
        void waitForNotesFlush({
          request: () => webContents.send(IPC_CHANNELS.windowFlushNotes),
          onReply: (callback) => {
            const listener = (reply: IpcMainEvent) => {
              if (reply.sender === webContents) callback();
            };
            ipcMain.on(IPC_CHANNELS.windowNotesFlushed, listener);
            return () => {
              ipcMain.removeListener(IPC_CHANNELS.windowNotesFlushed, listener);
            };
          },
          timeoutMs: NOTES_FLUSH_TIMEOUT_MS,
        }).then(() => {
          notesFlushed = true;
          if (!window.isDestroyed()) window.close();
        });
        return;
      }
      saveState(window);
    });

    void window.loadURL(appUrl);
    // DevTools only in development, never in a packaged build.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) window.webContents.openDevTools();
  };

  const currentTheme = (): Theme =>
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light';

  /** The native half of a theme: the window background and the caption buttons. */
  const applyNativeTheme = (window: BrowserWindow, theme: Theme) => {
    const { backgroundColor, titleBarOverlay } = nativeThemeSettings(theme);
    window.setBackgroundColor(backgroundColor);
    window.setTitleBarOverlay(titleBarOverlay);
  };

  void app
    .whenReady()
    .then(() => {
      saved = readWindowState(
        statePath,
        screen.getAllDisplays().map((display) => display.workArea),
      );
      nativeTheme.themeSource = saved.theme ?? 'system';

      // The single connection of the process (AD-10), opened before the window
      // asks for anything. A refusal is kept and answered by the handler.
      const catalog = openDesktopCatalog({
        env,
        fs: nodeFileSystem,
        openStore: (dbPath, options) =>
          openCatalogStore(dbPath, {
            ...options,
            clock: systemClock,
            ids: randomIdGenerator,
            busyTimeoutMs: DESKTOP_BUSY_TIMEOUT_MS,
          }),
        logError: reporter.log,
      });
      // Tells the window the catalog changed (AD-10): from the poll below and
      // from the handlers that write.
      const notifyCatalogChanged = () => {
        const window = liveWindow();
        if (window === undefined) return;
        const { webContents } = window;
        if (!webContents.isDestroyed()) {
          webContents.send(IPC_CHANNELS.catalogChanged);
        }
      };
      // What the six write handlers share (AD-10, AD-18).
      const writeContext = {
        opened: catalog,
        emit: notifyCatalogChanged,
        logError: reporter.log,
      };
      ipcMain.handle(IPC_CHANNELS.catalogSnapshot, () =>
        snapshotResult(catalog, reporter.log),
      );
      ipcMain.handle(IPC_CHANNELS.entriesSearch, (_event, text: unknown) =>
        searchResult(catalog, text, reporter.log),
      );
      ipcMain.handle(
        IPC_CHANNELS.entriesSetNotes,
        (_event, id: unknown, notes: unknown) =>
          setNotesResult(writeContext, id, notes),
      );
      ipcMain.handle(IPC_CHANNELS.entriesDelete, (_event, id: unknown) =>
        deleteEntryResult(writeContext, id),
      );
      ipcMain.handle(
        IPC_CHANNELS.categoriesRename,
        (_event, id: unknown, name: unknown) =>
          renameCategoryResult(writeContext, id, name),
      );
      ipcMain.handle(
        IPC_CHANNELS.categoriesMerge,
        (_event, sourceId: unknown, targetId: unknown) =>
          mergeCategoriesResult(writeContext, sourceId, targetId),
      );
      ipcMain.handle(
        IPC_CHANNELS.categoriesDelete,
        (_event, id: unknown, targetId: unknown) =>
          deleteCategoryResult(writeContext, id, targetId),
      );
      // The same link checks as the CLI's import (AD-3), created once.
      const patchDeps = {
        http: createHttpClient(),
        github: createGitHubClient(),
        clock: systemClock,
        readBlockedDomains: (workspace: string) =>
          readBlockedDomains(workspace, { env, fs: nodeFileSystem }),
      };
      ipcMain.handle(IPC_CHANNELS.entriesPatch, (_event, input: unknown) =>
        patchEntryResult(writeContext, input, patchDeps),
      );
      // The export (CAP-13, AD-12): one call opens the folder dialog and
      // writes. Main remembers the folders it made, so "Deschide folderul"
      // can open those and nothing else (AD-9).
      const exportDeps = {
        fs: nodeFileSystem,
        clock: systemClock,
        labels: exportStrings,
      };
      const exportedFolders = new Set<string>();
      ipcMain.handle(IPC_CHANNELS.catalogExport, async (event) => {
        if (!catalog.ok) return failure(catalog.code);
        try {
          const options = {
            title: mainStrings.exportDialogTitle,
            defaultPath: app.getPath('documents'),
            properties: ['openDirectory' as const, 'createDirectory' as const],
          };
          const window = BrowserWindow.fromWebContents(event.sender);
          const picked =
            window === null
              ? await dialog.showOpenDialog(options)
              : await dialog.showOpenDialog(window, options);
          const result = exportCatalogResult(
            catalog,
            picked.canceled ? undefined : picked.filePaths[0],
            exportDeps,
            reporter.log,
          );
          if (result.ok && result.data !== null) {
            exportedFolders.add(result.data.folderPath);
          }
          return result;
        } catch (error) {
          reporter.log(error);
          return failure('INTERNAL');
        }
      });
      ipcMain.handle(
        IPC_CHANNELS.shellOpenExportFolder,
        (_event, folderPath: unknown) =>
          openExportFolderResult(
            folderPath,
            exportedFolders,
            (target) => shell.openPath(target),
            reporter.log,
          ),
      );
      ipcMain.handle(IPC_CHANNELS.shellOpenExternal, (_event, url: unknown) =>
        openExternalResult(url, (u) => shell.openExternal(u), reporter.log),
      );
      ipcMain.handle(
        IPC_CHANNELS.windowSetTheme,
        (event, theme: unknown): IpcResult<null> => {
          if (!isTheme(theme)) {
            return failure('ARGUMENTS_INVALID');
          }
          try {
            nativeTheme.themeSource = theme;
            const window = BrowserWindow.fromWebContents(event.sender);
            saved.theme = theme;
            if (window === null) {
              try {
                writeWindowState(statePath, saved);
              } catch (error) {
                reporter.log(error);
              }
            } else {
              applyNativeTheme(window, theme);
              // The theme is applied; a failed save is already logged.
              saveState(window);
            }
            return { ok: true, data: null };
          } catch (error) {
            reporter.log(error);
            return failure('INTERNAL');
          }
        },
      );
      let watcher: CatalogWatcher | undefined;
      app.on('will-quit', () => {
        // Stop polling first: it reads through the store that closes next.
        watcher?.stop();
        if (catalog.ok) catalog.store.close();
      });

      // No application menu: the renderer's keyboard layer owns Ctrl+=/−/0,
      // and nothing else (Ctrl+R, Ctrl+Shift+I) is reachable in production.
      Menu.setApplicationMenu(null);

      // With no saved theme the renderer follows Windows live; the native
      // half (background, caption buttons) must follow it too.
      nativeTheme.on('updated', () => {
        const window = liveWindow();
        if (window !== undefined) applyNativeTheme(window, currentTheme());
      });

      const workspace = catalog.ok ? catalog.workspace : null;
      createWindow(currentTheme(), workspace);

      if (catalog.ok) {
        const { store } = catalog;
        watcher = watchCatalog({
          readVersion: () => store.dataVersion(),
          emit: notifyCatalogChanged,
          intervalMs: CATALOG_POLL_INTERVAL_MS,
          logError: reporter.log,
        });
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow(currentTheme(), workspace);
        }
      });
    })
    // A failed startup must not leave a windowless process holding the lock.
    .catch((error: unknown) => {
      reporter.report(error);
      app.exit(1);
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// Squirrel install/uninstall events: nothing else may run (it also quits).
if (started) {
  app.quit();
} else {
  main();
}
