# Codebase Overview (Ad-Vault Fork)

This document provides an overview of the codebase structure, key components, and implementation details for the Ad-Vault application, forked from `guasam/electron-react-app`.

## Directory Structure

The project follows a structure separating the Electron main process, the React renderer process, and potentially shared code (though the `shared/` directory was not found in this specific fork).

```
/
├── app/                  # React Renderer Source Code
│   ├── components/       # React Components (e.g., App.tsx, LibraryView.tsx)
│   ├── hooks/            # React Hooks (e.g., useAssets.ts)
│   ├── services/         # Renderer-specific services (if any)
│   ├── styles/           # CSS Styles
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

*   **Electron Main Entry**: `lib/main/main.ts`
    *   Handles app lifecycle events.
    *   Initializes the SQLite database (`vaultDatabase.db` in user data path).
    *   Defines IPC handlers for communication with the renderer process.
    *   Sets the vault root directory to `/vault/` within the project root.
    *   Handles file copying, metadata extraction, and thumbnail generation triggers.
*   **Database Schema**: `main/schema.ts`
    *   Defines the `Asset` TypeScript interface. Fields include: `id`, `fileName`, `filePath`, `mimeType`, `size`, `createdAt`, `year`, `advertiser`, `niche`, `adspower`.
    *   Defines the `CustomField` TypeScript interface.
    *   Contains the `initializeDatabase` function for `assets` and `custom_fields` tables.
*   **Thumbnail Service**: `lib/main/ThumbnailService.ts`
    *   Provides `generateThumbnail`, `deleteThumbnail`, `getExistingThumbnailPath` functions.
    *   Generates thumbnails for images (using `nativeImage`), videos (via `ffmpeg`), and PDFs (via `pdftocairo`).
    *   Stores thumbnails in a cache directory within the user data path (`<userData>/cache/thumbnails/<asset-id>.jpg`).
*   **IPC Handlers**: Defined in `lib/main/main.ts` using `ipcMain.handle`:
    *   `get-assets`: Fetches all asset metadata. Now includes an optional `thumbnailPath` (`file://` URL) if a cached thumbnail exists.
    *   `open-file-dialog`: Uses Electron's `dialog.showOpenDialog`.
    *   `create-asset`: Takes a source file path, copies the file to the vault (using `path.win32` for relative DB path), generates unique name (hash-based), extracts metadata, inserts into `assets` table, and asynchronously triggers thumbnail generation. Returns `{ success: boolean, asset?: AssetWithThumbnail, error?: string }`.
    *   `bulk-import-assets` (New): Opens a multi-select file dialog (images, videos, PDFs, text). For each valid file, performs the same actions as `create-asset` (copy, metadata, DB insert, async thumbnail generation). Returns `{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }`.
    *   `update-asset`: Takes `{ id: number, updates: { ... } }`. Updates `assets` and `custom_fields` tables atomically. Returns `boolean`.
    *   `delete-asset`: Takes an asset ID (`number`). Deletes the asset record from the `assets` table (cascades to `custom_fields`), the corresponding file from the vault, and the cached thumbnail. Returns `boolean`.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes a generic `api` object with an `invoke` method.
*   **React App Entry**: `app/renderer.tsx`
    *   Renders the main React component (`App`). Likely needs modification to render `LibraryView`.
*   **Main React Component**: `app/components/App.tsx`
    *   Previously the top-level UI. Might need changes to incorporate `LibraryView`.
*   **Main Library View Component**: `app/components/LibraryView.tsx` (New)
    *   Displays assets in a grid view using `AssetCard` components.
    *   Shows thumbnails (via `thumbnailPath` from `useAssets`) and key metadata (`fileName`, `year`, `advertiser`, `niche`, `adspower`).
    *   Implements multi-select functionality.
    *   Provides basic search (name, advertiser, niche) and filtering (adspower) capabilities.
    *   Includes a button to trigger the `bulkImportAssets` flow.
*   **React State Management (Assets)**: `app/hooks/useAssets.ts`
    *   Custom hook (`useAssets`) managing the list of assets (`AssetWithThumbnail[]`).
    *   Defines the `AssetWithThumbnail` type locally.
    *   Defines specific types for IPC arguments/return values (e.g., `BulkImportResult`).
    *   Handles fetching (`get-assets`), creating (`create-asset`), bulk importing (`bulk-import-assets`), updating (`update-asset`), and deleting (`delete-asset`) assets by calling the corresponding IPC handlers via `window.api.invoke`. CRUD operations re-fetch the asset list on success.

## Implementation Notes

*   **Asset Creation/Import**: Initiated via `createAsset` (single file dialog) or `bulkImportAssets` (multi-file dialog) in `useAssets`, called from the UI (e.g., `LibraryView`). The main process handles file copy (to `/vault/`), metadata extraction (`createdAt`, size, MIME), database insertion (`assets` table), and triggers background thumbnail generation via `ThumbnailService`. Initial values for `year`, `advertiser`, etc., are `null`. Relative file paths stored in the DB use `path.win32` separators.
*   **Asset Update**: The `update-asset` handler allows modifying standard fields and custom fields.
*   **File Storage**: Files are stored directly in the configured vault root (`/vault/` directory within the project) using unique hash-based names. The database (`assets` table) stores the relative `filePath` (using `\` separators) to the file within this vault directory. The `vault/` directory itself should be ignored by Git.
*   **Previews/Thumbnails**: Handled by `lib/main/ThumbnailService.ts`. Generates `.jpg` thumbnails for images, videos (requires `ffmpeg`), and PDFs (requires `pdftocairo` or similar Poppler tool) and caches them in the user data directory. The `get-assets` IPC call returns a `file://` URL to the cached thumbnail if available. `LibraryView` displays these thumbnails.
*   **Database**: `better-sqlite3` is used. The database file (`vaultDatabase.db`) is stored in the Electron application's user data directory. Schema includes `assets` and `custom_fields` tables.
*   **Path Handling**: `path.win32.join` is used specifically for creating the relative `filePath` stored in the database, as requested. `path.join` is used for most other internal path operations (e.g., constructing absolute paths for file system access, cache paths).
*   **Error Handling**: Basic error handling in IPC handlers and React hooks. `bulk-import-assets` returns a list of errors if any files fail. Thumbnail generation errors are logged to the console.
*   **Dependencies**: Key dependencies include `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`. Thumbnail generation relies on external tools (`ffmpeg`, `pdftocairo`) being available in the system's PATH.
