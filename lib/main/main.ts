import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import mime from 'mime-types'
import Database from 'better-sqlite3'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { initializeDatabase, type Asset } from '../../main/schema'

// PRD Section 3: Configuration Update - Set vault root path to project's vault/ directory
// Use path.join(__dirname, '..', '..', 'vault') to get path relative to project root
const VAULT_ROOT = path.join(__dirname, '..', '..', 'vault');

// Ensure the vault directory exists
try {
  fs.mkdirSync(VAULT_ROOT, { recursive: true }); // Re-add directory creation
  console.log(`Vault directory ensured at: ${VAULT_ROOT}`);
} catch (error) {
  console.error(`Failed to create vault directory at ${VAULT_ROOT}:`, error);
  // Consider notifying the user or exiting if the vault is critical
}

// Initialize SQLite Database
const dbPath = path.join(app.getPath('userData'), 'vaultDatabase.db')
const db = new Database(dbPath)
initializeDatabase(db)

// PRD §4.2 Data Model - Prepare SQL statements for the assets and custom_fields tables
const getAssetsStmt = db.prepare('SELECT id, fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, adspower FROM assets');
const createAssetStmt = db.prepare('INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, adspower) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @adspower)');
// Prepare statement for updating standard asset fields dynamically later
const getAssetPathStmt = db.prepare('SELECT filePath FROM assets WHERE id = ?'); // To get path for deletion
const deleteAssetStmt = db.prepare('DELETE FROM assets WHERE id = ?'); // Cascades to custom_fields

// Statements for custom fields
// const getCustomFieldsStmt = db.prepare('SELECT key, value FROM custom_fields WHERE assetId = ?'); // Removed as it's currently unused
const upsertCustomFieldStmt = db.prepare('INSERT INTO custom_fields (assetId, key, value) VALUES (@assetId, @key, @value) ON CONFLICT(assetId, key) DO UPDATE SET value = excluded.value');
const deleteCustomFieldStmt = db.prepare('DELETE FROM custom_fields WHERE assetId = ? AND key = ?');

