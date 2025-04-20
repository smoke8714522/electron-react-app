import React, { useState, useEffect } from 'react';
import { FiSave, FiXCircle } from 'react-icons/fi';
import { Asset } from '../hooks/useAssets'; // Assuming Asset type is defined here

// PRD §4.1 Library View: Define the fields available for bulk editing (using shares)
type EditableAssetFields = Pick<Asset, 'year' | 'advertiser' | 'niche' | 'shares'>;
export type BulkUpdatePayload = Partial<EditableAssetFields>;

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: BulkUpdatePayload) => Promise<void>; // Async to allow showing loading state
    selectedCount: number;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onSave, selectedCount }) => {
    // State for each field's value
    const [year, setYear] = useState<string>('');
    const [advertiser, setAdvertiser] = useState<string>('');
    const [niche, setNiche] = useState<string>('');
    const [shares, setShares] = useState<string>(''); // Renamed from adspower

    // State for the "Apply" checkboxes
    const [applyYear, setApplyYear] = useState<boolean>(false);
    const [applyAdvertiser, setApplyAdvertiser] = useState<boolean>(false);
    const [applyNiche, setApplyNiche] = useState<boolean>(false);
    const [applyShares, setApplyShares] = useState<boolean>(false); // Renamed from applyAdspower

    // Loading state for the save operation
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Reset form when modal opens or closes
    useEffect(() => {
        if (!isOpen) {
            setYear('');
            setAdvertiser('');
            setNiche('');
            setShares(''); // Renamed from setAdspower
            setApplyYear(false);
            setApplyAdvertiser(false);
            setApplyNiche(false);
            setApplyShares(false); // Renamed from setApplyAdspower
            setIsSaving(false);
        }
    }, [isOpen]);

    // PRD §4.1 Library View: Handle save action
    const handleSave = async () => {
        const updates: BulkUpdatePayload = {};
        if (applyYear) updates.year = year === '' ? null : parseInt(year, 10) || null;
        if (applyAdvertiser) updates.advertiser = advertiser || null;
        if (applyNiche) updates.niche = niche || null;
        if (applyShares) {
            const numShares = parseInt(shares, 10);
            updates.shares = shares === '' ? null : (isNaN(numShares) ? null : numShares);
        }

        // Check if any field is selected to apply
        if (!applyYear && !applyAdvertiser && !applyNiche && !applyShares) {
            alert('Please check at least one field to apply.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(updates);
            onClose(); // Close modal on successful save
        } catch (error) {
            console.error("Bulk update failed:", error);
            alert("An error occurred during the bulk update. Please check the console.");
            // Optionally keep modal open on error
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        // Modal backdrop
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            {/* Modal container */}
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md text-white overflow-hidden">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-semibold">Edit Metadata for {selectedCount} Assets</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" title="Close">
                        <FiXCircle size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <p className="text-sm text-gray-400 mb-4">
                        Check the box next to a field to apply its value to all selected assets. Leave fields blank to clear the value.
                    </p>

                    {/* Year Field */}
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="applyYear"
                            checked={applyYear}
                            onChange={(e) => setApplyYear(e.target.checked)}
                            className="h-5 w-5 rounded text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <label htmlFor="applyYear" className="w-24 flex-shrink-0 text-sm font-medium">Year:</label>
                        <input
                            type="number"
                            id="year"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            placeholder="e.g., 2023"
                            className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!applyYear}
                        />
                    </div>

                    {/* Advertiser Field */}
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="applyAdvertiser"
                            checked={applyAdvertiser}
                            onChange={(e) => setApplyAdvertiser(e.target.checked)}
                            className="h-5 w-5 rounded text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <label htmlFor="applyAdvertiser" className="w-24 flex-shrink-0 text-sm font-medium">Advertiser:</label>
                        <input
                            type="text"
                            id="advertiser"
                            value={advertiser}
                            onChange={(e) => setAdvertiser(e.target.value)}
                            placeholder="Advertiser name"
                            className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!applyAdvertiser}
                        />
                    </div>

                    {/* Niche Field */}
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="applyNiche"
                            checked={applyNiche}
                            onChange={(e) => setApplyNiche(e.target.checked)}
                            className="h-5 w-5 rounded text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <label htmlFor="applyNiche" className="w-24 flex-shrink-0 text-sm font-medium">Niche:</label>
                        <input
                            type="text"
                            id="niche"
                            value={niche}
                            onChange={(e) => setNiche(e.target.value)}
                            placeholder="Product niche"
                            className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!applyNiche}
                        />
                    </div>

                    {/* Shares Field */}
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="applyShares"
                            checked={applyShares}
                            onChange={(e) => setApplyShares(e.target.checked)}
                            className="h-5 w-5 rounded text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <label htmlFor="applyShares" className="w-24 flex-shrink-0 text-sm font-medium">Shares:</label>
                        <input
                            type="number"
                            id="shares"
                            min="0"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            placeholder="e.g., 100"
                            className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!applyShares}
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end items-center p-4 border-t border-gray-700 bg-gray-800 space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !(applyYear || applyAdvertiser || applyNiche || applyShares)}
                        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiSave className="mr-1.5" size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal; 