import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises' // Use promises for async file operations
import fsc from 'node:fs' // Use sync fs for specific checks like existsSync
import mime from 'mime-types'
import Database from 'better-sqlite3'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { initializeDatabase, type Asset, type CustomField } from '../../main/schema'
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
  accumulatedShares?: number | null; // Step 2: Add accumulatedShares
}

// PRD §4.1 Library View: Update get-assets to handle filtering and sorting
// PRD §4.1 Library View: Define structure for filters from renderer
interface AssetFilters {
    year?: number | null;
    advertiser?: string | null;
    niche?: string | null;
    sharesMin?: number | null;
    sharesMax?: number | null;
}

// PRD §4.1 Library View: Define structure for sorting from renderer
interface AssetSort {
    sortBy?: 'fileName' | 'year' | 'shares' | 'createdAt'; // Added createdAt for default/newest
    sortOrder?: 'ASC' | 'DESC';
}

// PRD §4.2 Data Model - Prepare SQL statements for the assets and custom_fields tables
const createAssetStmt = db.prepare('INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @shares)');
const getAssetByIdStmt = db.prepare<[number], Asset>('SELECT * FROM assets WHERE id = ?');
const getAssetPathStmt = db.prepare<{ id: number }, { filePath: string }>('SELECT filePath FROM assets WHERE id = ?'); // To get path for deletion
const deleteAssetStmt = db.prepare('DELETE FROM assets WHERE id = ?'); // Cascades to custom_fields

// Statements for custom fields
const upsertCustomFieldStmt = db.prepare('INSERT INTO custom_fields (assetId, key, value) VALUES (@assetId, @key, @value) ON CONFLICT(assetId, key) DO UPDATE SET value = excluded.value');
const deleteCustomFieldStmt = db.prepare('DELETE FROM custom_fields WHERE assetId = ? AND key = ?');

