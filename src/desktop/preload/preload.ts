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
  setTheme: (theme: Theme) =>
    ipcRenderer.invoke(IPC_CHANNELS.windowSetTheme, theme),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
} satisfies WhenkitApi;

contextBridge.exposeInMainWorld('whenkit', api);
