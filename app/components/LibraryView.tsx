import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Removed useAssets import as props are now passed down
import { AssetWithThumbnail, BulkImportResult, /* Unused: UpdateAssetPayload, */ BatchUpdateResult, FetchFilters, FetchSort /* Unused: GetVersionsResult, CreateVersionResult, AddToGroupResult, RemoveFromGroupResult */ } from '../hooks/useAssets';
// Assuming react-icons is installed for a better UX
import { 
    FiFilter, FiRefreshCw, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiUploadCloud, 
    FiSearch, FiTag, FiTrash2, FiEdit, FiEye, FiCalendar, FiUser, FiAward, FiShare2,
    FiClock, FiGitBranch // <-- Import icons for versioning
} from 'react-icons/fi';
// Import the new modal component and types
import BulkEditModal, { BulkUpdatePayload } from './BulkEditModal';
import { VersionHistoryModal } from './VersionHistoryModal'; // Import the VersionHistoryModal
import { Tooltip } from 'react-tooltip'; // Import Tooltip

// PRD §4.1 Library View: Define props for LibraryView including fetchAssets with params
interface LibraryViewProps {
    assets: AssetWithThumbnail[];
    loading: boolean;
    error: string | null;
    bulkImportAssets: () => Promise<BulkImportResult>;
    fetchAssets: (filters?: FetchFilters, sort?: FetchSort) => Promise<void>; 
    deleteAsset: (id: number) => Promise<boolean>;
    bulkUpdateAssets: (selectedIds: number[], updates: BulkUpdatePayload) => Promise<BatchUpdateResult>;
}

