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

import { GetMasterAssetsFunc } from '../lib/preload/api' // Import the type

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

// Define the interface for the exposed API methods
export interface ExposedApi {
  send: (channel: string, ...args: any[]) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
  removeAllListeners: (channel: string) => void;

  // Specific methods
  getAssets: (params?: { filters?: any; sort?: any }) => Promise<AssetWithThumbnail[]>;
  createAsset: (sourcePath: string) => Promise<CreateAssetResult>;
  bulkImportAssets: () => Promise<BulkImportResult>;
  updateAsset: (payload: UpdateAssetPayload) => Promise<boolean>;
  deleteAsset: (assetId: number) => Promise<boolean>;
  // Keep the specific openFileDialog definition
  openFileDialog: (options?: OpenDialogOptions) => Promise<OpenDialogReturnValue>; 

  // Versioning methods
  createVersion: (payload: { masterId: number; sourcePath: string }) => Promise<CreateVersionResult>; 
  getVersions: (payload: { masterId: number }) => Promise<GetVersionsResult>; 
  addToGroup: (payload: { versionId: number; masterId: number }) => Promise<AddToGroupResult>; 
  removeFromGroup: (payload: { versionId: number; }) => Promise<RemoveFromGroupResult>; 
  promoteVersion: (payload: { versionId: number; }) => Promise<PromoteVersionResult>; 

  // Grouping methods
  getMasterAssets: GetMasterAssetsFunc;

  // REMOVE the generic invoke and dialog definitions if they are redundant
  // openFileDialog: (options: any) => Promise<any>; 
  // invoke: (channel: string, ...args: any[]) => Promise<any>; // Already defined above with generics
}

// Update the global Window interface
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
