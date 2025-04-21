import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import api, { GetMasterAssetsFunc } from './api'

// Custom APIs for renderer
const apiFunctions = {
  // Existing API functions...
  getAssets: (params) => ipcRenderer.invoke('get-assets', params),
  createAsset: (sourcePath: string) => ipcRenderer.invoke('create-asset', sourcePath),
  bulkImportAssets: () => ipcRenderer.invoke('bulk-import-assets'),
  updateAsset: (payload) => ipcRenderer.invoke('update-asset', payload),
  deleteAsset: (id: number) => ipcRenderer.invoke('delete-asset', id),
  createVersion: (payload) => ipcRenderer.invoke('create-version', payload),
  getVersions: (payload) => ipcRenderer.invoke('get-versions', payload),
  addToGroup: (payload) => ipcRenderer.invoke('add-to-group', payload),
  removeFromGroup: (payload) => ipcRenderer.invoke('remove-from-group', payload),
  promoteVersion: (payload) => ipcRenderer.invoke('promote-version', payload),

  // --- Add the new function here ---
  getMasterAssets: (searchTerm?: string) => ipcRenderer.invoke('get-master-assets', searchTerm) as ReturnType<GetMasterAssetsFunc>,

  // --- Add generic invoke/open dialog if needed ---
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  // Example listener setup (if needed for future features)
  // on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on(channel, listener),
  // removeListener: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', apiFunctions)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = apiFunctions
}
