import React from 'react';
import AssetListRow from './AssetListRow';
import { AssetWithThumbnail, FetchSort } from '../hooks/useAssets';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';

// Define Sortable Columns Type (non-optional for active sorting)
type SortableColumn = Extract<FetchSort['sortBy'], 'fileName' | 'year' | 'shares' | 'accumulatedShares' | 'createdAt'>;

interface AssetListProps {
    assets: AssetWithThumbnail[];
    selectedAssetIds: Set<number>;
    onSelect: (assetId: number, isSelected: boolean) => void;
    onHistory: (masterId: number) => void;
    // Adjust sortConfig to allow potentially undefined sort (though LibraryView provides defaults)
    sortConfig: { sortBy?: SortableColumn; sortOrder?: FetchSort['sortOrder'] }; 
    // Ensure handleSort expects a defined SortableColumn as passed by LibraryView
    handleSort: (sortByValue: SortableColumn) => void; 
    handleSelectAll: (isSelected: boolean) => void;
    isAllSelected: boolean;
}

const AssetList: React.FC<AssetListProps> = ({ 
    assets, 
    selectedAssetIds, 
    onSelect, 
    onHistory, 
    sortConfig, 
    handleSort, 
    handleSelectAll,
    isAllSelected
}) => {

    // Helper to render sort icons
    const renderSortIcon = (column: SortableColumn) => {
        if (sortConfig.sortBy !== column) {
            return null; // No icon if not the currently sorted column
        }
        return sortConfig.sortOrder === 'ASC' ? <FiChevronUp className="inline ml-1" /> : <FiChevronDown className="inline ml-1" />;
    };

    // Helper to create sortable table header
    const SortableHeader: React.FC<{ column: SortableColumn; label: string; className?: string }> = ({ column, label, className }) => (
        <th 
            scope="col" 
            className={`px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer ${className || ''}`}
            onClick={() => handleSort(column)}
        >
            {label}
            {renderSortIcon(column)}
        </th>
    );

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800 sticky top-0 z-10">
                    <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10">
                            <input 
                                type="checkbox" 
                                className="rounded"
                                checked={isAllSelected} 
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                aria-label="Select all assets"
                            />
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Preview</th>
                        <SortableHeader column="fileName" label="Filename" />
                        <SortableHeader column="year" label="Year" />
                        {/* Advertiser and Niche might not be directly sortable via API yet, keep as non-sortable for now */}
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Advertiser</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Niche</th>
                        <SortableHeader column="shares" label="Shares" />
                        <SortableHeader column="accumulatedShares" label="Total Shares" /> {/* Updated label for clarity */}
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-850 divide-y divide-gray-700">
                    {assets.map(asset => (
                        <AssetListRow 
                            key={asset.id} 
                            asset={asset} 
                            isSelected={selectedAssetIds.has(asset.id)} 
                            onSelect={onSelect} 
                            onHistory={onHistory} 
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AssetList; 