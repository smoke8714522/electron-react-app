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
            *   Displays a list of all assets associated with a given `masterId` (fetched using `getVersions` hook).
            *   Props: `{ masterId: number | null; isOpen: boolean; onClose: () => void }`.
            *   Renders a table showing each version's thumbnail, metadata (filename, type, size, created, year, advertiser, niche, shares), and version number (`version_no`).
            *   Includes checkboxes for multi-selecting versions within the modal.
            *   Provides a toolbar with actions operating on the *selected versions*:
                *   **Add Existing Master**: Prompts for the ID of *another* master asset, then calls `addToGroup(selectedMasterIdToAdd, currentMasterId)` to make the selected master a new version in the *current* group. (Requires user input for ID).
                *   **Remove From Group**: Calls `removeFromGroup(selectedVersionId)` for each selected version, making them standalone master assets again. Requires confirmation.
                *   **Bulk Edit**: Opens the `BulkEditModal` (imported) to edit metadata (`year`, `advertiser`, `niche`, `shares`) for the selected versions. Calls `bulkUpdateAssets` hook on save.
                *   **Bulk Delete**: Calls `deleteAsset(selectedVersionId)` for each selected version. Requires confirmation.
            *   Uses `react-tooltip` for button hints.
            *   Calls `onClose` prop when the close button is clicked.
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
    *   `open-file-dialog`: Uses Electron's `dialog.showOpenDialog`.
    *   `create-asset`: Takes a source file path, copies the file to the vault (using `path.win32` for relative DB path), generates unique name (hash-based), extracts metadata, inserts into `assets` table (setting `master_id` to `NULL` and `version_no` to `1` for new assets), and asynchronously triggers thumbnail generation. Returns `{ success: boolean, asset?: AssetWithThumbnail, error?: string }`. The returned asset includes `accumulatedShares` (which will initially just be the master's own shares).
    *   `bulk-import-assets`: Opens a multi-select file dialog. For each valid file, performs the same actions as `create-asset` (creating new master assets). Returns `{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }`.
    *   `update-asset`: Takes `{ id: number, updates: { ... } }`. Updates `assets` (including `shares`) and `custom_fields` tables atomically. Ensures `shares` and `year` are stored as numbers or null. Returns `Promise<boolean>`. (Note: Currently updates only the specific asset record provided, not versions).
    *   `delete-asset`: Takes an asset ID (`number`). Deletes the asset record from the `assets` table (cascades to `custom_fields`), the corresponding file from the vault, and the cached thumbnail. Returns `Promise<boolean>`. (Note: Currently deletes only the specific asset ID. Deleting versions or the master needs specific handling not yet implemented).
    *   `create-version`: Takes `{ masterId: number, sourcePath: string }`. Copies the `sourcePath` file into the vault, generates a unique path, fetches metadata from the specified `masterId` asset, determines the next available `version_no` for that master, inserts a new `assets` record cloning the master's metadata but with the new file path, the master's ID set in `master_id`, and the calculated `version_no`. Triggers thumbnail generation for the new version asset. Returns `Promise<{ success: boolean, newId?: number, error?: string }>`.
    *   `get-versions`: Takes `{ masterId: number }`. Fetches all asset records where `master_id` equals the provided `masterId`, ordered by `version_no` descending. Adds the `thumbnailPath` to each asset record if available. Returns `Promise<{ success: boolean, assets?: AssetWithThumbnail[], error?: string }>`. (Note: `accumulatedShares` is not calculated for individual versions).
    *   `add-to-group`: Takes `{ versionId: number, masterId: number }`. Updates the asset record with `id = versionId` to set its `master_id` to `masterId` and calculates the next available `version_no` within that master's group (`MAX(version_no) + 1`). This operation only succeeds if `versionId` currently represents a master asset (`master_id IS NULL`) and `masterId` also represents a master asset. Returns `Promise<{ success: boolean, error?: string }>`.
    *   `remove-from-group`: Takes `{ versionId: number }`. Updates the asset record with `id = versionId` to set its `master_id` to `NULL` and resets its `version_no` to `1`, effectively making it a standalone master asset again. This only succeeds if the asset was previously a version (`master_id IS NOT NULL`). Returns `Promise<{ success: boolean, error?: string }>`.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes a generic `api` object with an `invoke` method.
    *   Also exposes specific typed methods for common IPC calls, including `createVersion`, `getVersions`, `addToGroup`, `removeFromGroup`.
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
        *   `fetchAssets`: Now accepts optional `filters: { year?, advertiser?, niche?, sharesRange? }` and `sort: { sortBy?, sortOrder? }` objects, passing relevant parameters (`year`, `advertiser`, `niche`, `sharesMin`, `sharesMax`, `sortBy`, `sortOrder`) to the `get-assets` IPC handler. Returns `AssetWithThumbnail[]` which now includes `accumulatedShares` and potentially `version_no`. Sorting by `accumulatedShares` is now supported.
        *   `updateAsset`: Ensures `year` and `shares` are converted to `number | null` before sending via IPC.
        *   `bulkUpdateAssets`: Takes `selectedIds: number[]`, `updates: BulkUpdatePayload`. Iterates through `selectedIds`, prepares payload (converting `year`/`shares` to `number | null`), and calls the `update-asset` IPC handler for each. Returns `Promise<BatchUpdateResult>`. Refreshes asset list after completion.
    *   Defines types: `Asset` (updated with `master_id`, `version_no`), `AssetWithThumbnail` (updated to include `accumulatedShares`), `EditableAssetFields`, `BulkUpdatePayload`, `CreateAssetResult`, `BulkImportResult`, `UpdateAssetPayload`, `BatchUpdateResult`, `FetchFilters`, `FetchSort` (including `accumulatedShares`).
    *   **Versioning Hook Functions**: Provides functions (`createVersion`, `getVersions`, `addToGroup`, `removeFromGroup`) that invoke corresponding IPC handlers. These now use `useCallback` and handle loading/error states, often calling `fetchAssets` to refresh the main list after mutations.
    *   **Versioning Result Types**: `CreateVersionResult`, `GetVersionsResult`, `AddToGroupResult`, `RemoveFromGroupResult` are now defined and exported at the top level.

## Implementation Notes

*   **Asset Creation/Import**: Initiated via `createAsset` or `bulkImportAssets`. Main process handles file copy, metadata, DB insert (now sets `master_id = NULL`, `version_no = 1`), and async thumbnail generation.
*   **Asset Update**: The `update-asset` handler allows modifying standard fields and custom fields for a *specific* asset ID.
*   **Asset Deletion**: Single asset deletion via `deleteAsset` hook. Batch deletion via `LibraryView` toolbar (for master assets) or `VersionHistoryModal` toolbar (for versions). Deletion currently targets the specific asset ID provided.
*   **Filtering & Sorting**: Implemented in `LibraryView`, triggers `fetchAssets`. `get-assets` IPC handler builds SQL, now **always includes `WHERE a.master_id IS NULL`** and calculates `accumulatedShares`. Filtering/sorting by `shares` uses the master's own `shares` value, while sorting by `accumulatedShares` uses the calculated total. Client-side text search added for quick filtering of loaded results.
*   **File Storage**: Files stored in `/vault/`, DB stores relative `filePath`.
*   **Previews/Thumbnails**: Handled by `ThumbnailService`. `get-assets` returns `thumbnailPath`.
*   **Database**: `better-sqlite3`, `vaultDatabase.db` in user data path. Schema includes migration for `adspower` -> `shares` rename.
*   **Path Handling**: `path.win32.join` for DB paths, `path.join` otherwise.
*   **UI Layout**: `App.tsx` uses `flex flex-col h-screen w-screen` for full window layout. `LibraryView.tsx` uses `flex` for its two-pane layout, with the sidebar width controlled by state and the main content area managing its own scrolling. Tailwind CSS used throughout.
*   **Error Handling**: Basic error handling in IPC/hooks. `bulk-import-assets`/`bulkUpdateAssets` return errors. Thumbnail errors logged.
*   **Dependencies**: `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`, `react-icons`, `ffmpeg-static`, `react-tooltip`. External tools (`ffmpeg`, `pdftocairo`, `magick` CLI (ImageMagick), `Ghostscript`) needed for PDF and video thumbnails.
