import React, { useState, useMemo } from 'react';
// Removed useAssets import as props are now passed down
import { AssetWithThumbnail, BulkImportResult, UpdateAssetPayload } from '../hooks/useAssets'; 
// Assuming react-icons is installed for a better UX
import { 
    FiFilter, FiRefreshCw, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiUploadCloud, 
    FiSearch, FiSliders, FiTag, FiTrash2, FiEdit, FiEye, FiPackage
} from 'react-icons/fi';

// PRD §4.1 Library View: Define props for LibraryView
interface LibraryViewProps {
    assets: AssetWithThumbnail[];
    loading: boolean;
    error: string | null;
    bulkImportAssets: () => Promise<BulkImportResult>;
    fetchAssets: () => Promise<void>;
    deleteAsset: (id: number) => Promise<boolean>;
    updateAsset: (payload: UpdateAssetPayload) => Promise<boolean>; // Add updateAsset prop if needed for inline editing
}

// PRD §4.1 Library View: Define the main library view component
const LibraryView: React.FC<LibraryViewProps> = ({ 
    assets, 
    loading, 
    error, 
    bulkImportAssets, 
    fetchAssets,
    deleteAsset,
    // updateAsset // Include if inline editing from library is needed
}) => {
    // PRD §4.1 Library View: Use props instead of hook
    // const { assets, loading, error, bulkImportAssets, fetchAssets } = useAssets(); // Remove this line
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAdspower, setFilterAdspower] = useState('');
    // PRD §4.1 Library View: UI State - Default sidebar open, grid view
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

    // PRD §4.1 Library View: Memoized filtering based on search term and Adspower profile
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesSearch = searchTerm === '' || 
                                  asset.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (asset.advertiser && asset.advertiser.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                  (asset.niche && asset.niche.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesAdspower = filterAdspower === '' || 
                                    (asset.adspower && asset.adspower.toLowerCase().includes(filterAdspower.toLowerCase()));

            return matchesSearch && matchesAdspower;
        });
    }, [assets, searchTerm, filterAdspower]);

    const handleBulkImport = async () => {
        const result = await bulkImportAssets();
        // Optionally show feedback based on result
        console.log('Bulk import result:', result);
        if (result.success) {
            setSelectedAssetIds(new Set()); // Clear selection after import
        }
    };

    // PRD §4.1 Library View: Refresh asset list and clear selection
    const handleRefresh = () => {
        fetchAssets(); // Re-fetch assets from the main process
        setSelectedAssetIds(new Set()); // Clear selection on refresh
    };

    // PRD §4.1 Library View: Handle batch deletion
    const handleBatchDelete = async () => {
        const idsToDelete = Array.from(selectedAssetIds);
        if (idsToDelete.length === 0 || !window.confirm(`Delete ${idsToDelete.length} selected assets?`)) {
            return;
        }
        console.log('Attempting to delete assets:', idsToDelete);
        try {
            // Perform deletions sequentially or adapt backend for batch delete
            for (const id of idsToDelete) {
                await deleteAsset(id);
            }
            setSelectedAssetIds(new Set()); // Clear selection after deletion
            await fetchAssets(); // Refresh list to reflect deletions
        } catch (err) {
            console.error('Error during batch delete:', err);
            // Show error feedback to user
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
            {/* PRD §4.1 Library View: Collapsible Left Sidebar */} 
            <aside className={`flex flex-col bg-gray-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0 border-r border-gray-700`}>
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
               
                {/* Filter Controls Area */} 
                <div className={`overflow-y-auto overflow-x-hidden ${isSidebarOpen ? 'flex-grow min-h-0 p-3 space-y-3' : 'p-4 flex flex-col items-center space-y-4 pt-6'}`}>
                     {/* Search - Only render content if open, keep icon otherwise */} 
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

                     {/* Adspower Filter - Only render content if open */} 
                     <div className={isSidebarOpen ? '' : 'w-full flex justify-center'}>
                         {isSidebarOpen ? (
                             <>
                                 <label htmlFor="filter-adspower" className={`block text-sm font-medium text-gray-300 mb-1`}>Adspower Profile</label>
                                 <input 
                                    id="filter-adspower"
                                    type="text" 
                                    placeholder="Filter by Adspower ID..." 
                                    value={filterAdspower}
                                    onChange={(e) => setFilterAdspower(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                                />
                             </>
                         ) : (
                            <button className="p-2 rounded hover:bg-gray-700" title="Filter Adspower"><FiSliders size={18}/></button>
                         )}
                     </div>

                     {/* Tag Filter Placeholder - Only render content if open */} 
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
                <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 flex-shrink-0 sticky top-0 z-10">
                    {/* Left Side: Batch Actions (visible when items selected) */} 
                    <div className="flex items-center space-x-2">
                         {selectedAssetIds.size > 0 ? (
                             <> 
                                 <span className="text-sm text-gray-400">{selectedAssetIds.size} selected</span>
                                 <button 
                                    onClick={handleBatchDelete}
                                    className="flex items-center px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-medium transition-colors duration-150"
                                    title="Delete Selected Assets"
                                >
                                    <FiTrash2 className="mr-1" size={14}/> Delete
                                </button>
                                {/* Add other batch actions like Edit Meta, Add Tags here */} 
                                <button 
                                    disabled 
                                    className="flex items-center px-2 py-1 bg-yellow-600 rounded text-white text-xs font-medium opacity-50 cursor-not-allowed"
                                    title="Batch Edit Metadata (Coming Soon)"
                                >
                                    <FiEdit className="mr-1" size={14}/> Edit Meta
                                </button>
                             </> 
                         ) : (
                             <span className="text-sm text-gray-500 italic">Select assets for batch actions</span>
                         )}
                    </div>
                    
                    {/* Right Side: Main Actions & View Toggle */} 
                    <div className="flex items-center space-x-2">
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
                        
                        {/* View Toggle - Ensure icons are centered */}
                        <div className="flex items-center text-sm">
                             <button 
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center justify-center px-2.5 py-1 border border-r-0 border-gray-600 rounded-l ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}`}
                                title="Grid View"
                            >
                                <FiGrid size={16}/>
                            </button>
                             <button 
                                onClick={() => setViewMode('list')}
                                className={`flex items-center justify-center px-2.5 py-1 border border-gray-600 rounded-r ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}`}
                                title="List View"
                            >
                                <FiList size={16}/>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Asset Display Area - Scrollable */} 
                <div className="flex-grow overflow-y-auto p-4">
                    {filteredAssets.length === 0 && !loading && (
                        <div className="text-center text-gray-500 mt-10">
                            <FiPackage size={48} className="mx-auto mb-4 text-gray-600"/>
                            <p>No assets found matching your criteria.</p>
                            {assets.length > 0 && (
                                <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                            )}
                        </div>
                    )}
                    
                    {/* PRD §4.1 Library View: Conditional Grid/List display */} 
                    {viewMode === 'grid' ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 content-start">
                            {filteredAssets.map((asset) => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset} 
                                    isSelected={selectedAssetIds.has(asset.id)}
                                    onSelect={handleSelectAsset}
                                />
                            ))}
                        </div>
                    ) : (
                         <div className="space-y-2">
                            {filteredAssets.map((asset) => (
                                <AssetListItem 
                                    key={asset.id} 
                                    asset={asset} 
                                    isSelected={selectedAssetIds.has(asset.id)}
                                    onSelect={handleSelectAsset}
                                />
                            ))}
                         </div>
                    )}
                </div>
            </main>
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
                <p className="whitespace-nowrap overflow-hidden text-ellipsis">Adspower: <span className="text-gray-300">{asset.adspower ?? 'N/A'}</span></p>
                 {/* TODO: Display custom fields/tags */} 
            </div>
        </div>
    );
};

// --- Asset List Item Component (Placeholder) --- 

interface AssetListItemProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
}

// PRD §4.1 Library View: Component for displaying a single asset list item (Tailwind)
const AssetListItem: React.FC<AssetListItemProps> = ({ asset, isSelected, onSelect }) => {
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect(asset.id, e.target.checked);
    };

    // Helper to format file size
    function formatBytes(bytes: number, decimals = 1): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    return (
        <div className={`flex items-center p-2 border rounded-lg shadow-sm bg-gray-800 ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 ring-opacity-50' : 'border-gray-700 hover:bg-gray-750'} transition-colors duration-150`}>
            {/* Checkbox */}
            <div className="flex-shrink-0 mr-3">
                <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={handleCheckboxChange} 
                    className="h-4 w-4 rounded text-blue-600 bg-gray-700 border-gray-500 focus:ring-blue-500 cursor-pointer"
                    aria-label={`Select ${asset.fileName}`}
                />
            </div>
            {/* Thumbnail */}
            <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded mr-3 flex items-center justify-center overflow-hidden">
                 {asset.thumbnailPath ? (
                    <img src={asset.thumbnailPath} alt="" className="w-full h-full object-cover" loading="lazy"/>
                ) : (
                    <FiEye size={20} className="text-gray-500"/>
                )}
            </div>
            {/* Main Info (takes most space) */} 
            <div className="flex-grow grid grid-cols-4 gap-2 text-sm overflow-hidden mr-3">
                <div className="truncate" title={asset.fileName}><strong className="text-gray-200">{asset.fileName}</strong></div>
                <div className="truncate text-gray-400" title={asset.advertiser ?? 'N/A'}>{asset.advertiser ?? '-'}</div>
                <div className="truncate text-gray-400" title={asset.niche ?? 'N/A'}>{asset.niche ?? '-'}</div>
                <div className="truncate text-gray-400" title={asset.adspower ?? 'N/A'}>{asset.adspower ?? '-'}</div>
            </div>
             {/* File Info & Actions (fixed width) */} 
            <div className="flex-shrink-0 flex items-center gap-4 text-xs text-gray-400">
                <span title={`Type: ${asset.mimeType}`}>{asset.mimeType?.split('/')[1] ?? 'File'}</span>
                <span title={`Size: ${asset.size} bytes`}>{formatBytes(asset.size)}</span>
                <span title={`Created: ${new Date(asset.createdAt).toLocaleDateString()}`}>{new Date(asset.createdAt).toLocaleDateString()}</span>
                 {/* Placeholder for inline actions */} 
                 <button disabled className="p-1 rounded hover:bg-gray-700 opacity-50" title="Edit (Coming Soon)"><FiEdit size={14}/></button>
                 <button disabled className="p-1 rounded hover:bg-gray-700 opacity-50" title="Delete (Use Batch)"><FiTrash2 size={14}/></button>
            </div>
        </div>
    );
};

// --- Remove old inline styles object --- 
// const styles: { [key: string]: React.CSSProperties } = { ... };

export default LibraryView; 