import React, { useRef } from 'react';
import { useDrag } from 'react-dnd';
import { FiEye, FiClock, FiInfo, FiTag, FiUser, FiAward, FiGitMerge, FiDatabase, FiCalendar } from 'react-icons/fi';
import { AssetWithThumbnail } from '../hooks/useAssets';

const ItemTypes = {
    ASSET: 'asset',
};

// --- Helper Functions (Copied from App.tsx / AssetCard.tsx) ---
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString(); // Or customize format as needed
    } catch (error) {
        return 'Invalid Date';
    }
}
// --- End Helper Functions ---

interface AssetListRowProps {
    asset: AssetWithThumbnail;
    isSelected: boolean;
    onSelect: (id: number, selected: boolean) => void;
    onHistory: (masterId: number) => void;
}

const AssetListRow: React.FC<AssetListRowProps> = ({ asset, isSelected, onSelect, onHistory }) => {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: ItemTypes.ASSET,
        item: { id: asset.id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [asset.id]);

    const handleHistoryClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onHistory(asset.id);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect(asset.id, e.target.checked);
    };

    const rowClasses = `
    border-b border-gray-700 hover:bg-gray-750 transition-colors duration-150 
    ${isSelected ? 'bg-gray-700' : 'bg-gray-800'} 
    ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}
  `;

    const elementRef = useRef<HTMLTableRowElement>(null);
    const handleRef = (node: HTMLTableRowElement | null) => {
        dragRef(node);
        elementRef.current = node;
    };

    return (
        <tr ref={handleRef} className={rowClasses}>
            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={handleCheckboxChange}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-800 focus:ring-1"
                />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm">
                <div className="w-16 h-10 bg-gray-700 flex items-center justify-center rounded overflow-hidden">
                    {asset.thumbnailPath ? (
                        <img src={asset.thumbnailPath} alt="" className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                        <FiDatabase className="text-gray-500" />
                    )}
                </div>
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 truncate max-w-xs" title={asset.fileName}>{asset.fileName}</td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">{asset.year ?? '-'}</td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs" title={asset.advertiser ?? ''}>{asset.advertiser ?? '-'}</td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs" title={asset.niche ?? ''}>{asset.niche ?? '-'}</td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 text-right">
                {asset.shares !== null ? asset.shares : '-'}
                {asset.master_id === null && asset.accumulatedShares !== null && asset.accumulatedShares !== asset.shares && (
                    <span className="ml-1 text-gray-500" title={`Accumulated: ${asset.accumulatedShares}`}>({asset.accumulatedShares})</span>
                )}
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">{formatDate(asset.createdAt)}</td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 text-center">
                {asset.master_id === null && asset.versionCount && asset.versionCount > 1 ? (
                    <button 
                        onClick={handleHistoryClick}
                        className="p-1.5 bg-gray-700 rounded-full text-gray-300 hover:bg-gray-600 hover:text-white transition-colors mx-auto flex items-center justify-center" 
                        title={`View ${asset.versionCount - 1} Version(s)`}
                    >
                        <FiGitMerge size={16} />
                    </button>
                ) : (
                    <span className="text-gray-600">-</span> 
                )}
            </td>
        </tr>
    );
};

export default AssetListRow; 