import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Import necessary types directly
import { AssetWithThumbnail, FetchFilters, FetchSort, BulkUpdatePayload, BulkImportResult, BatchUpdateResult } from '../hooks/useAssets';
// Assuming react-icons is installed
import { 
    FiFilter, FiRefreshCw, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiUploadCloud, 
    FiTrash2, FiEdit
    // Removed unused icons: FiSearch, FiTag, FiCalendar, FiUser, FiAward, FiShare2, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
// Import child components
import AssetGrid from './AssetGrid';
import AssetList from './AssetList';
import BulkEditModal from './BulkEditModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { Tooltip } from 'react-tooltip';
import SidebarFilters from './SidebarFilters';

// Define available sort options for the dropdown
const sortOptions: { label: string; value: FetchSort }[] = [
    { label: 'Newest First', value: { sortBy: 'createdAt', sortOrder: 'DESC' } },
    { label: 'Oldest First', value: { sortBy: 'createdAt', sortOrder: 'ASC' } },
    { label: 'Filename (A-Z)', value: { sortBy: 'fileName', sortOrder: 'ASC' } },
    { label: 'Filename (Z-A)', value: { sortBy: 'fileName', sortOrder: 'DESC' } },
    { label: 'Year (High-Low)', value: { sortBy: 'year', sortOrder: 'DESC' } },
    { label: 'Year (Low-High)', value: { sortBy: 'year', sortOrder: 'ASC' } },
    { label: 'Shares (High-Low)', value: { sortBy: 'shares', sortOrder: 'DESC' } },
    { label: 'Shares (Low-High)', value: { sortBy: 'shares', sortOrder: 'ASC' } },
    { label: 'Total Shares (High-Low)', value: { sortBy: 'accumulatedShares', sortOrder: 'DESC' } },
    { label: 'Total Shares (Low-High)', value: { sortBy: 'accumulatedShares', sortOrder: 'ASC' } },
];

// Type for sortable columns in the list view header
type SortableColumn = Extract<FetchSort['sortBy'], 'fileName' | 'year' | 'shares' | 'accumulatedShares' | 'createdAt'>;

// Define props expected by LibraryView
interface LibraryViewProps {
    assets: AssetWithThumbnail[];
    loading: boolean;
    error: string | null;
    bulkImportAssets: () => Promise<BulkImportResult>;
    fetchAssets: (filters?: FetchFilters, sort?: FetchSort) => Promise<void>; 
    deleteAsset: (id: number) => Promise<boolean>;
    bulkUpdateAssets: (selectedIds: number[], updates: BulkUpdatePayload) => Promise<BatchUpdateResult>;
}


// LibraryView Component: Main interface for browsing assets
const LibraryView: React.FC<LibraryViewProps> = ({
    assets, 
    loading, 
    error, 
    bulkImportAssets, 
    fetchAssets,
    deleteAsset,
    bulkUpdateAssets,
}) => {

    // --- State Management ---
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyMasterId, setHistoryMasterId] = useState<number | null>(null);

    // Filter and Sort State (Consolidated)
    const [searchTerm, setSearchTerm] = useState<string>(''); 
    const [filters, setFilters] = useState<FetchFilters>({}); 
    const [sort, setSort] = useState<FetchSort>({ sortBy: 'createdAt', sortOrder: 'DESC' }); 

    // --- Derived State (for filter dropdowns) ---
    const availableYears = useMemo(() => {
        const years = new Set(assets.map(a => a.year).filter((y): y is number => y !== null && y !== undefined && y !== 0)); // Exclude 0 year if appropriate
        return Array.from(years).sort((a, b) => b - a); 
    }, [assets]);

    const availableAdvertisers = useMemo(() => {
        const advertisers = new Set(assets.map(a => a.advertiser).filter((adv): adv is string => !!adv));
        return Array.from(advertisers).sort();
    }, [assets]);

    const availableNiches = useMemo(() => {
        const niches = new Set(assets.map(a => a.niche).filter((n): n is string => !!n));
        return Array.from(niches).sort();
    }, [assets]);

    // --- Effect: Fetch assets when filters or sort change ---
    useEffect(() => {
        const currentFilters: FetchFilters = { ...filters };
        if (currentFilters.sharesRange && currentFilters.sharesRange[0] === null && currentFilters.sharesRange[1] === null) {
            delete currentFilters.sharesRange;
        }
        // TODO: Integrate searchTerm into backend fetch if required
        fetchAssets(currentFilters, sort); // Use the passed-in fetchAssets prop
    }, [filters, sort, fetchAssets]); // Correct dependencies

    // --- Event Handlers ---

    // Centralized filter change handler
    const handleFilterChange = useCallback((filterName: keyof FetchFilters, value: string | number | null | [number | null, number | null]) => {
        setFilters(prevFilters => {
            const newFilters = { ...prevFilters };
            if (value === null || value === '' || (Array.isArray(value) && value[0] === null && value[1] === null)) {
                delete newFilters[filterName]; 
            } else {
                (newFilters as any)[filterName] = value;
            }
            return newFilters;
        });
        setSelectedAssetIds(new Set()); // Clear selection on filter change
    }, []);

    // Search term change handler
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        // TODO: If backend search needed: handleFilterChange('searchTerm', event.target.value);
    };

    // Handle sort dropdown change
    const handleSortDropdownChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        const selectedOption = sortOptions.find(opt => `${opt.value.sortBy}-${opt.value.sortOrder}` === selectedValue);
        if (selectedOption) {
            setSort(selectedOption.value); // Update consolidated sort state
            setSelectedAssetIds(new Set()); // Clear selection
        }
    };

    // Handle sort change from list view column header click
    const handleColumnSort = (column: SortableColumn) => {
        setSort(prevSort => {
            const newSortOrder = (prevSort.sortBy === column && prevSort.sortOrder === 'ASC') ? 'DESC' : 'ASC';
            const newSortBy = column as FetchSort['sortBy']; 
            return { sortBy: newSortBy, sortOrder: newSortOrder };
        });
        setSelectedAssetIds(new Set()); // Clear selection
    };

    // Handle view mode toggle
    const toggleViewMode = () => {
        setViewMode(prevMode => (prevMode === 'grid' ? 'list' : 'grid'));
        setSelectedAssetIds(new Set()); // Clear selection on view mode change
    };

    // Handle individual asset selection
    const handleSelectAsset = (assetId: number, isSelected: boolean) => {
        setSelectedAssetIds(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (isSelected) {
                newSelected.add(assetId);
            } else {
                newSelected.delete(assetId);
            }
            return newSelected;
        });
    };

    // Handle Select/Deselect All
    const handleSelectAll = (isSelected: boolean) => {
        if (isSelected) {
            const allFilteredIds = new Set(assets.map(a => a.id));
            setSelectedAssetIds(allFilteredIds);
        } else {
            setSelectedAssetIds(new Set());
        }
    };

    const isAllSelected = useMemo(() => {
        return assets.length > 0 && selectedAssetIds.size === assets.length;
    }, [assets, selectedAssetIds]);

    // Handle Bulk Import
    const handleBulkImport = async () => {
        const result = await bulkImportAssets(); // Use passed-in prop
        console.log('Bulk import result:', result);
        if (result.success) {
            setSelectedAssetIds(new Set()); 
        }
    };

    // Handle Refresh (Reset filters/sort)
    const handleRefresh = useCallback(() => {
        setFilters({}); 
        setSort({ sortBy: 'createdAt', sortOrder: 'DESC' }); 
        setSearchTerm(''); 
        setSelectedAssetIds(new Set()); 
        // fetchAssets called by useEffect
    }, []); 

    // Handle batch deletion
    const handleBatchDelete = async () => {
        const idsToDelete = Array.from(selectedAssetIds);
        if (idsToDelete.length === 0 || !window.confirm(`Are you sure you want to delete ${idsToDelete.length} selected asset(s)? This action cannot be undone.`)) {
            return;
        }
        let deletedCount = 0;
        const errors: { id: number, error: string }[] = [];
        try {
            for (const id of idsToDelete) {
                const success = await deleteAsset(id); // Use passed-in prop
                if (success) {
                    deletedCount++;
                } else {
                    errors.push({ id, error: 'Deletion failed via hook.'});
                }
            }
            setSelectedAssetIds(new Set()); 
            alert(`${deletedCount} asset(s) deleted successfully. ${errors.length > 0 ? `${errors.length} failed.` : ''}`);
            // Consider if fetchAssets() is needed here or if deleteAsset handles refresh
             await fetchAssets(); // Call fetchAssets passed via props if needed
        } catch (err: any) {
            console.error('Error during batch delete:', err);
            alert(`An error occurred during batch deletion: ${err.message || 'Unknown error'}`);
            await fetchAssets(); // Refresh on error too?
        }
    };

    // Handle opening the bulk edit modal
    const handleOpenBulkEditModal = () => {
        if (selectedAssetIds.size > 0) {
            setIsBulkEditModalOpen(true);
        }
    };
    
    // Handle saving from the bulk edit modal
    const handleBulkUpdateSave = async (updates: BulkUpdatePayload) => {
        const idsToUpdate = Array.from(selectedAssetIds);
        if (idsToUpdate.length === 0) return; 
        try {
            const result = await bulkUpdateAssets(idsToUpdate, updates); // Use passed-in prop
            console.log('Bulk update result:', result);
            if (result.success) {
                alert(`Successfully updated ${result.updatedCount} asset(s).`);
            } else {
                alert(`Bulk update completed with ${result.errors.length} error(s). Updated ${result.updatedCount} asset(s). Check console.`);
                result.errors.forEach(e => console.error(`Update Error (ID: ${e.id}): ${e.error}`));
            }
            setSelectedAssetIds(new Set()); 
            setIsBulkEditModalOpen(false); 
             // Consider if fetchAssets() is needed here or if bulkUpdateAssets handles refresh
             await fetchAssets(); // Call fetchAssets passed via props if needed
        } catch (err: any) {
            console.error('Failed to execute bulk update:', err);
            alert(`An unexpected error occurred during bulk update: ${err.message || 'Unknown error'}`);
        }
    };

    // Handle opening the version history modal
    const handleOpenHistoryModal = useCallback((assetId: number) => {
        console.log('Opening history for asset ID:', assetId);
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            const idToOpen = asset.master_id ?? asset.id;
            setHistoryMasterId(idToOpen);
            setIsHistoryModalOpen(true);
        } else {
            alert('Could not find the selected asset to open history.');
        }
    }, [assets]);


    // Handle closing the version history modal
    const handleCloseHistoryModal = useCallback(() => {
        setIsHistoryModalOpen(false);
        setHistoryMasterId(null);
        // Consider if refresh is needed: fetchAssets();
    }, []);

    // Loading/Error states
    if (loading && assets.length === 0) return <div className="flex justify-center items-center h-full text-gray-400">Loading assets...</div>;
    if (error) return <div className="flex justify-center items-center h-full text-red-500">Error loading assets: {error}</div>;

    // Main Layout
    return (
        <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            {/* Collapsible Left Sidebar */}
            <aside className={`flex flex-col h-full min-h-0 bg-gray-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0 border-r border-gray-700`}>
                {/* Sidebar Header */}
                <div className={`flex items-center p-4 border-b border-gray-700 flex-shrink-0 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    {isSidebarOpen && (
                        <h3 className="text-lg font-semibold flex items-center">
                            <FiFilter className="mr-2"/> Filters
                        </h3>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1 rounded hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isSidebarOpen ? <FiChevronLeft size={18}/> : <FiChevronRight size={18}/>}
                    </button>
                </div>

                {/* Render the new SidebarFilters component with CORRECT props */}
                <SidebarFilters
                  isCollapsed={!isSidebarOpen}
                  filters={filters} // Pass consolidated filters state
                  handleFilterChange={handleFilterChange} // Pass correct unified handler
                  distinctYears={availableYears}
                  distinctAdvertisers={availableAdvertisers}
                  distinctNiches={availableNiches}
                  searchTerm={searchTerm}
                  handleSearchChange={handleSearchChange} // Pass correct search handler
                />

            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Sticky Top Toolbar - Reverted to original structure/styles for clarity */}
                <div className="flex-shrink-0 bg-gray-850 p-3 border-b border-gray-700 shadow-md sticky top-0 z-10">
                     <div className="flex items-center justify-between">
                         {/* Left Actions: Import, Refresh */}
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={handleBulkImport}
                                 className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium flex items-center space-x-1 transition duration-150 ease-in-out"
                                 title="Import multiple files"
                                 data-tooltip-id="library-tooltip" data-tooltip-content="Import Multiple Files"
                            >
                                 <FiUploadCloud size={16} />
                                 <span>Bulk Import</span>
                            </button>
                             <button 
                                onClick={handleRefresh}
                                 className="p-2 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition duration-150 ease-in-out"
                                 title="Refresh asset list and filters"
                                 data-tooltip-id="library-tooltip" data-tooltip-content="Refresh Asset List"
                            >
                                <FiRefreshCw size={18} />
                            </button>
                        </div>

                         {/* Center: Conditional Batch Actions */} 
                         <div className="flex-grow flex justify-center px-4">
                             {selectedAssetIds.size > 0 && (
                                 <div className="flex items-center space-x-3 bg-gray-700 px-3 py-1 rounded-md">
                                     <span className="text-sm font-medium text-gray-300">
                                         {selectedAssetIds.size} selected
                                     </span>
                                 <button 
                                     onClick={handleOpenBulkEditModal}
                                         className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 rounded text-white text-xs font-semibold flex items-center space-x-1 transition duration-150 ease-in-out"
                                         title="Edit metadata for selected assets"
                                         data-tooltip-id="library-tooltip" data-tooltip-content="Edit Metadata for Selected"
                                 >
                                         <FiEdit size={14} />
                                         <span>Edit Metadata</span>
                                 </button>
                                 <button 
                                     onClick={handleBatchDelete}
                                         className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-semibold flex items-center space-x-1 transition duration-150 ease-in-out"
                                         title="Delete selected assets"
                                         data-tooltip-id="library-tooltip" data-tooltip-content="Delete Selected Assets"
                                 >
                                         <FiTrash2 size={14} />
                                         <span>Delete Selected</span>
                                 </button>
                             </div>
                         )}
                        </div>

                        {/* Right Actions: Sort, View Mode */} 
                        <div className="flex items-center space-x-3">
                            {/* Sort Dropdown (using consolidated sort state) */} 
                            <div className="flex items-center space-x-2">
                                <label htmlFor="sort-select" className="sr-only">Sort by</label>
                                <select 
                                    id="sort-select" 
                                    value={`${sort.sortBy}-${sort.sortOrder}`} // Value derived from sort state object
                                    onChange={handleSortDropdownChange} // Use the correct handler
                                     className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm appearance-none"
                                >
                                    {sortOptions.map(opt => (
                                        <option key={`${opt.value.sortBy}-${opt.value.sortOrder}`} value={`${opt.value.sortBy}-${opt.value.sortOrder}`}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* View Mode Toggle - USE toggleViewMode */} 
                            <div className="flex items-center space-x-1 bg-gray-700 p-0.5 rounded">
                                <button 
                                    // onClick={() => setViewMode('grid')}
                                    onClick={toggleViewMode} // Use the toggle function
                                    disabled={viewMode === 'grid'} // Disable if already in this mode
                                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                    title="Grid View"
                                >
                                    <FiGrid size={18} />
                                </button>
                                <button 
                                    // onClick={() => setViewMode('list')}
                                    onClick={toggleViewMode} // Use the toggle function
                                    disabled={viewMode === 'list'} // Disable if already in this mode
                                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                    title="List View"
                                >
                                    <FiList size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Asset Display Area - Ensure it scrolls */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
                    {loading && assets.length > 0 && ( // Show loading overlay only if assets were previously loaded
                        <div className="absolute inset-x-0 top-16 flex justify-center p-4 z-20">
                            <div className="bg-gray-700 bg-opacity-80 text-white px-4 py-2 rounded shadow-lg">
                                Loading...
                            </div>
                        </div>
                    )}
                    {!loading && assets.length === 0 && ( // Show no assets message only when not loading
                        <div className="flex justify-center items-center h-full text-gray-500">
                            No assets found matching your criteria.
                        </div>
                    )}
                    {assets.length > 0 && (
                        viewMode === 'grid' ? (
                            <AssetGrid 
                                assets={assets} 
                                selectedAssetIds={selectedAssetIds} 
                                onSelect={handleSelectAsset} 
                                onHistory={handleOpenHistoryModal} 
                            />
                        ) : (
                            <AssetList 
                                assets={assets} 
                                selectedAssetIds={selectedAssetIds} 
                                onSelect={handleSelectAsset} 
                                onHistory={handleOpenHistoryModal}
                                sortConfig={sort} // Pass sortConfig instead of currentSort
                                handleSort={handleColumnSort} // Pass the new handler
                                handleSelectAll={handleSelectAll}
                                isAllSelected={isAllSelected}
                            />
                        )
                    )}
                </div>
            </main>

            {/* Bulk Edit Modal */} 
            {isBulkEditModalOpen && (
                <BulkEditModal
                    isOpen={isBulkEditModalOpen}
                    onClose={() => setIsBulkEditModalOpen(false)}
                    onSave={handleBulkUpdateSave}
                    selectedCount={selectedAssetIds.size}
                />
            )}

            {/* Tooltips for the Library View */} 
            <Tooltip id="library-tooltip" place="top" />

            {/* Version History Modal */} 
             {isHistoryModalOpen && historyMasterId !== null && (
                <VersionHistoryModal
                    masterId={historyMasterId}
                    isOpen={isHistoryModalOpen}
                    onClose={handleCloseHistoryModal}
                />
            )}

            {/* Tooltip component definitions (if needed globally) */} 
            <Tooltip id="accumulated-shares-tooltip" place="top" />
        </div>
    );
};

export default LibraryView; 