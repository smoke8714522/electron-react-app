import Database from 'better-sqlite3';

// PRD Section 2: File Support - Define file metadata structure
export interface Item {
  id: number;
  name: string; // Original filename or user-defined name
  description: string; // Optional user description
  filePath: string; // Absolute path within the vault
  mimeType: string; // Detected MIME type
  size: number; // File size in bytes
}

export function initializeDatabase(db: Database.Database): void {
  // PRD Section 2: File Support - Update schema for file metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      filePath TEXT NOT NULL UNIQUE, -- Store the vault-relative path, ensure uniqueness
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL -- Store size in bytes
    );
  `);
  // PRD Section 2: File Support - Add index for potentially faster lookups by path
  db.exec(`CREATE INDEX IF NOT EXISTS idx_items_filePath ON items (filePath);`);
} 