// --- Helper Function --- 
// Generates a unique filename within the vault to avoid collisions
function generateUniqueVaultPath(originalFilePath: string): string {
    const originalName = path.basename(originalFilePath);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    let uniqueName = originalName;
    let counter = 0;
    // Check if file exists and generate new name if it does
    // Use path.join for cross-platform compatibility
    while (fs.existsSync(path.join(VAULT_ROOT, uniqueName))) { 
        counter++;
        uniqueName = `${baseName}_${counter}${ext}`;
    }
    // Use path.join for cross-platform compatibility
    return path.join(VAULT_ROOT, uniqueName);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // --- IPC Handlers --- 
  ipcMain.handle('get-assets', async () => {
    try {
      // Fetch assets based on the new schema
      // Note: Custom fields are not fetched here for performance; fetch separately if needed per asset.
      return getAssetsStmt.all() as Asset[]
    } catch (error) {
      console.error('Failed to get assets:', error)
      return []
    }
  })

  ipcMain.handle('create-asset', async (_, sourcePath: string) => {
    try {
      if (!fs.existsSync(sourcePath)) {
        console.error('Source file does not exist:', sourcePath);
        return { success: false, error: 'Source file not found.' };
      }

      // Generate vault path (uses VAULT_ROOT)
      const vaultFilePath = generateUniqueVaultPath(sourcePath);
      // Store path relative to VAULT_ROOT in the database
      const relativeVaultPath = path.relative(VAULT_ROOT, vaultFilePath);

      // Copy file to vault
      fs.copyFileSync(sourcePath, vaultFilePath);

      // Get file metadata
      const stats = fs.statSync(vaultFilePath);
      const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
      const originalFileName = path.basename(sourcePath);
      const createdAt = new Date().toISOString(); // PRD §4.2 - Add createdAt timestamp

      // Insert metadata into DB using the new statement
      // PRD §4.2 Data Model - Populate new fields, set others to null initially
      const info = createAssetStmt.run({
        fileName: originalFileName,
        filePath: relativeVaultPath,
        mimeType: mimeType,
        size: stats.size,
        createdAt: createdAt,
        year: null,
        advertiser: null,
        niche: null,
        adspower: null
      });
      
      const newAssetId = info.lastInsertRowid;
      if (typeof newAssetId !== 'number') {
         throw new Error('Failed to get ID of newly created asset.');
      }

      // Return the newly created asset data
      // Fetch the newly created asset to return all fields correctly
      const newAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(newAssetId) as Asset;

      return {
        success: true,
        asset: newAsset
      };
    } catch (error) {
      console.error('Failed to create asset:', error);
      let errorMessage = 'Unknown error during asset creation.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // Attempt to clean up potentially copied file if DB insert failed - more robust error handling could be added
      // Consider deleting vaultFilePath if it exists and the operation failed after copy
      return { success: false, error: `Failed to create asset: ${errorMessage}` };
    }
  });

  ipcMain.handle('update-asset', async (_, { id, updates }: { id: number; updates: Partial<Asset> & { customFields?: Record<string, string | null> } }) => {
    const { customFields, ...standardUpdates } = updates;
    const allowedStandardFields = ['fileName', 'year', 'advertiser', 'niche', 'adspower']; // Fields allowed for direct update in 'assets' table

    // Use a transaction for atomic update
    const transaction = db.transaction((assetId: number, stdUpdates: Partial<Asset>, custFields?: Record<string, string | null>) => {
        // 1. Update standard fields in the 'assets' table
        const setClauses: string[] = [];
        const params: any[] = [];
        for (const key of allowedStandardFields) {
            if (key in stdUpdates) {
                setClauses.push(`${key} = ?`);
                params.push(stdUpdates[key as keyof Asset]);
            }
        }

        if (setClauses.length > 0) {
            params.push(assetId);
            const sql = `UPDATE assets SET ${setClauses.join(', ')} WHERE id = ?`;
            const updateStmt = db.prepare(sql);
            const info = updateStmt.run(...params);
            if (info.changes === 0) {
                 console.warn(`Asset with ID ${assetId} not found for update.`);
                 // Optionally throw error to rollback transaction if asset must exist
                 // throw new Error(`Asset with ID ${assetId} not found.`);
            }
        }

        // 2. Update custom fields in the 'custom_fields' table
        if (custFields) {
            for (const [key, value] of Object.entries(custFields)) {
                if (value === null || typeof value === 'undefined') {
                    // Delete the custom field if value is null/undefined
                    deleteCustomFieldStmt.run(assetId, key);
                } else {
                    // Insert or update the custom field
                    upsertCustomFieldStmt.run({ assetId, key, value });
                }
            }
        }
        return true; // Indicate success within transaction
    });

    try {
      const success = transaction(id, standardUpdates, customFields);
      return success;
    } catch (error) {
      console.error(`Failed to update asset ID ${id}:`, error);
      return false;
    }
  });

  ipcMain.handle('delete-asset', async (_, id: number) => {
    let vaultFilePath = '';
    try {
      // 1. Get the relative file path from the database
      const row = getAssetPathStmt.get(id) as { filePath: string } | undefined;
      if (!row || !row.filePath) {
        console.warn(`No file path found for asset ID ${id}. Attempting DB record deletion only.`);
      } else {
          // Construct full path using VAULT_ROOT and the relative path
          vaultFilePath = path.join(VAULT_ROOT, row.filePath); // Use path.join
      }

      // 2. Delete the database record (will cascade to custom_fields)
      const dbInfo = deleteAssetStmt.run(id)
      if (dbInfo.changes === 0) {
          console.warn(`No database record found for asset ID ${id} during delete.`);
          // If no record found, maybe the file was already deleted or never existed correctly
          // We still check if a file path was constructed and exists
          if (vaultFilePath && fs.existsSync(vaultFilePath)) {
             console.warn(`DB record for asset ID ${id} not found, but vault file exists: ${vaultFilePath}. Attempting file deletion.`);
             // Proceed to file deletion attempt below
          } else {
             return true; // No DB record, no file path or file doesn't exist -> considered success
          }
      } else {
          console.log(`Deleted asset record ID ${id} from database.`);
      }

      // 3. Delete the file from the vault if path was constructed and file exists
      if (vaultFilePath && fs.existsSync(vaultFilePath)) {
          try {
              fs.unlinkSync(vaultFilePath);
              console.log(`Deleted file: ${vaultFilePath}`);
          } catch (fileError) {
              console.error(`Failed to delete file ${vaultFilePath} for asset ID ${id} after deleting DB record:`, fileError);
              // Log error but still return true as DB record is deleted
              return true; 
          }
      } else if (vaultFilePath) {
          console.warn(`Vault file not found at expected path: ${vaultFilePath} for asset ID ${id}.`);
      }
      
      return true // Indicate success (DB record deleted, file handled)
    } catch (error) {
      console.error(`Failed to delete asset ID ${id}:`, error)
      // If DB deletion failed, the file might still exist. More robust cleanup could be added.
      return false
    }
  })

  // PRD Section 2: Add handler to open file dialog
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'] // Allow selecting a single file
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]; // Return the selected file path
    } 
    return null; // Return null if canceled or no file selected
  });
  // --- End IPC Handlers ---

  // Create app window
  createAppWindow()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createAppWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
