import React from 'react';
import { FiEye, FiClock } from 'react-icons/fi';
import { AssetWithThumbnail } from '../hooks/useAssets';

interface AssetListRowProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (assetId: number, isSelected: boolean) => void;
    onHistory: (masterId: number) => void;
}

const AssetListRow: React.FC<AssetListRowProps> = ({ asset, isSelected, onSelect, onHistory }) => {
    const handleHistoryClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent potential row click handlers (if any added later)
        onHistory(asset.id);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect(asset.id, e.target.checked);
    };

    return (
        <tr key={asset.id} className={`hover:bg-gray-800 ${isSelected ? 'bg-blue-900/50' : ''}`}>
            <td className="px-3 py-2 whitespace-nowrap">
                <input 
                    type="checkbox" 
                    className="rounded"
                    checked={isSelected} 
                    onChange={handleCheckboxChange}
                />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                {/* Consistent thumbnail rendering */} 
                <div className="w-16 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                    {asset.thumbnailPath ? (
                        <img 
                            src={asset.thumbnailPath + `?${Date.now()}`} // Append timestamp 
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
            {/* Consistent display of accumulated/regular shares */} 
            <td 
                className="px-3 py-2 text-sm text-gray-400 font-medium"
                title={asset.versionCount && asset.versionCount > 1 ? `Accumulated: ${asset.accumulatedShares?.toLocaleString()}` : `Shares: ${asset.shares?.toLocaleString()}`}
            >
                {asset.versionCount && asset.versionCount > 1 ? asset.accumulatedShares?.toLocaleString() : asset.shares?.toLocaleString() ?? '-'}
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                <button 
                    onClick={handleHistoryClick}
                    className="text-blue-400 hover:text-blue-300 p-1 hover:bg-gray-700 rounded"
                    title="View History"
                >
                    <FiClock size={16}/>
                </button>
                {/* Could add edit/delete buttons here too if needed */}
            </td>
        </tr>
    );
};

export default AssetListRow; 