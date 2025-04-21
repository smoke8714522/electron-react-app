import React from 'react';
import AssetCard from './AssetCard';
import { AssetWithThumbnail } from '../hooks/useAssets';

interface AssetGridProps {
    assets: AssetWithThumbnail[];
    selectedAssetIds: Set<number>; // Use the Set directly for checking selection
    onSelect: (assetId: number, isSelected: boolean) => void;
    onHistory: (masterId: number) => void;
}

const AssetGrid: React.FC<AssetGridProps> = ({ assets, selectedAssetIds, onSelect, onHistory }) => {
    return (
        // PRD §4.1 Library View: Grid View - Added items-start and content-start
        // Copied class list directly from LibraryView.tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 items-start content-start">
            {assets.map(asset => (
                <AssetCard 
                    key={asset.id} 
                    asset={asset} 
                    isSelected={selectedAssetIds.has(asset.id)} // Check selection using the Set
                    onSelect={onSelect}
                    onHistory={onHistory}
                />
            ))}
        </div>
    );
};

export default AssetGrid; 