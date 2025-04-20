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

// Result type for create-asset IPC call
export interface CreateAssetResult {
  success: boolean;
  asset?: Asset;
  error?: string;
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
  invoke(channel: 'get-assets'): Promise<Asset[]>;
  invoke(channel: 'open-file-dialog'): Promise<string | null>;
  invoke(channel: 'create-asset', sourcePath: string): Promise<CreateAssetResult>;
  invoke(channel: 'update-asset', payload: UpdateAssetPayload): Promise<boolean>;
  invoke(channel: 'delete-asset', id: number): Promise<boolean>;
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
  const [assets, setAssets] = useState<Asset[]>([])
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

  const createAsset = useCallback(async (): Promise<Asset | null> => {
    setError(null);
    let assetCreated: Asset | null = null;
    try {
      const sourcePath = await window.api.invoke('open-file-dialog');
      if (!sourcePath) {
        return null;
      }
      setLoading(true);
      const result = await window.api.invoke('create-asset', sourcePath);
      setLoading(false);
      if (result.success && result.asset) {
        // No need to manually add, fetchAssets will be called if needed (or rely on initial fetch)
        // setAssets((prevAssets) => [...prevAssets, result.asset]);
        assetCreated = result.asset;
        await fetchAssets(); // Re-fetch to get the latest list including the new one
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
  }, [fetchAssets, setLoading, setError]); // Updated dependencies

  const updateAsset = useCallback(async (payload: UpdateAssetPayload): Promise<boolean> => {
    setError(null);
    let success = false;
    try {
      setLoading(true); // Indicate loading during update
      success = await window.api.invoke('update-asset', payload);
      if (success) {
        // Re-fetch assets to get updated data, including custom fields if applicable
        await fetchAssets(); 
      } else {
        throw new Error('Backend indicated update failed.');
      }
    } catch (err) {
      console.error('Failed to update asset:', err);
      setError('Failed to update asset.');
      success = false; // Ensure success is false on error
    } finally {
      setLoading(false); // Ensure loading is turned off
    }
    return success;
  }, [fetchAssets, setLoading, setError]); // Updated dependencies

  const deleteAsset = useCallback(async (id: number): Promise<boolean> => {
    setError(null);
    let success = false;
    try {
      setLoading(true);
      success = await window.api.invoke('delete-asset', id);
      if (success) {
        // Re-fetch is simpler than filtering locally if order matters or for consistency
        await fetchAssets(); 
        // Or filter locally: setAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== id))
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
  }, [fetchAssets, setLoading, setError]); // Updated dependencies

  return { assets, loading, error, fetchAssets, createAsset, updateAsset, deleteAsset }
} 