-- Migration: Add unified project structure for Monolit ↔ Registry integration
-- Date: 2026-02-10
-- Purpose: Enable cross-kiosk data synchronization with TOV (Rozpis zdrojů)

-- Portal Objects table (SO 202, SO 203, etc.)
CREATE TABLE IF NOT EXISTS portal_objects (
  object_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  object_code VARCHAR(50) NOT NULL,
  object_name VARCHAR(255) NOT NULL,
  object_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(portal_project_id, object_code)
);

-- Portal Positions table (unified positions with TOV data)
CREATE TABLE IF NOT EXISTS portal_positions (
  position_id VARCHAR(255) PRIMARY KEY,
  object_id VARCHAR(255) NOT NULL REFERENCES portal_objects(object_id) ON DELETE CASCADE,
  kod VARCHAR(50) NOT NULL,
  popis TEXT NOT NULL,
  mnozstvi REAL NOT NULL DEFAULT 0,
  mj VARCHAR(20),
  cena_jednotkova REAL,
  cena_celkem REAL,
  
  -- TOV data (JSON)
  tov_labor TEXT,
  tov_machinery TEXT,
  tov_materials TEXT,
  
  -- Sync metadata
  monolit_position_id VARCHAR(255),
  registry_item_id VARCHAR(255),
  last_sync_from VARCHAR(20),
  last_sync_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_objects_project ON portal_objects(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_objects_code ON portal_objects(object_code);
CREATE INDEX IF NOT EXISTS idx_portal_positions_object ON portal_positions(object_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_kod ON portal_positions(kod);
CREATE INDEX IF NOT EXISTS idx_portal_positions_monolit ON portal_positions(monolit_position_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_registry ON portal_positions(registry_item_id);
