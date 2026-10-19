import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { createProcessEnvironment } from '../../adapters/env/process-environment';
import { nodeFileSystem } from '../../adapters/fs/node-file-system';
import { openCatalogStore } from '../../adapters/sqlite/sqlite-catalog-store';
import { randomIdGenerator, systemClock } from '../../adapters/system';
import { IPC_CHANNELS } from '../../shared/ipc';
import { openDesktopCatalog, snapshotResult } from './catalog';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

/** The window never waits long for a lock held by the CLI (AD-4). */
const DESKTOP_BUSY_TIMEOUT_MS = 2000;

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'whenkit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Set explicitly (AD-9) so a default change in Electron cannot weaken them.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // DevTools only in development, never in a packaged build.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  // `npm start` does not load .env (the CLI's cli:dev does): without it the
  // dev window would resolve the real workspace (AD-19). Packaged builds
  // never read it.
  if (!app.isPackaged) {
    const envFile = path.join(app.getAppPath(), '.env');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }

  // The single connection of the process (AD-10), opened before the window
  // asks for anything. A refusal is kept and answered by the handler.
  const catalog = openDesktopCatalog({
    // __filename: the CJS main bundle has no usable import.meta.url.
    env: createProcessEnvironment(__filename),
    fs: nodeFileSystem,
    openStore: (dbPath, options) =>
      openCatalogStore(dbPath, {
        ...options,
        clock: systemClock,
        ids: randomIdGenerator,
        busyTimeoutMs: DESKTOP_BUSY_TIMEOUT_MS,
      }),
  });
  ipcMain.handle(IPC_CHANNELS.catalogSnapshot, () => snapshotResult(catalog));
  app.on('will-quit', () => {
    if (catalog.ok) catalog.store.close();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