// New statements for versioning
const getMaxVersionNoStmt = db.prepare<{ masterId: number }, { max_version: number | null }>('SELECT MAX(version_no) as max_version FROM assets WHERE master_id = @masterId');
const insertVersionStmt = db.prepare('INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares, master_id, version_no) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @shares, @masterId, @versionNo)');
const getVersionsStmt = db.prepare<[number], Asset>('SELECT * FROM assets WHERE master_id = ? ORDER BY version_no DESC');
const setMasterIdStmt = db.prepare('UPDATE assets SET master_id = ?, version_no = (SELECT COALESCE(MAX(v.version_no), 0) + 1 FROM assets v WHERE v.master_id = ?) WHERE id = ?');
const clearMasterIdStmt = db.prepare('UPDATE assets SET master_id = NULL, version_no = 1 WHERE id = ?');

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

    console.log('🔍 generateUniqueVaultPath', { originalFilePath, uniqueFileName, absolutePath, relativePathWin });

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
        // Select base fields plus accumulated shares. Alias asset table as 'a'.
        let query = `
          SELECT 
            a.id, a.fileName, a.filePath, a.mimeType, a.size, a.createdAt, 
            a.year, a.advertiser, a.niche, a.shares, a.master_id, a.version_no,
            a.shares + COALESCE((SELECT SUM(v.shares) FROM assets v WHERE v.master_id = a.id), 0) AS accumulatedShares
          FROM assets a
        `;
        const whereClauses: string[] = [
          'a.master_id IS NULL' // Step 2: Always filter for master assets
        ];
        const queryParams: (string | number)[] = [];

        // Apply Filters (PRD §4.1 Library View) - Apply to master asset 'a'
        if (params?.filters) {
            const { year, advertiser, niche, sharesMin, sharesMax } = params.filters;
            if (year !== undefined && year !== null && year !== 0) { // Assuming 0 means "All Years"
                whereClauses.push('a.year = ?');
                queryParams.push(year);
            }
            if (advertiser) {
                whereClauses.push('a.advertiser = ?');
                queryParams.push(advertiser);
            }
            if (niche) {
                whereClauses.push('a.niche = ?');
                queryParams.push(niche);
            }
            if (sharesMin !== undefined && sharesMin !== null) {
                // Note: Filtering by master's own shares, not accumulated
                whereClauses.push('a.shares >= ?');
                queryParams.push(sharesMin);
            }
            if (sharesMax !== undefined && sharesMax !== null) {
                // Note: Filtering by master's own shares, not accumulated
                whereClauses.push('a.shares <= ?');
                queryParams.push(sharesMax);
            }
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        // Apply Sorting (PRD §4.1 Library View) - Apply to master asset 'a'
        const sortBy = params?.sort?.sortBy || 'createdAt'; // Default sort by newest
        const sortOrder = params?.sort?.sortOrder || 'DESC';
        const validSortColumns = ['fileName', 'year', 'shares', 'createdAt'];
        if (validSortColumns.includes(sortBy)) {
            // Note: Sorting by master's own shares, not accumulated
            query += ` ORDER BY a.${sortBy} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
        }

        console.log("Executing get-assets query:", query, queryParams); // Debug log
        const assets = db.prepare(query).all(...queryParams) as Asset[]; // Raw assets from DB

      const assetsWithThumbnails: AssetWithThumbnail[] = [];
      // Iterate and add thumbnail path if it exists
      for (const asset of assets) {
        const thumbnailPath = await getExistingThumbnailPath(asset.id);
            // Ensure shares is a number or null
            const sharesAsNumber = typeof asset.shares === 'string' ? parseInt(asset.shares, 10) : asset.shares;
            // The accumulatedShares should already be a number from SQL SUM/COALESCE
            const accumulatedShares = (asset as any).accumulatedShares; // Cast to access the calculated field

            assetsWithThumbnails.push({ 
                ...asset, 
                shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber, // Handle potential NaN from parseInt
                accumulatedShares: typeof accumulatedShares === 'number' ? accumulatedShares : null, // Ensure type or null
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
    console.log('⚙️ create-asset invoked with sourcePath:', sourcePath);
    try {
      // Check source exists
      await fs.access(sourcePath); 

      // Generate unique vault path (absolute for copy, relative for DB)
      const { absolutePath: vaultFilePath, relativePath: relativeVaultPath } = await generateUniqueVaultPath(sourcePath);

      // Copy file to vault using the platform-specific absolute path
      await fs.copyFile(sourcePath, vaultFilePath);

      // Get file metadata
      const stats = await fs.stat(vaultFilePath);
      const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
      const originalFileName = path.basename(sourcePath);
      const createdAt = new Date().toISOString(); 

      // Insert metadata into DB - New assets are always master assets (master_id=NULL, version=1)
      const info = db.prepare(
        'INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares, master_id, version_no) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @shares, NULL, 1)'
        ).run({
        fileName: originalFileName,
        filePath: relativeVaultPath, // Store win32-style relative path
        mimeType: mimeType,
        size: stats.size,
        createdAt: createdAt,
        year: null,
        advertiser: null,
        niche: null,
        shares: null // Defaulting to null
      });

      const newAssetId = info.lastInsertRowid;
      if (typeof newAssetId !== 'number') {
         throw new Error('Failed to get ID of newly created asset.');
      }

      // Fetch the newly created asset to return it (includes accumulatedShares)
      const newAssetResult = db.prepare(`
        SELECT 
          a.*,
          a.shares + COALESCE((SELECT SUM(v.shares) FROM assets v WHERE v.master_id = a.id), 0) AS accumulatedShares
        FROM assets a
        WHERE a.id = ? AND a.master_id IS NULL
      `).get(newAssetId) as Asset;

      if (!newAssetResult) {
        throw new Error('Failed to retrieve newly created master asset.');
      }

      // Generate thumbnail asynchronously (don't wait)
      generateThumbnail(newAssetId, vaultFilePath).catch(err => {
        console.error(`Failed to generate thumbnail for asset ${newAssetId}:`, err);
      }); 
      
      const thumbnailPath = await getExistingThumbnailPath(newAssetId); // Check if already generated (unlikely but safe)

      return {
        success: true,
        asset: { 
          ...newAssetResult, 
          shares: typeof newAssetResult.shares === 'string' ? parseInt(newAssetResult.shares, 10) : newAssetResult.shares, // Ensure type
          accumulatedShares: (newAssetResult as any).accumulatedShares, // Access calculated field
          thumbnailPath 
        }
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
  ipcMain.handle('bulk-import-assets', async (): Promise<{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }> => {
    // 1. Show Open Dialog for multiple files
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: 'Import Assets',
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
        return { success: true, importedCount: 0, assets: [], errors: [] }; // Return success but 0 imported
    }

    const sourcePaths = result.filePaths;
    const importedAssets: AssetWithThumbnail[] = [];
    const errors: { file: string, error: string }[] = [];

    // 2. Process each selected file
    // Define the core asset creation logic as a local function to reuse it
    const createSingleAsset = async (sourcePath: string): Promise<{ success: boolean, asset?: AssetWithThumbnail, error?: string }> => {
      try {
        await fs.access(sourcePath); // Check source exists
        const { absolutePath: vaultFilePath, relativePath: relativeVaultPath } = await generateUniqueVaultPath(sourcePath);
        await fs.copyFile(sourcePath, vaultFilePath);
        const stats = await fs.stat(vaultFilePath);
        const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
        const originalFileName = path.basename(sourcePath);
        const createdAt = new Date().toISOString();
        const info = db.prepare(
          'INSERT INTO assets (fileName, filePath, mimeType, size, createdAt, year, advertiser, niche, shares, master_id, version_no) VALUES (@fileName, @filePath, @mimeType, @size, @createdAt, @year, @advertiser, @niche, @shares, NULL, 1)'
          ).run({
          fileName: originalFileName,
          filePath: relativeVaultPath, 
          mimeType: mimeType,
          size: stats.size,
          createdAt: createdAt,
          year: null,
          advertiser: null,
          niche: null,
          shares: null 
        });
        const newAssetId = info.lastInsertRowid;
        if (typeof newAssetId !== 'number') {
          throw new Error('Failed to get ID of newly created asset.');
        }
        const newAssetResult = db.prepare(`
          SELECT 
            a.*,
            a.shares + COALESCE((SELECT SUM(v.shares) FROM assets v WHERE v.master_id = a.id), 0) AS accumulatedShares
          FROM assets a
          WHERE a.id = ? AND a.master_id IS NULL
        `).get(newAssetId) as (Asset & { accumulatedShares: number | null }); // Add type hint for accumulatedShares
        if (!newAssetResult) {
          throw new Error('Failed to retrieve newly created master asset.');
        }
        generateThumbnail(newAssetId, vaultFilePath).catch(err => {
          console.error(`Failed to generate thumbnail for asset ${newAssetId}:`, err);
        }); 
        const thumbnailPath = await getExistingThumbnailPath(newAssetId);
        const sharesAsNumber = typeof newAssetResult.shares === 'string' ? parseInt(newAssetResult.shares, 10) : newAssetResult.shares;

        return {
          success: true,
          asset: { 
            ...newAssetResult, 
            shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber,
            accumulatedShares: newAssetResult.accumulatedShares, // Use value from query
            thumbnailPath 
          }
        };
      } catch (error) {
        let errorMessage = 'Unknown error during asset creation.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        console.error(`Error creating asset from ${sourcePath}:`, error);
        // Cleanup potentially copied file if error occurred after copy but before DB commit (if transactions were used)
        // Simple cleanup: attempt to delete the target file if it exists
        try {
          const { absolutePath: vaultFilePath } = await generateUniqueVaultPath(sourcePath); // Re-generate path to know potential target
          await fs.unlink(vaultFilePath).catch(() => {}); // Attempt deletion, ignore error if it fails (e.g., file wasn't created)
        } catch { /* ignore errors during cleanup path generation */ }
        return { success: false, error: errorMessage };
      }
    };

    for (const sourcePath of sourcePaths) {
      const createResult = await createSingleAsset(sourcePath);
      if (createResult.success && createResult.asset) {
          importedAssets.push(createResult.asset);
      } else {
          errors.push({ file: path.basename(sourcePath), error: createResult.error || 'Unknown error during import.' });
      }
    }

    console.log(`Bulk import finished. Imported: ${importedAssets.length}, Errors: ${errors.length}`);
    return {
        success: errors.length === 0,
        importedCount: importedAssets.length,
        assets: importedAssets,
        errors
    };
  });

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

  ipcMain.handle('delete-asset', async (_, assetId: number): Promise<boolean> => {
    console.log(`⚙️ delete-asset invoked for assetId: ${assetId}`);
    let filePathToDelete: string | undefined;
    let thumbnailPathToDelete: string | undefined;
    try {
      // Get file path before deleting DB record
      const assetInfo = getAssetPathStmt.get({ id: assetId }); // FIX: Pass object { id: assetId }
      if (assetInfo?.filePath) {
        filePathToDelete = path.join(VAULT_ROOT, assetInfo.filePath);
        thumbnailPathToDelete = path.join(projectRoot, 'public', 'cache', 'thumbnails', `${assetId}.jpg`);
      }

      // 2. Delete the database record (will cascade to custom_fields)
      const dbInfo = deleteAssetStmt.run(assetId)
      if (dbInfo.changes === 0) {
          console.warn(`No database record found for asset ID ${assetId} during delete.`);
          // If no record found, maybe the file was already deleted or never existed correctly
          // We still check if a file path was constructed and exists
          if (filePathToDelete && fsc.existsSync(filePathToDelete)) { // Use sync exists check
             console.warn(`DB record for asset ID ${assetId} not found, but vault file exists: ${filePathToDelete}. Attempting file deletion.`);
          } else {
             // Also attempt to delete thumbnail if it exists
             await deleteThumbnail(assetId); // PRD §4.3: Delete thumbnail cache
             return true; // No DB record, no file path or file doesn't exist -> considered success
          }
      } else {
          console.log(`Deleted asset record ID ${assetId} from database.`);
      }

      // 3. Delete the file from the vault if path was constructed and file exists
      if (filePathToDelete && fsc.existsSync(filePathToDelete)) {
          try {
              await fs.unlink(filePathToDelete); // Use async unlink
              console.log(`Deleted file: ${filePathToDelete}`);
          } catch (fileError) {
              console.error(`Failed to delete file ${filePathToDelete} for asset ID ${assetId} after deleting DB record:`, fileError);
              // Log error but still return true as DB record is deleted
              // Proceed to delete thumbnail anyway
          }
      } else if (filePathToDelete) {
          console.warn(`Vault file not found at expected path: ${filePathToDelete} for asset ID ${assetId}.`);
      }

      // 4. Delete the cached thumbnail
      // PRD §4.3 Thumbnail Service: Delete thumbnail cache associated with the asset
      await deleteThumbnail(assetId);
      
      return true // Indicate success (DB record deleted, file handled, thumbnail handled)
    } catch (error) {
      console.error(`Failed to delete asset ID ${assetId}:`, error)
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

  ipcMain.handle('regenerate-thumbnails', async (): Promise<{ regeneratedCount: number }> => {
    const rows = db.prepare('SELECT id, filePath FROM assets').all() as { id: number; filePath: string }[];
    let regeneratedCount = 0;
    for (const { id, filePath } of rows) {
      const existing = await getExistingThumbnailPath(id);
      if (!existing) {
        const absPath = path.join(VAULT_ROOT, filePath);
        const thumb = await generateThumbnail(id, absPath);
        if (thumb) regeneratedCount++;
      }
    }
    return { regeneratedCount };
  });

  // --- Versioning IPC Handlers ---

  ipcMain.handle('create-version', async (_, { masterId, sourcePath }: { masterId: number; sourcePath: string }): Promise<{ success: boolean, newId?: number, error?: string }> => {
    console.log('⚙️ create-version invoked with masterId:', masterId, 'sourcePath:', sourcePath);
    try {
        // 1. Check source file exists
        await fs.access(sourcePath);

        // 2. Get master asset data (needed for cloning metadata)
        const masterAsset = getAssetByIdStmt.get(masterId);
        if (!masterAsset) {
            throw new Error(`Master asset with ID ${masterId} not found.`);
        }

        // 3. Generate unique vault path for the new version
        const { absolutePath: vaultFilePath, relativePath: relativeVaultPath } = await generateUniqueVaultPath(sourcePath);

        // 4. Copy source file to the vault
        await fs.copyFile(sourcePath, vaultFilePath);

        // 5. Get file stats for the new version
        const stats = await fs.stat(vaultFilePath);
        const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
        const originalFileName = path.basename(sourcePath); // Use the *new* source file's name
        const createdAt = new Date().toISOString();

        // 6. Determine the next version number
        const result = getMaxVersionNoStmt.get({ masterId });
        const nextVersionNo = (result?.max_version ?? 0) + 1;

        // 7. Insert new asset record cloning master's metadata but with new path, masterId, and versionNo
        const info = insertVersionStmt.run({
            fileName: originalFileName, // Use the name of the source file being added as a version
            filePath: relativeVaultPath, // New relative path
            mimeType: mimeType,
            size: stats.size,
            createdAt: createdAt,
            year: masterAsset.year,             // Clone from master
            advertiser: masterAsset.advertiser, // Clone from master
            niche: masterAsset.niche,           // Clone from master
            shares: masterAsset.shares,         // Clone from master (or set to null/0?) - cloning for now
            masterId: masterId,                 // Link to master
            versionNo: nextVersionNo            // Set new version number
        });

        const newAssetId = info.lastInsertRowid as number;
        if (!newAssetId) {
           throw new Error('Failed to get ID of newly created version asset.');
        }

        // 8. Trigger thumbnail generation asynchronously
        generateThumbnail(newAssetId, vaultFilePath).catch(err => {
            console.error(`Failed to generate thumbnail for version asset ${newAssetId}:`, err);
        });

        console.log(`✅ Version asset created with ID: ${newAssetId}, Version No: ${nextVersionNo} for Master ID: ${masterId}`);
        return { success: true, newId: newAssetId };

    } catch (error: any) {
        console.error('❌ Failed to create version asset:', error);
        // Attempt to clean up copied file if insertion failed after copy
        if (error.message.includes('Failed to get ID') || error.message.includes('INSERT')) {
             try {
                const { absolutePath } = await generateUniqueVaultPath(sourcePath); // Re-generate to be sure
                await fs.unlink(absolutePath);
                console.log(`🧹 Cleaned up copied file: ${absolutePath}`);
             } catch (cleanupError) {
                console.error(`🧹 Failed to cleanup copied file after error:`, cleanupError);
             }
        }
        return { success: false, error: error.message || 'An unknown error occurred' };
    }
  });

  ipcMain.handle('get-versions', async (_, { masterId }: { masterId: number }): Promise<{ success: boolean, assets?: AssetWithThumbnail[], error?: string }> => {
    console.log(`⚙️ get-versions invoked for masterId: ${masterId}`);
    try {
        const assets = getVersionsStmt.all(masterId) as Asset[]; // Fetch all versions for the master ID

        const assetsWithThumbnails: AssetWithThumbnail[] = [];
        for (const asset of assets) {
            const thumbnailPath = await getExistingThumbnailPath(asset.id);
            // Ensure shares is number or null
            const sharesAsNumber = typeof asset.shares === 'string' ? parseInt(asset.shares, 10) : asset.shares;

            assetsWithThumbnails.push({
                ...asset,
                shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber,
                // accumulatedShares is not calculated for individual versions here, only for masters in get-assets
                thumbnailPath
            });
        }
        console.log(`✅ Found ${assetsWithThumbnails.length} versions for master ID: ${masterId}`);
        return { success: true, assets: assetsWithThumbnails };
    } catch (error: any) {
        console.error(`❌ Failed to get versions for masterId ${masterId}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred' };
    }
  });

  ipcMain.handle('add-to-group', async (_, { versionId, masterId }: { versionId: number, masterId: number }): Promise<{ success: boolean, error?: string }> => {
     console.log(`⚙️ add-to-group invoked: adding versionId ${versionId} to masterId ${masterId}`);
     try {
        // Ensure the target masterId exists and is a master itself (master_id IS NULL)
        const masterAsset = getAssetByIdStmt.get(masterId);
        if (!masterAsset) {
            throw new Error(`Target master asset with ID ${masterId} not found.`);
        }
        if ((masterAsset as any).master_id !== null) { // FIX: Use type assertion
             throw new Error(`Target asset ID ${masterId} is not a master asset.`);
        }
        // Ensure the versionId exists
         const versionAsset = getAssetByIdStmt.get(versionId);
         if (!versionAsset) {
             throw new Error(`Asset to be added (ID ${versionId}) not found.`);
         }
         // Prevent adding a master to a group or adding an asset to itself
         if ((versionAsset as any).master_id === null && versionId !== masterId) { // FIX: Use type assertion
             // Only proceed if versionId is currently a master and not the target master
             const info = setMasterIdStmt.run(masterId, masterId, versionId); // Pass masterId twice for the subquery
             console.log(`✅ Rows affected by add-to-group: ${info.changes}`);
             return { success: info.changes > 0 };
         } else if (versionId === masterId) {
             throw new Error(`Cannot add an asset to its own group.`);
         } else {
             // Asset is already part of *another* group or is not a master
             console.warn(`⚠️ Asset ${versionId} could not be added to group ${masterId}. It might already be a version or not exist.`);
             // Allow re-assigning to the same group? For now, let's say no unless explicitly requested.
             // If we want to allow moving from one group to another, this logic needs adjustment.
             // Currently, it only allows adding *existing master* assets to a group.
             return { success: false, error: `Asset ${versionId} is already a version or cannot be added.` };
         }

     } catch (error: any) {
        console.error(`❌ Failed to add asset ${versionId} to group ${masterId}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred' };
     }
  });

  ipcMain.handle('remove-from-group', async (_, { versionId }: { versionId: number }): Promise<{ success: boolean, error?: string }> => {
      console.log(`⚙️ remove-from-group invoked for versionId: ${versionId}`);
      try {
         // Ensure the asset exists and is currently a version (master_id IS NOT NULL)
         const asset = getAssetByIdStmt.get(versionId);
         if (!asset) {
             throw new Error(`Asset with ID ${versionId} not found.`);
         }
         if ((asset as any).master_id === null) { // FIX: Use type assertion
            console.warn(`⚠️ Asset ${versionId} is already a master asset.`);
            return { success: false, error: `Asset ${versionId} is not currently part of a group.` };
         }

         const info = clearMasterIdStmt.run(versionId);
         console.log(`✅ Rows affected by remove-from-group: ${info.changes}`);
         return { success: info.changes > 0 };
      } catch (error: any) {
         console.error(`❌ Failed to remove asset ${versionId} from group:`, error);
         return { success: false, error: error.message || 'An unknown error occurred' };
      }
  });

  // --- End Versioning IPC Handlers ---

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
