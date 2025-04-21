import { ipcRenderer } from 'electron'

const api = {
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => func(...args))
  },
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // Specific methods for type safety (optional but recommended)
  // These just wrap the generic invoke but provide better hints in the renderer
  getAssets: (params?: any) => ipcRenderer.invoke('get-assets', params),
  createAsset: (sourcePath: string) => ipcRenderer.invoke('create-asset', sourcePath),
  bulkImportAssets: () => ipcRenderer.invoke('bulk-import-assets'),
  updateAsset: (payload: any) => ipcRenderer.invoke('update-asset', payload),
  deleteAsset: (assetId: number) => ipcRenderer.invoke('delete-asset', assetId),
  openFileDialog: (options?: any) => ipcRenderer.invoke('open-file-dialog', options),

  // Versioning methods
  createVersion: (payload: { masterId: number; sourcePath: string }) => ipcRenderer.invoke('create-version', payload),
  getVersions: (payload: { masterId: number }) => ipcRenderer.invoke('get-versions', payload),
  addToGroup: (payload: { versionId: number; masterId: number }) => ipcRenderer.invoke('add-to-group', payload),
  removeFromGroup: (payload: { versionId: number }) => ipcRenderer.invoke('remove-from-group', payload),
  promoteVersion: (payload: { versionId: number }) => ipcRenderer.invoke('promote-version', payload),
}

// Type definition for get-master-assets handler
export type GetMasterAssetsFunc = (searchTerm?: string) => Promise<{ success: boolean; assets?: { id: number; fileName: string }[]; error?: string }>;

// Type definition for open-file-dialog handler

export default api
