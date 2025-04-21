import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AssetWithThumbnail, BulkUpdatePayload, useAssets, GetVersionsResult, MasterAssetOption } from '../hooks/useAssets';
import Modal from 'react-modal'; // Default export of react-modal
import BulkEditModal from './BulkEditModal'; // Import for bulk editing
import { FiX, FiTrash2, FiEdit, FiPlusSquare, FiCornerUpLeft, FiUploadCloud, FiChevronsUp } from 'react-icons/fi'; // Added UploadCloud, ChevronsUp
import { Tooltip } from 'react-tooltip'; // Import Tooltip
import BulkGroupModal from './BulkGroupModal'; // Import BulkGroupModal

interface VersionHistoryModalProps {
  masterId: number | null;
  isOpen: boolean;
  onClose: () => void;
  getVersions: (masterId: number) => Promise<{ success: boolean; assets?: AssetWithThumbnail[] | undefined; error?: string | undefined }>;
  createVersion: (payload: { masterId: number; sourcePath: string; }) => Promise<{ success: boolean; newId?: number | undefined; error?: string | undefined }>;
  deleteAsset: (id: number) => Promise<boolean>;
  bulkUpdateAssets: (selectedIds: number[], updates: BulkUpdatePayload) => Promise<{ success: boolean; updatedCount: number; errors: { id: number; error: string; }[]; }>;
  addToGroup: (versionId: number, masterId: number) => Promise<{ success: boolean; error?: string | undefined }>;
  removeFromGroup: (payload: { versionId: number; }) => Promise<{ success: boolean; error?: string | undefined }>;
  promoteVersion: (payload: { versionId: number; }) => Promise<{ success: boolean; error?: string | undefined }>;
  fetchAssets: () => Promise<void>;
  getMasterAssets: (searchTerm?: string | undefined) => Promise<MasterAssetOption[]>;
  bulkAddToGroup: (versionIds: number[], masterId: number) => Promise<{ success: boolean; errors: { id: number; error: string; }[]; }>;
}

// Ensure this type matches the actual return from getVersions
// Based on CODEBASE.md, getVersions returns GetVersionsResult = { success: boolean, assets?: AssetWithThumbnail[], error?: string }
// Let's adjust the internal state type to match AssetWithThumbnail more closely
type VersionAsset = AssetWithThumbnail; // Use the full type provided by useAssets