// PRD §4.1 Library View: Define the main library view component
const LibraryView: React.FC<LibraryViewProps> = ({ 
    assets, 
    loading, 
    error, 
    bulkImportAssets, 
    fetchAssets,
    deleteAsset,
    bulkUpdateAssets,
}) => {
    // PRD §4.1 Library View: Use props instead of hook
    // const { assets, loading, error, bulkImportAssets, fetchAssets } = useAssets(); // Remove this line
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState(''); // Still useful for client-side search if needed, but filtering is backend now
    // PRD §4.1 Library View: UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    // PRD §4.1 Library View: State for controlling the bulk edit modal
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState<boolean>(false);
    // State for Version History Modal
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
    const [historyMasterId, setHistoryMasterId] = useState<number | null>(null);

    // --- PRD §4.1 Library View: Filter State --- 
    const [filterYear, setFilterYear] = useState<number | null>(null);
    const [filterAdvertiser, setFilterAdvertiser] = useState<string>('');
    const [filterNiche, setFilterNiche] = useState<string>('');
    const [filterSharesMin, setFilterSharesMin] = useState<string>(''); // Use string for input control
    const [filterSharesMax, setFilterSharesMax] = useState<string>(''); // Use string for input control

    // --- PRD §4.1 Library View: Sort State --- 
    const [sortBy, setSortBy] = useState<FetchSort['sortBy']>('createdAt');
    const [sortOrder, setSortOrder] = useState<FetchSort['sortOrder']>('DESC');

    // --- PRD §4.1 Library View: Dynamic Options for Filters --- 
    const availableYears = useMemo(() => {
        const years = new Set(assets.map(a => a.year).filter((y): y is number => y !== null && y !== 0));
        return Array.from(years).sort((a, b) => b - a); // Sort descending
    }, [assets]);

    const availableAdvertisers = useMemo(() => {
        const advertisers = new Set(assets.map(a => a.advertiser).filter((adv): adv is string => !!adv));
        return Array.from(advertisers).sort();
    }, [assets]);

    const availableNiches = useMemo(() => {
        const niches = new Set(assets.map(a => a.niche).filter((n): n is string => !!n));
        return Array.from(niches).sort();
    }, [assets]);

    // --- PRD §4.1 Library View: Effect to Fetch Assets on Filter/Sort Change --- 
    useEffect(() => {
        const filters: FetchFilters = {
            year: filterYear,
            advertiser: filterAdvertiser || null,
            niche: filterNiche || null,
            sharesRange: [
                filterSharesMin === '' ? null : parseInt(filterSharesMin, 10),
                filterSharesMax === '' ? null : parseInt(filterSharesMax, 10)
            ]
        };
        const sort: FetchSort = {
            sortBy: sortBy,
            sortOrder: sortOrder
        };
        // Debounce could be added here for text inputs if needed
        fetchAssets(filters, sort);
    }, [filterYear, filterAdvertiser, filterNiche, filterSharesMin, filterSharesMax, sortBy, sortOrder, fetchAssets]);

    // PRD §4.1 Library View: Toggle single asset selection
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

    const handleBulkImport = async () => {
        const result = await bulkImportAssets();
        // Optionally show feedback based on result
        console.log('Bulk import result:', result);
        if (result.success) {
            setSelectedAssetIds(new Set()); // Clear selection after import
        }
    };

    // PRD §4.1 Library View: Refresh asset list (clear filters/sort and fetch)
    const handleRefresh = () => {
        setFilterYear(null);
        setFilterAdvertiser('');
        setFilterNiche('');
        setFilterSharesMin('');
        setFilterSharesMax('');
        setSortBy('createdAt');
        setSortOrder('DESC');
        // fetchAssets will be called by the useEffect hook due to state changes
        setSelectedAssetIds(new Set()); 
    };

    // PRD §4.1 Library View: Handle batch deletion
    const handleBatchDelete = async () => {
        const idsToDelete = Array.from(selectedAssetIds);
        if (idsToDelete.length === 0 || !window.confirm(`Are you sure you want to delete ${idsToDelete.length} selected asset(s)? This action cannot be undone.`)) {
            return;
        }
        console.log('Attempting to delete assets:', idsToDelete);
        // Display loading state? (Consider adding a loading state for batch actions)
        let deletedCount = 0;
        const errors: { id: number, error: string }[] = [];
        try {
            // Perform deletions sequentially. Consider backend endpoint for true batch deletion.
            for (const id of idsToDelete) {
                const success = await deleteAsset(id); // Reuse single delete logic
                if (success) {
                    deletedCount++;
                } else {
                    errors.push({ id, error: 'Deletion failed via hook.'});
                }
            }
            setSelectedAssetIds(new Set()); // Clear selection after deletion
            await fetchAssets(); // Refresh list to reflect deletions
            alert(`${deletedCount} asset(s) deleted successfully. ${errors.length > 0 ? `${errors.length} failed.` : ''}`);
        } catch (err: any) {
            console.error('Error during batch delete:', err);
            alert(`An error occurred during batch deletion: ${err.message || 'Unknown error'}`);
            // Optionally fetchAssets again even on error to ensure UI consistency
            await fetchAssets(); 
        }
    };

    // PRD §4.1 Library View: Handle opening the bulk edit modal
    const handleOpenBulkEditModal = () => {
        if (selectedAssetIds.size > 0) {
            setIsBulkEditModalOpen(true);
        }
    };
    
    // PRD §4.1 Library View: Handle saving from the bulk edit modal
    const handleBulkUpdateSave = async (updates: BulkUpdatePayload) => {
        const idsToUpdate = Array.from(selectedAssetIds);
        if (idsToUpdate.length === 0) return; // Should not happen if modal opened
        
        try {
            const result = await bulkUpdateAssets(idsToUpdate, updates);
            console.log('Bulk update result:', result);
            if (result.success) {
                alert(`Successfully updated ${result.updatedCount} asset(s).`);
            } else {
                alert(`Bulk update completed with ${result.errors.length} error(s). Updated ${result.updatedCount} asset(s). Check console for details.`);
                // Optionally log detailed errors
                result.errors.forEach(e => console.error(`Update Error (ID: ${e.id}): ${e.error}`));
            }
            setSelectedAssetIds(new Set()); // Clear selection after update
            setIsBulkEditModalOpen(false); // Close modal handled by modal itself on success, but ensure state sync
            // fetchAssets() is called within bulkUpdateAssets hook, no need to call again here.
        } catch (err: any) {
            console.error('Failed to execute bulk update:', err);
            alert(`An unexpected error occurred during bulk update: ${err.message || 'Unknown error'}`);
            // Keep modal open? Maybe close it and rely on error message.
            // setIsBulkEditModalOpen(false); // Decide on desired behavior
        }
    };

    // --- Helper: Input Change Handler for Numeric Filters ---
    const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow empty string or positive integers
        if (value === '' || /^[0-9]+$/.test(value)) {
            setter(value);
        }
    };

    // --- Version History Action Handler ---
    const handleOpenHistoryModal = useCallback((assetId: number) => {
        console.log('Opening history for asset ID:', assetId);
        setHistoryMasterId(assetId);
        setIsHistoryModalOpen(true);
    }, []);

    const handleCloseHistoryModal = useCallback(() => {
        setIsHistoryModalOpen(false);
        setHistoryMasterId(null);
        // Optionally trigger a refresh of the main asset list if versions might have changed
        // fetchAssets(); // Consider if this is necessary after modal actions
    }, []);

    // Loading/Error states
    if (loading && assets.length === 0) {
        return <div className="p-4 text-center">Loading assets...</div>;
    }
    if (error) {
        return <div className="p-4 text-center text-red-500">Error loading assets: {error}</div>;
    }

    return (
        // PRD §4.1 Library View: Main container with flex layout, ensures view takes full height within App's main area
        <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            {/* PRD §4.1 Library View: Collapsible Left Sidebar - Added flex flex-col h-full min-h-0 */} 
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
               
                {/* Filter Controls Area - Ensure flex-1, overflow-y-auto, min-h-0 for scrolling */} 
                <div className={`overflow-y-auto overflow-x-hidden flex-1 min-h-0 ${isSidebarOpen ? 'p-3 space-y-4' : 'p-4 flex flex-col items-center space-y-4 pt-6'}`}>
                     {/* Search - Kept for potential future client-side refinement or quick search */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                 <label htmlFor="search-term" className={`block text-sm font-medium text-gray-300 mb-1`}>Search</label>
                                 <input 
                                     id="search-term"
                                     type="text" 
                                     placeholder="Name, advertiser, niche..." 
                                     value={searchTerm}
                                     onChange={(e) => setSearchTerm(e.target.value)}
                                     className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                 />
                             </>
                         ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Search"><FiSearch size={18}/></button>
                         )}
                     </div>

                     {/* PRD §4.1 Library View: Year Filter Dropdown */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                 <label htmlFor="filter-year" className={`block text-sm font-medium text-gray-300 mb-1`}>Year</label>
                                 <select 
                                     id="filter-year"
                                     value={filterYear ?? ''} 
                                     onChange={(e) => setFilterYear(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                                     className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                 >
                                     <option value="">All Years</option>
                                     {availableYears.map(year => (
                                         <option key={year} value={year}>{year}</option>
                                     ))}
                                 </select>
                             </>
                         ) : (
                             <button className="p-2 rounded hover:bg-gray-700" title="Filter by Year"><FiCalendar size={18}/></button>
                         )}
                     </div>

                     {/* PRD §4.1 Library View: Advertiser Filter Dropdown */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                 <label htmlFor="filter-advertiser" className={`block text-sm font-medium text-gray-300 mb-1`}>Advertiser</label>
                                 <select 
                                     id="filter-advertiser"
                                     value={filterAdvertiser}
                                     onChange={(e) => setFilterAdvertiser(e.target.value)}
                                     className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                 >
                                     <option value="">All Advertisers</option>
                                     {availableAdvertisers.map(adv => (
                                         <option key={adv} value={adv}>{adv}</option>
                                     ))}
                                 </select>
                             </>
                         ) : (
                             <button className="p-2 rounded hover:bg-gray-700" title="Filter by Advertiser"><FiUser size={18}/></button>
                         )}
                     </div>

                     {/* PRD §4.1 Library View: Niche Filter Dropdown */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                 <label htmlFor="filter-niche" className={`block text-sm font-medium text-gray-300 mb-1`}>Niche</label>
                                 <select 
                                     id="filter-niche"
                                     value={filterNiche}
                                     onChange={(e) => setFilterNiche(e.target.value)}
                                     className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                 >
                                     <option value="">All Niches</option>
                                     {availableNiches.map(niche => (
                                         <option key={niche} value={niche}>{niche}</option>
                                     ))}
                                 </select>
                             </>
                         ) : (
                             <button className="p-2 rounded hover:bg-gray-700" title="Filter by Niche"><FiAward size={18}/></button>
                         )}
                     </div>

                     {/* PRD §4.1 Library View: Shares Filter Range Inputs */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                        {isSidebarOpen ? (
                            <div className="space-y-1">
                                <label className={`block text-sm font-medium text-gray-300`}>Shares</label>
                                <div className="flex space-x-2">
                                    <input 
                                        type="number" 
                                        placeholder="Min" 
                                        value={filterSharesMin}
                                        onChange={handleNumericInputChange(setFilterSharesMin)}
                                        className="w-1/2 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Max" 
                                        value={filterSharesMax}
                                        onChange={handleNumericInputChange(setFilterSharesMax)}
                                        className="w-1/2 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Filter by Shares"><FiShare2 size={18}/></button>
                        )}
                    </div>

                    {/* Placeholder for Tag Filter */}
                    <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                        {isSidebarOpen ? (
                            <div>
                                <label className={`block text-sm font-medium text-gray-300 mb-1`}>Tags</label>
                                <div className="p-2 text-center text-gray-500 text-xs border border-dashed border-gray-600 rounded">
                                    Tag filtering coming soon...
                                </div>
                            </div>
                        ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Filter by Tags"><FiTag size={18}/></button>
                        )}
                    </div>
                </div>
            </aside>

            {/* PRD §4.1 Library View: Main Content Area */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Sticky Top Toolbar */}
                <div className="flex-shrink-0 bg-gray-850 p-3 border-b border-gray-700 shadow-md">
                    <div className="flex items-center justify-between">
                        {/* Left Actions: Import, Refresh */}
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={handleBulkImport}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium flex items-center space-x-1 transition duration-150 ease-in-out"
                                title="Import multiple files"
                            >
                                <FiUploadCloud size={16} />
                                <span>Bulk Import</span>
                            </button>
                            <button 
                                onClick={handleRefresh}
                                className="p-2 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition duration-150 ease-in-out"
                                title="Refresh asset list and filters"
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
                                    >
                                        <FiEdit size={14} />
                                        <span>Edit Metadata</span>
                                    </button>
                                    <button 
                                        onClick={handleBatchDelete}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-semibold flex items-center space-x-1 transition duration-150 ease-in-out"
                                        title="Delete selected assets"
                                    >
                                        <FiTrash2 size={14} />
                                        <span>Delete Selected</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Actions: Sort, View Mode */}
                        <div className="flex items-center space-x-3">
                            {/* Sort Dropdown */}
                            <div className="flex items-center space-x-1">
                                <label htmlFor="sort-by" className="text-sm text-gray-400">Sort by:</label>
                                <select 
                                    id="sort-by"
                                    value={`${sortBy}-${sortOrder}`}
                                    onChange={(e) => {
                                        const [newSortBy, newSortOrder] = e.target.value.split('-') as [FetchSort['sortBy'], FetchSort['sortOrder']];
                                        setSortBy(newSortBy);
                                        setSortOrder(newSortOrder);
                                    }}
                                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                >
                                    <option value="createdAt-DESC">Newest</option>
                                    <option value="createdAt-ASC">Oldest</option>
                                    <option value="fileName-ASC">Name (A-Z)</option>
                                    <option value="fileName-DESC">Name (Z-A)</option>
                                    <option value="year-DESC">Year (High-Low)</option>
                                    <option value="year-ASC">Year (Low-High)</option>
                                    <option value="shares-DESC">Shares (High-Low)</option> 
                                    <option value="shares-ASC">Shares (Low-High)</option> 
                                </select>
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex items-center space-x-1 bg-gray-700 p-0.5 rounded">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    title="Grid View"
                                >
                                    <FiGrid size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
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
                    {assets.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10">No assets found matching your criteria.</div>
                    ) : viewMode === 'grid' ? (
                        // PRD §4.1 Library View: Grid View - Added items-start and content-start
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start content-start">
                            {assets.map(asset => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset} 
                                    isSelected={selectedAssetIds.has(asset.id)} 
                                    onSelect={handleSelectAsset}
                                    onHistory={handleOpenHistoryModal}
                                />
                            ))}
                        </div>
                    ) : (
                        // PRD §4.1 Library View: List View - Table implementation
                        <div className="overflow-x-auto">
                             <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10">
                                            <input type="checkbox" className="rounded" /* Add bulk select logic if needed */ />
                                        </th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Preview</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Filename</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Year</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Advertiser</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Niche</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shares</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Accumulated</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-850 divide-y divide-gray-700">
                                    {assets.map(asset => (
                                        <tr key={asset.id} className={`hover:bg-gray-800 ${selectedAssetIds.has(asset.id) ? 'bg-blue-900/50' : ''}`}>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded"
                                                    checked={selectedAssetIds.has(asset.id)} 
                                                    onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {/* Consistent thumbnail rendering */} 
                                                <div className="w-16 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                                                    {asset.thumbnailPath ? (
                                                        <img 
                                                            src={asset.thumbnailPath + `?${Date.now()}`} // Append timestamp to try and bypass cache if needed
                                                            alt="Thumbnail" 
                                                            className="object-cover h-full w-full transition-transform duration-300 group-hover:scale-105" 
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <FiEye className="text-gray-500" size={20} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-300 truncate max-w-xs" title={asset.fileName}>{asset.fileName}</td>
                                            <td className="px-3 py-2 text-sm text-gray-400">{asset.year || '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-400 truncate max-w-[150px]" title={asset.advertiser || ''}>{asset.advertiser || '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-400 truncate max-w-[150px]" title={asset.niche || ''}>{asset.niche || '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-400">{asset.shares ?? '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-400 font-medium">{asset.accumulatedShares ?? asset.shares ?? '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                                                {/* Add List View actions - placeholder for now */}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenHistoryModal(asset.id);
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300 p-1 hover:bg-gray-700 rounded"
                                                    title="View History"
                                                >
                                                    <FiClock size={16}/>
                                                </button>
                                                {/* Could add edit/delete buttons here too if needed */}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* PRD §4.1 Library View: Bulk Edit Modal */} 
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
            <VersionHistoryModal
                isOpen={isHistoryModalOpen}
                masterId={historyMasterId} // Pass the selected master ID
                onClose={handleCloseHistoryModal} // Pass the close handler
            />

            {/* Tooltip for Asset Card items */}
            <Tooltip id="asset-card-tooltip" place="top" />

            {/* Tooltip component definitions */}
            <Tooltip id="accumulated-shares-tooltip" place="top" />
        </div>
    );
};

// --- Asset Card Component (used in Grid View) --- 
interface AssetCardProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
    onHistory: (masterId: number) => void; // <-- Prop for history action
}

// PRD §4.1 Library View: Asset card component
const AssetCard: React.FC<AssetCardProps> = ({ asset, isSelected, onSelect, onHistory }) => {
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Stop propagation to prevent card click when clicking checkbox
        e.stopPropagation(); 
        onSelect(asset.id, e.target.checked);
    };
    const handleCardClick = () => {
        // Toggle selection when the card area (excluding checkbox/buttons) is clicked
        onSelect(asset.id, !isSelected);
    };

    const handleHistoryClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        onHistory(asset.id);
    };

    // Step 3: Determine display logic based on versionCount
    const hasVersions = asset.versionCount != null && asset.versionCount > 1;

    // Step 3: Define display shares based on version count
    const displayShares = hasVersions
        ? asset.accumulatedShares
        : asset.shares;
    const displaySharesFormatted = displayShares?.toLocaleString() ?? '-';
    const sharesLabel = "Shares"; // Always use "Shares"

    return (
        <div 
            className={`bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer transition-all duration-200 ease-in-out relative group border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600 hover:shadow-blue-900/30'}`}
            onClick={handleCardClick}
        >
            {/* Selection Checkbox - Positioned top-left */}
            <input 
                type="checkbox" 
                checked={isSelected}
                onChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()} // Also stop propagation on click itself
                className="absolute top-2 left-2 z-10 h-4 w-4 rounded text-blue-600 bg-gray-700 border-gray-500 focus:ring-blue-500 cursor-pointer"
                aria-label={`Select asset ${asset.fileName}`}
            />

            {/* Version Badges - Positioned top-right */} 
            <div className="absolute top-2 right-2 z-10 flex flex-col items-end space-y-1">
                 {/* Step 3: Always display version count badge, showing 'v1' if no versions */}
                 <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shadow ${hasVersions ? 'bg-teal-600 text-teal-100' : 'bg-gray-600 text-gray-200'}`}
                    data-tooltip-id="asset-card-tooltip"
                    data-tooltip-content={hasVersions ? `Versions: ${asset.versionCount}` : 'Master Asset (v1)'}
                >
                    <FiGitBranch className="mr-1" size={12}/>
                    {asset.versionCount ?? 1} {/* Show count, default to 1 */}
                </span>
            </div>

            {/* Thumbnail Area */} 
            <div className="w-full h-32 bg-gray-700 flex items-center justify-center overflow-hidden relative">
                {asset.thumbnailPath ? (
                    <img 
                        src={asset.thumbnailPath + `?${Date.now()}`} // Append timestamp to try and bypass cache if needed
                        alt={`Thumbnail for ${asset.fileName}`}
                        className="object-cover h-full w-full transition-transform duration-300 group-hover:scale-105" 
                        loading="lazy"
                    />
                ) : (
                    <FiEye className="text-gray-500" size={20} />
                )}
                {/* Optional: Overlay on hover? */}
            </div>

            {/* Content Area */} 
            <div className="p-3">
                <h4 
                    className="text-sm font-semibold text-gray-100 truncate mb-1" 
                    title={asset.fileName}
                >
                    {asset.fileName}
                </h4>
                <div className="text-xs text-gray-400 space-y-0.5">
                    <p className="truncate" title={`Year: ${asset.year || 'N/A'}`}>Year: {asset.year || '-'}</p>
                    <p className="truncate" title={`Advertiser: ${asset.advertiser || 'N/A'}`}>Adv: {asset.advertiser || '-'}</p>
                    <p className="truncate" title={`Niche: ${asset.niche || 'N/A'}`}>Niche: {asset.niche || '-'}</p>
                    {/* Display conditional shares value and label */}
                    <p
                        className="truncate"
                        title={`${sharesLabel}: ${displaySharesFormatted}${hasVersions ? ' (Accumulated)' : ''}`}
                        data-tooltip-id="asset-card-tooltip"
                        data-tooltip-content={`${sharesLabel}: ${displaySharesFormatted}${hasVersions ? ' (Accumulated: Master + Versions)' : ''}`}
                    >
                        {sharesLabel}: {displaySharesFormatted}
                    </p>
                </div>
            </div>

             {/* Footer - Absolute positioning at the bottom right for icons */}
            <div className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                 {/* History Button */}
                 <button
                    onClick={handleHistoryClick}
                    className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <FiClock size={14} />
                </button>
                {/* Add other action buttons here if needed */}
            </div>
        </div>
    );
};

export default LibraryView; 