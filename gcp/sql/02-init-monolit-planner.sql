-- ============================================================
-- monolit_planner database — Full schema
-- Run in Cloud SQL Studio → database: monolit_planner
-- ============================================================

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

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
  portal_project_id TEXT,
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
  curing_days INTEGER DEFAULT 3,
  has_rfi INTEGER DEFAULT 0,
  rfi_message TEXT,
  item_name VARCHAR(255),
  otskp_code VARCHAR(50),
  position_instance_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Formwork calculator
CREATE TABLE IF NOT EXISTS formwork_calculator (
  id VARCHAR(255) PRIMARY KEY,
  bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE,
  construction_name VARCHAR(500) NOT NULL,
  total_area_m2 REAL NOT NULL DEFAULT 0,
  set_area_m2 REAL NOT NULL DEFAULT 0,
  num_tacts INTEGER NOT NULL DEFAULT 1,
  num_sets INTEGER NOT NULL DEFAULT 1,
  assembly_days_per_tact REAL DEFAULT 0,
  disassembly_days_per_tact REAL DEFAULT 0,
  days_per_tact REAL DEFAULT 0,
  formwork_term_days REAL DEFAULT 0,
  system_name VARCHAR(255) DEFAULT 'Frami Xlife',
  system_height VARCHAR(100) DEFAULT '',
  rental_czk_per_m2_month REAL DEFAULT 0,
  monthly_rental_per_set REAL DEFAULT 0,
  final_rental_czk REAL DEFAULT 0,
  kros_code VARCHAR(50),
  kros_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Snapshots
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

-- Configuration
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

-- Monolith Projects (universal)
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
  status VARCHAR(50) DEFAULT 'active',
  portal_project_id TEXT,
  -- Project hierarchy (Migration 001)
  stavba TEXT,
  objekt TEXT,
  soupis TEXT,
  parent_project_id VARCHAR(255)
);

