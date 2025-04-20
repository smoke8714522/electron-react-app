import Database from 'better-sqlite3';

// PRD §4.2 Data Model - Define Asset structure
export interface Asset {
  id: number;
  fileName: string; // Original filename
  filePath: string; // Relative path within the vault
  mimeType: string; // Detected MIME type
  size: number; // File size in bytes
  createdAt: string; // ISO 8601 date string
  year: number | null;
  advertiser: string | null;
  niche: string | null;
  adspower: string | null;
  // Custom fields will be handled in a separate table
}

// PRD §4.2 Data Model - Define Custom Field structure
export interface CustomField {
  id: number;
  assetId: number; // Foreign key to assets table
  key: string;
  value: string;
}

export function initializeDatabase(db: Database.Database): void {
  // Drop the old table if it exists (simple migration)
  db.exec(`DROP TABLE IF EXISTS items;`);
  db.exec(`DROP INDEX IF EXISTS idx_items_filePath;`);

  // PRD §4.2 Data Model - Create assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL UNIQUE, -- Store the vault-relative path, ensure uniqueness
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL, -- Store size in bytes
      createdAt TEXT NOT NULL, -- Store as ISO 8601 string
      year INTEGER,          -- e.g., 2023
      advertiser TEXT,       -- e.g., "Client Name"
      niche TEXT,            -- e.g., "E-commerce"
      adspower TEXT          -- e.g., "Profile ID or Name"
    );
  `);

  // PRD §4.2 Data Model - Add index for faster lookups by path
  db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_filePath ON assets (filePath);`);

  // PRD §4.2 Data Model - Create custom_fields table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (assetId) REFERENCES assets (id) ON DELETE CASCADE
    );
  `);

  // PRD §4.2 Data Model - Add index for faster lookups of custom fields by assetId
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_fields_assetId ON custom_fields (assetId);`);
  // PRD §4.2 Data Model - Ensure unique key per asset
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_fields_assetId_key ON custom_fields (assetId, key);`);
} 