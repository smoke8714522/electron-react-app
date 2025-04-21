import React from 'react';
import { FiEye, FiClock, FiGitBranch } from 'react-icons/fi'; // Add necessary icons
import { AssetWithThumbnail } from '../hooks/useAssets'; // Corrected import path

// Copied directly from LibraryView.tsx
interface AssetCardProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
    onHistory: (masterId: number) => void; // Prop for history action
}

// PRD §4.1 Library View: Asset card component
// Wrapped with React.memo as requested
const AssetCard: React.FC<AssetCardProps> = React.memo(({ asset, isSelected, onSelect, onHistory }) => {
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

    // Determine display logic based on versionCount
    const hasVersions = asset.versionCount != null && asset.versionCount > 1;

    // Define display shares based on version count
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
                 {/* Always display version count badge, showing 'v1' if no versions */}
                 <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shadow ${hasVersions ? 'bg-teal-600 text-teal-100' : 'bg-gray-600 text-gray-200'}`}
                    title={hasVersions ? `Versions: ${asset.versionCount}` : 'Master Asset (v1)'}
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
                        title={`${sharesLabel}: ${displaySharesFormatted}${hasVersions ? ' (Accumulated: Master + Versions)' : ''}`}
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
                    title="View History" // Added title for accessibility/tooltip
                >
                    <FiClock size={14} />
                </button>
                {/* Add other action buttons here if needed */}
            </div>
        </div>
    );
}); // Closing React.memo wrapper

export default AssetCard; 