-- Part Templates
CREATE TABLE IF NOT EXISTS part_templates (
  template_id VARCHAR(255) PRIMARY KEY,
  object_type VARCHAR(50) NOT NULL,
  part_name VARCHAR(255) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parts
CREATE TABLE IF NOT EXISTS parts (
  part_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  is_predefined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PORTAL TABLES (shared schema for cross-kiosk integration)
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
-- R0 DETERMINISTIC CORE (Migration 006)
-- ============================================================

CREATE TABLE IF NOT EXISTS r0_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shift_hours REAL NOT NULL DEFAULT 10.0,
  time_utilization_k REAL NOT NULL DEFAULT 0.80,
  days_per_month INTEGER NOT NULL DEFAULT 30,
  oh_rate REAL NOT NULL DEFAULT 0.13,
  profit_rate REAL NOT NULL DEFAULT 0.08,
  reserve_rate REAL NOT NULL DEFAULT 0.05,
  wage_rebar_czk_h REAL NOT NULL DEFAULT 398,
  wage_formwork_czk_h REAL NOT NULL DEFAULT 398,
  wage_concreting_czk_h REAL NOT NULL DEFAULT 398,
  pump_rate_czk_h REAL NOT NULL DEFAULT 1500,
  formwork_rental_czk_day REAL NOT NULL DEFAULT 300,
  crew_rebar_count INTEGER NOT NULL DEFAULT 1,
  crew_formwork_count INTEGER NOT NULL DEFAULT 1,
  crew_concreting_count INTEGER NOT NULL DEFAULT 1,
  formwork_kits_count INTEGER NOT NULL DEFAULT 1,
  pumps_count INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'active',
  owner_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES r0_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  length_m REAL,
  width_m REAL,
  height_m REAL,
  thickness_m REAL,
  concrete_volume_m3 REAL NOT NULL,
  formwork_area_m2 REAL NOT NULL,
  rebar_mass_t REAL NOT NULL,
  max_continuous_pour_hours REAL DEFAULT 12.0,
  layer_thickness_m REAL,
  source_tag TEXT DEFAULT 'USER',
  confidence REAL DEFAULT 1.0,
  assumptions_log TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS normsets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_tag TEXT NOT NULL,
  rebar_h_per_t REAL NOT NULL,
  formwork_assembly_h_per_m2 REAL NOT NULL,
  formwork_disassembly_h_per_m2 REAL NOT NULL,
  pour_team_required INTEGER NOT NULL DEFAULT 6,
  pour_setup_hours REAL NOT NULL DEFAULT 0.5,
  washout_hours REAL NOT NULL DEFAULT 0.5,
  strip_wait_hours REAL NOT NULL DEFAULT 72.0,
  move_clean_hours REAL NOT NULL DEFAULT 2.0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  sequence_index INTEGER NOT NULL,
  name TEXT,
  volume_m3 REAL NOT NULL,
  area_m2 REAL NOT NULL,
  mass_t REAL NOT NULL,
  joint_type TEXT DEFAULT 'none',
  dependencies TEXT DEFAULT '[]',
  source_tag TEXT DEFAULT 'USER',
  confidence REAL DEFAULT 1.0,
  assumptions_log TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  normset_id TEXT NOT NULL REFERENCES normsets(id),
  type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  description TEXT,
  duration_hours REAL NOT NULL,
  duration_days REAL NOT NULL,
  labor_hours REAL NOT NULL,
  cost_labor REAL NOT NULL,
  cost_machine REAL,
  cost_rental REAL,
  crew_size INTEGER NOT NULL,
  resources_required TEXT DEFAULT '{}',
  source_tag TEXT NOT NULL,
  norm_used TEXT,
  assumptions_log TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  start_day REAL NOT NULL,
  end_day REAL NOT NULL,
  resources_used TEXT NOT NULL DEFAULT '{}',
  is_critical BOOLEAN DEFAULT false,
  slack_days REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_breakdown (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  cost_type TEXT NOT NULL,
  source_tag TEXT NOT NULL,
  norm_used TEXT,
  assumptions TEXT,
  confidence REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bottlenecks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES r0_projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  suggestion TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Suggestion tables (Migration 007)
CREATE TABLE IF NOT EXISTS position_suggestions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  suggested_days REAL NOT NULL,
  suggested_by TEXT NOT NULL,
  normset_id TEXT REFERENCES normsets(id),
  norm_source TEXT,
  assumptions_log TEXT,
  confidence REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  user_decision_days REAL,
  user_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- UNIFIED REGISTRY (Migration 010)
-- ============================================================

CREATE TABLE IF NOT EXISTS registry_projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS registry_objects (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES registry_projects(id) ON DELETE CASCADE,
  object_name TEXT NOT NULL,
  object_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(project_id, object_name)
);

CREATE TABLE IF NOT EXISTS registry_source_files (
  id SERIAL PRIMARY KEY,
  object_id INTEGER REFERENCES registry_objects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  file_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS registry_file_versions (
  id SERIAL PRIMARY KEY,
  source_file_id INTEGER REFERENCES registry_source_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  file_hash TEXT NOT NULL,
  changes_summary TEXT,
  previous_version_id INTEGER REFERENCES registry_file_versions(id) ON DELETE SET NULL,
  relink_status VARCHAR(20) DEFAULT 'pending' CHECK (relink_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  UNIQUE(source_file_id, version_number)
);

CREATE TABLE IF NOT EXISTS registry_position_instances (
  id SERIAL PRIMARY KEY,
  object_id INTEGER REFERENCES registry_objects(id) ON DELETE CASCADE,
  source_file_id INTEGER REFERENCES registry_source_files(id),
  file_version_id INTEGER REFERENCES registry_file_versions(id),
  position_code TEXT NOT NULL,
  position_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  kiosk_type TEXT NOT NULL,
  kiosk_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'needs_review', 'orphaned')),
  description_normalized TEXT,
  UNIQUE(object_id, position_code, file_version_id)
);

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

CREATE TABLE IF NOT EXISTS registry_apply_logs (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES registry_position_templates(id),
  object_id INTEGER REFERENCES registry_objects(id),
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by TEXT,
  result JSONB DEFAULT '{}'::jsonb
);

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
  report_data JSONB DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  details JSONB DEFAULT '{}'::jsonb,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP
);

-- Normalize description function
CREATE OR REPLACE FUNCTION normalize_description(text) RETURNS TEXT AS $$
  SELECT lower(trim(regexp_replace($1, '[^a-zA-Z0-9\s]', '', 'g')))
$$ LANGUAGE SQL IMMUTABLE;

-- ============================================================
-- ALL INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bridges_owner ON bridges(owner_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(status);
CREATE INDEX IF NOT EXISTS idx_bridges_portal_project ON bridges(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
CREATE INDEX IF NOT EXISTS idx_positions_otskp ON positions(otskp_code);
CREATE INDEX IF NOT EXISTS idx_positions_instance_id ON positions(position_instance_id);
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
CREATE INDEX IF NOT EXISTS idx_monolith_projects_portal ON monolith_projects(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_part_templates_type ON part_templates(object_type);
CREATE INDEX IF NOT EXISTS idx_parts_project ON parts(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_projects_owner ON portal_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_portal_projects_type ON portal_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_kiosk_links_project ON kiosk_links(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_links_type ON kiosk_links(kiosk_type);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_portal_objects_project ON portal_objects(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_object ON portal_positions(object_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_positions_instance_id ON portal_positions(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_position_templates_project ON position_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_position_audit_log_project ON position_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_elements_project ON elements(project_id);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);
CREATE INDEX IF NOT EXISTS idx_captures_element ON captures(element_id);
CREATE INDEX IF NOT EXISTS idx_captures_sequence ON captures(element_id, sequence_index);
CREATE INDEX IF NOT EXISTS idx_tasks_capture ON tasks(capture_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_schedule_timeline ON schedule(start_day, end_day);
CREATE INDEX IF NOT EXISTS idx_schedule_critical ON schedule(is_critical);
CREATE INDEX IF NOT EXISTS idx_cost_breakdown_task ON cost_breakdown(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_breakdown_type ON cost_breakdown(cost_type);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_project ON bottlenecks(project_id);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_severity ON bottlenecks(severity);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_status ON bottlenecks(status);
CREATE INDEX IF NOT EXISTS idx_position_suggestions_position ON position_suggestions(position_id);
CREATE INDEX IF NOT EXISTS idx_position_suggestions_status ON position_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_registry_objects_project ON registry_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_registry_source_files_object ON registry_source_files(object_id);
CREATE INDEX IF NOT EXISTS idx_registry_file_versions_source ON registry_file_versions(source_file_id);
CREATE INDEX IF NOT EXISTS idx_registry_positions_object ON registry_position_instances(object_id);
CREATE INDEX IF NOT EXISTS idx_registry_positions_code ON registry_position_instances(position_code);
CREATE INDEX IF NOT EXISTS idx_registry_positions_active ON registry_position_instances(is_active);
CREATE INDEX IF NOT EXISTS idx_file_versions_previous ON registry_file_versions(previous_version_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_relink_status ON registry_file_versions(relink_status);
CREATE INDEX IF NOT EXISTS idx_positions_status ON registry_position_instances(status);
CREATE INDEX IF NOT EXISTS idx_positions_description_normalized ON registry_position_instances(description_normalized);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_tasks_full AS
SELECT
  t.id as task_id, t.type as task_type, t.sequence, t.description,
  t.duration_hours, t.duration_days, t.labor_hours, t.cost_labor,
  t.cost_machine, t.cost_rental, t.source_tag, t.assumptions_log, t.confidence,
  c.id as capture_id, c.sequence_index as capture_sequence,
  c.volume_m3, c.area_m2, c.mass_t,
  e.id as element_id, e.name as element_name, e.type as element_type,
  p.id as project_id, p.name as project_name,
  n.id as normset_id, n.name as normset_name, n.source_tag as norm_source
FROM tasks t
JOIN captures c ON t.capture_id = c.id
JOIN elements e ON c.element_id = e.id
JOIN r0_projects p ON e.project_id = p.id
JOIN normsets n ON t.normset_id = n.id;

CREATE OR REPLACE VIEW v_schedule_full AS
SELECT
  s.task_id, s.start_day, s.end_day,
  s.end_day - s.start_day as duration_days,
  s.is_critical, s.slack_days, s.resources_used,
  t.type as task_type, t.description as task_description, t.labor_hours,
  t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0) as total_cost,
  c.sequence_index as capture_sequence,
  e.name as element_name, p.name as project_name
FROM schedule s
JOIN tasks t ON s.task_id = t.id
JOIN captures c ON t.capture_id = c.id
JOIN elements e ON c.element_id = e.id
JOIN r0_projects p ON e.project_id = p.id
ORDER BY s.start_day, c.sequence_index, t.sequence;

CREATE OR REPLACE VIEW v_cost_by_element AS
SELECT
  e.id as element_id, e.name as element_name, e.type as element_type,
  p.id as project_id, p.name as project_name,
  SUM(t.labor_hours) as total_labor_hours,
  SUM(t.cost_labor) as total_cost_labor,
  SUM(COALESCE(t.cost_machine, 0)) as total_cost_machine,
  SUM(COALESCE(t.cost_rental, 0)) as total_cost_rental,
  SUM(t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0)) as total_cost,
  e.concrete_volume_m3,
  CASE WHEN e.concrete_volume_m3 > 0 THEN
    SUM(t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0)) / e.concrete_volume_m3
  ELSE 0 END as unit_cost_czk_per_m3
FROM elements e
JOIN r0_projects p ON e.project_id = p.id
LEFT JOIN captures c ON e.id = c.element_id
LEFT JOIN tasks t ON c.id = t.capture_id
GROUP BY e.id, e.name, e.type, p.id, p.name, e.concrete_volume_m3;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default user
INSERT INTO users (email, password_hash, name, role, email_verified)
VALUES ('admin@stavagent.cz', '$2b$10$placeholder', 'Admin', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Part templates
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

-- Normsets seed data (PostgreSQL syntax)
INSERT INTO normsets (id, name, description, source_tag, rebar_h_per_t, formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2, pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours, is_default, is_active) VALUES
  ('norm_urs_2024', 'ÚRS 2024', 'Ústřední rozpočtové standardy 2024 (Czech Republic)', 'URS_2024_OFFICIAL', 50.0, 0.8, 0.3, 6, 0.5, 0.5, 72.0, 2.0, true, true),
  ('norm_rts_2023', 'RTS 2023', 'Российские территориальные сметные нормативы 2023', 'RTS_2023', 48.0, 0.75, 0.28, 6, 0.5, 0.5, 72.0, 2.0, false, true),
  ('norm_kros_2024', 'KROS 2024', 'Komplexní rozpočtové orientační standardy 2024', 'KROS_2024', 52.0, 0.85, 0.32, 6, 0.5, 0.5, 72.0, 2.0, false, true),
  ('norm_internal_2025', 'Internal Measured 2025', 'Фактически замеренные нормы на проектах компании', 'INTERNAL_MEASURED', 47.0, 0.72, 0.25, 6, 0.4, 0.4, 72.0, 1.5, false, true)
ON CONFLICT (id) DO NOTHING;

-- Project config with AI suggestion enabled
INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
VALUES (
  1,
  '{"FF_AI_DAYS_SUGGEST": true, "FF_PUMP_MODULE": false, "FF_ADVANCED_METRICS": false, "FF_DARK_MODE": false, "FF_SPEED_ANALYSIS": false}',
  '{"ROUNDING_STEP_KROS": 50, "RHO_T_PER_M3": 2.4, "LOCALE": "cs-CZ", "CURRENCY": "CZK", "DAYS_PER_MONTH_OPTIONS": [30, 22], "DAYS_PER_MONTH_DEFAULT": 30}',
  30
) ON CONFLICT (id) DO NOTHING;

-- Schema migration records
INSERT INTO schema_migrations (version) VALUES ('006'), ('007'), ('008'), ('009'), ('010'), ('011')
ON CONFLICT (version) DO NOTHING;
