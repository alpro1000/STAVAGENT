-- Migration 010: Create Unified Project Registry
-- Purpose: Foundation for cross-kiosk project tracking with position identity

-- 1. Projects table (extends existing monolith_projects)
CREATE TABLE IF NOT EXISTS registry_projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Objects table (bridges, buildings, etc.)
CREATE TABLE IF NOT EXISTS registry_objects (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES registry_projects(id) ON DELETE CASCADE,
  object_name TEXT NOT NULL,
  object_type TEXT NOT NULL, -- 'bridge', 'building', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(project_id, object_name)
);

-- 3. Source files table
CREATE TABLE IF NOT EXISTS registry_source_files (
  id SERIAL PRIMARY KEY,
  object_id INTEGER REFERENCES registry_objects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'xlsx', 'pdf', 'docx'
  upload_date TIMESTAMP DEFAULT NOW(),
  file_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. File versions table
CREATE TABLE IF NOT EXISTS registry_file_versions (
  id SERIAL PRIMARY KEY,
  source_file_id INTEGER REFERENCES registry_source_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  file_hash TEXT NOT NULL,
  changes_summary TEXT,
  UNIQUE(source_file_id, version_number)
);

-- 5. Position instances table (core identity system)
CREATE TABLE IF NOT EXISTS registry_position_instances (
  id SERIAL PRIMARY KEY,
  object_id INTEGER REFERENCES registry_objects(id) ON DELETE CASCADE,
  source_file_id INTEGER REFERENCES registry_source_files(id),
  file_version_id INTEGER REFERENCES registry_file_versions(id),
  
  -- Identity fields
  position_code TEXT NOT NULL, -- e.g., "1.2.3"
  position_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  
  -- Kiosk-specific data
  kiosk_type TEXT NOT NULL, -- 'monolit', 'registry', 'urs'
  kiosk_data JSONB DEFAULT '{}'::jsonb,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(object_id, position_code, file_version_id)
);

-- 6. Position templates table (for future use)
CREATE TABLE IF NOT EXISTS registry_position_templates (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL UNIQUE,
  position_code TEXT NOT NULL,
  position_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_quantity NUMERIC(12,3),
  kiosk_type TEXT NOT NULL,
  template_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Apply logs table (track template applications)
CREATE TABLE IF NOT EXISTS registry_apply_logs (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES registry_position_templates(id),
  object_id INTEGER REFERENCES registry_objects(id),
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by TEXT,
  result JSONB DEFAULT '{}'::jsonb
);

-- 8. Relink reports table (track file updates)
CREATE TABLE IF NOT EXISTS registry_relink_reports (
  id SERIAL PRIMARY KEY,
  source_file_id INTEGER REFERENCES registry_source_files(id),
  old_version_id INTEGER REFERENCES registry_file_versions(id),
  new_version_id INTEGER REFERENCES registry_file_versions(id),
  relink_date TIMESTAMP DEFAULT NOW(),
  positions_added INTEGER DEFAULT 0,
  positions_removed INTEGER DEFAULT 0,
  positions_updated INTEGER DEFAULT 0,
  positions_unchanged INTEGER DEFAULT 0,
  report_data JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_registry_objects_project ON registry_objects(project_id);
CREATE INDEX idx_registry_source_files_object ON registry_source_files(object_id);
CREATE INDEX idx_registry_file_versions_source ON registry_file_versions(source_file_id);
CREATE INDEX idx_registry_positions_object ON registry_position_instances(object_id);
CREATE INDEX idx_registry_positions_code ON registry_position_instances(position_code);
CREATE INDEX idx_registry_positions_active ON registry_position_instances(is_active);

-- Migration metadata
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('010', NOW())
ON CONFLICT (version) DO NOTHING;
