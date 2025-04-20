import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import mime from 'mime-types'
import Database from 'better-sqlite3'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { initializeDatabase, type Item } from '../../main/schema'

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
const dbPath = path.join(app.getPath('userData'), 'vaultDatabase.db') // Restore DB name
const db = new Database(dbPath)
initializeDatabase(db)

// Prepare SQL statements for the updated schema
// PRD Section 2: File Support - Updated SQL statements
const getItemsStmt = db.prepare('SELECT id, name, description, filePath, mimeType, size FROM items');
const importFileStmt = db.prepare('INSERT INTO items (name, description, filePath, mimeType, size) VALUES (?, ?, ?, ?, ?)');
const updateItemStmt = db.prepare('UPDATE items SET name = ?, description = ? WHERE id = ?'); // Only update name/desc
const getItemPathStmt = db.prepare('SELECT filePath FROM items WHERE id = ?'); // To get path for deletion
const deleteItemStmt = db.prepare('DELETE FROM items WHERE id = ?');

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
  ipcMain.handle('get-items', async () => {
    try {
      // PRD Section 2: File Support - Fetch items with file metadata
      return getItemsStmt.all() as Item[]
    } catch (error) {
      console.error('Failed to get items:', error)
      return []
    }
  })

  // PRD Section 2: File Support - New handler for importing files
  ipcMain.handle('import-file', async (_, sourcePath: string) => {
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
      const originalName = path.basename(sourcePath);

      // Insert metadata into DB
      const info = importFileStmt.run(originalName, '', relativeVaultPath, mimeType, stats.size);
      
      // Return the newly created item data
      return {
        success: true,
        item: {
          id: info.lastInsertRowid,
          name: originalName,
          description: '',
          filePath: relativeVaultPath, // Return relative path
          mimeType: mimeType,
          size: stats.size
        } as Item
      };
    } catch (error) {
      console.error('Failed to import file:', error);
      let errorMessage = 'Unknown error during file import.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // Attempt to clean up potentially copied file if DB insert failed - more robust error handling could be added
      return { success: false, error: `Failed to import file: ${errorMessage}` };
    }
  });

  ipcMain.handle('update-item', async (_, item: Pick<Item, 'id' | 'name' | 'description'>) => { // Only update name/desc
    try {
      // PRD Section 2: File Support - Update limited fields (name, description)
      const info = updateItemStmt.run(item.name, item.description, item.id)
      return info.changes > 0 
    } catch (error) {
      console.error('Failed to update item:', error)
      return false 
    }
  })

  ipcMain.handle('delete-item', async (_, id: number) => {
    let vaultFilePath = '';
    try {
      // 1. Get the relative file path from the database
      const row = getItemPathStmt.get(id) as { filePath: string } | undefined;
      if (!row || !row.filePath) {
        console.warn(`No file path found for item ID ${id}. Deleting DB record only.`);
      } else {
          // Construct full path using VAULT_ROOT and the relative path
          vaultFilePath = path.join(VAULT_ROOT, row.filePath); // Use path.join
      }

      // 2. Delete the database record first
      const dbInfo = deleteItemStmt.run(id)
      if (dbInfo.changes === 0) {
          console.warn(`No database record found for item ID ${id} during delete.`);
          return true; // Assume already deleted or doesn't exist
      }

      // 3. Delete the file from the vault if path was constructed and file exists
      if (vaultFilePath && fs.existsSync(vaultFilePath)) {
          try {
              fs.unlinkSync(vaultFilePath);
              console.log(`Deleted file: ${vaultFilePath}`);
          } catch (fileError) {
              console.error(`Failed to delete file ${vaultFilePath} for item ID ${id}:`, fileError);
              // Log error but still return true as DB record is deleted
          }
      }
      
      return true // Indicate success (DB record deleted)
    } catch (error) {
      console.error(`Failed to delete item ID ${id}:`, error)
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
