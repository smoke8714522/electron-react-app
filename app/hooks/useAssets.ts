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

// PRD §4.1 Library View: Define the fields available for bulk editing
export type EditableAssetFields = Pick<Asset, 'year' | 'advertiser' | 'niche' | 'adspower'>;
export type BulkUpdatePayload = Partial<EditableAssetFields>;

// PRD §4.1 Library View: Extend Asset with optional thumbnail path for UI
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

// PRD §4.1 Library View: Result type for batch update operation
export interface BatchUpdateResult {
    success: boolean;
    updatedCount: number;
    errors: { id: number, error: string }[];
}

// Argument type for update-asset IPC call
export type UpdateAssetPayload = {
  id: number;
  // Allow updates for any subset of Asset fields, excluding read-only ones
  // Includes custom fields logic if implemented
  updates: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'> & { customFields?: Record<string, string | null> }>;
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

  // PRD §4.1 Library View: Add bulk update function
  const bulkUpdateAssets = useCallback(async (selectedIds: number[], updates: BulkUpdatePayload): Promise<BatchUpdateResult> => {
      setLoading(true);
      setError(null);
      const results: { success: boolean, id: number, error?: string }[] = [];
      let successCount = 0;
      const errors: { id: number, error: string }[] = [];

      // Sequentially update each selected asset
      for (const id of selectedIds) {
          try {
              // Prepare payload for single asset update
              const payload: UpdateAssetPayload = { 
                  id,
                  // Ensure we only pass allowed fields for update
                  updates: {
                    ...(updates.year !== undefined && { year: updates.year }),
                    ...(updates.advertiser !== undefined && { advertiser: updates.advertiser }),
                    ...(updates.niche !== undefined && { niche: updates.niche }),
                    ...(updates.adspower !== undefined && { adspower: updates.adspower }),
                    // Note: Does not handle custom fields in this bulk update
                  }
              };
              const success = await window.api.invoke('update-asset', payload);
              results.push({ success, id });
              if (success) {
                  successCount++;
              } else {
                 // Assume if success is false, an error occurred (though invoke might not throw)
                 // The backend should ideally return an error message
                 const errorMsg = `Update failed for asset ID ${id}.`;
                 console.error(errorMsg);
                 errors.push({ id, error: 'Update operation returned false.' });
              }
          } catch (err: any) {
              console.error(`Failed to update asset ID ${id}:`, err);
              const errorMsg = err.message || 'Unknown error during update';
              results.push({ success: false, id, error: errorMsg });
              errors.push({ id, error: errorMsg });
          }
      }

      // Refresh assets list if at least one update was attempted (even if it failed, to ensure UI consistency)
      if (selectedIds.length > 0) {
        await fetchAssets();
      }
      
      setLoading(false);
      // Set error state if there were any failures
      if (errors.length > 0) {
          setError(`Bulk update completed with ${errors.length} error(s). See console for details.`);
      }

      return { success: errors.length === 0, updatedCount: successCount, errors };
  }, [fetchAssets]);

  // Expose bulkImportAssets along with other actions
  return { 
      assets, 
      loading, 
      error, 
      fetchAssets, 
      createAsset, 
      bulkImportAssets, 
      updateAsset, 
      deleteAsset,
      bulkUpdateAssets // Expose the new function
  }
} 