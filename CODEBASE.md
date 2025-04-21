# Codebase Overview (Ad-Vault Fork)

This document provides an overview of the codebase structure, key components, and implementation details for the Ad-Vault application, forked from `guasam/electron-react-app`.

*Updated: 2024-07-29* <!-- Update Date -->

## Directory Structure

The project follows a structure separating the Electron main process, the React renderer process, and potentially shared code (though the `shared/` directory was not found in this specific fork).

```
/
├── app/                  # React Renderer Source Code
│   ├── components/       # React Components (e.g., App.tsx, LibraryView.tsx, BulkEditModal.tsx, SidebarFilters.tsx, VersionHistoryModal.tsx, BulkGroupModal.tsx, AssetCard.tsx, AssetList.tsx, AssetListRow.tsx)
│   ├── hooks/            # React Hooks (e.g., useAssets.ts)
│   ├── services/         # Renderer-specific services (if any)
│   ├── styles/           # CSS Styles (app.css, tailwind.css)
│   └── renderer.tsx      # React entry point
│   └── index.d.ts        # Type definitions for renderer
├── lib/
│   ├── main/             # Electron Main Process Source Code
│   │   ├── app.ts          # BrowserWindow creation logic
│   │   ├── main.ts         # Electron entry, IPC handlers, DB logic
│   │   └── ThumbnailService.ts # Thumbnail generation logic
│   └── preload/          # Electron Preload Scripts
│       ├── preload.ts      # Preload entry, contextBridge setup
│       └── api.ts          # Generic IPC helper definitions
├── main/                 # Contains main process related files like schema
│   └── schema.ts         # Database schema and Asset/CustomField types
├── out/                  # Build output directory
├── public/              # Static assets served at `/` (via `publicDir` in Vite)
│   └── cache/             # Generated thumbnails and other runtime assets
│       └── thumbnails/    # JPEG thumbnails (`<id>.jpg`)
├── resources/            # Static assets (e.g., icons)
├── vault/                # Directory for storing imported asset files (gitignored)
├── electron.vite.config.ts # Vite configuration for Electron
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # Base TypeScript configuration
├── tsconfig.node.json    # TypeScript config for main process
├── tsconfig.web.json     # TypeScript config for renderer process
└── README.md             # Project README
```

## Key Component Locations

*   **Electron Main App Logic**: `lib/main/app.ts`
    *   Handles `BrowserWindow` creation.
    *   Configured to create a frameless, resizable window (`frame: false`, `titleBarStyle: 'hidden'`) to allow for a custom UI (PRD §5 Non-Functional Requirements).
    *   Window starts maximized (`mainWindow.maximize()`) to provide a full-window experience (PRD §5 Non-Functional Requirements).
    *   Fullscreen support enabled (`fullscreenable: true`) and added native application menu with a 'View' menu containing a 'Toggle Fullscreen' item (`role: 'togglefullscreen'`).
*   **Electron Main Entry**: `lib/main/main.ts`
    *   Handles app lifecycle events.
    *   Initializes the SQLite database (`vaultDatabase.db` in user data path).
    *   Defines IPC handlers for communication with the renderer process.
    *   Sets the vault root directory to `/vault/` within the project root.
    *   Handles file copying, metadata extraction, and thumbnail generation triggers.
    *   IPC handlers, including `get-master-assets` for bulk grouping dropdown.
*   **Database Schema**: `main/schema.ts`
    *   Defines the `Asset` TypeScript interface. Fields include: `id`, `fileName`, `filePath`, `mimeType`, `size`, `createdAt`, `year`, `advertiser`, `niche`, `shares` (renamed from `adspower`, now `INTEGER`), `master_id`, `version_no`. **Note:** This interface (and related interfaces like `AssetWithThumbnail`) are extended in other parts of the code (e.g., `lib/main/main.ts`, `app/hooks/useAssets.ts`) to include calculated fields like `versionCount` and `accumulatedShares` returned by the `get-assets` handler.
    *   Defines the `CustomField` TypeScript interface.
    *   Contains the `initializeDatabase` function for `assets` and `custom_fields` tables. Includes migration logic to rename `adspower` column to `shares` and add version control columns.
