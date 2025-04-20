# Codebase Overview (Ad-Vault Fork)

This document provides an overview of the codebase structure, key components, and implementation details for the Ad-Vault application, forked from `guasam/electron-react-app`.

## Directory Structure

The project follows a structure separating the Electron main process, the React renderer process, and potentially shared code (though the `shared/` directory was not found in this specific fork).

```
/
├── app/                  # React Renderer Source Code
│   ├── components/       # React Components (e.g., App.tsx)
│   ├── hooks/            # React Hooks (e.g., useItems.ts)
│   ├── styles/           # CSS Styles
│   └── renderer.tsx      # React entry point
│   └── preload.ts        # Electron preload script
├── lib/
│   └── main/             # Electron Main Process Source Code
│       ├── app.ts          # BrowserWindow creation logic
│       └── main.ts         # Electron entry, IPC handlers, DB logic
├── main/                 # Contains main process related files like schema
│   └── schema.ts         # Database schema and Item type definition
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
    *   Defines the `Item` TypeScript interface.
    *   Contains the `initializeDatabase` function with the `CREATE TABLE items` statement.
*   **IPC Handlers**: Defined in `lib/main/main.ts` using `ipcMain.handle`:
    *   `get-items`: Fetches all item metadata from the DB.
    *   `open-file-dialog`: Uses Electron's `dialog.showOpenDialog` to let the user select a file.
    *   `import-file`: Copies the selected file to the vault (`/vault/` dir in project), generates a unique name, detects MIME type, gets size, and inserts metadata into the DB.
    *   `update-item`: Updates the `name` and `description` metadata for an item in the DB.
    *   `delete-item`: Deletes the item record from the DB and the corresponding file from the vault (`/vault/` dir).
*   **Electron Preload Script**: `app/preload.ts`
    *   Exposes specific IPC channels (`invoke`) to the renderer process securely via `contextBridge`.
*   **React App Entry**: `app/renderer.tsx`
    *   Renders the main React component (`App`).
*   **Main React Component**: `app/components/App.tsx`
    *   Top-level UI component.
    *   Uses the `useItems` hook to manage application state.
    *   Provides UI elements for importing files, listing files with metadata, editing metadata (name/description), and deleting files.
*   **React State Management (Items)**: `app/hooks/useItems.ts`
    *   Custom hook (`useItems`) managing the list of file items.
    *   Handles fetching, importing, updating (metadata), and deleting items by calling the corresponding IPC handlers exposed via `window.api`.

## Implementation Notes

*   **File Import**: Initiated by the `Import File` button in `App.tsx`. It calls the `importFile` function in `useItems.ts`, which triggers the `open-file-dialog` IPC handler. If a file is selected, the `import-file` IPC handler is called with the source path. This handler copies the file to the `/vault/` directory in the project root (ensuring a unique name), extracts metadata (MIME type, size), and stores everything in the `items` SQLite table.
*   **File Storage**: Files are stored directly in the configured vault root (`/vault/` directory within the project). The database (`items` table) stores a *relative* path (`filePath`) to the file within this vault directory. The `vault/` directory itself is ignored by Git (see `.gitignore`).
*   **Previews**: Currently, no file previews are implemented. The UI only displays file metadata.
*   **Database**: `better-sqlite3` is used for synchronous SQLite operations in the main process. The database file (`vaultDatabase.db`) is stored in the Electron application's user data directory.
*   **Path Handling**: `path.join` is used in `lib/main/main.ts` to ensure cross-platform compatibility when constructing paths within the vault. Relative paths are stored in the database.
*   **Error Handling**: Basic error handling is implemented in IPC handlers and the `useItems` hook, logging errors to the console and displaying messages to the user via the `error` state.
*   **Dependencies**: Key dependencies include `electron`, `react`, `better-sqlite3`, `@electron-toolkit/utils`, `mime-types`. 