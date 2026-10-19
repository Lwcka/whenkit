import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  themeFromArgv,
  type Theme,
  type WhenkitApi,
} from '../../shared/ipc';

// The only thing the sandboxed renderer can reach (AD-9): `window.whenkit`.
const api = {
  initialTheme: themeFromArgv(process.argv),
  catalogSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.catalogSnapshot),
  setTheme: (theme: Theme) =>
    ipcRenderer.invoke(IPC_CHANNELS.windowSetTheme, theme),
} satisfies WhenkitApi;

contextBridge.exposeInMainWorld('whenkit', api);
