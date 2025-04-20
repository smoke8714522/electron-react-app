import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises' // Use promises for async file operations
import fsc from 'node:fs' // Use sync fs for specific checks like existsSync
import mime from 'mime-types'
import Database from 'better-sqlite3'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { initializeDatabase, type Asset } from '../../main/schema'
import { generateThumbnail, deleteThumbnail, getExistingThumbnailPath } from './ThumbnailService' // Import thumbnail helpers
import crypto from 'crypto'; // For generating unique names

// Define the vault root path. Use path.join for initial construction.
const projectRoot = path.join(__dirname, '..', '..')
const VAULT_ROOT = path.join(projectRoot, 'vault')

// Ensure the vault directory exists
const ensureVaultDir = async () => {
  try {
    await fs.mkdir(VAULT_ROOT, { recursive: true })
    console.log(`Vault directory ensured at: ${VAULT_ROOT}`)
  } catch (error) {
    console.error(`Failed to create vault directory at ${VAULT_ROOT}:`, error)
  }
}
// Ensure directory exists on startup (async but non-blocking)
ensureVaultDir();

// Initialize SQLite Database
const dbPath = path.join(app.getPath('userData'), 'vaultDatabase.db')
const db = new Database(dbPath)
initializeDatabase(db)

// PRD §4.2 Data Model - Add thumbnailPath to Asset type returned by IPC
// Note: This type is illustrative; actual type safety depends on how renderer uses it.
interface AssetWithThumbnail extends Asset {
  thumbnailPath?: string | null; 
}

// PRD §4.1 Library View - Define structure for filters from renderer
interface AssetFilters {
    year?: number | null;
    advertiser?: string | null;
    niche?: string | null;
    sharesMin?: number | null;
    sharesMax?: number | null;
}

// PRD §4.1 Library View - Define structure for sorting from renderer
interface AssetSort {
    sortBy?: 'fileName' | 'year' | 'shares' | 'createdAt'; // Added createdAt for default/newest
    sortOrder?: 'ASC' | 'DESC';
}

// PRD §4.2 Data Model - Prepare SQL statements for the assets and custom_fields tables
const createAssetStmt = db.prepare('INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @shares)');
const getAssetByIdStmt = db.prepare('SELECT * FROM assets WHERE id = ?');
const getAssetPathStmt = db.prepare('SELECT filePath FROM assets WHERE id = ?'); // To get path for deletion
const deleteAssetStmt = db.prepare('DELETE FROM assets WHERE id = ?'); // Cascades to custom_fields

// Statements for custom fields
const upsertCustomFieldStmt = db.prepare('INSERT INTO custom_fields (assetId, key, value) VALUES (@assetId, @key, @value) ON CONFLICT(assetId, key) DO UPDATE SET value = excluded.value');
const deleteCustomFieldStmt = db.prepare('DELETE FROM custom_fields WHERE assetId = ? AND key = ?');

// --- Helper Function --- 
// Generates a unique relative filepath within the vault
// Uses windows path separator specifically for the relative path stored in DB as requested
async function generateUniqueVaultPath(originalFilePath: string): Promise<{ absolutePath: string; relativePath: string }> {
    const originalName = path.basename(originalFilePath);
    const ext = path.extname(originalName);
    // Generate a hash for uniqueness, keeping extension
    const hash = crypto.randomBytes(8).toString('hex');
    const uniqueFileName = `${hash}${ext}`;

    // Use path.win32.join for the vault path, as per constraint
    const relativePathWin = path.win32.join(uniqueFileName);
    const absolutePath = path.join(VAULT_ROOT, uniqueFileName); // Use platform native join for fs operations

    // Basic check - collisions highly unlikely with hash, but could add check/retry if needed
    try {
        await fs.access(absolutePath); // Check if file already exists (very unlikely)
        console.warn('Hash collision detected or file exists, retrying path generation...');
        return await generateUniqueVaultPath(originalFilePath); // Recurse if collision (rare)
    } catch {
        // File does not exist, path is unique
        return { absolutePath, relativePath: relativePathWin };
    }
}

