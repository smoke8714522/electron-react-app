import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises' // Use promises for async file operations
import mime from 'mime-types'
import Database from 'better-sqlite3'
import { electronApp } from '@electron-toolkit/utils'
import { initializeDatabase, type Asset as BaseAsset } from '../../main/schema'
import { generateThumbnail, getExistingThumbnailPath } from './ThumbnailService'
import crypto from 'crypto'; // For generating unique names
import { createAppWindow } from './app'

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

// Extend base Asset type locally for main process logic
// This Asset type now includes optional master_id and version_no
interface Asset extends BaseAsset {
  master_id?: number | null;
  version_no?: number;
}

// Define AssetWithThumbnail based on the extended Asset type
interface AssetWithThumbnail extends Asset {
  thumbnailPath?: string | null;
  accumulatedShares?: number | null;
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

// Re-add necessary prepared statements
const getAssetByIdStmt = db.prepare<[number], Asset>('SELECT * FROM assets WHERE id = ?');
const getAssetPathStmt = db.prepare<{ id: number }, { filePath: string }>('SELECT filePath FROM assets WHERE id = ?'); // To get path for deletion
const deleteAssetStmt = db.prepare('DELETE FROM assets WHERE id = ?'); // Cascades to custom_fields
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
  // Create the main application window
  createAppWindow()

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

        const assetsFromDb = db.prepare(query).all(...queryParams) as Asset[]; // Renamed to avoid conflict

