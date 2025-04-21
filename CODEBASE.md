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
    *   Contains the `initializeDatabase` function for `assets` and `custom_fields` tables. Includes migration logic to rename `adspower` column to `shares`.
*   **Thumbnail Service**: `lib/main/ThumbnailService.ts`
    *   Provides `generateThumbnail(assetId, sourcePath)`, `deleteThumbnail(assetId)`, `getExistingThumbnailPath(assetId)` functions.
    *   Uses `sharp` for images, `ffmpeg-static` for video thumbnails, and `pdf-thumbnail` (requires ImageMagick & Ghostscript installed) for PDFs.
    *   If generation fails or unsupported format, returns `null` and renderer should display a placeholder icon.
    *   Thumbnails are saved to `public/cache/thumbnails/<asset-id>.jpg`.
*   **IPC Handlers**: Defined in `lib/main/main.ts` using `ipcMain.handle`:
    *   `get-assets`: Fetches asset metadata. 
        *   Accepts optional `params: { filters?: AssetFilters, sort?: AssetSort }`.
        *   `AssetFilters`: `{ year?: number | null, advertiser?: string | null, niche?: string | null, sharesMin?: number | null, sharesMax?: number | null }`.
        *   `AssetSort`: `{ sortBy?: 'fileName' | 'year' | 'shares' | 'createdAt', sortOrder?: 'ASC' | 'DESC' }`.
        *   Dynamically builds SQL query based on filters and sorting.
        *   Returns `Promise<AssetWithThumbnail[]>` including an optional `thumbnailPath` (static `/cache/thumbnails/<asset-id>.jpg`) if a cached thumbnail exists and ensures `shares` is `number | null`.
    *   `open-file-dialog`: Uses Electron's `dialog.showOpenDialog`.
    *   `create-asset`: Takes a source file path, copies the file to the vault (using `path.win32` for relative DB path), generates unique name (hash-based), extracts metadata, inserts into `assets` table (using `shares: null` initially), and asynchronously triggers thumbnail generation. Returns `{ success: boolean, asset?: AssetWithThumbnail, error?: string }`.
    *   `bulk-import-assets`: Opens a multi-select file dialog (images, videos, PDFs, text). For each valid file, performs the same actions as `create-asset` (using `shares: null` initially). Returns `{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }`.
    *   `update-asset`: Takes `{ id: number, updates: { ... } }`. Updates `assets` (including `shares`) and `custom_fields` tables atomically. Ensures `shares` and `year` are stored as numbers or null. Returns `Promise<boolean>`.
    *   `delete-asset`: Takes an asset ID (`number`). Deletes the asset record from the `assets` table (cascades to `custom_fields`), the corresponding file from the vault, and the cached thumbnail. Returns `Promise<boolean>`.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes a generic `api` object with an `invoke` method.
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
        *   `fetchAssets`: Now accepts optional `filters: { year?, advertiser?, niche?, sharesRange? }` and `sort: { sortBy?, sortOrder? }` objects, passing relevant parameters (`year`, `advertiser`, `niche`, `sharesMin`, `sharesMax`, `sortBy`, `sortOrder`) to the `get-assets` IPC handler.
        *   `updateAsset`: Ensures `year` and `shares` are converted to `number | null` before sending via IPC.
        *   `bulkUpdateAssets`: Takes `selectedIds: number[]`, `updates: BulkUpdatePayload`. Iterates through `selectedIds`, prepares payload (converting `year`/`shares` to `number | null`), and calls the `update-asset` IPC handler for each. Returns `Promise<BatchUpdateResult>`. Refreshes asset list after completion.
    *   Defines types: `Asset`, `AssetWithThumbnail`, `EditableAssetFields`, `BulkUpdatePayload`, `CreateAssetResult`, `BulkImportResult`, `UpdateAssetPayload`, `BatchUpdateResult`, `FetchFilters`, `FetchSort` (including `shares` instead of `adspower`).

## Implementation Notes

*   **Asset Creation/Import**: Initiated via `createAsset` (single file dialog in Dashboard view) or `bulkImportAssets` (multi-file dialog via button in `LibraryView` toolbar) in `useAssets`. Main process handles file copy, metadata, DB insert (with `shares: null`), and async thumbnail generation.
*   **Asset Update**: The `update-asset` handler (used by Dashboard edit form, `updateAsset`, and `bulkUpdateAssets`) allows modifying standard fields (including `shares`) and custom fields.
*   **Asset Deletion**: Single asset deletion via `deleteAsset` hook. Batch deletion implemented in `LibraryView` toolbar by iterating calls to `deleteAsset`.
*   **Filtering & Sorting**: Implemented in `LibraryView` state, triggering `fetchAssets` hook with filter/sort parameters. `get-assets` IPC handler in `main.ts` dynamically builds the SQL query.
*   **File Storage**: Files stored in `/vault/`, DB stores relative `filePath`.
*   **Previews/Thumbnails**: Handled by `ThumbnailService`, cached in user data. `get-assets` returns `thumbnailPath`. `LibraryView` displays these in `AssetCard` and the list view table cells.
*   **Database**: `better-sqlite3`, `vaultDatabase.db` in user data path. Schema includes migration for `adspower` -> `shares` rename.
*   **Path Handling**: `path.win32.join` for DB paths, `path.join` otherwise.
*   **UI Layout**: `App.tsx` uses `flex flex-col h-screen w-screen` for full window layout. `LibraryView.tsx` uses `flex` for its two-pane layout, with the sidebar width controlled by state and the main content area managing its own scrolling. Tailwind CSS used throughout.
*   **Error Handling**: Basic error handling in IPC/hooks. `bulk-import-assets`/`bulkUpdateAssets` return errors. Thumbnail errors logged.
*   **Dependencies**: `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`, `react-icons`, `ffmpeg-static`, `pdf-thumbnail`. External tools (`ffmpeg`, `pdftocairo`, `ImageMagick`, `Ghostscript`) needed for some thumbnails.
