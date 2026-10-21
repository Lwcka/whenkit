import { contextBridge, ipcRenderer, webFrame } from 'electron';
import {
  IPC_CHANNELS,
  workspaceFromArgv,
  type EntryPatchInput,
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
  setNotes: (id: string, notes: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.entriesSetNotes, id, notes),
  deleteEntry: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.entriesDelete, id),
  patchEntry: (input: EntryPatchInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.entriesPatch, input),
  renameCategory: (id: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.categoriesRename, id, name),
  mergeCategories: (sourceId: string, targetId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.categoriesMerge, sourceId, targetId),
  deleteCategory: (id: string, targetId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.categoriesDelete, id, targetId),
  onFlushNotes: (flush: () => Promise<void>) => {
    // Main waits for the answer (with a time limit): it is sent whether the
    // flush worked or not.
    const handler = async () => {
      try {
        await flush();
      } finally {
        ipcRenderer.send(IPC_CHANNELS.windowNotesFlushed);
      }
    };
    ipcRenderer.on(IPC_CHANNELS.windowFlushNotes, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowFlushNotes, handler);
    };
  },
  setTheme: (theme: Theme) =>
    ipcRenderer.invoke(IPC_CHANNELS.windowSetTheme, theme),
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, url),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
} satisfies WhenkitApi;

contextBridge.exposeInMainWorld('whenkit', api);
