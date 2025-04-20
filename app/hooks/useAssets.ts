import { useState, useEffect, useCallback } from 'react'

// PRD §4.2 Data Model - Define Asset structure (copied from main/schema.ts)
// Ideally, share types via a common package or define in a shared types file within 'app'
export interface Asset {
  id: number;
  fileName: string; // Original filename
  filePath: string; // Relative path within the vault
  mimeType: string; // Detected MIME type
  size: number; // File size in bytes
  createdAt: string; // ISO 8601 date string
  year: number | null;
  advertiser: string | null;
  niche: string | null;
  adspower: string | null;
  // Note: Custom fields are not directly part of the Asset type here
  // They need to be fetched/managed separately if displayed/edited
}

// PRD §4.1 Library View - Extend Asset with optional thumbnail path for UI
export interface AssetWithThumbnail extends Asset {
  thumbnailPath?: string | null;
}

// Result type for create-asset IPC call
export interface CreateAssetResult {
  success: boolean;
  asset?: AssetWithThumbnail; // Updated to include thumbnail path
  error?: string;
}

// Result type for bulk-import-assets IPC call
export interface BulkImportResult {
    success: boolean;
    importedCount: number;
    assets?: AssetWithThumbnail[]; // Returns successfully imported assets
    errors: { file: string, error: string }[];
}

// Argument type for update-asset IPC call
export type UpdateAssetPayload = {
  id: number;
  updates: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'>> & { // Allow updating specific fields
    customFields?: Record<string, string | null>; // Allow sending custom fields updates/deletions
  };
};

// Define the API structure exposed by the preload script more specifically
// This improves type safety when calling window.api.invoke
interface ExposedApi {
  // Updated return type for get-assets
  invoke(channel: 'get-assets'): Promise<AssetWithThumbnail[]>; 
  invoke(channel: 'open-file-dialog'): Promise<string | null>;
  // Updated return type for create-asset
  invoke(channel: 'create-asset', sourcePath: string): Promise<CreateAssetResult>; 
  invoke(channel: 'update-asset', payload: UpdateAssetPayload): Promise<boolean>;
  invoke(channel: 'delete-asset', id: number): Promise<boolean>;
  // Add bulk-import-assets channel definition
  invoke(channel: 'bulk-import-assets'): Promise<BulkImportResult>;
  // Keep the generic fallback for potential other invoke calls if needed
  invoke(channel: string, ...args: any[]): Promise<any>; 
  // Add send/receive/removeAllListeners if used, with specific channel signatures if possible
  // send: (channel: string, ...args: any[]) => void;
  // receive: (channel: string, func: (...args: any[]) => void) => void;
  // removeAllListeners: (channel: string) => void;
}

// Augment the Window interface
declare global {
  interface Window {
    api: ExposedApi;
  }
}

// Renamed hook: useAssets
export function useAssets() {
  // State holds AssetWithThumbnail to include potential thumbnail paths
  const [assets, setAssets] = useState<AssetWithThumbnail[]>([]) 
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fetchedAssets = await window.api.invoke('get-assets')
      setAssets(fetchedAssets || [])
    } catch (err) {
      console.error('Failed to fetch assets:', err)
      setError('Failed to fetch assets.')
      setAssets([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const createAsset = useCallback(async (): Promise<AssetWithThumbnail | null> => {
    setError(null);
    let assetCreated: AssetWithThumbnail | null = null;
    try {
      const sourcePath = await window.api.invoke('open-file-dialog');
      if (!sourcePath) {
        return null; // User cancelled dialog
      }
      setLoading(true);
      const result = await window.api.invoke('create-asset', sourcePath);
      setLoading(false);
      if (result.success && result.asset) {
        assetCreated = result.asset; // Result now includes potential thumbnail path
        await fetchAssets(); // Re-fetch to ensure list consistency and get any newly generated thumbnails
      } else {
        console.error('Asset creation failed:', result.error);
        setError(`Asset creation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to create asset:', err);
      setError('An unexpected error occurred during asset creation.');
      setLoading(false);
    }
    return assetCreated;
  }, [fetchAssets]); // Removed setLoading, setError as direct dependencies (covered by useCallback)

  // PRD Task 1: Add bulk import function
  const bulkImportAssets = useCallback(async (): Promise<BulkImportResult> => {
      setLoading(true);
      setError(null);
      let result: BulkImportResult = { success: false, importedCount: 0, errors: [], assets: [] };
      try {
          result = await window.api.invoke('bulk-import-assets');
          if (result.importedCount > 0) {
              await fetchAssets(); // Re-fetch if any assets were successfully imported
          }
          if (result.errors.length > 0) {
              setError(`Bulk import completed with ${result.errors.length} errors. Check console for details.`);
              // Log details for debugging
              result.errors.forEach(e => console.error(`Import Error: ${e.file} - ${e.error}`));
          } else {
               setError(null); // Clear previous errors if successful
          }
      } catch (err) {
          console.error('Failed to execute bulk import:', err);
          setError('An unexpected error occurred during bulk import.');
          // Ensure result reflects the failure
          result = { success: false, importedCount: 0, errors: [{ file: 'Unknown', error: 'IPC call failed' }], assets: [] };
      } finally {
          setLoading(false);
      }
      return result;
  }, [fetchAssets]); // Removed setLoading, setError

  const updateAsset = useCallback(async (payload: UpdateAssetPayload): Promise<boolean> => {
    setError(null);
    let success = false;
    try {
      setLoading(true); 
      success = await window.api.invoke('update-asset', payload);
      if (success) {
        await fetchAssets(); // Re-fetch assets to get updated data
      } else {
        throw new Error('Backend indicated update failed.');
      }
    } catch (err) {
      console.error('Failed to update asset:', err);
      setError('Failed to update asset.');
      success = false; 
    } finally {
      setLoading(false); 
    }
    return success;
  }, [fetchAssets]); // Removed setLoading, setError

  const deleteAsset = useCallback(async (id: number): Promise<boolean> => {
    setError(null);
    let success = false;
    try {
      setLoading(true);
      success = await window.api.invoke('delete-asset', id);
      if (success) {
        await fetchAssets(); // Re-fetch after delete
      } else {
        throw new Error('Backend indicated delete failed.')
      }
    } catch (err) {
      console.error('Failed to delete asset:', err)
      setError('Failed to delete asset.')
      success = false;
    } finally {
       setLoading(false);
    }
    return success;
  }, [fetchAssets]); // Removed setLoading, setError

  // Expose bulkImportAssets along with other actions
  return { assets, loading, error, fetchAssets, createAsset, bulkImportAssets, updateAsset, deleteAsset }
} 