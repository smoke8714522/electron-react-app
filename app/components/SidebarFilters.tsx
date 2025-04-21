import React from 'react';
import { FiSearch, FiTag, FiCalendar, FiBriefcase, FiTarget, FiTrendingUp } from 'react-icons/fi';
import { FetchFilters } from '../hooks/useAssets';

interface SidebarFiltersProps {
  isCollapsed: boolean;
  filters: { 
    year?: number | null;
    advertiser?: string | null;
    niche?: string | null;
    sharesRange?: [number | null, number | null] | undefined;
  };
  handleFilterChange: (filterName: keyof FetchFilters, value: string | number | null | [number | null, number | null]) => void;
  distinctYears: number[];
  distinctAdvertisers: string[];
  distinctNiches: string[];
  searchTerm: string; // Assuming searchTerm state is managed in LibraryView
  handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // Assuming handler is in LibraryView
}

const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  isCollapsed,
  filters,
  handleFilterChange,
  distinctYears,
  distinctAdvertisers,
  distinctNiches,
  searchTerm,
  handleSearchChange
}) => {
  // Helper to handle dropdown changes and convert empty string to null
  const handleSelectChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
    filterName: keyof FetchFilters
  ) => {
    const value = event.target.value;
    // Ensure 'year' is parsed as a number or null
    const processedValue = filterName === 'year' 
      ? (value === '' ? null : parseInt(value, 10))
      : (value === '' ? null : value);
    handleFilterChange(filterName, processedValue as any); // Use 'as any' to bypass strict check, type is correct logic-wise
  };

  // Updated helper to handle number input changes for shares range
  const handleSharesRangeChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    index: 0 | 1 // 0 for min, 1 for max
  ) => {
    const value = event.target.value;
    const numberValue = parseInt(value, 10);
    const currentRange = filters.sharesRange || [null, null];
    const newRange: [number | null, number | null] = [...currentRange];
    newRange[index] = value === '' || isNaN(numberValue) ? null : numberValue;

    // If both are null, pass null instead of [null, null]
    if (newRange[0] === null && newRange[1] === null) {
        handleFilterChange('sharesRange', null);
    } else {
        handleFilterChange('sharesRange', newRange);
    }
  };

  return (
    // This div wraps the actual filter controls and handles internal scrolling
    // Classes `overflow-y-auto flex-1 min-h-0` are kept here
    <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <FiSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isCollapsed ? 'left-1/2 -translate-x-1/2' : ''}`} />
        {!isCollapsed && (
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>

      {/* Year Filter */}
      <div className="relative">
        <FiCalendar className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isCollapsed ? 'left-1/2 -translate-x-1/2' : ''}`} />
        {!isCollapsed && (
          <select
            value={filters.year ?? ''} // Handle potential null/undefined
            onChange={(e) => handleSelectChange(e, 'year')}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
          >
            <option value="">All Years</option>
            {distinctYears.sort((a, b) => b - a).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Advertiser Filter */}
      <div className="relative">
        <FiBriefcase className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isCollapsed ? 'left-1/2 -translate-x-1/2' : ''}`} />
        {!isCollapsed && (
          <select
            value={filters.advertiser ?? ''} // Handle potential null/undefined
            onChange={(e) => handleSelectChange(e, 'advertiser')}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
          >
            <option value="">All Advertisers</option>
            {distinctAdvertisers.sort().map((advertiser) => (
              <option key={advertiser} value={advertiser}>
                {advertiser}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Niche Filter */}
      <div className="relative">
        <FiTarget className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isCollapsed ? 'left-1/2 -translate-x-1/2' : ''}`} />
        {!isCollapsed && (
          <select
            value={filters.niche ?? ''} // Handle potential null/undefined
            onChange={(e) => handleSelectChange(e, 'niche')}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
          >
            <option value="">All Niches</option>
            {distinctNiches.sort().map((niche) => (
              <option key={niche} value={niche}>
                {niche}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Shares Filter - Reverted Structure (No Icon when expanded, no padding) */}
      <div> {/* Removed relative positioning */} 
         {/* Icon removed */} 
         {!isCollapsed && (
          <div className="space-y-1"> {/* Use original inner structure */} 
            <label className="block text-sm font-medium text-gray-300 mb-1">Shares</label> 
            <div className="flex space-x-2"> 
              <input
                type="number"
                placeholder="Min"
                value={filters.sharesRange?.[0] ?? ''}
                onChange={(e) => handleSharesRangeChange(e, 0)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.sharesRange?.[1] ?? ''}
                onChange={(e) => handleSharesRangeChange(e, 1)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
         )}
         {/* Add placeholder for collapsed icon if needed, like original */} 
         {isCollapsed && (
            <div className="flex justify-center">
               <FiTrendingUp className="text-gray-400" title="Filter by Shares"/>
            </div>
         )}
      </div>

      {/* Tag Filter Placeholder - Reverted Structure (No Icon when expanded, no padding) */}
      <div> {/* Removed relative positioning */} 
        {/* Icon removed */} 
        {!isCollapsed && (
          <div> 
             <label className="block text-sm font-medium text-gray-300 mb-1">Tags (Future)</label> 
             <div className="mt-1 p-2 rounded-md border border-dashed border-gray-600 bg-gray-700 text-gray-400 italic"> 
               Tag filtering coming soon...
             </div>
          </div>
        )}
         {/* Add placeholder for collapsed icon if needed, like original */} 
         {isCollapsed && (
            <div className="flex justify-center">
               <FiTag className="text-gray-400" title="Filter by Tags"/>
            </div>
         )}
      </div>
    </div>
  );
};

export default SidebarFilters;