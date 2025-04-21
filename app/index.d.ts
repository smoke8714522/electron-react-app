/// <reference types="electron-vite/node" />

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.web' {
  const content: string
  export default content
}

export interface ElectronAPI {
  // Add specific function signatures exposed via contextBridge here
  getAssets: (params?: { filters?: any; sort?: any }) => Promise<any[]> // Replace any with specific types if known
  openFileDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>
  createAsset: (filePath: string) => Promise<CreateAssetResult>
  bulkImportAssets: (filePaths: string[]) => Promise<BulkImportResult>
  updateAsset: (payload: UpdateAssetPayload) => Promise<boolean>
  deleteAsset: (assetId: number) => Promise<boolean>

  // Versioning API
  createVersion: (masterId: number, sourcePath: string) => Promise<CreateVersionResult>
  getVersions: (masterId: number) => Promise<GetVersionsResult>
  addToGroup: (versionId: number, masterId: number) => Promise<AddToGroupResult>
  removeFromGroup: (versionId: number) => Promise<RemoveFromGroupResult>
  promoteVersion: (versionId: number) => Promise<PromoteVersionResult>

  // Generic invoke for handlers not explicitly listed (like open-file-dialog)
  invoke: <T>(channel: string, ...args: any[]) => Promise<T>
}

declare global {
  interface Window {
    electron: {
      api: ElectronAPI
    }
    // Add other preload script exposed variables here if any
  }
}
