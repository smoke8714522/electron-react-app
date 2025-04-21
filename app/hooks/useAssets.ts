import { useState, useEffect, useCallback } from 'react'

// --- Versioning Result Types ---
export interface CreateVersionResult {
  success: boolean;
  newId?: number;
  error?: string;
}

export interface GetVersionsResult {
  success: boolean;
  assets?: AssetWithThumbnail[]; // Ensure AssetWithThumbnail is exported
  error?: string;
}

export interface AddToGroupResult {
  success: boolean;
  error?: string;
}

export interface RemoveFromGroupResult {
  success: boolean;
  error?: string;
}

// Result type for promote-version IPC call (Assume simple success/error)
export interface PromoteVersionResult {
    success: boolean;
    error?: string;
}

// PRD §4.2 Data Model - Define Asset structure (reflects schema changes)
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
  shares: number | null; // Renamed from adspower, now numeric
  master_id?: number | null; // Foreign key to the master asset
  version_no?: number; // Version number within the group
  versionCount?: number | null; // Total count of versions (including self if counted in backend)
  accumulatedShares?: number | null; // Total shares including versions
}

// PRD §4.1 Library View: Define the fields available for bulk editing
export type EditableAssetFields = Pick<Asset, 'year' | 'advertiser' | 'niche' | 'shares'>; // Updated field
export type BulkUpdatePayload = Partial<EditableAssetFields>;

// PRD §4.1 Library View: Extend Asset with optional thumbnail path for UI
export interface AssetWithThumbnail extends Asset {
  thumbnailPath?: string | null;
  // Ensure these are repeated/included here if not automatically inherited
  // (though they should be due to `extends Asset`)
  // accumulatedShares?: number | null;
  // versionCount?: number | null;
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

// PRD §4.1 Library View - Define structure for filters passed to fetchAssets
export interface FetchFilters {
    year?: number | null;
    advertiser?: string | null;
    niche?: string | null;
    sharesRange?: [number | null, number | null]; // [min, max]
}

// PRD §4.1 Library View - Define structure for sorting passed to fetchAssets
export interface FetchSort {
    sortBy?: 'fileName' | 'year' | 'shares' | 'createdAt';
    sortOrder?: 'ASC' | 'DESC';
}

// Argument type for update-asset IPC call
export type UpdateAssetPayload = {
  id: number;
  updates: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'>> & { customFields?: Record<string, string | null> };
};

// Define the API structure exposed by the preload script more specifically
interface ExposedApi {
  // Updated invoke signature for get-assets to accept filters/sort
  invoke(channel: 'get-assets', params?: { filters?: { year?: number | null, advertiser?: string | null, niche?: string | null, sharesMin?: number | null, sharesMax?: number | null }, sort?: { sortBy?: string, sortOrder?: string } }): Promise<AssetWithThumbnail[]>; 
  invoke(channel: 'open-file-dialog', options?: any): Promise<{ canceled: boolean; filePaths: string[] } | null>; // Updated based on VersionHistoryModal usage
  invoke(channel: 'create-asset', sourcePath: string): Promise<CreateAssetResult>; 
  invoke(channel: 'update-asset', payload: UpdateAssetPayload): Promise<boolean>;
  invoke(channel: 'delete-asset', id: number): Promise<boolean>;
  invoke(channel: 'bulk-import-assets'): Promise<BulkImportResult>;
  // Add versioning IPC calls
  invoke(channel: 'create-version', payload: { masterId: number, sourcePath: string }): Promise<CreateVersionResult>;
  invoke(channel: 'get-versions', payload: { masterId: number }): Promise<GetVersionsResult>;
  invoke(channel: 'add-to-group', payload: { versionId: number, masterId: number }): Promise<AddToGroupResult>;
  invoke(channel: 'remove-from-group', payload: { versionId: number }): Promise<RemoveFromGroupResult>;
  invoke(channel: 'promote-version', payload: { versionId: number }): Promise<PromoteVersionResult>;
  invoke(channel: string, ...args: any[]): Promise<any>; // Keep generic fallback
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