// Helper function to format bytes
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  masterId,
  isOpen,
  onClose,
  getVersions,
  createVersion,
  deleteAsset,
  bulkUpdateAssets,
  addToGroup,
  removeFromGroup,
  promoteVersion,
  fetchAssets,
  getMasterAssets,
  bulkAddToGroup
}) => {
  const { loading: hookLoading } = useAssets();
  const [versions, setVersions] = useState<VersionAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<number>>(new Set());

  // Bulk Edit State
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false);

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null); // Ref for select all checkbox

  const fetchVersionsData = useCallback(async () => {
    if (!masterId) return;
    setIsLoading(true);
    setError(null);
    setSelectedVersionIds(new Set()); // Clear selection on reload
    try {
      // Third attempt: Align with explicit types from useAssets.ts documentation
      const result: GetVersionsResult = await getVersions(masterId);
      if (result.success && result.assets) {
        setVersions(result.assets.filter(a => a) as VersionAsset[]);
      } else {
        setError(result.error || 'Failed to fetch versions.');
        setVersions([]);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred fetching versions.');
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [masterId, getVersions]);

  useEffect(() => {
    if (isOpen && masterId) {
      fetchVersionsData();
    } else {
      // Reset state when modal is closed or masterId is null
      setVersions([]);
      setError(null);
      setIsLoading(false);
      setSelectedVersionIds(new Set());
      setIsBulkEditModalOpen(false); // Ensure bulk edit modal is closed too
    }
  }, [isOpen, masterId, fetchVersionsData]);

  // Update indeterminate state for select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const numSelected = selectedVersionIds.size;
      const numVersions = versions.length;
      selectAllCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numVersions;
    }
  }, [selectedVersionIds, versions.length]);

  const handleSelectVersion = (id: number, checked: boolean) => {
    setSelectedVersionIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVersionIds(new Set(versions.map(v => v.id)));
    } else {
      setSelectedVersionIds(new Set());
    }
    // Ensure the indeterminate state is cleared immediately
    if (selectAllCheckboxRef.current) {
        selectAllCheckboxRef.current.indeterminate = false;
    }
  };

  const isAllSelected = versions.length > 0 && selectedVersionIds.size === versions.length;

  const handleAddVersion = async () => {
    if (!masterId) return;
    try {
      // Provide the expected type to the invoke call
      const filePathsResult = await window.api.openFileDialog({ properties: ['openFile'], title: 'Select File for New Version'});

      // Check if window.electron.api exists before trying to use it
      // Note: This check is mainly for robustness; the root cause of the runtime error
      // likely lies in the preload script setup if this check fails.
      /*
      if (!window.electron?.api?.invoke) {
          setError('Electron API is not available. Preload script might have failed.');
          setIsLoading(false);
          return;
      }
      */

      if (filePathsResult.canceled || !filePathsResult.filePaths || filePathsResult.filePaths.length === 0) {
        return; // User cancelled
      }
      const sourcePath = filePathsResult.filePaths[0];

      setIsLoading(true);
      setError(null);
      const result = await createVersion({ masterId, sourcePath });
      if (result.success) {
        alert(`New version created successfully (ID: ${result.newId}).`);
        fetchVersionsData(); // Reload versions
        fetchAssets(); // Reload main library view to update accumulated counts etc.
      } else {
        setError(result.error || 'Failed to create new version.');
      }
    } catch (err: any) {
      setError(`Failed to add version: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromGroup = async () => {
    if (selectedVersionIds.size === 0) {
      alert('Please select versions to remove from the group.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${selectedVersionIds.size} selected version(s) from this group? They will become standalone master assets.`)) {
        return;
    }

    setIsLoading(true);
    setError(null);
    let successes = 0;
    const errors: string[] = [];

    for (const versionId of selectedVersionIds) {
      try {
        const result = await removeFromGroup({ versionId });
        if (result.success) {
          successes++;
        } else {
          errors.push(`ID ${versionId}: ${result.error || 'Failed'}`);
        }
      } catch (err: any) {
        errors.push(`ID ${versionId}: ${err.message || 'IPC Error'}`);
      }
    }

    if (errors.length > 0) {
        setError(`Completed with errors: ${errors.join(', ')}`);
    } else {
        alert(`${successes} version(s) successfully removed from the group.`);
    }
    
    fetchVersionsData(); // Reload versions for the current master
    fetchAssets(); // Reload main library view
    setIsLoading(false);
  };

  const handlePromoteVersion = async () => {
    if (selectedVersionIds.size !== 1) {
      alert('Please select exactly one version to promote.');
      return;
    }
    const versionId = Array.from(selectedVersionIds)[0];

    if (!window.confirm(`Are you sure you want to promote version ID ${versionId} to be the new master of this group?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Assuming promoteVersion hook exists and takes versionId
      const result = await promoteVersion({ versionId });
      if (result.success) {
        alert(`Version ${versionId} successfully promoted.`);
        // Promotion changes the master, so close current modal and refresh library
        onClose();
        fetchAssets(); // Refresh library view
      } else {
        setError(result.error || 'Failed to promote version.');
      }
    } catch (err: any) {
      setError(`Failed to promote version: ${err.message}`);
    } finally {
      setIsLoading(false);
      // Don't call fetchVersionsData here as the master might have changed
    }
  };

  const handleBulkEdit = () => {
    if (selectedVersionIds.size === 0) {
      alert('Please select versions to edit.');
      return;
    }
    setIsBulkEditModalOpen(true);
  };

  const handleBulkEditSave = async (updates: BulkUpdatePayload) => {
     if (selectedVersionIds.size === 0) return;
     setIsLoading(true);
     setError(null);

     try {
         const result = await bulkUpdateAssets(Array.from(selectedVersionIds), updates);
         if (result.success) {
             alert(`${result.updatedCount} version(s) updated successfully.`);
             fetchVersionsData(); // Reload versions for the current master
             fetchAssets(); // Reload main library view
         } else {
             setError(`Bulk update failed for ${result.errors.length} assets. Check console.`);
             console.error("Bulk update errors:", result.errors);
         }
     } catch (err:any) {
         setError(`Bulk update failed: ${err.message}`);
     } finally {
        setIsBulkEditModalOpen(false);
        setIsLoading(false);
     }
  };

  const handleBulkDelete = async () => {
    if (selectedVersionIds.size === 0) {
      alert('Please select versions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedVersionIds.size} selected version(s)? This cannot be undone.`)) {
        return;
    }

    setIsLoading(true);
    setError(null);
    let successes = 0;
    const errors: string[] = [];

    for (const versionId of selectedVersionIds) {
      try {
        const result = await deleteAsset(versionId); // Use deleteAsset hook
        if (result) {
          successes++;
        } else {
          errors.push(`ID ${versionId}: Failed`);
        }
      } catch (err: any) {
        errors.push(`ID ${versionId}: ${err.message || 'IPC Error'}`);
      }
    }
     if (errors.length > 0) {
        setError(`Completed with errors: ${errors.join(', ')}`);
    } else {
        alert(`${successes} version(s) successfully deleted.`);
    }
    
    fetchVersionsData(); // Reload versions for the current master
    fetchAssets(); // Reload main library view
    setIsLoading(false);
  };

  const handleOpenBulkGroupModal = () => setIsBulkGroupModalOpen(true);
  const handleCloseBulkGroupModal = () => setIsBulkGroupModalOpen(false);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false} // Recommended for accessibility, but ensure your app root is set if needed
      // Dark mode styling
      className="relative flex flex-col w-11/12 max-w-4xl max-h-[80vh] bg-gray-900 text-gray-100 rounded-lg overflow-hidden shadow-xl outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      contentLabel="Version History"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-xl font-semibold text-gray-100">Version History for Master Asset #{masterId}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
          <FiX size={24} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-900 text-gray-100">
        {isLoading && !versions.length && <p className="text-center text-gray-400">Loading version history...</p>}
        {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}
        {!isLoading && versions.length === 0 && !error && <p className="text-center text-gray-400">No other versions found for this asset.</p>}

        {versions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      ref={selectAllCheckboxRef}
                      className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-20">Preview</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Filename</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Size</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Year</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Advertiser</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Niche</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Shares</th>
                  <th scope="col" className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Version</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {versions.map((version) => (
                  <tr key={version.id} className={`${selectedVersionIds.has(version.id) ? 'bg-gray-700' : 'hover:bg-gray-800'} transition-colors duration-150`}>
                    <td className="p-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                        checked={selectedVersionIds.has(version.id)}
                        onChange={(e) => handleSelectVersion(version.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {version.thumbnailPath ? (
                        <img
                            src={`local-asset://${version.thumbnailPath}`}
                            alt={`Thumbnail for ${version.fileName}`}
                            className="h-12 w-12 object-contain rounded bg-gray-700"
                            loading="lazy"
                          />
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center bg-gray-700 text-gray-500 rounded">
                           <FiPlusSquare size={24} /> {/* Placeholder icon */}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-300 max-w-xs truncate" title={version.fileName}>{version.fileName}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400 max-w-xs truncate" title={version.mimeType}>{version.mimeType}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400">{formatBytes(version.size)}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400">{new Date(version.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400">{version.year ?? 'N/A'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400 max-w-xs truncate" title={version.advertiser ?? ''}>{version.advertiser ?? 'N/A'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400 max-w-xs truncate" title={version.niche ?? ''}>{version.niche ?? 'N/A'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400">{version.shares ?? 'N/A'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-400 font-medium">v{version.version_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer with Actions */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-t border-gray-700 flex-shrink-0 space-x-2">
        {/* Left Aligned Buttons */}
        <div className="flex items-center space-x-2">
            <button
                onClick={handleAddVersion}
                disabled={!masterId || isLoading || hookLoading}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="version-modal-tooltip"
                data-tooltip-content="Add a new file as a version to this group"
            >
                <FiUploadCloud className="mr-1 h-4 w-4" /> Add Version
            </button>
            <button
                onClick={handlePromoteVersion}
                disabled={selectedVersionIds.size !== 1 || isLoading || hookLoading}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="version-modal-tooltip"
                data-tooltip-content="Promote the selected version to be the master"
            >
                <FiChevronsUp className="mr-1 h-4 w-4" /> Promote Selected
            </button>
             <button
                onClick={handleRemoveFromGroup}
                disabled={selectedVersionIds.size === 0 || isLoading || hookLoading}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="version-modal-tooltip"
                data-tooltip-content="Make selected versions standalone master assets"
            >
                <FiCornerUpLeft className="mr-1 h-4 w-4" /> Remove From Group
            </button>
        </div>

        {/* Right Aligned Buttons */}
         <div className="flex items-center space-x-2">
             <button
                onClick={handleBulkEdit}
                disabled={selectedVersionIds.size === 0 || isLoading || hookLoading}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="version-modal-tooltip"
                data-tooltip-content="Edit metadata for selected versions"
             >
                <FiEdit className="mr-1 h-4 w-4" /> Bulk Edit ({selectedVersionIds.size})
            </button>
            <button
                onClick={handleBulkDelete}
                disabled={selectedVersionIds.size === 0 || isLoading || hookLoading}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="version-modal-tooltip"
                data-tooltip-content="Permanently delete selected versions"
            >
                <FiTrash2 className="mr-1 h-4 w-4" /> Delete Selected ({selectedVersionIds.size})
            </button>
         </div>
         <Tooltip id="version-modal-tooltip" place="top" className="z-50" />
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        onSave={handleBulkEditSave}
        selectedCount={selectedVersionIds.size}
      />

      {/* Bulk Group Modal */}
      <BulkGroupModal
        isOpen={isBulkGroupModalOpen}
        onClose={handleCloseBulkGroupModal}
        onSave={bulkAddToGroup}
        getMasterAssets={getMasterAssets}
        selectedIds={Array.from(selectedVersionIds)}
      />
    </Modal>
  );
};

export default VersionHistoryModal;