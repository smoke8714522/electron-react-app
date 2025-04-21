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
  shares: number | null; // Renamed from adspower, now numeric
  // Custom fields will be handled in a separate table
  // PRD: Added for versioning
  master_id?: number | null;
  version_no?: number;
  // Step 2: Add fields calculated by get-assets
  versionCount?: number | null;
  accumulatedShares?: number | null;
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
      shares INTEGER,        -- Renamed from adspower, storing as INTEGER
      master_id INTEGER NULL REFERENCES assets(id) ON DELETE SET NULL,
      version_no INTEGER NOT NULL DEFAULT 1
    );
  `);

  // PRAGMA user_version is a way to manage schema versions
  // Read the version FIRST
  const user_version = db.pragma('user_version', { simple: true }) as number;

  if (user_version === 0) {
    // Migration from initial schema (version 0) to version 1
    console.log("Running migration from version 0 to 1...");
    // Attempt to rename the column if it exists (handles migration)
    try {
      // PRD §4.2 Data Model - Add migration step for renaming adspower to shares
      // This will fail if the column doesn't exist (new db) or already renamed, which is fine.
      db.exec(`ALTER TABLE assets RENAME COLUMN adspower TO shares;`);
      console.log("Successfully migrated 'adspower' column to 'shares'.");
    } catch (error: any) {
      // Ignore errors like "no such column" or "duplicate column name"
      if (!error.message.includes('no such column') && !error.message.includes('duplicate column name')) {
        console.warn("Could not rename 'adspower' to 'shares', it might already be renamed or another issue occurred:", error.message);
      }
    }
    // Attempt to change column type to INTEGER if it exists as TEXT (handles migration)
    // Note: SQLite's ALTER TABLE limitations mean we can't directly change type easily.
    // This might require more complex migration (new table, copy data, drop old, rename new)
    // for production apps. For now, we assume new columns or accept TEXT if migration fails.
    // If `ALTER TABLE assets RENAME COLUMN adspower TO shares;` succeeded, the type is likely still TEXT.
    // A robust migration is omitted for brevity but noted here.

    // Add new columns and index for version control (Step 1)
    try {
      db.exec(`ALTER TABLE assets ADD COLUMN master_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;`);
      db.exec(`ALTER TABLE assets ADD COLUMN version_no INTEGER NOT NULL DEFAULT 1;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_master ON assets(master_id);`);
      // Add the requested composite index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_master_version ON assets(master_id, version_no);`);
      console.log("Successfully added version control columns (master_id, version_no) and indexes (idx_assets_master, idx_assets_master_version).");
    } catch (error: any) {
        // Ignore errors like "duplicate column name" or "index ... already exists" if the migration is re-run
        if (!error.message.includes('duplicate column name') && !error.message.includes('already exists')) {
          console.error("Error adding version control columns/indexes:", error);
          // Depending on the error, you might want to throw it or handle it differently
        } else {
          console.log("Version control columns/indexes already exist.");
        }
    }

    // Set the new version
    db.pragma(`user_version = 1`);
    console.log("Migration to version 1 complete. Set user_version = 1.");
    // user_version is read-only; skip reassign
  }

  // Log the final version AFTER potential migration
  console.log(`Database user_version: ${user_version}`);

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