// --- IPC Handlers --- 

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // PRD §4.1 Library View: Update get-assets to handle filtering and sorting
  ipcMain.handle('get-assets', async (_, params?: { filters?: AssetFilters, sort?: AssetSort }): Promise<AssetWithThumbnail[]> => {
    try {
        let query = 'SELECT id, fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares FROM assets';
        const whereClauses: string[] = [];
        const queryParams: (string | number)[] = [];

        // Apply Filters (PRD §4.1 Library View)
        if (params?.filters) {
            const { year, advertiser, niche, sharesMin, sharesMax } = params.filters;
            if (year !== undefined && year !== null && year !== 0) { // Assuming 0 means "All Years"
                whereClauses.push('year = ?');
                queryParams.push(year);
            }
            if (advertiser) {
                whereClauses.push('advertiser = ?');
                queryParams.push(advertiser);
            }
            if (niche) {
                whereClauses.push('niche = ?');
                queryParams.push(niche);
            }
            if (sharesMin !== undefined && sharesMin !== null) {
                whereClauses.push('shares >= ?');
                queryParams.push(sharesMin);
            }
            if (sharesMax !== undefined && sharesMax !== null) {
                whereClauses.push('shares <= ?');
                queryParams.push(sharesMax);
            }
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        // Apply Sorting (PRD §4.1 Library View)
        const sortBy = params?.sort?.sortBy || 'createdAt'; // Default sort by newest
        const sortOrder = params?.sort?.sortOrder || 'DESC';
        const validSortColumns = ['fileName', 'year', 'shares', 'createdAt'];
        if (validSortColumns.includes(sortBy)) {
            query += ` ORDER BY ${sortBy} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
        }

        console.log("Executing get-assets query:", query, queryParams); // Debug log
        const assets = db.prepare(query).all(...queryParams) as Asset[];

      const assetsWithThumbnails: AssetWithThumbnail[] = [];
      // Iterate and add thumbnail path if it exists
      for (const asset of assets) {
        const thumbnailPath = await getExistingThumbnailPath(asset.id);
            // Ensure shares is a number or null
            const sharesAsNumber = typeof asset.shares === 'string' ? parseInt(asset.shares, 10) : asset.shares;
            assetsWithThumbnails.push({ 
                ...asset, 
                shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber, // Handle potential NaN from parseInt
                thumbnailPath 
            });
      }
        
      return assetsWithThumbnails;
    } catch (error) {
      console.error('Failed to get assets:', error)
      return []
    }
  })

  ipcMain.handle('create-asset', async (_, sourcePath: string): Promise<{ success: boolean, asset?: AssetWithThumbnail, error?: string }> => {
    try {
      // Check source exists
      await fs.access(sourcePath); 

      // Generate unique vault path (absolute for copy, relative for DB)
      // Uses path.win32 for relative path stored in DB as per constraints
      const { absolutePath: vaultFilePath, relativePath: relativeVaultPath } = await generateUniqueVaultPath(sourcePath);
      
      // Copy file to vault using the platform-specific absolute path
      await fs.copyFile(sourcePath, vaultFilePath);

      // Get file metadata
      const stats = await fs.stat(vaultFilePath);
      const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
      const originalFileName = path.basename(sourcePath);
      const createdAt = new Date().toISOString(); // PRD §4.2 - Add createdAt timestamp

      // Insert metadata into DB
      // PRD §4.2 Data Model - Populate new fields, set others to null initially
      const info = createAssetStmt.run({
        fileName: originalFileName,
        filePath: relativeVaultPath, // Store win32-style relative path
        mimeType: mimeType,
        size: stats.size,
        createdAt: createdAt,
        year: null,
        advertiser: null,
        niche: null,
        shares: null // Renamed from adspower, defaulting to null
      });
      
      const newAssetId = info.lastInsertRowid;
      if (typeof newAssetId !== 'number') {
         throw new Error('Failed to get ID of newly created asset.');
      }

      // Generate thumbnail asynchronously (don't wait for it)
      // PRD §4.3 Thumbnail Service: Trigger thumbnail generation after asset creation
      generateThumbnail(newAssetId, vaultFilePath, mimeType)
        .then(thumbPath => {
            if (thumbPath) {
                console.log(`Thumbnail generation initiated for asset ${newAssetId}`);
            } else {
                 console.log(`Thumbnail generation skipped or failed for asset ${newAssetId}`);
            }
        })
        .catch(err => console.error(`Thumbnail generation background error for ${newAssetId}:`, err));

      // Fetch the newly created asset to return all fields correctly
      const newAsset = getAssetByIdStmt.get(newAssetId) as Asset;
      
      // Check for existing thumbnail immediately (might not be ready, but check cache)
      const thumbnailPath = await getExistingThumbnailPath(newAssetId);

      return {
        success: true,
        asset: { ...newAsset, thumbnailPath } // Return asset with potential thumbnail path
      };
    } catch (error) {
      console.error('Failed to create asset:', error);
      let errorMessage = 'Unknown error during asset creation.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // TODO: Add cleanup for copied file if DB insert or subsequent steps fail
      return { success: false, error: `Failed to create asset: ${errorMessage}` };
    }
  });

  // PRD Task 1: Add bulk import handler
  ipcMain.handle('bulk-import-assets', async () => {
    // 1. Show Open Dialog for multiple files
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: 'Import Assets',
        // PRD Task 1: Filter for allowed file types
        filters: [
            { name: 'Media Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'wmv', 'pdf', 'txt'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
            { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'wmv'] },
            { name: 'Documents', extensions: ['pdf', 'txt'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        console.log('Bulk import cancelled by user.');
        return { success: true, importedCount: 0, errors: [] }; // Return success but 0 imported
    }

    const sourcePaths = result.filePaths;
    const results = { success: true, importedCount: 0, errors: [] as { file: string, error: string }[] };
    let importedAssets: AssetWithThumbnail[] = [];

    // 2. Process each selected file
    for (const sourcePath of sourcePaths) {
        try {
            // Check source exists (redundant check, dialog should ensure this)
            await fs.access(sourcePath);

            // Generate unique vault path (absolute for copy, relative for DB)
            // Uses path.win32 for relative path stored in DB as per constraints
            const { absolutePath: vaultFilePath, relativePath: relativeVaultPath } = await generateUniqueVaultPath(sourcePath);

            // Copy file to vault
            await fs.copyFile(sourcePath, vaultFilePath);

            // Get file metadata
            const stats = await fs.stat(vaultFilePath);
            const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
            const originalFileName = path.basename(sourcePath);
            const createdAt = new Date().toISOString(); // PRD §4.2

            // Insert metadata into DB
            // PRD §4.2 Data Model - Populate fields, null for others
            const info = createAssetStmt.run({
                fileName: originalFileName,
                filePath: relativeVaultPath, // Store win32-style relative path
                mimeType: mimeType,
                size: stats.size,
                createdAt: createdAt,
                year: null,
                advertiser: null,
                niche: null,
                shares: null // Renamed from adspower
            });

            const newAssetId = info.lastInsertRowid;
            if (typeof newAssetId !== 'number') {
                throw new Error('Failed to get ID of newly created asset.');
            }

            // Generate thumbnail asynchronously
            // PRD §4.3 Thumbnail Service: Trigger thumbnail generation
            generateThumbnail(newAssetId, vaultFilePath, mimeType)
                .then(thumbPath => console.log(`Thumbnail initiated for bulk asset ${newAssetId}${thumbPath ? '' : ' (skipped or failed)'}`))
                .catch(err => console.error(`Thumbnail background error for bulk asset ${newAssetId}:`, err));

            // Fetch the newly created asset to potentially return later
            const newAsset = getAssetByIdStmt.get(newAssetId) as Asset;
            // Check for existing thumbnail (might not be ready)
            const thumbnailPath = await getExistingThumbnailPath(newAssetId);
            // Ensure shares is a number or null
            const sharesAsNumber = typeof newAsset.shares === 'string' ? parseInt(newAsset.shares, 10) : newAsset.shares;
            importedAssets.push({ 
                ...newAsset, 
                shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber,
                thumbnailPath 
            });

            results.importedCount++;

        } catch (error) {
            console.error(`Failed to import file: ${sourcePath}`, error);
            let errorMessage = 'Unknown error during import.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            results.errors.push({ file: sourcePath, error: errorMessage });
            results.success = false; // Mark overall success as false if any error occurs
            // TODO: Add cleanup logic for partially imported file (e.g., delete copied file if DB insert failed)
        }
    }

    console.log(`Bulk import finished. Imported: ${results.importedCount}, Errors: ${results.errors.length}`);
    // Return status and list of successfully imported assets (or empty if errors occurred)
    // We return assets only if overall success is true, otherwise client should handle errors
    return { ...results, assets: results.success ? importedAssets : [] }; 
  });

  // PRD §4.1 Library View: Handle updates for one or more assets
  ipcMain.handle('update-asset', async (_, { id, updates }: { id: number, updates: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'>> & { customFields?: Record<string, string | null> } }): Promise<boolean> => {
    const validFields = ['fileName', 'year', 'advertiser', 'niche', 'shares']; // Include 'shares'
        const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    // Build SET clauses for standard asset fields
    for (const key of Object.keys(updates)) {
        if (validFields.includes(key)) {
            // Ensure null is passed correctly for fields that can be null
            const value = updates[key as keyof typeof updates];
            if (key === 'shares' && value === '') { // Treat empty string for shares as null
                 setClauses.push(`${key} = ?`);
                 params.push(null);
            } else if (key === 'shares' && typeof value === 'string') {
                 const numValue = parseInt(value, 10);
                 setClauses.push(`${key} = ?`);
                 params.push(isNaN(numValue) ? null : numValue); // Store as number or null
            } else if (key === 'year' && typeof value === 'string') {
                 const numValue = parseInt(value, 10);
                 setClauses.push(`${key} = ?`);
                 params.push(isNaN(numValue) ? null : numValue);
            } else if (key === 'year' && value === '') {
                 setClauses.push(`${key} = ?`);
                 params.push(null);
            } else if (value !== undefined) {
                setClauses.push(`${key} = ?`);
                params.push(value as string | number); // Already checked if valid key
            }
        }
    }

    const customFields = updates.customFields;

    // Use a transaction for atomicity if updating both asset fields and custom fields
    const transaction = db.transaction(() => {
        // Update standard asset fields if necessary
        if (setClauses.length > 0) {
            params.push(id); // Add asset ID for the WHERE clause
            const sql = `UPDATE assets SET ${setClauses.join(', ')} WHERE id = ?`;
            const info = db.prepare(sql).run(...params);
            if (info.changes === 0) {
                // Optional: Check if asset actually exists first?
                console.warn(`Update asset: No rows changed for ID ${id}. Asset might not exist.`);
                // throw new Error(`Asset with ID ${id} not found or no changes made.`);
            }
        }

        // Update custom fields if present
        if (customFields) {
            for (const [key, value] of Object.entries(customFields)) {
                if (value === null || value === '') {
                    // Delete custom field if value is null or empty
                    deleteCustomFieldStmt.run(id, key);
                } else {
                    // Insert or update custom field
                    upsertCustomFieldStmt.run({ assetId: id, key: key, value: value });
                }
            }
        }
    });

    try {
        transaction();
        return true;
    } catch (error) {
      console.error(`Failed to update asset ID ${id}:`, error);
      return false;
    }
  });

  ipcMain.handle('delete-asset', async (_, id: number) => {
    let absoluteVaultFilePath = '';
    try {
      // 1. Get the relative file path from the database
      const row = getAssetPathStmt.get(id) as { filePath: string } | undefined;
      if (!row || !row.filePath) {
        console.warn(`No file path found for asset ID ${id}. Attempting DB record deletion only.`);
      } else {
          // Construct full path using VAULT_ROOT and the relative path
          // IMPORTANT: Assume filePath uses win32 separators as stored, join with platform native path
          absoluteVaultFilePath = path.join(VAULT_ROOT, row.filePath);
      }

      // 2. Delete the database record (will cascade to custom_fields)
      const dbInfo = deleteAssetStmt.run(id)
      if (dbInfo.changes === 0) {
          console.warn(`No database record found for asset ID ${id} during delete.`);
          // If no record found, maybe the file was already deleted or never existed correctly
          // We still check if a file path was constructed and exists
          if (absoluteVaultFilePath && fsc.existsSync(absoluteVaultFilePath)) { // Use sync exists check
             console.warn(`DB record for asset ID ${id} not found, but vault file exists: ${absoluteVaultFilePath}. Attempting file deletion.`);
          } else {
             // Also attempt to delete thumbnail if it exists
             await deleteThumbnail(id); // PRD §4.3: Delete thumbnail cache
             return true; // No DB record, no file path or file doesn't exist -> considered success
          }
      } else {
          console.log(`Deleted asset record ID ${id} from database.`);
      }

      // 3. Delete the file from the vault if path was constructed and file exists
      if (absoluteVaultFilePath && fsc.existsSync(absoluteVaultFilePath)) {
          try {
              await fs.unlink(absoluteVaultFilePath); // Use async unlink
              console.log(`Deleted file: ${absoluteVaultFilePath}`);
          } catch (fileError) {
              console.error(`Failed to delete file ${absoluteVaultFilePath} for asset ID ${id} after deleting DB record:`, fileError);
              // Log error but still return true as DB record is deleted
              // Proceed to delete thumbnail anyway
          }
      } else if (absoluteVaultFilePath) {
          console.warn(`Vault file not found at expected path: ${absoluteVaultFilePath} for asset ID ${id}.`);
      }

      // 4. Delete the cached thumbnail
      // PRD §4.3 Thumbnail Service: Delete thumbnail cache associated with the asset
      await deleteThumbnail(id);
      
      return true // Indicate success (DB record deleted, file handled, thumbnail handled)
    } catch (error) {
      console.error(`Failed to delete asset ID ${id}:`, error)
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

  createAppWindow()

  optimizer.watchWindowShortcuts(BrowserWindow.getAllWindows()[0])

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createAppWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Close the database connection when the app quits
    if (db && db.open) {
      db.close();
      console.log('Database connection closed.');
    }
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
