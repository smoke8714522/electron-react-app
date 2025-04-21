# Codebase Overview (Ad-Vault Fork)

This document provides an overview of the codebase structure, key components, and implementation details for the Ad-Vault application, forked from `guasam/electron-react-app`.

## Directory Structure

The project follows a structure separating the Electron main process, the React renderer process, and potentially shared code (though the `shared/` directory was not found in this specific fork).

```
/
├── app/                  # React Renderer Source Code
│   ├── components/       # React Components (e.g., App.tsx, LibraryView.tsx, BulkEditModal.tsx)
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
*   **Electron Main Entry**: `lib/main/main.ts`
    *   Handles app lifecycle events.
    *   Initializes the SQLite database (`vaultDatabase.db` in user data path).
    *   Defines IPC handlers for communication with the renderer process.
    *   Sets the vault root directory to `/vault/` within the project root.
    *   Handles file copying, metadata extraction, and thumbnail generation triggers.
*   **Database Schema**: `main/schema.ts`
    *   Defines the `Asset` TypeScript interface. Fields include: `id`, `fileName`, `filePath`, `mimeType`, `size`, `createdAt`, `year`, `advertiser`, `niche`, `shares` (renamed from `adspower`, now `INTEGER`).
    *   Defines the `CustomField` TypeScript interface.
    *   Contains the `initializeDatabase` function for `assets` and `custom_fields` tables. Includes migration logic to rename `adspower` column to `shares` and add version control columns.
*   **Version Control & Grouping (Database Schema)**: Implemented in `main/schema.ts`.
    *   `assets` table includes:
        *   `master_id` (INTEGER, NULL, FK -> assets.id ON DELETE SET NULL): Links an asset version to its original master asset.
        *   `version_no` (INTEGER, NOT NULL, DEFAULT 1): Tracks the version number within a group of related assets.
    *   An index `idx_assets_master` is created on `master_id` for efficient querying of asset versions.
    *   A composite index `idx_assets_master_version` is created on `(master_id, version_no)` for efficient querying and ordering of versions within a group.
    *   Database migrations are handled in `initializeDatabase` using `PRAGMA user_version`.
    *   The `get-assets` IPC handler now filters results using `WHERE a.master_id IS NULL` to return only master assets by default.
    *   The `get-assets` IPC handler calculates and returns a new field `accumulatedShares`. This represents the sum of the `shares` value of the master asset itself plus the `shares` values of all its associated versions (assets linked via `master_id`). The SQL calculation is: `a.shares + COALESCE((SELECT SUM(v.shares) FROM assets v WHERE v.master_id = a.id), 0) AS accumulatedShares`.
    *   **UI**:
        *   The main asset gallery (`LibraryView.tsx`) displays **only master assets** (those with `master_id IS NULL`).
        *   Each master asset card (`AssetCard` within `LibraryView.tsx`) displays:
            *   An **Accumulated Shares badge** (e.g., `[Icon] 1,234`) showing the total shares of the master and its versions, if this total is different from the master's own `shares` value. Uses `react-tooltip` for details.
            *   A **Version badge** (e.g., `v2`) if the master asset itself has `version_no > 1`. Uses `react-tooltip` for details. *(Note: This condition might be revisited; typically masters might be v1. This badge indicates the version number stored on the master record itself).*
            *   A **History button** (clock icon) in the card footer. Clicking this button triggers the `onHistory` prop in `LibraryView.tsx`.
        *   `LibraryView.tsx` manages state (`historyMasterId`, `isHistoryModalOpen`) to control the `VersionHistoryModal`. It passes the `masterId` and `onClose` handler to the modal.
        *   The List view also displays the `accumulatedShares` value and includes a History button per row, triggering the same `onHistory` handler.
        *   **Version History Modal** (`app/components/VersionHistoryModal.tsx`):
            *   Props: `{ masterId: number | null; isOpen: boolean; onClose: () => void }`.
            *   Applies **dark mode styling** using Tailwind CSS (`bg-gray-900`, `text-gray-100`, etc.) for the modal container, header, body, and footer, ensuring legibility.
            *   Fetches and displays a list of all assets associated with the given `masterId` (using `getVersions` hook) in a table.
            *   Table includes columns: Checkbox, Preview, Filename, Type, Size, Created, Year, Advertiser, Niche, Shares, Version (`vX`).
            *   Supports multi-select via checkboxes in the table header (select-all) and each row.
            *   Includes a **footer action bar** (`bg-gray-800`) with buttons:
                *   **Add Version** (`<FiUploadCloud>`): Uses `window.api.openFileDialog` to open a file dialog; on selection, calls `createVersion(masterId, sourcePath)`. Disabled if `!masterId` or loading.
                *   **Promote Selected** (`<FiChevronsUp>`): Calls `promoteVersion(versionId)` after confirmation. Disabled unless exactly one version is selected.
                *   **Remove From Group** (`<FiCornerUpLeft>`): Calls `removeFromGroup(versionId)` for each selected item after confirmation. Disabled unless at least one version is selected.
                *   **Bulk Edit** (`<FiEdit>`): Opens the `BulkEditModal` component. Disabled unless at least one version is selected.
                *   **Delete Selected** (`<FiTrash2>`): Calls `deleteAsset(versionId)` for each selected item after confirmation. Disabled unless at least one version is selected.
            *   All buttons use `react-tooltip` for hints and have appropriate `disabled` states based on selection count and loading status.
            *   Destructive actions (Promote, Remove, Delete) use `window.confirm()` before proceeding.
            *   After successful actions (Add, Promote, Remove, Bulk Edit Save, Delete), the modal refreshes its own version data (`fetchVersionsData`) and triggers a refresh of the main library view (`fetchAssets`) to ensure consistency.
            *   Calls the `onClose` prop when the close button (top right) is clicked.
            *   Manages internal loading and error states.
*   **Thumbnail Service**: `lib/main/ThumbnailService.ts`
    *   Provides `generateThumbnail(assetId, sourcePath)`, `deleteThumbnail(assetId)`, `getExistingThumbnailPath(assetId)` functions.
    *   Uses `sharp` for images, `ffmpeg-static` for videos, and the ImageMagick CLI (`magick`) + Ghostscript for PDF thumbnails.
    *   If generation fails or unsupported format, returns `null` and renderer should display a placeholder icon.
    *   Thumbnails are saved to `public/cache/thumbnails/<asset-id>.jpg`.
*   **IPC Handlers**: Defined in `lib/main/main.ts` using `ipcMain.handle`:
    *   `get-assets`: Fetches asset metadata. Now filters to return **only master assets** (`master_id IS NULL`).
        *   Accepts optional `params: { filters?: AssetFilters, sort?: AssetSort }`.
        *   `AssetFilters`: `{ year?: number | null, advertiser?: string | null, niche?: string | null, sharesMin?: number | null, sharesMax?: number | null }`. (Note: `shares` filter currently applies to the master asset's own `shares` value, not the accumulated value).
        *   `AssetSort`: `{ sortBy?: 'fileName' | 'year' | 'shares' | 'createdAt', sortOrder?: 'ASC' | 'DESC' }`. (Note: Sorting by `shares` currently uses the master asset's own `shares` value).
        *   Dynamically builds SQL query based on filters and sorting, including the `WHERE a.master_id IS NULL` clause.
        *   Returns `Promise<AssetWithThumbnail[]>` including:
            *   Standard asset fields.
            *   An optional `thumbnailPath` (static `/cache/thumbnails/<asset-id>.jpg`) if cached.
            *   Ensures `shares` is `number | null`.
            *   A new calculated field `accumulatedShares: number | null`, representing the total shares of the master and all its versions.
    *   `open-file-dialog`: Opens a file picker via Electron's `dialog.showOpenDialog`; returns `{ canceled: boolean, filePaths: string[] }`.
    *   `create-asset`: Takes a source file path, copies the file to the vault (using `path.win32` for relative DB path), generates unique name (hash-based), extracts metadata, inserts into `assets` table (setting `master_id` to `NULL` and `version_no` to `1` for new assets), and asynchronously triggers thumbnail generation. Returns `{ success: boolean, asset?: AssetWithThumbnail, error?: string }`. The returned asset includes `accumulatedShares` (which will initially just be the master's own shares).
    *   `bulk-import-assets`: Opens a multi-select file dialog (using Electron's `dialog.showOpenDialog` internally). For each valid file, performs the same actions as `create-asset` (creating new master assets). Returns `{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }`.
    *   `update-asset`: Takes `{ id: number, updates: { ... } }`. Updates `assets` (including `shares`) and `custom_fields` tables atomically. Ensures `shares` and `year` are stored as numbers or null. Returns `Promise<boolean>`. (Note: Currently updates only the specific asset record provided, not versions).
    *   `delete-asset`: Takes an asset ID (`number`). Deletes the asset record from the `assets` table (cascades to `custom_fields`), the corresponding file from the vault, and the cached thumbnail. Returns `Promise<boolean>`. (Note: Deleting a master asset *does not* currently delete its versions automatically; versions remain linked via `master_id` which might become invalid. Deleting a version only deletes that specific version).
    *   `create-version`: Takes `{ masterId: number, sourcePath: string }`. Checks `sourcePath` exists. Copies the file into the vault, generates a unique path. Fetches metadata from the specified `masterId` asset (ensuring it *is* a master). Determines the next available `version_no` for that master. Inserts a new `assets` record cloning the master's metadata (filename, year, advertiser, niche, shares) but with the new file path, size, mimeType, createdAt, the master's ID set in `master_id`, and the calculated `version_no`. File copy/metadata retrieval happens outside transaction, DB insert/version number calculation inside. Triggers thumbnail generation asynchronously for the new version asset. Returns `Promise<{ success: boolean, newId?: number, error?: string }>`.
    *   `get-versions`: Takes `{ masterId: number }`. Fetches all asset records where `master_id` equals the provided `masterId`, ordered by `version_no` descending. Adds the `thumbnailPath` to each asset record if available. Returns `Promise<{ success: boolean, assets?: AssetWithThumbnail[], error?: string }>`. (Note: `accumulatedShares` is not calculated/returned for individual versions here).
    *   `add-to-group`: Takes `{ versionId: number, masterId: number }`. Verifies within a transaction that `versionId` exists and is currently a master asset (`master_id IS NULL`) and that `masterId` also exists and is a master asset. Updates the asset record with `id = versionId` to set its `master_id` to `masterId` and calculates the next available `version_no` within that master's group using a subquery (`SELECT COALESCE(MAX(v.version_no), 0) + 1 FROM assets v WHERE v.master_id = ?`). Returns `Promise<{ success: boolean, error?: string }>`.
    *   `remove-from-group`: Takes `{ versionId: number }`. Verifies within a transaction that the asset exists and is currently a version (`master_id IS NOT NULL`). Updates the asset record with `id = versionId` to set its `master_id` to `NULL` and resets its `version_no` to `1`, effectively making it a standalone master asset again. Returns `Promise<{ success: boolean, error?: string }>`. If the asset is already a master, it returns success without making changes.
    *   `promote-version`: Takes `{ versionId: number }`. **Stub handler that currently returns `{ success: true }`.** (Future implementation: Promote the specified version to be the new master of its group, potentially swapping data with the current master and updating `master_id` and `version_no` for other versions). The corresponding hook (`useAssets().promoteVersion`) calls this and refreshes the asset list.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes a generic `api` object with an `invoke` method.
    *   Also exposes specific typed methods for many common IPC calls via the `api` object (e.g., `api.getAssets`, `api.createAsset`, `api.openFileDialog`, `api.createVersion`, `api.getVersions`, `api.addToGroup`, `api.removeFromGroup`, `api.promoteVersion`). Renderer code can use either the generic `invoke` or these specific, typed methods.
*   **React App Entry**: `app/renderer.tsx`
    *   Renders the main React component (`App`).
*   **Main React Component**: `app/components/App.tsx`
    *   Top-level UI component using Tailwind CSS.
    *   Implements a simple top navigation bar ("Ad Vault" title + tabs) to switch between views ('Dashboard' and 'Library'). Navigation is edge-to-edge.
    *   Conditionally renders either the original basic asset list/edit view (as 'Dashboard') or the `LibraryView` based on selected tab state.
    *   Root element uses Flexbox (`h-screen w-screen flex flex-col min-h-0`) to ensure the layout fills the entire window edge-to-edge without extra padding or child overflow (PRD §5 Non-Functional Requirements). Main content area handles scrolling.
*   **Main Library View Component**: `app/components/LibraryView.tsx` (Refactored)
    *   Main view for browsing and managing assets, styled with Tailwind CSS.
    *   Features a two-pane layout implemented with Flexbox (PRD §4.1 Library View):
        *   **Collapsible Left Sidebar** (`<aside>`): Uses `flex flex-col h-full min-h-0`. Width transitions between `w-64` (expanded) and `w-16` (icon-only collapsed state). Contains filter controls:
            *   **Search Input**: Basic text search (currently unused for backend filtering but available).
            *   **Year Filter**: Dropdown (`<select>`) populated with distinct years from loaded assets. Allows selecting a specific year or "All Years".
            *   **Advertiser Filter**: Dropdown (`<select>`) populated with distinct advertisers from loaded assets. Allows selecting a specific advertiser or "All Advertisers".
            *   **Niche Filter**: Dropdown (`<select>`) populated with distinct niches from loaded assets. Allows selecting a specific niche or "All Niches".
            *   **Shares Filter**: Two numeric input fields (`<input type="number">`) for Minimum and Maximum shares. Allows filtering by a range.
            *   **Tag Filter**: Placeholder for future tag filtering implementation.
            *   Sidebar content adapts or hides when collapsed. Toggle button in the sidebar header.
            *   The filter controls section (`div`) within the sidebar uses `overflow-y-auto flex-1 min-h-0` to enable independent scrolling when filters exceed available space.
        *   **Main Content Area** (`<main>`): Takes remaining width (`flex-1`). Contains a sticky top toolbar and the scrollable asset display area.
            *   **Sticky Top Toolbar**: Contains main action buttons ("Bulk Import", "Refresh"), a "Sort by" dropdown, a "Grid/List" view toggle, and **conditional batch action controls** that appear when assets are selected (`selectedCount`, "Edit Metadata" button, "Delete Selected" button). Toolbar remains visible when scrolling assets.
                *   **Sort Dropdown**: Allows sorting by Newest/Oldest (default), FileName (A-Z, Z-A), Year (High-Low, Low-High), Shares (High-Low, Low-High).
            *   **Asset Display Area**: Scrollable area (`overflow-y-auto`). Displays assets (fetched based on current filters/sort) using either `AssetCard` components in a responsive grid (default) or inline `<tr>`/`<td>` elements within a `<table>` (list view) based on the view toggle state.
            *   **Asset Display Area**: Scrollable area (`overflow-y-auto`). Displays assets (fetched based on current filters/sort) using either `AssetCard` components in a responsive grid (default) or inline `<tr>`/`<td>` elements within a `<table>` (list view) based on the view toggle state.
                *   The grid container uses `items-start` and `content-start` to prevent cards from stretching vertically, especially in the last row when it's not full.
    *   `AssetCard`: Displays thumbnail, key metadata (`fileName`, `year`, `advertiser`, `niche`, `shares`), and includes a checkbox for multi-select. Clicking the card toggles selection.
    *   `AssetListItem`: Component removed. List view renders table rows (`<tr>`) with table data (`<td>`) cells directly within the `<tbody>`.
    *   Implements multi-select functionality via checkboxes on `AssetCard` or within the list view `<tr>`. Selected count and batch actions ("Edit Metadata", "Delete Selected") appear in the main content toolbar.
    *   Triggers `BulkEditModal` when the "Edit Metadata" batch action is clicked.
    *   Filtering and sorting changes trigger an immediate re-fetch of assets via `useAssets.fetchAssets`.
*   **Bulk Edit Modal Component**: `app/components/BulkEditModal.tsx` (New)
    *   Modal dialog for batch editing metadata of selected assets (PRD §4.1 Library View).
    *   Displays fields for `year`, `advertiser`, `niche`, `shares`.
    *   Each field has an associated "Apply" checkbox; only checked fields are included in the update.
    *   Props:
        *   `isOpen: boolean`: Controls modal visibility.
        *   `onClose: () => void`: Callback to close the modal.
        *   `onSave: (updates: BulkUpdatePayload) => Promise<void>`: Callback triggered on save, passing an object with only the checked fields and their values.
        *   `selectedCount: number`: Displays the number of assets being edited.
    *   Styled using Tailwind CSS.
*   **React State Management (Assets)**: `app/hooks/useAssets.ts`
    *   Custom hook (`useAssets`) managing the list of assets (`AssetWithThumbnail[]`).
    *   Provides `fetchAssets(filters?: FetchFilters, sort?: FetchSort)`, `bulkImportAssets`, `updateAsset`, `deleteAsset`, `bulkUpdateAssets` functions which invoke corresponding IPC handlers.
        *   `fetchAssets`: Now accepts optional `filters: { year?, advertiser?, niche?, sharesRange? }` and `sort: { sortBy?, sortOrder? }` objects, passing relevant parameters (`year`, `advertiser`, `niche`, `sharesMin`, `sharesMax`, `sortBy`, `sortOrder`) to the `get-assets` IPC handler. Returns `AssetWithThumbnail[]` which now includes `accumulatedShares` for master assets.
        *   `updateAsset`: Ensures `year` and `shares` are converted to `number | null` before sending via IPC.
        *   `bulkUpdateAssets`: Takes `selectedIds: number[]`, `updates: BulkUpdatePayload`. Iterates through `selectedIds`, prepares payload (converting `year`/`shares` to `number | null`), and calls the `update-asset` IPC handler for each. Returns `Promise<BatchUpdateResult>`. Refreshes asset list after completion via `fetchAssets()`.
    *   Defines types: `Asset` (updated with `master_id`, `version_no`), `AssetWithThumbnail` (updated to include `accumulatedShares`), `EditableAssetFields`, `BulkUpdatePayload`, `CreateAssetResult`, `BulkImportResult`, `UpdateAssetPayload`, `BatchUpdateResult`, `FetchFilters`, `FetchSort`.
    *   **Versioning Hook Functions**: Provides functions (`createVersion`, `getVersions`, `addToGroup`, `removeFromGroup`, `promoteVersion`) that invoke corresponding IPC handlers. These now use `useCallback` and handle loading/error states within the main hook (except `getVersions`, which is designed for direct use by the modal). They call `fetchAssets` to refresh the main list after successful mutations.
        *   `promoteVersion`: Takes `versionId: number`. Calls the `promote-version` IPC handler. Refreshes the asset list via `fetchAssets` upon success. Returns `Promise<PromoteVersionResult>`.
    *   **Versioning Result Types**: `CreateVersionResult`, `GetVersionsResult`, `AddToGroupResult`, `RemoveFromGroupResult`, `PromoteVersionResult` are now defined and exported at the top level.

## Implementation Notes

*   **Asset Creation/Import**: Initiated via `createAsset` or `bulkImportAssets`. Main process handles file copy, metadata, DB insert (now sets `master_id = NULL`, `version_no = 1`), and async thumbnail generation.
*   **Asset Update**: The `update-asset` handler allows modifying standard fields and custom fields for a *specific* asset ID.
*   **Asset Deletion**: Single asset deletion via `deleteAsset` hook/IPC. Batch deletion via `LibraryView` toolbar (for master assets) or `VersionHistoryModal` toolbar (for versions). Deletion targets the specific asset ID provided. Deleting a master *does not* automatically delete its versions.
*   **Filtering & Sorting**: Implemented in `LibraryView`, triggers `fetchAssets`. `get-assets` IPC handler builds SQL, **always includes `WHERE a.master_id IS NULL`** and calculates `accumulatedShares`. Filtering/sorting by `shares` uses the master's own `shares` value. Sorting by `accumulatedShares` is not explicitly implemented in the backend `get-assets` sort options yet (only `fileName`, `year`, `shares`, `createdAt`).
*   **File Storage**: Files stored in `/vault/`, DB stores relative `filePath` using Windows separators (`\`).
*   **Previews/Thumbnails**: Handled by `ThumbnailService`. `get-assets` returns `thumbnailPath`.
*   **Database**: `better-sqlite3`, `vaultDatabase.db` in user data path. Schema includes migration for `adspower` -> `shares` rename.
*   **Path Handling**: `path.win32.join` for DB paths, `path.join` otherwise.
*   **UI Layout**: `App.tsx` uses `flex flex-col h-screen w-screen` for full window layout. `LibraryView.tsx` uses `flex` for its two-pane layout, with the sidebar width controlled by state and the main content area managing its own scrolling. Tailwind CSS used throughout.
*   **Error Handling**: Basic error handling in IPC/hooks. `bulk-import-assets`/`bulkUpdateAssets` return errors. Thumbnail errors logged.
*   **Dependencies**: `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`, `react-icons`, `ffmpeg-static`, `react-tooltip`, `react-modal` (required for VersionHistoryModal). External tools (`ffmpeg`, `pdftocairo`, `magick` CLI (ImageMagick), `Ghostscript`) needed for PDF and video thumbnails.
*   **Type Definitions**: `app/index.d.ts` defines the `ElectronAPI` interface exposed via preload, including specific handlers and a generic `invoke` method.
