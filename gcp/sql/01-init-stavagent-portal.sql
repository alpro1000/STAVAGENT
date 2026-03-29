-- ============================================================
-- stavagent_portal database — Full schema
-- Run in Cloud SQL Studio → database: stavagent_portal
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Legacy bridge tables (Monolit integration)
CREATE TABLE IF NOT EXISTS bridges (
  bridge_id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255),
  object_name VARCHAR(255) NOT NULL DEFAULT '',
  element_count INTEGER DEFAULT 0,
  concrete_m3 REAL DEFAULT 0,
  sum_kros_czk REAL DEFAULT 0,
  span_length_m REAL,
  deck_width_m REAL,
  pd_weeks REAL,
  status VARCHAR(50) DEFAULT 'active',
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  portal_project_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(255) PRIMARY KEY,
  bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  subtype VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  qty REAL NOT NULL,
  qty_m3_helper REAL,
  crew_size INTEGER NOT NULL DEFAULT 4,
  wage_czk_ph REAL NOT NULL DEFAULT 398,
  shift_hours REAL NOT NULL DEFAULT 10,
  days REAL NOT NULL DEFAULT 0,
  labor_hours REAL,
  cost_czk REAL,
  unit_cost_native REAL,
  concrete_m3 REAL,
  unit_cost_on_m3 REAL,
  kros_unit_czk REAL,
  kros_total_czk REAL,
  has_rfi INTEGER DEFAULT 0,
  rfi_message TEXT,
  item_name VARCHAR(255),
  otskp_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshots (
  id VARCHAR(255) PRIMARY KEY,
  bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE,
  snapshot_name VARCHAR(255),
  snapshot_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  positions_snapshot TEXT NOT NULL,
  header_kpi_snapshot TEXT NOT NULL,
  description TEXT,
  is_locked INTEGER DEFAULT 1,
  is_final INTEGER DEFAULT 0,
  parent_snapshot_id VARCHAR(255) REFERENCES snapshots(id) ON DELETE SET NULL,
  sum_kros_at_lock REAL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mapping_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  column_mapping TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feature_flags TEXT NOT NULL,
  defaults TEXT NOT NULL,
  days_per_month_mode INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otskp_codes (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price REAL NOT NULL,
  specification TEXT,
  search_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monolith_projects (
  project_id VARCHAR(255) PRIMARY KEY,
  object_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  project_name VARCHAR(255),
  object_name VARCHAR(255) NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  element_count INTEGER DEFAULT 0,
  concrete_m3 REAL DEFAULT 0,
  sum_kros_czk REAL DEFAULT 0,
  span_length_m REAL,
  deck_width_m REAL,
  pd_weeks REAL,
  building_area_m2 REAL,
  building_floors INTEGER,
  road_length_km REAL,
  road_width_m REAL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PORTAL TABLES (Main entry point)
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_projects (
  portal_project_id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50),
  description TEXT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  core_project_id VARCHAR(255),
  core_status VARCHAR(50) DEFAULT 'not_sent',
  core_audit_result VARCHAR(50),
  core_last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_files (
  file_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  core_workflow_id VARCHAR(255),
  core_status VARCHAR(50) DEFAULT 'not_sent',
  analysis_result TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_documents (
  document_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  source_file_id VARCHAR(255),
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kiosk_links (
  link_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  kiosk_type VARCHAR(50) NOT NULL,
  kiosk_project_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  handshake_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP,
  UNIQUE(portal_project_id, kiosk_type)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  message_id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- UNIFIED PROJECT STRUCTURE (Portal Objects + Positions)
-- ============================================================

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

CREATE TABLE IF NOT EXISTS portal_positions (
  position_id VARCHAR(255) PRIMARY KEY,
  object_id VARCHAR(255) NOT NULL REFERENCES portal_objects(object_id) ON DELETE CASCADE,
  kod VARCHAR(50) NOT NULL,
  popis TEXT NOT NULL,
  mnozstvi REAL NOT NULL DEFAULT 0,
  mj VARCHAR(20),
  cena_jednotkova REAL,
  cena_celkem REAL,
  tov_labor TEXT,
  tov_machinery TEXT,
  tov_materials TEXT,
  monolit_position_id VARCHAR(255),
  registry_item_id VARCHAR(255),
  last_sync_from VARCHAR(20),
  last_sync_at TIMESTAMP,
  -- Position Instance Architecture
  position_instance_id UUID DEFAULT gen_random_uuid() NOT NULL,
  sheet_name VARCHAR(255),
  row_index INTEGER DEFAULT 0,
  skupina VARCHAR(50),
  row_role VARCHAR(20) DEFAULT 'unknown',
  template_id UUID,
  template_confidence VARCHAR(10),
  monolith_payload JSONB,
  dov_payload JSONB,
  overrides JSONB,
  created_by VARCHAR(100) DEFAULT 'legacy',
  updated_by VARCHAR(100) DEFAULT 'legacy',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS position_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  catalog_code VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  normalized_description TEXT NOT NULL,
  display_description TEXT NOT NULL,
  monolith_template JSONB,
  dov_template JSONB,
  scaling_rule VARCHAR(20) NOT NULL DEFAULT 'linear',
  source_qty REAL NOT NULL,
  source_instance_id UUID NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  apply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, catalog_code, unit, normalized_description)
);

CREATE TABLE IF NOT EXISTS position_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT NOW(),
  event VARCHAR(50) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  position_instance_id UUID,
  template_id UUID,
  details JSONB
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bridges_owner ON bridges(owner_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(status);
CREATE INDEX IF NOT EXISTS idx_bridges_portal_project ON bridges(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
CREATE INDEX IF NOT EXISTS idx_positions_otskp ON positions(otskp_code);
CREATE INDEX IF NOT EXISTS idx_snapshots_bridge ON snapshots(bridge_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_locked ON snapshots(is_locked);
CREATE INDEX IF NOT EXISTS idx_snapshots_final ON snapshots(is_final);
CREATE INDEX IF NOT EXISTS idx_otskp_code ON otskp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otskp_name ON otskp_codes(name);
CREATE INDEX IF NOT EXISTS idx_otskp_search_name ON otskp_codes(search_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_owner ON monolith_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_type ON monolith_projects(object_type);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_status ON monolith_projects(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_projects_owner ON portal_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_portal_projects_type ON portal_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_portal_projects_core_status ON portal_projects(core_status);
CREATE INDEX IF NOT EXISTS idx_portal_files_project ON portal_files(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_files_type ON portal_files(file_type);
CREATE INDEX IF NOT EXISTS idx_portal_files_uploader ON portal_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_portal_files_core_workflow ON portal_files(core_workflow_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_links_project ON kiosk_links(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_links_type ON kiosk_links(kiosk_type);
CREATE INDEX IF NOT EXISTS idx_kiosk_links_kiosk_project ON kiosk_links(kiosk_project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_documents_project ON portal_documents(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_documents_type ON portal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_portal_documents_source ON portal_documents(source_file_id);
CREATE INDEX IF NOT EXISTS idx_portal_objects_project ON portal_objects(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_objects_code ON portal_objects(object_code);
CREATE INDEX IF NOT EXISTS idx_portal_positions_object ON portal_positions(object_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_kod ON portal_positions(kod);
CREATE INDEX IF NOT EXISTS idx_portal_positions_monolit ON portal_positions(monolit_position_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_registry ON portal_positions(registry_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_positions_instance_id ON portal_positions(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_skupina ON portal_positions(skupina);
CREATE INDEX IF NOT EXISTS idx_portal_positions_template ON portal_positions(template_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_row_role ON portal_positions(row_role);
CREATE INDEX IF NOT EXISTS idx_position_templates_project ON position_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_position_templates_code ON position_templates(catalog_code);
CREATE INDEX IF NOT EXISTS idx_position_templates_code_unit ON position_templates(catalog_code, unit);
CREATE INDEX IF NOT EXISTS idx_position_audit_log_project ON position_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_position_audit_log_instance ON position_audit_log(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_position_audit_log_event ON position_audit_log(event);
CREATE INDEX IF NOT EXISTS idx_position_audit_log_timestamp ON position_audit_log(timestamp DESC);

-- Seed default admin user (placeholder hash — app seedAdminIfNeeded() will
-- detect the invalid hash and replace it with bcrypt('123456') on first boot)
INSERT INTO users (email, password_hash, name, role, email_verified, email_verified_at)
VALUES ('admin@stavagent.cz', '$2b$10$placeholder_will_be_fixed_by_seed', 'Admin', 'admin', true, NOW())
ON CONFLICT (email) DO NOTHING;