*   **Version Control & Grouping (Database Schema)**: Implemented in `main/schema.ts`.
    *   `assets` table includes: `master_id` (INTEGER, NULL, FK -> assets.id ON DELETE SET NULL), `version_no` (INTEGER, NOT NULL, DEFAULT 1).
    *   Indices `idx_assets_master` and `idx_assets_master_version` facilitate version querying.
    *   Database migrations handle schema changes via `PRAGMA user_version`.
    *   `get-assets` IPC handler uses `LEFT JOIN` and `GROUP BY a.id` to calculate `accumulatedShares` and `versionCount` for master assets (`WHERE a.master_id IS NULL`).
    *   **UI Implications**: `LibraryView.tsx` displays only master assets. `AssetCard.tsx` shows `versionCount` badge and conditional `accumulatedShares` value. `AssetList.tsx` shows `accumulatedShares`. History buttons trigger `VersionHistoryModal.tsx`.
    *   `add-to-group` IPC handler used for drag-and-drop and bulk grouping.
*   **Drag-and-Drop & Bulk Grouping** (New Section):
    *   **Implementation**: Uses `react-dnd` and `react-dnd-html5-backend`.
    *   **Provider**: `<DndProvider>` wraps the application in `app/components/App.tsx`.
    *   **Draggable Items**: `AssetCard.tsx` and `AssetListRow.tsx` implement `useDrag` (item type: `'ASSET'`, item data: `{ id: number }`).
    *   **Drop Targets**: `AssetCard.tsx` implements `useDrop` for master assets (`asset.master_id === null`). It accepts `'ASSET'`, checks `canDrop` (not self), and calls the `addToGroup` prop on `drop`.
    *   **Bulk Grouping**: 
        *   A "Group under..." button (<FiPlusSquare>) appears in the `LibraryView.tsx` toolbar when multiple assets are selected.
        *   Opens `BulkGroupModal.tsx`.
    *   **Bulk Group Modal** (`app/components/BulkGroupModal.tsx` - New):
        *   Props: `isOpen`, `onClose`, `onSave` (calls `bulkAddToGroup`), `getMasterAssets`, `selectedIds`.
        *   Fetches potential master assets using `getMasterAssets`, excluding already selected assets.
        *   Provides a searchable (debounced input) and selectable list (`<select>`) of master assets.
        *   On confirm, calls the `onSave` prop (`bulkAddToGroup`) with the list of `selectedIds` and the chosen `masterId`.
*   **Version History Modal** (`app/components/VersionHistoryModal.tsx`):
    *   Props: `{ masterId: number | null; isOpen: boolean; onClose: () => void }` plus various action handlers passed from `LibraryView.tsx` via `useAssets` hook (e.g., `getVersions`, `createVersion`, `deleteAsset`, etc.).
    *   Fetches versions using `getVersions`. Displays in a table (Checkbox, Preview, Filename, Type, Size, Created, Year, Advertiser, Niche, Shares, Version).
    *   Supports multi-select and footer actions (Add Version, Promote Selected, Remove From Group, Bulk Edit, Delete Selected) with appropriate confirmations and disabled states.
    *   Applies dark mode styling (`bg-gray-900`, etc.)
    *   Refreshes its own data and triggers main library refresh (`fetchAssets`) after successful actions.
    *   Receives additional props (`getVersions`, `createVersion`, `deleteAsset`, `bulkUpdateAssets`, `addToGroup`, `removeFromGroup`, `promoteVersion`, `getMasterAssets`, `bulkAddToGroup`, `fetchAssets`) to manage versions and potentially trigger nested bulk actions (though bulk group within history might be disabled/re-evaluated).
*   **Thumbnail Service**: `lib/main/ThumbnailService.ts`
    *   Generates thumbnails using `sharp` (images), `ffmpeg-static` (videos), `magick` CLI + Ghostscript (PDFs).
    *   Saves to `public/cache/thumbnails/<asset-id>.jpg`.
