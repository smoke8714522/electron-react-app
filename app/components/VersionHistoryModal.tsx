import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlus, FaTrash, FaEdit, FaUnlink, FaHistory, FaTimes } from 'react-icons/fa';
import { AssetWithThumbnail, BulkUpdatePayload, useAssets, GetVersionsResult, CreateVersionResult, RemoveFromGroupResult } from '../hooks/useAssets';
import { Tooltip } from 'react-tooltip'; // Assuming react-tooltip is installed or will be
import BulkEditModal from './BulkEditModal'; // Import for bulk editing

interface VersionHistoryModalProps {
  masterId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Ensure this type matches the actual return from getVersions
// Based on CODEBASE.md, getVersions returns GetVersionsResult = { success: boolean, assets?: AssetWithThumbnail[], error?: string }
// Let's adjust the internal state type to match AssetWithThumbnail more closely
type VersionAsset = AssetWithThumbnail; // Use the full type provided by useAssets

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  masterId,
  isOpen,
  onClose,
}) => {
  const { getVersions, createVersion, removeFromGroup, bulkUpdateAssets, deleteAsset } = useAssets();
  const [versions, setVersions] = useState<VersionAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk Edit State
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkYear, setBulkYear] = useState('');
  const [applyYear, setApplyYear] = useState(false);
  const [bulkAdvertiser, setBulkAdvertiser] = useState('');
  const [applyAdvertiser, setApplyAdvertiser] = useState(false);
  const [bulkNiche, setBulkNiche] = useState('');
  const [applyNiche, setApplyNiche] = useState(false);
  const [bulkShares, setBulkShares] = useState('');
  const [applyShares, setApplyShares] = useState(false);

  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  const fetchVersionsData = useCallback(async () => {
    if (!masterId) return;
    setIsLoading(true);
    setError(null);
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
      setSelectedIds([]); // Reset selection when opening
      setShowBulkEdit(false); // Hide bulk edit form
    } else {
      // Clear state when modal is closed or masterId is null
      setVersions([]);
      setSelectedIds([]);
      setError(null);
      setShowBulkEdit(false);
    }
  }, [isOpen, masterId, fetchVersionsData]);

  const handleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === versions.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(versions.map(v => v.id));
    }
  };

  const handleAddToGroup = async () => {
      if (!masterId) return;
      try {
          const result = await window.api.invoke('open-file-dialog', {
              properties: ['openFile'],
              title: 'Select File to Add as New Version',
          });
          if (result && !result.canceled && result.filePaths.length > 0) {
              const sourcePath = result.filePaths[0];
              setIsLoading(true);
              const createResult: CreateVersionResult = await createVersion(masterId, sourcePath);
              setIsLoading(false);
              if (createResult.success) {
                  fetchVersionsData(); // Refresh list
              } else {
                  setError(createResult.error || 'Failed to create version.');
              }
          }
      } catch (err: any) {
          setError(`Error opening file dialog: ${err.message}`);
          setIsLoading(false);
      }
  };

  const handleRemoveFromGroup = async () => {
      if (selectedIds.length !== 1 || !masterId) return;
      const versionId = selectedIds[0];
      const confirm = window.confirm(`Are you sure you want to remove version (ID: ${versionId}) from this group? It will become a standalone master asset.`);
      if (!confirm) return;

      setIsLoading(true);
      try {
          const result: RemoveFromGroupResult = await removeFromGroup(versionId);
          if (result.success) {
              fetchVersionsData(); // Refresh the list as the item is removed
              setSelectedIds([]); // Clear selection
          } else {
              setError(result.error || 'Failed to remove from group.');
          }
      } catch (err: any) {
          setError(`Error removing from group: ${err.message}`);
      } finally {
          setIsLoading(false);
      }
  };

  const handleBulkDelete = async () => {
      if (selectedIds.length === 0) return;
      const confirm = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected version(s)? This cannot be undone.`);
      if (!confirm) return;

      setIsLoading(true);
      let successCount = 0;
      const errors: string[] = [];

      for (const id of selectedIds) {
          try {
              // Expect boolean return based on previous attempts/errors
              const deleted: boolean = await deleteAsset(id);
              if (deleted) {
                  successCount++;
              } else {
                  errors.push(`Failed to delete asset ID ${id}.`);
              }
          } catch (err: any) {
              errors.push(`Error deleting asset ID ${id}: ${err.message}`);
          }
      }

      setIsLoading(false);
      if (errors.length > 0) {
          setError(`Bulk delete issues: ${errors.join(' ')}`);
      } else {
          setError(null); // Clear previous errors if successful
      }

      setSelectedIds([]); // Clear selection
      fetchVersionsData(); // Refresh list
  };

  const handleToggleBulkEdit = () => {
    setShowBulkEdit(!showBulkEdit);
    // Reset bulk edit form fields when toggling
    if (!showBulkEdit) {
        setBulkYear(''); setApplyYear(false);
        setBulkAdvertiser(''); setApplyAdvertiser(false);
        setBulkNiche(''); setApplyNiche(false);
        setBulkShares(''); setApplyShares(false);
    }
  };

  const handleBulkUpdateSave = async () => {
    if (selectedIds.length === 0) return;

    const updates: BulkUpdatePayload = {};
    // Ensure conversion happens correctly, guarding against NaN
    if (applyYear) {
        const yearVal = parseInt(bulkYear, 10);
        updates.year = bulkYear === '' || isNaN(yearVal) ? null : yearVal;
    }
    if (applyAdvertiser) updates.advertiser = bulkAdvertiser === '' ? null : bulkAdvertiser;
    if (applyNiche) updates.niche = bulkNiche === '' ? null : bulkNiche;
    if (applyShares) {
        const sharesVal = parseInt(bulkShares, 10);
        updates.shares = bulkShares === '' || isNaN(sharesVal) ? null : sharesVal;
    }

    if (Object.keys(updates).length === 0) {
        setError("No fields selected to apply for bulk update.");
        return;
    }

    // Validation for numeric fields (already handled by guarded conversion above)
    /*
    if (applyYear && isNaN(updates.year as number) && updates.year !== null) {
        setError("Invalid Year entered.");
        return;
    }
    if (applyShares && isNaN(updates.shares as number) && updates.shares !== null) {
        setError("Invalid Shares entered.");
        return;
    }
    */


    setIsLoading(true);
    setError(null);
    try {
      const result = await bulkUpdateAssets(selectedIds, updates);
      if (result.success) {
          setShowBulkEdit(false); // Hide form on success
          fetchVersionsData(); // Refresh data
          setSelectedIds([]); // Clear selection
      } else {
          setError(`Bulk update failed: ${result.errors?.map(e => `${e.id}: ${e.error}`).join(', ')}`);
      }
    } catch (err: any) {
      setError(`Error during bulk update: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = useMemo(() => (
     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-300 dark:border-gray-600">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Version History (Master ID: {masterId})</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded">
           <button
                onClick={handleAddToGroup}
                disabled={isLoading || selectedIds.length > 0}
                className="flex items-center px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="tooltip-add"
                data-tooltip-content="Add new file as version"
            >
                <FaPlus className="mr-1" /> Add
            </button>
            <Tooltip id="tooltip-add" />

            <button
                onClick={handleRemoveFromGroup}
                disabled={isLoading || selectedIds.length !== 1}
                className="flex items-center px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="tooltip-remove"
                data-tooltip-content="Make selected version a master (unlinks)"
            >
                <FaUnlink className="mr-1" /> Remove from Group
            </button>
            <Tooltip id="tooltip-remove" />

            <button
                onClick={handleToggleBulkEdit}
                disabled={isLoading || selectedIds.length === 0}
                className={`flex items-center px-3 py-1 rounded text-white ${showBulkEdit ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                data-tooltip-id="tooltip-edit"
                data-tooltip-content="Edit metadata for selected versions"
            >
                <FaEdit className="mr-1" /> {showBulkEdit ? 'Cancel Edit' : 'Bulk Edit'}
            </button>
             <Tooltip id="tooltip-edit" />

             <button
                onClick={handleBulkDelete}
                disabled={isLoading || selectedIds.length === 0}
                className="flex items-center px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="tooltip-delete"
                data-tooltip-content="Delete selected versions"
            >
                <FaTrash className="mr-1" /> Delete Selected
            </button>
            <Tooltip id="tooltip-delete" />

             <div className="flex-grow"></div> {/* Spacer */}

            <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">
                {selectedIds.length} / {versions.length} selected
            </span>
             <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={selectedIds.length === versions.length && versions.length > 0}
                onChange={handleSelectAll}
                disabled={versions.length === 0}
                title="Select/Deselect All"
            />

        </div>

        {/* Bulk Edit Form */}
        {showBulkEdit && selectedIds.length > 0 && (
            <div className="mb-4 p-4 border rounded border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-750">
                <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">Bulk Edit Metadata for {selectedIds.length} item(s)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Check the box next to a field to apply its value.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Year */}
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="applyYear" checked={applyYear} onChange={(e) => setApplyYear(e.target.checked)} className="form-checkbox h-5 w-5"/>
                        <label htmlFor="applyYear" className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Year:</label>
                        <input type="number" value={bulkYear} onChange={(e) => setBulkYear(e.target.value)} disabled={!applyYear} placeholder="e.g., 2023" className="form-input flex-grow px-2 py-1 border rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"/>
                    </div>
                     {/* Advertiser */}
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="applyAdvertiser" checked={applyAdvertiser} onChange={(e) => setApplyAdvertiser(e.target.checked)} className="form-checkbox h-5 w-5"/>
                        <label htmlFor="applyAdvertiser" className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Advertiser:</label>
                        <input type="text" value={bulkAdvertiser} onChange={(e) => setBulkAdvertiser(e.target.value)} disabled={!applyAdvertiser} placeholder="Advertiser Name" className="form-input flex-grow px-2 py-1 border rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"/>
                    </div>
                    {/* Niche */}
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="applyNiche" checked={applyNiche} onChange={(e) => setApplyNiche(e.target.checked)} className="form-checkbox h-5 w-5"/>
                        <label htmlFor="applyNiche" className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Niche:</label>
                        <input type="text" value={bulkNiche} onChange={(e) => setBulkNiche(e.target.value)} disabled={!applyNiche} placeholder="Niche Name" className="form-input flex-grow px-2 py-1 border rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"/>
                    </div>
                    {/* Shares */}
                     <div className="flex items-center space-x-2">
                        <input type="checkbox" id="applyShares" checked={applyShares} onChange={(e) => setApplyShares(e.target.checked)} className="form-checkbox h-5 w-5"/>
                        <label htmlFor="applyShares" className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Shares:</label>
                        <input type="number" value={bulkShares} onChange={(e) => setBulkShares(e.target.value)} disabled={!applyShares} placeholder="e.g., 500" className="form-input flex-grow px-2 py-1 border rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"/>
                    </div>
                </div>
                <div className="mt-4 flex justify-end space-x-2">
                     <button onClick={handleToggleBulkEdit} className="px-4 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                     <button onClick={handleBulkUpdateSave} disabled={isLoading} className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">Apply Updates</button>
                </div>
            </div>
        )}


        {error && <p className="text-red-500 dark:text-red-400 text-sm mb-2">Error: {error}</p>}

        {/* Version List */}
        <div className="flex-grow overflow-y-auto min-h-0 pr-2">
            {isLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading versions...</p>}
            {!isLoading && versions.length === 0 && !error && (
                <p className="text-center text-gray-500 dark:text-gray-400">No versions found for this asset.</p>
            )}
            {!isLoading && versions.length > 0 && (
                <ul className="space-y-2">
                    {versions.map((version) => (
                        <li key={version.id} className={`flex items-center p-2 border rounded transition-colors duration-150 ${selectedIds.includes(version.id) ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
                             <input
                                type="checkbox"
                                checked={selectedIds.includes(version.id)}
                                onChange={() => handleSelect(version.id)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-3 flex-shrink-0"
                             />
                            <img
                                // Use file protocol for local paths
                                src={version.thumbnailPath ? `file:///${version.thumbnailPath.replace(/\\/g, '/')}` : './placeholder.svg'} 
                                alt={`Thumbnail for ${version.fileName}`}
                                className="w-16 h-16 object-cover rounded mr-3 flex-shrink-0 bg-gray-200 dark:bg-gray-600"
                                onError={(e) => { 
                                    // More robust fallback
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== './placeholder.svg') { 
                                        target.src = './placeholder.svg';
                                    }
                                }}
                            />
                            <div className="flex-grow grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <div className="col-span-2 truncate" title={version.fileName}>
                                    <span className="font-medium text-gray-800 dark:text-gray-100">File:</span> {version.fileName}
                                </div>
                                <div><span className="font-medium text-gray-600 dark:text-gray-300">Version:</span> {version.version_no}</div>
                                <div><span className="font-medium text-gray-600 dark:text-gray-300">Year:</span> {version.year ?? 'N/A'}</div>
                                <div className="truncate" title={version.advertiser ?? ''}><span className="font-medium text-gray-600 dark:text-gray-300">Advertiser:</span> {version.advertiser ?? 'N/A'}</div>
                                <div className="truncate" title={version.niche ?? ''}><span className="font-medium text-gray-600 dark:text-gray-300">Niche:</span> {version.niche ?? 'N/A'}</div>
                                <div><span className="font-medium text-gray-600 dark:text-gray-300">Shares:</span> {version.shares ?? 'N/A'}</div>
                                <div><span className="font-medium text-gray-600 dark:text-gray-300">ID:</span> {version.id}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        {/* Footer Actions (Optional, could just use Close button) */}
         {/* <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 flex justify-end">
             <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Close</button>
         </div> */}
    </div>
  ), [masterId, isOpen, onClose, versions, isLoading, error, selectedIds, showBulkEdit, bulkYear, applyYear, bulkAdvertiser, applyAdvertiser, bulkNiche, applyNiche, bulkShares, applyShares, handleSelect, handleSelectAll, handleAddToGroup, handleRemoveFromGroup, handleToggleBulkEdit, handleBulkDelete, handleBulkUpdateSave]);


  if (!isOpen || !masterId) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      {modalContent}
    </div>
  );
};

// Remove the duplicate/conflicting global declaration
// Assume window.api types are provided elsewhere (e.g., app/index.d.ts)
/*
declare global {
    interface Window {
        api: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            createVersion: (payload: { masterId: number; sourcePath: string }) => Promise<{ success: boolean, newId?: number, error?: string }>;
            removeFromGroup: (payload: { versionId: number }) => Promise<{ success: boolean, error?: string }>;
        }
    }
}
*/ 

export default VersionHistoryModal; 