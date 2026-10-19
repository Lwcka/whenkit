import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type WhenkitApi } from '../../shared/ipc';

// The only thing the sandboxed renderer can reach (AD-9): `window.whenkit`.
const api = {
  catalogSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.catalogSnapshot),
} satisfies WhenkitApi;

contextBridge.exposeInMainWorld('whenkit', api);
