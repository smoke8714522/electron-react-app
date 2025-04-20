# Codebase Overview (Ad-Vault Fork)

This document provides an overview of the codebase structure, key components, and implementation details for the Ad-Vault application, forked from `guasam/electron-react-app`.

## Directory Structure

The project follows a structure separating the Electron main process, the React renderer process, and potentially shared code (though the `shared/` directory was not found in this specific fork).

```
/
├── app/                  # React Renderer Source Code
│   ├── components/       # React Components (e.g., App.tsx)
│   ├── hooks/            # React Hooks (e.g., useAssets.ts)
│   ├── styles/           # CSS Styles
│   └── renderer.tsx      # React entry point
│   └── index.d.ts        # Type definitions for renderer
├── lib/
│   ├── main/             # Electron Main Process Source Code
│   │   ├── app.ts          # BrowserWindow creation logic
│   │   └── main.ts         # Electron entry, IPC handlers, DB logic
│   └── preload/          # Electron Preload Scripts
│       ├── preload.ts      # Preload entry, contextBridge setup
│       └── api.ts          # Generic IPC helper definitions
├── main/                 # Contains main process related files like schema
│   └── schema.ts         # Database schema and Asset/CustomField types
├── out/                  # Build output directory
├── resources/            # Static assets (e.g., icons)
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
*   **Database Schema**: `main/schema.ts`
    *   Defines the `Asset` TypeScript interface (replaces `Item`). Fields include: `id`, `fileName`, `filePath`, `mimeType`, `size`, `createdAt`, `year`, `advertiser`, `niche`, `adspower`.
    *   Defines the `CustomField` TypeScript interface for dynamic key-value pairs linked to assets. Fields include: `id`, `assetId`, `key`, `value`.
    *   Contains the `initializeDatabase` function which creates the `assets` and `custom_fields` tables (replacing the `items` table).
*   **IPC Handlers**: Defined in `lib/main/main.ts` using `ipcMain.handle`:
    *   `get-assets`: Fetches all asset metadata (excluding custom fields) from the `assets` table.
    *   `open-file-dialog`: Uses Electron's `dialog.showOpenDialog` to let the user select a file (unchanged).
    *   `create-asset`: Takes a source file path, copies the file to the vault (`/vault/` dir), generates a unique name, detects MIME type, gets size, creates a timestamp, and inserts metadata into the `assets` table (other fields like `year`, `advertiser` are initially null). Returns `{ success: boolean, asset?: Asset, error?: string }`.
    *   `update-asset`: Takes `{ id: number, updates: { ... } }` where `updates` contains standard fields (`fileName`, `year`, etc.) and optional `customFields: Record<string, string | null>`. Updates the `assets` and `custom_fields` tables. Returns `boolean`.
    *   `delete-asset`: Takes an asset ID (`number`). Deletes the asset record from the `assets` table (cascades to `custom_fields`) and the corresponding file from the vault (`/vault/` dir). Returns `boolean`.
*   **Electron Preload Script**: `lib/preload/preload.ts` (with helpers in `lib/preload/api.ts`)
    *   Exposes a generic `api` object with an `invoke` method to the renderer process securely via `contextBridge`. Does not expose specific channels directly.
*   **React App Entry**: `app/renderer.tsx`
    *   Renders the main React component (`App`).
*   **Main React Component**: `app/components/App.tsx`
    *   Top-level UI component.
    *   Uses the `useAssets` hook to manage application state.
    *   Provides UI elements for importing assets, listing assets with metadata, editing standard metadata fields, and deleting assets.
*   **React State Management (Assets)**: `app/hooks/useAssets.ts`
    *   Custom hook (`useAssets`) managing the list of assets (`Asset[]`).
    *   Defines the `Asset` type locally (as it cannot import directly from `main/schema.ts`).
    *   Defines specific types for `window.api.invoke` arguments/return values.
    *   Handles fetching, creating, updating (standard metadata), and deleting assets by calling the corresponding IPC handlers via `window.api.invoke`. CRUD operations re-fetch the asset list on success.

## Implementation Notes

*   **Asset Creation**: Initiated potentially via `App.tsx`. Typically involves calling `open-file-dialog`, then `create-asset` with the selected path. The main process handles file copy, metadata extraction (including `createdAt`), and database insertion into the `assets` table. Initial values for `year`, `advertiser`, etc., are `null`.
*   **Asset Update**: The `update-asset` handler allows modifying standard fields like `fileName`, `year`, etc., and managing key-value pairs in the `custom_fields` table.
*   **File Storage**: Files are stored directly in the configured vault root (`/vault/` directory within the project). The database (`assets` table) stores a *relative* path (`filePath`) to the file within this vault directory. The `vault/` directory itself is ignored by Git.
*   **Previews**: Currently, no file previews are implemented. The UI only displays file metadata.
*   **Database**: `better-sqlite3` is used for synchronous SQLite operations in the main process. The database file (`vaultDatabase.db`) is stored in the Electron application's user data directory. The schema includes `assets` and `custom_fields` tables.
*   **Path Handling**: `path.join` is used in `lib/main/main.ts` to ensure cross-platform compatibility when constructing paths within the vault. Relative paths are stored in the database.
*   **Error Handling**: Basic error handling is implemented in IPC handlers and React hooks, logging errors to the console. Transaction is used in `update-asset` for atomicity.
*   **Dependencies**: Key dependencies include `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`.
