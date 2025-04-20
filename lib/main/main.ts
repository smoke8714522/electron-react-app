import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import Database from 'better-sqlite3'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { initializeDatabase, type Item } from '../../main/schema'

// Initialize SQLite Database
// Using path.join to ensure the path is correct across platforms
// app.getPath('userData') provides a standard location for app data
const dbPath = path.join(app.getPath('userData'), 'myDatabase.db')
const db = new Database(dbPath)
initializeDatabase(db)

// Prepare SQL statements for better performance and security
const getItemsStmt = db.prepare('SELECT * FROM items')
const createItemStmt = db.prepare('INSERT INTO items (name, description) VALUES (?, ?)')
const updateItemStmt = db.prepare('UPDATE items SET name = ?, description = ? WHERE id = ?')
const deleteItemStmt = db.prepare('DELETE FROM items WHERE id = ?')

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // --- IPC Handlers --- 
  ipcMain.handle('get-items', async () => {
    try {
      return getItemsStmt.all() as Item[]
    } catch (error) {
      console.error('Failed to get items:', error)
      return [] // Return empty array on error
    }
  })

  ipcMain.handle('create-item', async (_, item: { name: string; description: string }) => {
    try {
      const info = createItemStmt.run(item.name, item.description)
      // Return the newly created item (including the auto-incremented ID)
      return { id: info.lastInsertRowid, ...item } as Item
    } catch (error) {
      console.error('Failed to create item:', error)
      return null // Indicate failure
    }
  })

  ipcMain.handle('update-item', async (_, item: Item) => {
    try {
      const info = updateItemStmt.run(item.name, item.description, item.id)
      return info.changes > 0 // Return true if a row was updated
    } catch (error) {
      console.error('Failed to update item:', error)
      return false // Indicate failure
    }
  })

  ipcMain.handle('delete-item', async (_, id: number) => {
    try {
      const info = deleteItemStmt.run(id)
      return info.changes > 0 // Return true if a row was deleted
    } catch (error) {
      console.error('Failed to delete item:', error)
      return false // Indicate failure
    }
  })
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
