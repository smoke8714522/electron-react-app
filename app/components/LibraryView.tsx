import React, { useState, useMemo, useEffect } from 'react';
// Removed useAssets import as props are now passed down
import { AssetWithThumbnail, BulkImportResult, UpdateAssetPayload, BatchUpdateResult, FetchFilters, FetchSort } from '../hooks/useAssets'; 
// Assuming react-icons is installed for a better UX
import { 
    FiFilter, FiRefreshCw, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiUploadCloud, 
    FiSearch, FiTag, FiTrash2, FiEdit, FiEye, FiCalendar, FiUser, FiAward, FiShare2
} from 'react-icons/fi';
// Import the new modal component and types
import BulkEditModal, { BulkUpdatePayload } from './BulkEditModal';

// PRD §4.1 Library View: Define props for LibraryView including fetchAssets with params
interface LibraryViewProps {
    assets: AssetWithThumbnail[];
    loading: boolean;
    error: string | null;
    bulkImportAssets: () => Promise<BulkImportResult>;
    // PRD §4.1 Library View: fetchAssets signature updated to accept filters/sort
    fetchAssets: (filters?: FetchFilters, sort?: FetchSort) => Promise<void>; 
    deleteAsset: (id: number) => Promise<boolean>;
    updateAsset: (payload: UpdateAssetPayload) => Promise<boolean>; 
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
                                <label htmlFor="filter-year" className={`block text-sm font-medium text-gray-300 mb-1 flex items-center`}><FiCalendar className="mr-1"/> Year</label>
                                <select 
                                     id="filter-year"
                                     value={filterYear ?? ''} // Handle null state
                                     onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value, 10) : null)}
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
                                <label htmlFor="filter-advertiser" className={`block text-sm font-medium text-gray-300 mb-1 flex items-center`}><FiUser className="mr-1"/> Advertiser</label>
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
                                <label htmlFor="filter-niche" className={`block text-sm font-medium text-gray-300 mb-1 flex items-center`}><FiAward className="mr-1"/> Niche</label>
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

                     {/* PRD §4.1 Library View: Shares Filter (Min/Max Inputs) */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                <label className={`block text-sm font-medium text-gray-300 mb-1 flex items-center`}><FiShare2 className="mr-1"/> Shares</label>
                                <div className="flex space-x-2">
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="Min"
                                        value={filterSharesMin}
                                        onChange={handleNumericInputChange(setFilterSharesMin)} // Use helper
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                    />
                                 <input 
                                        type="number" 
                                        min="0"
                                        placeholder="Max" 
                                        value={filterSharesMax}
                                        onChange={handleNumericInputChange(setFilterSharesMax)} // Use helper
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                />
                                </div>
                             </>
                         ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Filter by Shares"><FiShare2 size={18}/></button>
                         )}
                     </div>

                     {/* Placeholder for Tag Filters (if implemented later) */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                <label className={`block text-sm font-medium text-gray-300 mb-1`}>Tags</label>
                                <div className="space-y-1 text-gray-500 text-xs p-2 bg-gray-700 rounded border border-gray-600">
                                    <p>Tag filtering coming soon...</p>
                                    {/* Example Checkboxes (Disabled) */}
                                    <label className="flex items-center space-x-2 opacity-50">
                                        <input type="checkbox" disabled className="rounded text-blue-500 bg-gray-600 border-gray-500"/>
                                        <span>Example Tag 1</span>
                                    </label>
                                    <label className="flex items-center space-x-2 opacity-50">
                                        <input type="checkbox" disabled className="rounded text-blue-500 bg-gray-600 border-gray-500"/>
                                        <span>Example Tag 2</span>
                                    </label>
                                </div>
                            </>
                         ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Filter Tags"><FiTag size={18}/></button>
                         )}
                     </div>
                </div>
            </aside>

            {/* Main Content Area */} 
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* PRD §4.1 Library View: Sticky Top Action Bar */}
                {/* NOTE: The previous implementation had layout issues. Refactored for clarity. */}
                <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 flex-shrink-0 sticky top-0 z-10">
                    {/* Left Side: Conditional Batch Actions */}
                    <div className="flex items-center space-x-3 flex-grow mr-4 min-w-0">
                        {selectedAssetIds.size > 0 ? (
                            <> 
                                <span className="text-sm text-gray-300 font-medium bg-gray-700 px-2.5 py-1 rounded">
                                    {selectedAssetIds.size} selected
                                </span>
                                <button 
                                   onClick={handleOpenBulkEditModal}
                                   className="flex items-center px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-xs font-medium transition-colors duration-150"
                                   title="Edit Metadata for Selected Assets"
                               >
                                   <FiEdit className="mr-1" size={14}/> Edit Metadata
                               </button>
                                <button 
                                   onClick={handleBatchDelete}
                                   className="flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-medium transition-colors duration-150"
                                   title="Delete Selected Assets"
                               >
                                   <FiTrash2 className="mr-1" size={14}/> Delete Selected
                               </button>
                            </> 
                        ) : (
                            // Placeholder when nothing is selected
                            <span className="text-sm text-gray-500 italic">Select assets for batch actions</span>
                        )}
                    </div>
                    
                    {/* Right Side: Main Actions, Sort, & View Toggle */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* Main Actions */} 
                        <button 
                            onClick={handleBulkImport}
                            disabled={loading}
                            className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                        >
                            <FiUploadCloud className="mr-1.5" size={16}/> Bulk Import
                        </button>
                        <button 
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                            title="Refresh Assets"
                        >
                            <FiRefreshCw className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} size={16}/> Refresh
                        </button>
                        
                        {/* PRD §4.1 Library View: Sort Dropdown (Moved here) */} 
                         <div className="flex items-center">
                            <label htmlFor="sort-by" className="text-sm mr-2 text-gray-400">Sort by:</label>
                            <select 
                                id="sort-by"
                                value={`${sortBy}-${sortOrder}`} // Combine value for selection
                                onChange={(e) => {
                                    const [newSortBy, newSortOrder] = e.target.value.split('-');
                                    setSortBy(newSortBy as FetchSort['sortBy']);
                                    setSortOrder(newSortOrder as FetchSort['sortOrder']);
                                }}
                                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                            >
                                <option value="createdAt-DESC">Newest First</option>
                                <option value="createdAt-ASC">Oldest First</option>
                                <option value="fileName-ASC">FileName A-Z</option>
                                <option value="fileName-DESC">FileName Z-A</option>
                                <option value="year-DESC">Year (High-Low)</option>
                                <option value="year-ASC">Year (Low-High)</option>
                                <option value="shares-DESC">Shares (High-Low)</option>
                                <option value="shares-ASC">Shares (Low-High)</option>
                            </select>
                         </div>

                        {/* View Toggle */} 
                        <div className="flex items-center text-sm">
                             <button 
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center justify-center px-2.5 py-1.5 h-8 border border-r-0 border-gray-600 rounded-l ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}`}
                                title="Grid View"
                            >
                                <FiGrid size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`flex items-center justify-center px-2.5 py-1.5 h-8 border border-gray-600 rounded-r ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}`}
                                title="List View"
                            >
                                <FiList size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Asset Display Area */} 
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {/* PRD §4.1 Library View: Display assets directly from props, filtering is backend */} 
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start content-start">
                             {/* Map over assets prop */} 
                             {assets.map((asset) => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset} 
                                    isSelected={selectedAssetIds.has(asset.id)}
                                    onSelect={handleSelectAsset}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800">
                                    {/* PRD §4.1 Library View: Table header for list view */}
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-12">Select</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-16">Thumb</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Filename</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Year</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Advertiser</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Niche</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shares</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-850 divide-y divide-gray-700">
                                    {/* PRD §4.1 Library View: Render table rows directly */}
                                    {assets.map((asset) => {
                                        const isSelected = selectedAssetIds.has(asset.id);
                                        // Helper to format file size (kept local for simplicity)
                                        const formatBytes = (bytes: number, decimals = 1): string => {
                                            if (bytes === 0) return '0 Bytes';
                                            const k = 1024;
                                            const dm = decimals < 0 ? 0 : decimals;
                                            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                                            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
                                        }
                                        return (
                                            <tr key={asset.id} className={`hover:bg-gray-750 ${isSelected ? 'bg-blue-900/50' : ''} transition-colors duration-150`}>
                                                {/* Select Checkbox Cell */}
                                                <td className="px-4 py-2 whitespace-nowrap align-middle">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                                                        className="form-checkbox h-4 w-4 text-blue-500 bg-gray-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-800 cursor-pointer"
                                                        aria-label={`Select ${asset.fileName}`}
                                                    />
                                                </td>
                                                {/* Thumbnail Cell */}
                                                <td className="px-4 py-2 align-middle">
                                                    <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {asset.thumbnailPath ? (
                                                            <img src={asset.thumbnailPath} alt={`Thumb ${asset.fileName}`} className="w-full h-full object-cover" loading="lazy"/>
                                                        ) : (
                                                            <FiEye size={20} className="text-gray-500" /> 
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Filename Cell */}
                                                <td className="px-4 py-2 text-sm font-medium text-gray-200 align-middle max-w-xs truncate" title={asset.fileName}>
                                                    {asset.fileName}
                                                </td>
                                                {/* Year Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle">
                                                    {asset.year || 'N/A'}
                                                </td>
                                                {/* Advertiser Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle max-w-xs truncate" title={asset.advertiser || undefined}>
                                                    {asset.advertiser || 'N/A'}
                                                </td>
                                                {/* Niche Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle max-w-xs truncate" title={asset.niche || undefined}>
                                                    {asset.niche || 'N/A'}
                                                </td>
                                                {/* Shares Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle">
                                                    {(asset.shares !== null && asset.shares !== undefined) ? asset.shares : 'N/A'}
                                                </td>
                                                {/* Size Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle">
                                                    {formatBytes(asset.size)}
                                                </td>
                                                {/* Created Cell */}
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle">
                                                    {new Date(asset.createdAt).toLocaleDateString()}
                                                </td>
                                                {/* Actions Cell */} 
                                                <td className="px-4 py-2 text-sm text-gray-400 align-middle">
                                                    <div className="flex items-center space-x-2">
                                                        {/* Placeholder for inline actions - use actual buttons or links later */} 
                                                        <button disabled className="p-1 rounded hover:bg-gray-700 opacity-50" title="Edit (Coming Soon)"><FiEdit size={14}/></button>
                                                        <button disabled className="p-1 rounded hover:bg-gray-700 opacity-50" title="Delete (Use Batch)"><FiTrash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                         </div>
                    )}
                    {/* Display message if no assets match filters/search */} 
                    {assets.length === 0 && !loading && (
                        <div className="text-center text-gray-500 mt-8">No assets found matching your criteria.</div>
                    )}
                </div>
            </main>

            {/* PRD §4.1 Library View: Bulk Edit Modal */} 
            <BulkEditModal 
                isOpen={isBulkEditModalOpen} 
                onClose={() => setIsBulkEditModalOpen(false)} 
                onSave={handleBulkUpdateSave} 
                selectedCount={selectedAssetIds.size}
            />

        </div>
    );
};

// --- Asset Card Component (Using Tailwind) --- 

interface AssetCardProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
}

// PRD §4.1 Library View: Component for displaying a single asset card (Tailwind)
const AssetCard: React.FC<AssetCardProps> = ({ asset, isSelected, onSelect }) => {
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent card click when checkbox is clicked
        onSelect(asset.id, e.target.checked);
    };

    const handleCardClick = () => {
        onSelect(asset.id, !isSelected);
    };

    return (
        <div 
            className={`relative border rounded-lg overflow-hidden shadow-md bg-gray-800 ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-700 hover:border-gray-600'} flex flex-col cursor-pointer transition-all duration-150`}
            onClick={handleCardClick}
        >
            {/* PRD §4.1 Library View: Multi-select checkbox */} 
            <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={handleCheckboxChange} 
                onClick={(e) => e.stopPropagation()} // Prevent card click when checkbox is clicked
                className="absolute top-2 right-2 z-10 h-4 w-4 rounded text-blue-600 bg-gray-700 border-gray-500 focus:ring-blue-500 cursor-pointer"
                aria-label={`Select ${asset.fileName}`}
            />
            {/* PRD §4.3 Thumbnail Service: Display thumbnail */} 
            <div className="w-full h-40 bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {asset.thumbnailPath ? (
                    <img 
                        src={asset.thumbnailPath} 
                        alt={`${asset.fileName} thumbnail`} 
                        className="w-full h-full object-cover" 
                        loading="lazy" // Lazy load images
                    />
                ) : (
                    <div className="text-gray-500 text-sm">No Preview</div> 
                )}
            </div>
            {/* PRD §4.1 Library View: Display asset metadata */} 
            <div className="p-3 flex flex-col gap-0.5 text-xs text-gray-400 overflow-hidden">
                <strong 
                    title={asset.fileName} 
                    className="block text-sm font-medium text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis mb-1"
                >
                    {asset.fileName}
                </strong>
                <p className="whitespace-nowrap overflow-hidden text-ellipsis">Year: <span className="text-gray-300">{asset.year ?? 'N/A'}</span></p>
                <p className="whitespace-nowrap overflow-hidden text-ellipsis">Advertiser: <span className="text-gray-300">{asset.advertiser ?? 'N/A'}</span></p>
                <p className="whitespace-nowrap overflow-hidden text-ellipsis">Niche: <span className="text-gray-300">{asset.niche ?? 'N/A'}</span></p>
                <p className="whitespace-nowrap overflow-hidden text-ellipsis">Shares: <span className="text-gray-300">{asset.shares ?? 'N/A'}</span></p>
                 {/* TODO: Display custom fields/tags */} 
            </div>
        </div>
    );
};

// --- Remove old inline styles object --- 
// const styles: { [key: string]: React.CSSProperties } = { ... };

export default LibraryView; 