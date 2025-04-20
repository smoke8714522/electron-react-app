import React, { useState, useMemo } from 'react';
import { useAssets, AssetWithThumbnail } from '../hooks/useAssets';

// PRD §4.1 Library View: Define the main library view component
const LibraryView: React.FC = () => {
    const { assets, loading, error, bulkImportAssets } = useAssets();
    // PRD §4.1 Library View: State for multi-select
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
    // PRD §4.1 Library View: State for search/filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAdspower, setFilterAdspower] = useState('');

    // Handle selection change for an asset
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

    // Memoized filtering logic
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesSearch = searchTerm === '' || 
                                  asset.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (asset.advertiser && asset.advertiser.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                  (asset.niche && asset.niche.toLowerCase().includes(searchTerm.toLowerCase()));
                                  // TODO: Extend search to include custom fields/tags when implemented

            const matchesAdspower = filterAdspower === '' || 
                                    (asset.adspower && asset.adspower.toLowerCase().includes(filterAdspower.toLowerCase()));

            return matchesSearch && matchesAdspower;
        });
    }, [assets, searchTerm, filterAdspower]);

    // Simple placeholder for a loading state
    if (loading) {
        return <div>Loading assets...</div>;
    }

    // Simple placeholder for an error state
    if (error) {
        return <div style={{ color: 'red' }}>Error loading assets: {error}</div>;
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2>Asset Library</h2>
            
            {/* PRD §4.1 Library View: Toolbar for actions and filtering */} 
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={bulkImportAssets}>Bulk Import Assets</button>
                <input 
                    type="text" 
                    placeholder="Search by name, advertiser, niche..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '5px' }}
                />
                <input 
                    type="text" 
                    placeholder="Filter by Adspower ID..." 
                    value={filterAdspower}
                    onChange={(e) => setFilterAdspower(e.target.value)}
                    style={{ padding: '5px' }}
                />
                 {/* Placeholder for batch actions based on selection */} 
                 {selectedAssetIds.size > 0 && (
                    <button disabled>Actions ({selectedAssetIds.size} selected)</button>
                 )}
            </div>

            {/* PRD §4.1 Library View: Grid display of assets */} 
            <div style={styles.gridContainer}>
                {filteredAssets.map((asset) => (
                    <AssetCard 
                        key={asset.id} 
                        asset={asset} 
                        isSelected={selectedAssetIds.has(asset.id)}
                        onSelect={handleSelectAsset}
                    />
                ))}
            </div>
        </div>
    );
};

// --- Asset Card Component --- 

interface AssetCardProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
}

// PRD §4.1 Library View: Component for displaying a single asset card
const AssetCard: React.FC<AssetCardProps> = ({ asset, isSelected, onSelect }) => {
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect(asset.id, e.target.checked);
    };

    return (
        <div style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}>
            {/* PRD §4.1 Library View: Multi-select checkbox */} 
            <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={handleCheckboxChange} 
                style={styles.checkbox} 
            />
            {/* PRD §4.3 Thumbnail Service: Display thumbnail */} 
            <div style={styles.thumbnailContainer}>
                {asset.thumbnailPath ? (
                    <img src={asset.thumbnailPath} alt={`${asset.fileName} thumbnail`} style={styles.thumbnail} />
                ) : (
                    // Placeholder if no thumbnail is available
                    <div style={styles.thumbnailPlaceholder}>No Preview</div> 
                )}
            </div>
            {/* PRD §4.1 Library View: Display asset metadata */} 
            <div style={styles.metadataContainer}>
                <strong title={asset.fileName} style={styles.fileName}>{asset.fileName}</strong>
                <small>Year: {asset.year ?? 'N/A'}</small>
                <small>Advertiser: {asset.advertiser ?? 'N/A'}</small>
                <small>Niche: {asset.niche ?? 'N/A'}</small>
                <small>Adspower: {asset.adspower ?? 'N/A'}</small>
                 {/* TODO: Display custom fields/tags */} 
            </div>
        </div>
    );
};

// --- Styles --- 
// Basic inline styles for layout - consider moving to CSS modules or styled-components
const styles: { [key: string]: React.CSSProperties } = {
    gridContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', // Responsive grid
        gap: '15px',
    },
    card: {
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '10px',
        backgroundColor: '#f9f9f9',
        position: 'relative', // For checkbox positioning
        display: 'flex',
        flexDirection: 'column',
    },
    cardSelected: {
        borderColor: '#007bff', // Highlight selected cards
        boxShadow: '0 0 5px rgba(0, 123, 255, 0.5)',
    },
    checkbox: {
        position: 'absolute',
        top: '5px',
        right: '5px',
    },
    thumbnailContainer: {
        width: '100%',
        height: '150px', // Fixed height for alignment
        backgroundColor: '#eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px',
        overflow: 'hidden', // Hide parts of image that don't fit aspect ratio
    },
    thumbnail: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'cover', // Cover the container space
    },
    thumbnailPlaceholder: {
        color: '#666',
        fontSize: '0.9em',
    },
    metadataContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        fontSize: '0.85em', // Smaller font for metadata
        overflow: 'hidden', // Prevent long text overflow issues
    },
    fileName: {
        fontSize: '1em', // Slightly larger for filename
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis', // Add ellipsis for long filenames
        display: 'block',
        marginBottom: '4px'
    }
};

export default LibraryView; 