      const assetsWithThumbnails: AssetWithThumbnail[] = [];
      // Iterate and add thumbnail path if it exists
      for (const asset of assetsFromDb) { // Use renamed variable
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
      
      const thumbnailPath = await getExistingThumbnailPath(newAssetId);
      
      // Simplify check using nullish coalescing operator
      const accumulatedSharesValue = (newAssetResult as any).accumulatedShares;
      const finalAccumulatedShares = accumulatedSharesValue ?? null;
      console.log(`✅ Asset ${newAssetId} created successfully from ${sourcePath}`);
      return { success: true, asset: { ...newAssetResult, accumulatedShares: finalAccumulatedShares, thumbnailPath } };

    } catch (error: any) {
      console.error(`❌ Error creating asset from ${sourcePath}: `, error);
      return { success: false, error: error.message || 'Failed to create asset' };
    }
  });

  ipcMain.handle('bulk-import-assets', async (_): Promise<{ success: boolean, importedCount: number, assets?: AssetWithThumbnail[], errors: { file: string, error: string }[] }> => {
    console.log('🚀 bulk-import-assets invoked');
    const { filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      properties: ['openFile', 'multiSelections'],
      // Add filters for common media types if desired
    });

    if (!filePaths || filePaths.length === 0) {
      console.log('No files selected for bulk import.');
      return { success: true, importedCount: 0, assets: [], errors: [] };
    }

    console.log(`Starting bulk import for ${filePaths.length} files.`);
    let importedCount = 0;
    const errors: { file: string, error: string }[] = [];

    // Helper function to create a single asset, reused from 'create-asset' logic
    const createSingleAsset = async (sourcePath: string): Promise<{ success: boolean, asset?: AssetWithThumbnail, error?: string }> => {
      try {
          await fs.access(sourcePath);
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
              year: null, advertiser: null, niche: null, shares: null
          });

          const newAssetId = info.lastInsertRowid;
          if (typeof newAssetId !== 'number' && typeof newAssetId !== 'bigint') {
               throw new Error('Failed to get ID of newly created asset.');
          }
          console.log(`✅ Asset ${newAssetId} created successfully from ${sourcePath}`);
          return { success: true, asset: { id: newAssetId, thumbnailPath: null, accumulatedShares: null } };

      } catch (error: any) {
          console.error('Error importing '+ sourcePath + ': ', error);
          return { success: false, error: error.message || 'Import failed' };
      }
    };

    for (const filePath of filePaths) {
      const result = await createSingleAsset(filePath);
      if (result.success && result.asset) {
        importedCount++;
      } else {
        errors.push({ file: filePath, error: result.error || 'Unknown error during import' });
      }
    }

    console.log(`Bulk import finished. Imported: ${importedCount}, Errors: ${errors.length}`);
    return { success: true, importedCount, assets: [], errors };
  });

  ipcMain.handle('update-asset', async (_, { id, updates }: { id: number, updates: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'>> }): Promise<boolean> => {
    console.log(`🔄 update-asset invoked for ID: ${id} with updates:`, updates);
    try {
      const tx = db.transaction(() => {
        const standardFields: Partial<Omit<Asset, 'id' | 'filePath' | 'mimeType' | 'size' | 'createdAt'>> = {};
        const customFields: { [key: string]: string } = {};

        for (const key in updates) {
          if (Object.prototype.hasOwnProperty.call(updates, key)) {
            if (['fileName', 'year', 'advertiser', 'niche', 'shares', 'master_id', 'version_no'].includes(key)) {
              const value = updates[key];
              // Correctly handle empty string for numeric fields, otherwise treat as null
              standardFields[key] = (typeof value === 'string' && value === '') ? null : 
                                      (value === undefined) ? null : 
                                      (key === 'year' || key === 'shares') ? Number(value) : value;

              if ((key === 'year' || key === 'shares') && isNaN(standardFields[key] as number)) {
                  standardFields[key] = null; // Ensure NaN becomes null
              }
            } else {
              // Assume other keys are custom fields
              customFields[key] = updates[key];
            }
          }
        }

        // Update standard asset fields
        if (Object.keys(standardFields).length > 0) {
          const setClauses = Object.keys(standardFields).map(fieldKey => `${fieldKey} = @${fieldKey}`).join(', ');
          const updateStmt = db.prepare(`UPDATE assets SET ${setClauses} WHERE id = @id`);
          const info = updateStmt.run({ ...standardFields, id });
          console.log(`Updated asset ${id} standard fields, changes: ${info.changes}`);
        }

        // Update/Insert custom fields
        if (Object.keys(customFields).length > 0) {
          const upsertStmt = db.prepare('INSERT INTO custom_fields (assetId, key, value) VALUES (@assetId, @key, @value) ON CONFLICT(assetId, key) DO UPDATE SET value = excluded.value');
          for (const key in customFields) {
            upsertStmt.run({ assetId: id, key, value: customFields[key] });
          }
          console.log(`Upserted ${Object.keys(customFields).length} custom fields for asset ${id}`);
        }
      });

      tx();
      console.log(`✅ Asset ${id} updated successfully.`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error updating asset ${id}: `, error);
      return false;
    }
  });

  ipcMain.handle('delete-asset', async (_, id: number): Promise<boolean> => {
    console.log(`🗑️ delete-asset invoked for ID: ${id}`);
    try {
      // Use re-added statement variables
      const assetInfo = getAssetPathStmt.get({ id });
      if (!assetInfo) {
          console.warn(`Asset with ID ${id} not found for deletion.`);
          return true; 
      }
      const absolutePath = path.join(VAULT_ROOT, assetInfo.filePath);
      
      // Use re-added statement variable
      const info = deleteAssetStmt.run(id);
      console.log(`Deleted asset record ${id}, changes: ${info.changes}`);

      try {
          await fs.unlink(absolutePath);
          console.log(`Deleted asset file: ${absolutePath}`);
      } catch (fileError: any) {
          console.error(`Error deleting asset file ${absolutePath} for asset ${id}: `, fileError);
      }

      try {
          await generateThumbnail(id, 'delete'); // Simulate deletion if ThumbnailService handles it
          console.log(`Deleted thumbnail for asset ${id}.`);
      } catch (thumbError: any) {
          console.error(`Error deleting thumbnail for asset ${id}: `, thumbError);
      }

      console.log(`✅ Asset ${id} deleted successfully.`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error deleting asset ${id}: `, error);
      return false;
    }
  });

  ipcMain.handle('regenerate-thumbnails', async (): Promise<{ regeneratedCount: number }> => {
    const rows = db.prepare('SELECT id, filePath FROM assets').all() as { id: number; filePath: string }[];
    let regeneratedCount = 0;
    for (const { id, filePath } of rows) {
      const existing = await getExistingThumbnailPath(id);
      if (!existing) {
        const absPath = path.join(VAULT_ROOT, filePath);
        const thumbResult = await generateThumbnail(id, absPath); 
        if (thumbResult) regeneratedCount++;
      }
    }
    return { regeneratedCount };
  });

  // IPC handler for file open dialog
  ipcMain.handle('open-file-dialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, options);
    return result;
  });

  // --- Versioning IPC Handlers ---

  // Step 1: Add promote-version stub
  ipcMain.handle('promote-version', async (_evt, { versionId }: { versionId: number }): Promise<{ success: boolean, error?: string }> => {
    console.log(`🚨 promote-version stub invoked for versionId: ${versionId}`);
    // TODO: Implement actual promotion logic
    // 1. Verify versionId exists and IS a version (master_id IS NOT NULL).
    // 2. Find its masterId.
    // 3. Find the current master asset (id = masterId).
    // 4. In a transaction:
    //    a. Update all siblings (other assets with same master_id) to point to the new master (versionId).
    //    b. Update the OLD master to become a version of the new master (set its master_id = versionId, calculate new version_no).
    //    c. Update the NEW master (versionId) to become a master (set master_id = NULL, version_no = 1).
    return { success: true }; // Return success for the stub
  });

  ipcMain.handle('create-version', async (_, { masterId, sourcePath }: { masterId: number, sourcePath: string }): Promise<{ success: boolean, newId?: number, error?: string }> => {
    console.log(`🔄 create-version invoked for master ID: ${masterId} from source: ${sourcePath}`);
    
    let newVersionId: number | bigint | undefined;
    let vaultFilePath: string | undefined;
    try {
        // Use re-added statement variables
        const masterAsset = getAssetByIdStmt.get(masterId);
        if (!masterAsset) {
            return { success: false, error: `Master asset with ID ${masterId} not found.` };
        }
        // Fix type error: Check if master_id exists and is not null
        if (masterAsset.master_id !== undefined && masterAsset.master_id !== null) {
            return { success: false, error: `Asset ID ${masterId} is already a version, cannot create a version from it.` };
        }

        await fs.access(sourcePath);
        
        const pathData = await generateUniqueVaultPath(sourcePath);
        vaultFilePath = pathData.absolutePath;
        const relativeVaultPath = pathData.relativePath;

        await fs.copyFile(sourcePath, vaultFilePath);
        console.log(`Copied ${sourcePath} to ${vaultFilePath}`);

        const stats = await fs.stat(vaultFilePath);
        const mimeType = mime.lookup(vaultFilePath) || 'application/octet-stream';
        const createdAt = new Date().toISOString();

        const tx = db.transaction(() => {
            // Use re-added statement variable
            const versionInfo = getMaxVersionNoStmt.get({ masterId });
            const nextVersionNo = (versionInfo?.max_version ?? 0) + 1;

            // Use re-added statement variable
            const info = insertVersionStmt.run({
                fileName: masterAsset.fileName,
                filePath: relativeVaultPath,
                mimeType: mimeType,
                size: stats.size,
                createdAt: createdAt,
                year: masterAsset.year,
                advertiser: masterAsset.advertiser,
                niche: masterAsset.niche,
                shares: masterAsset.shares,
                masterId: masterId,
                versionNo: nextVersionNo
            });

            if (typeof info.lastInsertRowid !== 'number' && typeof info.lastInsertRowid !== 'bigint') {
                 throw new Error('Failed to get ID of newly created version.');
            }
            console.log(`✅ Version ${info.lastInsertRowid} (v${nextVersionNo}) created for master ${masterId}.`);
            return { newId: info.lastInsertRowid as number, nextVersionNo };
        });

        const dbResult = tx();
        newVersionId = dbResult.newId;

        if (newVersionId && vaultFilePath) {
            generateThumbnail(newVersionId, vaultFilePath).catch(err => {
                console.error(`Failed to generate thumbnail for new version asset ${newVersionId}:`, err);
            });
        }

        return { success: true, newId: newVersionId };

    } catch (error: any) {
        console.error(`❌ Error creating version for master ${masterId} from ${sourcePath}: `, error);
        if (vaultFilePath) {
            try {
                await fs.unlink(vaultFilePath);
                console.log('Attempting to clean up copied file: ' + vaultFilePath);
            } catch (cleanupError) {
                 console.error('Failed cleanup for '+ vaultFilePath, cleanupError);
            }
        }
        return { success: false, error: error.message || 'Failed to create version' };
    }
  });

  ipcMain.handle('get-versions', async (_, { masterId }: { masterId: number }): Promise<{ success: boolean, assets?: AssetWithThumbnail[], error?: string }> => {
      console.log(`🔍 get-versions invoked for master ID: ${masterId}`);
      try {
          // Use re-added statement variable
          const versions = getVersionsStmt.all(masterId) as Asset[];

          const versionsWithThumbnails: AssetWithThumbnail[] = [];
          for (const version of versions) {
              const thumbnailPath = await getExistingThumbnailPath(version.id);
              const sharesAsNumber = typeof version.shares === 'string' ? parseInt(version.shares, 10) : version.shares;
              versionsWithThumbnails.push({ 
                  ...version, 
                  shares: isNaN(sharesAsNumber as number) ? null : sharesAsNumber,
                  thumbnailPath,
                  accumulatedShares: null 
              });
          }
          console.log(`Found ${versionsWithThumbnails.length} versions for master ${masterId}.`);
          return { success: true, assets: versionsWithThumbnails };
      } catch (error: any) {
          console.error(`❌ Error getting versions for master ${masterId}: `, error);
          return { success: false, error: error.message || 'Failed to get versions' };
      }
  });

  ipcMain.handle('add-to-group', async (_, { versionId, masterId }: { versionId: number, masterId: number }): Promise<{ success: boolean, error?: string }> => {
      console.log(`➕ add-to-group invoked: adding asset ${versionId} to master ${masterId}'s group`);
      const tx = db.transaction(() => {
          try {
              // Use re-added statement variables
              const assetToAdd = getAssetByIdStmt.get(versionId);
              const targetMaster = getAssetByIdStmt.get(masterId);

              // Fix type errors: Check if master_id exists and is not null
              if (!assetToAdd) return { success: false, error: `Asset to add (ID: ${versionId}) not found.` };
              if (assetToAdd.master_id !== undefined && assetToAdd.master_id !== null) return { success: false, error: `Asset ${versionId} is already a version.` };
              if (!targetMaster) return { success: false, error: `Target master asset (ID: ${masterId}) not found.` };
              if (targetMaster.master_id !== undefined && targetMaster.master_id !== null) return { success: false, error: `Target asset ${masterId} is itself a version, cannot add to it.` };
              if (versionId === masterId) return { success: false, error: 'Cannot add an asset to its own group.' };

              // Use re-added statement variable
              const info = setMasterIdStmt.run(masterId, masterId, versionId); 

              if (info.changes === 0) {
                  console.warn(`add-to-group: No changes made when setting master_id for asset ${versionId}.`);
                  return { success: false, error: 'Failed to update asset relationship. Asset may not exist or already be a version.' };
              }
              console.log(`✅ Asset ${versionId} successfully added to group of master ${masterId}.`);
              return { success: true };
          } catch (error: any) {
              console.error(`❌ Error adding asset ${versionId} to group ${masterId}: `, error);
              return { success: false, error: error.message || 'Failed to add asset to group' };
          }
      });
      return tx();
  });

  ipcMain.handle('remove-from-group', async (_, { versionId }: { versionId: number }): Promise<{ success: boolean, error?: string }> => {
      console.log(`➖ remove-from-group invoked for version ID: ${versionId}`);
      const tx = db.transaction(() => {
          try {
              // Use re-added statement variables
              const asset = getAssetByIdStmt.get(versionId);
              if (!asset) {
                  return { success: false, error: `Asset with ID ${versionId} not found.` };
              }
              // Fix type error: Check if master_id is null or undefined
              if (asset.master_id === null || asset.master_id === undefined) {
                  console.log(`Asset ${versionId} is already a master, no action needed for remove-from-group.`);
                  return { success: true };
              }

              // Use re-added statement variable
              const info = clearMasterIdStmt.run(versionId);

              if (info.changes === 0) {
                  console.warn(`remove-from-group: No changes made when clearing master_id for asset ${versionId}. Asset may not exist or already be a master.`);
                  // Still return success as the desired state (being a master) is achieved or it didn't exist
                  return { success: true }; 
              }
              console.log(`✅ Asset ${versionId} successfully removed from its group and became a master asset.`);
              return { success: true };
          } catch (error: any) {
              console.error(`❌ Error removing asset ${versionId} from group: `, error);
              return { success: false, error: error.message || 'Failed to remove asset from group' };
          }
      });
      // Ensure the main handler returns the result of the transaction execution
      return tx(); 
  });

  // --- App Lifecycle ---

  // ... existing code ...
});

// ... existing code ...