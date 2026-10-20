import { contextBridge, ipcRenderer, webFrame } from 'electron';
import {
  IPC_CHANNELS,
  workspaceFromArgv,
  type Theme,
  type WhenkitApi,
} from '../../shared/ipc';

// The only thing the sandboxed renderer can reach (AD-9): `window.whenkit`.
const api = {
  workspacePath: workspaceFromArgv(process.argv),
  catalogSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.catalogSnapshot),
  searchEntries: (text: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.entriesSearch, text),
  onCatalogChanged: (listener: () => void) => {
    // The event object is not handed on: the renderer learns only that
    // something changed.
    const handler = () => listener();
    ipcRenderer.on(IPC_CHANNELS.catalogChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.catalogChanged, handler);
    };
  },
  setTheme: (theme: Theme) =>
    ipcRenderer.invoke(IPC_CHANNELS.windowSetTheme, theme),
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, url),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
} satisfies WhenkitApi;

contextBridge.exposeInMainWorld('whenkit', api);