  // PRD §4.1 Library View: Update fetchAssets to accept filters and sorting
  const fetchAssets = useCallback(async (filters?: FetchFilters, sort?: FetchSort) => {
    setLoading(true)
    setError(null)
    try {
      // Prepare params for IPC call
      const ipcParams: any = {}; // Use 'any' temporarily for flexibility
      if (filters) {
          ipcParams.filters = {
              year: filters.year,
              advertiser: filters.advertiser,
              niche: filters.niche,
              sharesMin: filters.sharesRange ? filters.sharesRange[0] : null,
              sharesMax: filters.sharesRange ? filters.sharesRange[1] : null,
          };
          // Remove null/undefined keys to keep payload clean
          Object.keys(ipcParams.filters).forEach(key => {
            if (ipcParams.filters[key] === null || ipcParams.filters[key] === undefined || ipcParams.filters[key] === '' || (key === 'year' && ipcParams.filters[key] === 0)) {
              delete ipcParams.filters[key];
            }
          });
      }
      if (sort) {
          ipcParams.sort = {
              sortBy: sort.sortBy,
              sortOrder: sort.sortOrder
          };
          // Remove null/undefined keys
          Object.keys(ipcParams.sort).forEach(key => {
            if (ipcParams.sort[key] === null || ipcParams.sort[key] === undefined) {
              delete ipcParams.sort[key];
            }
          });
      }

      // Only pass params if filters or sort objects have keys
      const paramsToSend = (ipcParams.filters && Object.keys(ipcParams.filters).length > 0) || 
                           (ipcParams.sort && Object.keys(ipcParams.sort).length > 0) 
                           ? ipcParams : undefined;

      const fetchedAssets = await window.api.invoke('get-assets', paramsToSend);
      setAssets(fetchedAssets || [])
    } catch (err) {
      console.error('Failed to fetch assets:', err)
      setError('Failed to fetch assets.')
      setAssets([])
    }
    setLoading(false)
  }, []) // Dependencies remain empty as fetchAssets itself doesn't depend on external state changes

  // Initial fetch on mount - no filters/sort initially
  useEffect(() => {
    fetchAssets()
  }, [fetchAssets]) // fetchAssets is stable due to useCallback([])

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
      // Ensure shares is sent as number or null
      if (payload.updates.shares !== undefined) {
          payload.updates.shares = payload.updates.shares === null ? null : Number(payload.updates.shares);
          if (isNaN(payload.updates.shares as number)) payload.updates.shares = null; // Handle NaN case
      }
       // Ensure year is sent as number or null
      if (payload.updates.year !== undefined) {
          payload.updates.year = payload.updates.year === null ? null : Number(payload.updates.year);
          if (isNaN(payload.updates.year as number)) payload.updates.year = null; // Handle NaN case
      }

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

  // PRD §4.1 Library View: Add bulk update function, ensuring 'shares' is handled correctly
  const bulkUpdateAssets = useCallback(async (selectedIds: number[], updates: BulkUpdatePayload): Promise<BatchUpdateResult> => {
      setLoading(true);
      setError(null);
    const results: BatchUpdateResult = { success: true, updatedCount: 0, errors: [] };

    // Prepare the update payload, converting shares/year if necessary
    const processedUpdates = { ...updates };
    if (processedUpdates.shares !== undefined) {
        processedUpdates.shares = processedUpdates.shares === null ? null : Number(processedUpdates.shares);
        if (isNaN(processedUpdates.shares as number)) processedUpdates.shares = null; // Handle NaN
    }
     if (processedUpdates.year !== undefined) {
        processedUpdates.year = processedUpdates.year === null ? null : Number(processedUpdates.year);
        if (isNaN(processedUpdates.year as number)) processedUpdates.year = null; // Handle NaN
    }

    // Iterate and call updateAsset for each selected ID
    // Note: This is sequential. A dedicated backend bulk update endpoint would be more efficient.
      for (const id of selectedIds) {
          try {
            const payload: UpdateAssetPayload = { id, updates: processedUpdates };
              const success = await window.api.invoke('update-asset', payload);
              if (success) {
                results.updatedCount++;
              } else {
                results.success = false;
                results.errors.push({ id, error: 'Update failed via IPC call.' });
              }
          } catch (err: any) {
            console.error(`Error updating asset ${id}:`, err);
            results.success = false;
            results.errors.push({ id, error: err.message || 'Unknown error during update.' });
        }
      }

    // Refresh the asset list regardless of partial failures to show updates
        await fetchAssets();
      
      setLoading(false);
    if (results.errors.length > 0) {
        setError(`Bulk update completed with ${results.errors.length} error(s).`);
      }

    return results;
  }, [fetchAssets]);

