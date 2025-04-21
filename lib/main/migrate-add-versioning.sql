-- Add master_id column to link versions to a master asset
ALTER TABLE assets ADD COLUMN master_id INTEGER NULL;

-- Add version_no column to track the version number within a group
ALTER TABLE assets ADD COLUMN version_no INTEGER NOT NULL DEFAULT 1;

-- Create an index for efficient querying of versions belonging to a master
CREATE INDEX IF NOT EXISTS idx_assets_master_version ON assets(master_id, version_no); 