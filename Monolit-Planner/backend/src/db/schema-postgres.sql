-- PostgreSQL Schema for Monolit Planner
-- Auto-generated from SQLite schema with PostgreSQL-specific types

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

-- Email verification tokens table (Phase 1: Email Verification)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens table (Phase 2: Password Reset)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bridges table
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
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

-- Snapshots table
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

-- Mapping profiles table
CREATE TABLE IF NOT EXISTS mapping_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  column_mapping TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project config table
CREATE TABLE IF NOT EXISTS project_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feature_flags TEXT NOT NULL,
  defaults TEXT NOT NULL,
  days_per_month_mode INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTSKP codes table
CREATE TABLE IF NOT EXISTS otskp_codes (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price REAL NOT NULL,
  specification TEXT,
  search_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MonolithProjects table (universal object for all construction types)
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

-- Part Templates table (predefined parts for each construction type)
CREATE TABLE IF NOT EXISTS part_templates (
  template_id VARCHAR(255) PRIMARY KEY,
  object_type VARCHAR(50) NOT NULL,
  part_name VARCHAR(255) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parts table (actual parts for each project)
CREATE TABLE IF NOT EXISTS parts (
  part_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  is_predefined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table (Phase 3: Admin Panel & Audit Logging)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PORTAL TABLES (Main entry point for all projects and files)
-- ============================================================================

-- Portal projects table (main project registry)
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

-- Portal files table (all files uploaded to portal)
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

-- Kiosk links table (links between portal projects and kiosk services)
CREATE TABLE IF NOT EXISTS kiosk_links (
  link_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  kiosk_type VARCHAR(50) NOT NULL,
  kiosk_project_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  handshake_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP
);

-- Chat sessions table (chat sessions for each project)
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table (messages in chat sessions)
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bridges_owner ON bridges(owner_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(status);
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
CREATE INDEX IF NOT EXISTS idx_part_templates_type ON part_templates(object_type);
CREATE INDEX IF NOT EXISTS idx_parts_project ON parts(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Portal indexes
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

-- Seed part templates for all construction types
INSERT INTO part_templates (template_id, object_type, part_name, display_order, is_default, description) VALUES
  ('bridge_ZÁKLADY', 'bridge', 'ZÁKLADY', 1, TRUE, 'Hloubkové a plošné založení'),
  ('bridge_OPĚRY', 'bridge', 'OPĚRY', 2, TRUE, 'Koncové opěry/krajní podpory'),
  ('bridge_PILÍŘE', 'bridge', 'PILÍŘE', 3, TRUE, 'Mezipolí/středové pilíře'),
  ('bridge_KLENBY', 'bridge', 'KLENBY', 4, TRUE, 'Rozpětná pole/pěšinka'),
  ('bridge_ŘÍMSY', 'bridge', 'ŘÍMSY', 5, TRUE, 'Římsové profily a ochranné prvky'),
  ('building_ZÁKLADY', 'building', 'ZÁKLADY', 1, TRUE, 'Hloubkové a plošné základy'),
  ('building_SLOUPY', 'building', 'SLOUPY', 2, TRUE, 'Nosné sloupy'),
  ('building_STĚNY', 'building', 'STĚNY', 3, TRUE, 'Nosné a obvodové stěny'),
  ('building_STROPY', 'building', 'STROPY', 4, TRUE, 'Stropní desky a konstrukce'),
  ('building_SCHODIŠTĚ', 'building', 'SCHODIŠTĚ', 5, FALSE, 'Schodiště a výtahové šachty'),
  ('parking_ZÁKLADY', 'parking', 'ZÁKLADY', 1, TRUE, 'Hloubkové založení'),
  ('parking_SLOUPY', 'parking', 'SLOUPY', 2, TRUE, 'Nosné sloupy'),
  ('parking_STĚNY', 'parking', 'STĚNY', 3, TRUE, 'Obvodové a nosné stěny'),
  ('parking_STROPY', 'parking', 'STROPY', 4, TRUE, 'Stropní platformy'),
  ('parking_RAMPY', 'parking', 'RAMPY', 5, TRUE, 'Sjezdové rampy a komunikace'),
  ('road_ZÁKLADY', 'road', 'ZÁKLADY', 1, TRUE, 'Zemní těleso/podklad'),
  ('road_PODBASE', 'road', 'PODBASE', 2, TRUE, 'Podkladní stabilizační vrstva'),
  ('road_ASFALT', 'road', 'ASFALT', 3, TRUE, 'Asfaltobetonová vrstva'),
  ('road_DRENÁŽ', 'road', 'DRENÁŽ', 4, TRUE, 'Drenážní systém')
ON CONFLICT (template_id) DO NOTHING;
