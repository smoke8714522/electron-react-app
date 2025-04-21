/// <reference types="electron-vite/node" />

// Import Electron types needed for IPC definitions
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron' 

// Import result types from useAssets for clarity (assuming they are exported)
import type { 
    AssetWithThumbnail, 
    CreateAssetResult, 
    BulkImportResult, 
    UpdateAssetPayload, 
    CreateVersionResult, 
    GetVersionsResult, 
    AddToGroupResult, 
    RemoveFromGroupResult, 
    PromoteVersionResult 
} from './hooks/useAssets'; // Adjust path if necessary

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

// Define the interface for the API exposed by lib/preload/api.ts
export interface ExposedApi {
  send: (channel: string, ...args: any[]) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
  removeAllListeners: (channel: string) => void;

  // Specific methods defined in lib/preload/api.ts
  getAssets: (params?: { filters?: any; sort?: any }) => Promise<AssetWithThumbnail[]>; // Use imported type
  createAsset: (sourcePath: string) => Promise<CreateAssetResult>; // Use imported type
  bulkImportAssets: () => Promise<BulkImportResult>; // Use imported type
  updateAsset: (payload: UpdateAssetPayload) => Promise<boolean>; // Use imported type
  deleteAsset: (assetId: number) => Promise<boolean>;
  openFileDialog: (options?: OpenDialogOptions) => Promise<OpenDialogReturnValue>; // Use Electron types

  // Versioning methods
  createVersion: (payload: { masterId: number; sourcePath: string }) => Promise<CreateVersionResult>; // Use imported type
  getVersions: (payload: { masterId: number }) => Promise<GetVersionsResult>; // Use imported type
  addToGroup: (payload: { versionId: number; masterId: number }) => Promise<AddToGroupResult>; // Use imported type
  removeFromGroup: (payload: { versionId: number }) => Promise<RemoveFromGroupResult>; // Use imported type
  promoteVersion: (payload: { versionId: number }) => Promise<PromoteVersionResult>; // Use imported type
}

// Update the global Window interface to reflect the exposed API
declare global {
  interface Window {
    // Keep electronAPI if it's still used elsewhere, otherwise remove
    electron?: {
      // Assuming electronAPI type is defined elsewhere or provided by @electron-toolkit/preload
      // If not, define it or remove this part if unused.
      api: any; // Replace 'any' with the actual type if available
    };
    // Define the api object exposed by contextBridge
    api: ExposedApi;
  }
}