*   **IPC Handlers**: Defined in `lib/main/main.ts`.
    *   `get-assets`: Fetches master assets (`a.master_id IS NULL`), calculates `accumulatedShares`, `versionCount`. Accepts filters (`year`, `advertiser`, `niche`, `sharesMin`, `sharesMax`) and sorting (`fileName`, `year`, `shares`, `createdAt`, `accumulatedShares`). Returns `Promise<AssetWithThumbnail[]>`. Note: `shares` filter uses the master's own `shares`, not accumulated.
    *   `open-file-dialog`: Opens file picker.
    *   `create-asset`: Copies file, extracts metadata, inserts as master (`master_id = NULL`, `version_no = 1`), triggers thumbnail generation. Returns `Promise<{ success, asset?, error? }>`. Result includes `accumulatedShares` (master's own initially) and `versionCount` (1 initially).
    *   `bulk-import-assets`: Multi-select dialog, calls `create-asset` logic for each file. Returns `Promise<{ success, importedCount, assets?, errors[] }>`. 
    *   `update-asset`: Updates single asset record.
    *   `delete-asset`: Deletes single asset record, file, and thumbnail. Does *not* cascade to versions.
    *   `create-version`: Copies file, clones master metadata, inserts new asset record with `master_id` set and next `version_no`. Triggers thumbnail generation. Returns `Promise<{ success, newId?, error? }>`. 
    *   `get-versions`: Fetches all assets with a specific `master_id`. Returns `Promise<{ success, assets?, error? }>`. 
    *   `add-to-group`: Sets `master_id` and `version_no` on an existing master asset to make it a version of another master. Returns `Promise<{ success, error? }>`. 
    *   `remove-from-group`: Sets `master_id = NULL`, `version_no = 1` on a version asset, making it a master again. Returns `Promise<{ success, error? }>`. 
    *   `promote-version`: **Stub handler.** Returns `Promise<{ success: true }>`. 
    *   `get-master-assets`: (New) Fetches master assets (`id`, `fileName`) for bulk grouping, optionally filtering by `fileName`.
    *   `add-to-group`: Sets `master_id` and `version_no`. Used by DnD drop and `bulkAddToGroup` hook.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes `window.api` with typed methods (e.g., `api.getAssets`, `api.createAsset`) and a generic `invoke`.
*   **React App Entry**: `app/renderer.tsx`
    *   Renders the main React component (`App`).
*   **Main React Component**: `app/components/App.tsx`
    *   Top-level UI, Tailwind CSS, Flexbox for edge-to-edge layout.
    *   Simple top navigation bar to switch between 'Dashboard' (basic view) and 'Library' (`LibraryView`).
    *   Wraps the app in `<DndProvider backend={HTML5Backend}>`.
    *   Uses `useAssets` hook to provide state and functions as props to `LibraryView`.
*   **Main Library View Component**: `app/components/LibraryView.tsx` (Refactored)
    *   Main view for browsing/managing assets, styled with Tailwind.
    *   Uses `useAssets` hook for state management and actions.
    *   Features a two-pane layout (Flexbox):
        *   **Collapsible Left Sidebar** (`<aside>`): Houses the `SidebarFilters` component. Width transitions (`w-64`/`w-16`), controlled by `isSidebarOpen` state. Includes a header with a toggle button.
        *   **Main Content Area** (`<main>`): Takes remaining width (`flex-1`), manages its own scrolling (`overflow-y-auto`). Contains a sticky top toolbar and the asset display area.
            *   **Sticky Top Toolbar**: Contains main action buttons ("Bulk Import", "Refresh"), a "Sort by" dropdown, a "Grid/List" view toggle, and conditional batch action controls ("X selected", "Edit Metadata", "Delete Selected").
            *   **Asset Display Area**: Scrollable (`overflow-y-auto`). Renders either `AssetGrid.tsx` or `AssetList.tsx` based on `viewMode` state.
    *   Manages asset selection state (`selectedAssetIds`) and controls visibility of `BulkEditModal` and `VersionHistoryModal`.
    *   Manages filter state (`filters`), sort state (`sort`), and search term state (`searchTerm`). Passes these and relevant handlers down to `SidebarFilters` and other child components.
    *   Filtering/sorting changes trigger re-fetch via `useEffect` calling `fetchAssets`.
    *   Toolbar includes conditional "Group under..." button triggering `BulkGroupModal`.
    *   Manages modal states (`isBulkEditModalOpen`, `isBulkGroupModalOpen`, `isHistoryModalOpen`).
    *   Passes `addToGroup`, `getMasterAssets`, `bulkAddToGroup` and other necessary functions down to child components/modals (`AssetGrid`, `AssetList`, `BulkGroupModal`, `VersionHistoryModal`).
*   **Sidebar Filters Component**: `app/components/SidebarFilters.tsx` (New)
    *   **Purpose**: Contains the filter controls previously inline within `LibraryView.tsx`'s sidebar.
    *   **Location**: `app/components/SidebarFilters.tsx`
    *   **Props**:
        *   `isCollapsed: boolean`: Controls rendering for collapsed state (shows icons only).
        *   `filters: FetchFilters`: The current filter values (year, advertiser, niche, sharesRange).
        *   `handleFilterChange: (name: keyof FetchFilters, value: any) => void`: Callback to update the filter state in `LibraryView`.
        *   `distinctYears: number[]`: List of available years for the dropdown.
        *   `distinctAdvertisers: string[]`: List of available advertisers for the dropdown.
        *   `distinctNiches: string[]`: List of available niches for the dropdown.
        *   `searchTerm: string`: Current value for the search input.
        *   `handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void`: Callback to update the search term state in `LibraryView`.
    *   **Layout**: Uses Tailwind CSS and Flexbox. The root `div` handles internal padding (`p-4`), spacing (`space-y-4`), and scrolling (`overflow-y-auto flex-1 min-h-0`) for the filter controls. Adheres to the visual style of the original inline filters.
*   **Asset Grid Component**: `app/components/AssetGrid.tsx` (New)
    *   Renders a responsive Tailwind CSS grid.
    *   Maps `assets` prop to `AssetCard` components.
    *   Passes `onSelect` and `onHistory` handlers down.
    *   Passes `addToGroup` prop down to `AssetCard`.
*   **Asset List Component**: `app/components/AssetList.tsx` (New)
    *   Renders a `<table>` with sticky `<thead>`.
    *   Headers include sort icons/handlers and select-all checkbox.
    *   Maps `assets` prop to `AssetListRow` components.
    *   Passes correct sort props (`sort`, `onSort`) and selection props (`onSelectAll`).
    *   Does *not* pass `addToGroup` to `AssetListRow`.
*   **Asset Card Component**: `app/components/AssetCard.tsx` (New)
    *   Displays single asset in grid. Thumbnail, metadata, conditional shares/accumulated shares, version count badge, history button, selection checkbox.
    *   Uses HTML `title` for hover details.
    *   Implements `useDrag` (source).
    *   Implements `useDrop` (target, only if master) calling `addToGroup`.
    *   Includes visual feedback for dragging and dropping states.
    *   Defines `formatBytes`, `formatDate` locally (consider extracting).
*   **Asset List Row Component**: `app/components/AssetListRow.tsx` (New)
    *   Renders a single `<tr>` for the list view.
    *   Includes cells for checkbox, thumbnail, metadata, shares, history button.
    *   Implements `useDrag` (source only).
    *   Defines `formatBytes`, `formatDate` locally (consider extracting).
*   **Bulk Edit Modal Component**: `app/components/BulkEditModal.tsx` (New)
    *   `react-modal` dialog for batch editing (`year`, `advertiser`, `niche`, `shares`).
    *   Uses "Apply" checkboxes for selective updates.
    *   Props: `isOpen`, `onClose`, `onSave`, `selectedCount`.
*   **Bulk Group Modal Component** (`app/components/BulkGroupModal.tsx`) (New):
    *   `react-modal` dialog for selecting a master asset.
    *   Uses `getMasterAssets` prop to populate a searchable select list.
    *   Calls `onSave` (hook's `bulkAddToGroup`) on confirmation.
    *   Includes local `useDebounce` hook (consider extracting).
*   **React State Management (Assets)**: `app/hooks/useAssets.ts`
    *   Custom hook (`useAssets`) manages asset list (`AssetWithThumbnail[]`), loading, and error states.
    *   Provides functions (`fetchAssets`, `bulkImportAssets`, `updateAsset`, `deleteAsset`, `bulkUpdateAssets`, `createVersion`, `getVersions`, `addToGroup`, `removeFromGroup`, `promoteVersion`) invoking IPC handlers.
        *   `fetchAssets`: Accepts optional `filters: FetchFilters` and `sort: FetchSort`. Passes params (`year`, `advertiser`, `niche`, `sharesMin`, `sharesMax`, `sortBy`, `sortOrder`) to `get-assets` IPC. Returns `AssetWithThumbnail[]` (including `accumulatedShares`, `versionCount`).
        *   `updateAsset`, `bulkUpdateAssets`: Handle data conversion (e.g., `number | null`) before IPC.
        *   Mutation functions (e.g., `deleteAsset`, `createVersion`, `bulkUpdateAssets`) now trigger `fetchAssets` internally after successful IPC calls to refresh the UI automatically.
    *   Defines types: `Asset`, `AssetWithThumbnail`, `EditableAssetFields`, `BulkUpdatePayload`, `FetchFilters`, `FetchSort`, result types for IPC calls. `FetchFilters` uses `sharesRange: [number | null, number | null]`. `FetchSort` includes `accumulatedShares`.
    *   Provides `getMasterAssets` function (calls `get-master-assets` IPC).
    *   Provides `bulkAddToGroup` function (loops calls to `add-to-group` IPC). Calls `fetchAssets` on completion.
    *   `addToGroup` function now calls `fetchAssets` on success.
    *   Defines `MasterAssetOption` type.

## Implementation Notes

*   **Asset Creation/Import**: Handled by `createAsset`/`bulkImportAssets` IPCs. Creates master assets.
*   **Asset Update**: Single (`update-asset`) or batch (`bulkUpdateAssets` hook calling `update-asset` multiple times).
*   **Asset Deletion**: Single (`deleteAsset`) or batch (via `LibraryView` calling `deleteAsset` multiple times). Deleting master does not delete versions.
*   **Filtering & Sorting**: State managed in `LibraryView.tsx`. Filters passed to `SidebarFilters.tsx`. `fetchAssets` hook passes filters/sort to `get-assets` IPC handler which builds SQL (`WHERE a.master_id IS NULL`, `LEFT JOIN` for aggregates). Filtering/sorting applies to the list of master assets.
*   **File Storage**: `/vault/` directory. DB stores relative paths.
*   **Previews/Thumbnails**: `ThumbnailService.ts`. Path returned by `get-assets`.
*   **Database**: `better-sqlite3`. Schema in `main/schema.ts`.
*   **Path Handling**: Uses `path.win32` for DB paths if needed, `path` otherwise.
*   **UI Layout**: Tailwind CSS. `App.tsx` uses Flexbox for root layout. `LibraryView.tsx` uses Flexbox for sidebar/main panes. `SidebarFilters.tsx` manages its internal scrolling and layout.
*   **Error Handling**: Basic handling in hooks/IPCs. Batch operations return error details.
*   **Dependencies**: `electron`, `react`, `better-sqlite3`, `react-icons`, `react-tooltip`, `react-modal`, etc. External tools for some thumbnails.
*   **Type Definitions**: `app/index.d.ts` defines `ElectronAPI`. `useAssets.ts` defines core data types.
*   **Tooltips**: Previously used `react-tooltip` in `AssetCard` but removed due to layout issues; now uses native `title` attribute. Other components like `VersionHistoryModal` still use `react-tooltip`.
*   **Grouping**: 
    *   Drag-and-drop: Implemented via `react-dnd` in `AssetCard` (source/target) and `AssetListRow` (source). `addToGroup` hook called on drop.
    *   Bulk: Implemented via `BulkGroupModal` triggered from `LibraryView` toolbar. `bulkAddToGroup` hook called on save.
*   **Helper Functions**: `formatBytes`, `formatDate`, and `useDebounce` are currently defined locally in components where used (`AssetCard`, `AssetListRow`, `BulkGroupModal`). Consider extracting to a shared `app/utils` directory.
*   **Type Safety**: `index.d.ts` defines the `ExposedApi` interface for `window.api`.