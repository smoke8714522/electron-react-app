import React, { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import { FiSearch, FiX, FiGitMerge } from 'react-icons/fi';
import { MasterAssetOption } from '../hooks/useAssets'; // Import type for master asset options

// Basic Debounce Hook (consider moving to a utils file)
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// Ensure Modal is bound to the app element for accessibility
// Make sure an element with ID 'root' exists in your index.html
if (typeof window !== 'undefined') { // Check if running in browser context
    const rootElement = document.getElementById('root');
    if (rootElement) {
        Modal.setAppElement(rootElement);
    } else {
        // Fallback or warning if #root is not found
        console.warn('Modal app element #root not found. Accessibility features may be impaired.');
        // You might set a default fallback like document.body, but #root is preferred.
        // Modal.setAppElement(document.body);
    }
}

interface BulkGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (versionIds: number[], masterId: number) => Promise<{ success: boolean; errors: { id: number; error: string }[] }>;
  getMasterAssets: (searchTerm?: string) => Promise<MasterAssetOption[]>;
  selectedIds: number[]; // IDs of assets to be grouped
}

const BulkGroupModal: React.FC<BulkGroupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  getMasterAssets,
  selectedIds
}) => {
  const [masterAssets, setMasterAssets] = useState<MasterAssetOption[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch master assets
  const fetchMasterAssets = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const assets = await getMasterAssets(search);
      const availableMasters = assets.filter(master => !selectedIds.includes(master.id));
      setMasterAssets(availableMasters);
      if (availableMasters.length === 0 && !search) {
          setError('No other master assets available to group under.');
      } else if (availableMasters.length === 0 && search) {
          setError('No matching master assets found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load master assets.');
      setMasterAssets([]);
    } finally {
      setLoading(false);
    }
  }, [getMasterAssets, selectedIds]);

  // Effect to fetch on open or search change
  useEffect(() => {
    if (isOpen) {
      fetchMasterAssets(debouncedSearchTerm);
    } else {
      // Reset state on close
      setMasterAssets([]);
      setSelectedMasterId(null);
      setSearchTerm('');
      setLoading(false);
      setError(null);
      setSaveError(null);
    }
  }, [isOpen, debouncedSearchTerm, fetchMasterAssets]); // Added fetchMasterAssets dependency

  const handleMasterSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedMasterId(value ? parseInt(value, 10) : null);
    setSaveError(null);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSave = async () => {
    if (!selectedMasterId) {
      setSaveError('Please select a master asset.');
      return;
    }
    if (selectedIds.length === 0) {
        setSaveError('No assets selected.');
        return;
    }

    setLoading(true);
    setSaveError(null);
    try {
      const result = await onSave(selectedIds, selectedMasterId);
      if (result.success) {
        onClose();
      } else {
        const errorMsg = result.errors.map(e => `Asset ${e.id}: ${e.error}`).join('\n');
        setSaveError(`Failed to group some assets:\n${errorMsg}`);
        console.error('Bulk grouping errors:', result.errors);
      }
    } catch (err: any) {
      setSaveError(err.message || 'An unexpected error occurred.');
      console.error('Error saving bulk group:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Group Assets Under Master"
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-75 z-50"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 z-40" 
    >
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md text-white relative flex flex-col" style={{ maxHeight: '90vh' }}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close modal"
        >
          <FiX size={20} />
        </button>

        <h2 className="text-xl font-semibold mb-4 flex items-center flex-shrink-0">
            <FiGitMerge className="mr-2" /> Group {selectedIds.length} Asset(s) Under Master
        </h2>

        <div className="flex-grow overflow-y-auto pr-2"> {/* Scrollable content area */} 
            {saveError && <pre className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded mb-3 whitespace-pre-wrap">{saveError}</pre>}

            <div className="mb-4 relative">
              <label htmlFor="master-search" className="block text-sm font-medium text-gray-300 mb-1">
                Find Target Master Asset
              </label>
              <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
                  <input
                    type="text"
                    id="master-search"
                    placeholder="Search by filename..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    disabled={loading}
                  />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="master-select" className="block text-sm font-medium text-gray-300 mb-1">
                Select Master
              </label>
              <select
                id="master-select"
                value={selectedMasterId ?? ''}
                onChange={handleMasterSelect}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading || masterAssets.length === 0}
                size={5} // Show multiple options if list is long
              >
                {/* Add a default placeholder option */} 
                {!loading && masterAssets.length === 0 && <option value="" disabled>{error || 'No available masters'}</option>} 
                {loading && <option value="" disabled>Loading...</option>}
                {masterAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName} (ID: {asset.id})
                  </option>
                ))}
              </select>
              {error && !loading && masterAssets.length === 0 && <p className="text-sm text-yellow-400 mt-1">{error}</p>} 
            </div>
        </div>

        <div className="flex justify-end space-x-3 mt-4 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium transition-colors duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !selectedMasterId}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Grouping...' : 'Confirm Grouping'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkGroupModal; 