-- Registry Database Schema
-- Multi-user rozpočet registry with real-time collaboration

-- Projects
CREATE TABLE IF NOT EXISTS registry_projects (
  project_id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  owner_id INTEGER NOT NULL,
  portal_project_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sheets (SO 201, SO 202, etc.)
CREATE TABLE IF NOT EXISTS registry_sheets (
  sheet_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES registry_projects(project_id) ON DELETE CASCADE,
  sheet_name VARCHAR(255) NOT NULL,
  sheet_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items (positions)
CREATE TABLE IF NOT EXISTS registry_items (
  item_id VARCHAR(255) PRIMARY KEY,
  sheet_id VARCHAR(255) NOT NULL REFERENCES registry_sheets(sheet_id) ON DELETE CASCADE,
  kod VARCHAR(50),
  popis TEXT NOT NULL,
  mnozstvi REAL DEFAULT 0,
  mj VARCHAR(20),
  cena_jednotkova REAL,
  cena_celkem REAL,
  item_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TOV data (Labor, Machinery, Materials)
CREATE TABLE IF NOT EXISTS registry_tov (
  tov_id VARCHAR(255) PRIMARY KEY,
  item_id VARCHAR(255) NOT NULL REFERENCES registry_items(item_id) ON DELETE CASCADE,
  tov_type VARCHAR(20) NOT NULL,
  tov_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions (for collaboration)
CREATE TABLE IF NOT EXISTS registry_permissions (
  permission_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES registry_projects(project_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_registry_sheets_project ON registry_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_registry_items_sheet ON registry_items(sheet_id);
CREATE INDEX IF NOT EXISTS idx_registry_tov_item ON registry_tov(item_id);
CREATE INDEX IF NOT EXISTS idx_registry_permissions_project ON registry_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_registry_permissions_user ON registry_permissions(user_id);