  // --- Versioning Hook Functions ---

  const createVersion = useCallback(async (masterId: number, sourcePath: string): Promise<CreateVersionResult> => {
    setLoading(true);
    setError(null);
    let result: CreateVersionResult = { success: false, error: 'Initialization failed' };
    try {
      if (!sourcePath) {
        return { success: false, error: 'No source file path provided.' };
      }
      result = await window.api.invoke('create-version', { masterId, sourcePath });
      if (result.success) {
        await fetchAssets(); // Refresh list to show the new version (though versions aren't shown directly)
      } else {
        setError(`Failed to create version: ${result.error || 'Unknown error'}`);
        console.error('Create version failed:', result.error);
      }
    } catch (err: any) {
      console.error('Error invoking create-version:', err);
      setError(`An unexpected error occurred: ${err.message}`);
      result = { success: false, error: err.message || 'IPC call failed' };
    } finally {
      setLoading(false);
    }
    return result;
  }, [fetchAssets]);

  const getVersions = useCallback(async (masterId: number): Promise<GetVersionsResult> => {
    // Note: This directly returns versions for the modal, doesn't modify main asset list or loading state directly.
    // The modal should handle its own loading/error state based on this promise.
    try {
      const result = await window.api.invoke('get-versions', { masterId });
      if (!result.success) {
          console.error('Get versions failed:', result.error);
      }
      return result;
    } catch (err: any) {
      console.error('Error invoking get-versions:', err);
      return { success: false, error: err.message || 'IPC call failed' };
    }
  }, []); // No dependencies needed as it doesn't interact with hook state

  const addToGroup = useCallback(async (versionId: number, masterId: number): Promise<AddToGroupResult> => {
    setLoading(true);
    setError(null);
    let result: AddToGroupResult = { success: false, error: 'Initialization failed' };
    try {
      result = await window.api.invoke('add-to-group', { versionId, masterId });
      if (result.success) {
        await fetchAssets(); // Refresh master list (accumulated shares might change)
      } else {
        setError(`Failed to add to group: ${result.error || 'Unknown error'}`);
        console.error('Add to group failed:', result.error);
      }
    } catch (err: any) {
      console.error('Error invoking add-to-group:', err);
      setError(`An unexpected error occurred: ${err.message}`);
      result = { success: false, error: err.message || 'IPC call failed' };
    } finally {
      setLoading(false);
    }
    return result;
  }, [fetchAssets]);

  const removeFromGroup = useCallback(async (versionId: number): Promise<RemoveFromGroupResult> => {
    setLoading(true);
    setError(null);
    let result: RemoveFromGroupResult = { success: false, error: 'Initialization failed' };
    try {
      result = await window.api.invoke('remove-from-group', { versionId });
      if (result.success) {
        await fetchAssets(); // Refresh master list (asset might become visible as master, accumulated shares change)
      } else {
        setError(`Failed to remove from group: ${result.error || 'Unknown error'}`);
        console.error('Remove from group failed:', result.error);
      }
    } catch (err: any) {
      console.error('Error invoking remove-from-group:', err);
      setError(`An unexpected error occurred: ${err.message}`);
      result = { success: false, error: err.message || 'IPC call failed' };
    } finally {
      setLoading(false);
    }
    return result;
  }, [fetchAssets]);

  // Promote Version
  const promoteVersion = useCallback(async (versionId: number): Promise<PromoteVersionResult> => {
    setLoading(true);
    setError(null);
    let result: PromoteVersionResult = { success: false, error: 'Unknown error' };
    try {
      result = await window.api.invoke('promote-version', { versionId });
      if (result.success) {
        await fetchAssets(); // Refresh list after promotion
      } else {
        setError(`Failed to promote version ${versionId}: ${result.error || 'Backend error'}`);
      }
    } catch (err: any) {
      console.error(`Failed to promote version ${versionId}:`, err);
      setError(`Failed to promote version ${versionId}: ${err.message || 'IPC error'}`);
      result = { success: false, error: err.message || 'IPC error' };
    } finally {
      setLoading(false);
    }
    return result;
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
      bulkUpdateAssets, // Expose the new function
      // Versioning functions
      getVersions,
      createVersion,
      addToGroup,
      removeFromGroup,
      promoteVersion, // Export the new function
  }
} 