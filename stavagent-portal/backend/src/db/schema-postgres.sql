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
  stavba_name VARCHAR(255),
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
  last_sync TIMESTAMP,
  UNIQUE(portal_project_id, kiosk_type)
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

-- Safety: ensure columns exist on tables that may predate current schema
-- (CREATE TABLE IF NOT EXISTS does not add new columns to existing tables)
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE monolith_projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE positions ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE otskp_codes ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT '';

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
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Portal documents table (generated passports, summaries, kiosk outputs attached to projects)
CREATE TABLE IF NOT EXISTS portal_documents (
  document_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,       -- 'passport', 'summary', 'kiosk_output', 'audit_report'
  title VARCHAR(500) NOT NULL,
  source_file_id VARCHAR(255),              -- Reference to portal_files if generated from a file
  content JSONB NOT NULL,                   -- Full passport/summary JSON
  metadata JSONB DEFAULT '{}',              -- Processing metadata (time, model, confidence)
  version INTEGER DEFAULT 1,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX IF NOT EXISTS idx_portal_documents_project ON portal_documents(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_documents_type ON portal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_portal_documents_source ON portal_documents(source_file_id);

-- ============================================================================
-- MIGRATIONS (safe to re-run, uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- Add stavba_name to portal_projects (required by portal-projects.js)
ALTER TABLE portal_projects ADD COLUMN IF NOT EXISTS stavba_name VARCHAR(255);

-- ============================================================================
-- MIGRATION 001: Extend users table (Sprint 1 — Cabinets + Roles)
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Prague';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID;

-- ============================================================================
-- MIGRATION 002: Organizations + Members (Sprint 1 — Cabinets + Roles)
-- NOTE: Using VARCHAR + CHECK instead of ENUM types to avoid dependency on
-- CREATE TYPE ordering (migrations.js runs CREATE TABLE before other statements).
-- DO $$ blocks are avoided — they contain internal semicolons that break
-- the schema runner's semicolon-based statement splitter.
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  plan          VARCHAR(20) NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free','starter','professional','enterprise')),
  storage_mode  VARCHAR(20) NOT NULL DEFAULT 'managed'
                  CHECK (storage_mode IN ('managed','byos','private')),
  storage_config JSONB DEFAULT NULL,
  -- DEPRECATED 2026-05-08: stripe_customer_id / stripe_subscription_id were
  -- added during exploration but Stripe was never commercially activated
  -- (see credits.js note + LandingPage.tsx FAQ). Columns kept for backward
  -- compatibility with any existing prod rows; treat as orphan / no-op.
  -- Will be repurposed or dropped when Lemon Squeezy MoR integration ships
  -- in Q3 2026.
  stripe_customer_id    VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  max_projects    INTEGER DEFAULT 5,
  max_storage_gb  REAL    DEFAULT 1.0,
  max_team_members INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at  TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'estimator'
                CHECK (role IN ('admin','manager','estimator','viewer','api_client')),
  invited_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMP DEFAULT NOW(),
  joined_at   TIMESTAMP,
  invite_token_hash VARCHAR(64),
  invite_expires_at TIMESTAMP,
  UNIQUE(org_id, user_id)
);

-- FK from users.org_id → organizations.id
-- Runs after CREATE TABLE pass, so organizations already exists.
-- Uses DO block to avoid "already exists" errors in Cloud SQL logs.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invite_token ON org_members(invite_token_hash);

-- ============================================================================
-- MIGRATION 003: Position Instance Architecture (Portal v1.0)
-- Tables: portal_objects, portal_positions, position_templates, position_audit_log
-- ============================================================================

-- Objects: grouping layer (one per Excel sheet / SO bridge object)
CREATE TABLE IF NOT EXISTS portal_objects (
  object_id         VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  object_code       VARCHAR(100) NOT NULL,  -- e.g. "Sheet1", "SO-201"
  object_name       VARCHAR(255),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(portal_project_id, object_code)
);

-- Positions: individual work items (BOQ line items)
CREATE TABLE IF NOT EXISTS portal_positions (
  position_id           VARCHAR(255) PRIMARY KEY,
  position_instance_id  UUID UNIQUE DEFAULT gen_random_uuid(),
  object_id             VARCHAR(255) NOT NULL REFERENCES portal_objects(object_id) ON DELETE CASCADE,
  kod                   VARCHAR(100) NOT NULL DEFAULT '',   -- catalog code
  popis                 TEXT NOT NULL DEFAULT '',           -- description
  mnozstvi              REAL DEFAULT 0,
  mj                    VARCHAR(50) DEFAULT '',             -- unit
  cena_jednotkova       REAL,
  cena_celkem           REAL,
  sheet_name            VARCHAR(255),
  row_index             INTEGER,
  skupina               VARCHAR(100),                       -- work group (BETON_MONOLIT, etc.)
  row_role              VARCHAR(50) DEFAULT 'unknown',      -- main / sub / header
  template_id           VARCHAR(255),
  template_confidence   VARCHAR(20),
  overrides             JSONB DEFAULT '{}',
  monolith_payload      JSONB,                              -- Monolit kiosk write-back
  dov_payload           JSONB,                              -- Registry DOV write-back
  created_by            VARCHAR(255),
  updated_by            VARCHAR(255),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- Templates: saved calculation payloads for reuse
CREATE TABLE IF NOT EXISTS position_templates (
  template_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  catalog_code            VARCHAR(100) NOT NULL DEFAULT '',
  unit                    VARCHAR(50) NOT NULL DEFAULT '',
  normalized_description  TEXT NOT NULL DEFAULT '',
  display_description     TEXT,
  monolith_template       JSONB,
  dov_template            JSONB,
  scaling_rule            VARCHAR(50) DEFAULT 'linear',
  source_qty              REAL DEFAULT 1,
  source_instance_id      UUID,
  apply_count             INTEGER DEFAULT 0,
  created_by              VARCHAR(255),
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, catalog_code, unit, normalized_description)
);

-- Audit log: changes to position payloads and templates
CREATE TABLE IF NOT EXISTS position_audit_log (
  id                  BIGSERIAL PRIMARY KEY,
  event               VARCHAR(100) NOT NULL,
  actor               VARCHAR(255),
  project_id          VARCHAR(255),
  position_instance_id UUID,
  template_id         UUID,
  details             JSONB,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Safety: ensure position_templates.unit exists (may predate column addition)
ALTER TABLE position_templates ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_portal_objects_project ON portal_objects(portal_project_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_object ON portal_positions(object_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_instance ON portal_positions(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_portal_positions_skupina ON portal_positions(skupina);
CREATE INDEX IF NOT EXISTS idx_position_templates_project ON position_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_position_audit_project ON position_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_position_audit_instance ON position_audit_log(position_instance_id);

-- ============================================================================
-- MIGRATION 004: Service Connections — Encrypted API Keys (Sprint 2)
-- Encryption: AES-256-GCM, MASTER_ENCRYPTION_KEY in env, never in DB
-- credentials_encrypted = base64(iv + ciphertext + authTag)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
  org_id               UUID REFERENCES organizations(id) ON DELETE CASCADE,
  service_type         VARCHAR(30) NOT NULL
                         CHECK (service_type IN (
                           'gemini','openai','anthropic','aws_bedrock',
                           'perplexity','azure_openai',
                           'gcs','aws_s3','azure_blob'
                         )),
  display_name         VARCHAR(255),
  credentials_encrypted TEXT NOT NULL,
  credentials_iv        VARCHAR(64) NOT NULL,
  config               JSONB DEFAULT '{}',
  status               VARCHAR(20) DEFAULT 'untested'
                         CHECK (status IN ('active','error','untested','disabled')),
  last_tested_at       TIMESTAMP,
  last_error           TEXT,
  created_by           INTEGER NOT NULL REFERENCES users(id),
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_connection_scope CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_service_connections_user ON service_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_service_connections_org ON service_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_service_connections_type ON service_connections(service_type);

-- ============================================================================
-- MIGRATION 005: Add registry sync columns to portal_positions
-- Required by POST /import-from-registry (integration.js)
-- ============================================================================

ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS registry_item_id VARCHAR(255);
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS tov_labor JSONB;
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS tov_machinery JSONB;
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS tov_materials JSONB;
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS last_sync_from VARCHAR(50);
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE portal_positions ADD COLUMN IF NOT EXISTS monolit_position_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_portal_positions_registry_item ON portal_positions(registry_item_id);

-- ============================================================================
-- MIGRATION 006: Unified Pump Calculator (Phase 9)
-- pump_suppliers, pump_models, pump_accessories_catalog, pump_calculations
-- ============================================================================

CREATE TABLE IF NOT EXISTS pump_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  billing_model VARCHAR(20) NOT NULL CHECK (billing_model IN ('hourly', 'hourly_plus_m3', 'per_15min', 'custom')),
  is_builtin    BOOLEAN DEFAULT false,
  contact       JSONB DEFAULT '{}',
  surcharges    JSONB DEFAULT '{}',
  hose_per_m_per_day NUMERIC(10,2),
  metadata      JSONB DEFAULT '{}',
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pump_models (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID NOT NULL REFERENCES pump_suppliers(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  reach_m             NUMERIC(5,1),
  boom_m              NUMERIC(5,1),
  arrival_fixed_czk   NUMERIC(10,2),
  arrival_per_km_czk  NUMERIC(10,2),
  operation_per_h_czk NUMERIC(10,2),
  operation_per_15min_czk NUMERIC(10,2),
  volume_per_m3_czk   NUMERIC(10,2),
  practical_m3_h      NUMERIC(5,1),
  theoretical_m3_h    NUMERIC(5,1),
  priplatek_czk_m3    NUMERIC(10,2) DEFAULT 0,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}',
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pump_accessories_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID REFERENCES pump_suppliers(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  unit          VARCHAR(10) NOT NULL,
  czk_per_unit  NUMERIC(10,2) NOT NULL,
  is_common     BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pump_calculations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_instance_id  UUID,
  project_id            VARCHAR(255),
  supplier_id           UUID REFERENCES pump_suppliers(id),
  model_id              UUID REFERENCES pump_models(id),
  input_params          JSONB NOT NULL,
  result                JSONB NOT NULL,
  created_by            INTEGER REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pump_models_supplier ON pump_models(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pump_accessories_supplier ON pump_accessories_catalog(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pump_calc_position ON pump_calculations(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_pump_calc_project ON pump_calculations(project_id);

-- ============================================================================
-- MIGRATION 007: Usage Tracking & Quotas (SaaS Phase 1)
-- Tracks every pipeline call, LLM token usage, and enforces free-tier limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type        VARCHAR(50) NOT NULL,  -- 'pipeline_run', 'file_upload', 'llm_call', 'export'
  service           VARCHAR(50) NOT NULL,  -- 'workflow_a', 'workflow_c', 'price_parser', 'pump', 'urs_matcher', 'chat'
  model_name        VARCHAR(100),          -- 'gemini-2.5-flash-lite', 'gemini-2.5-pro', etc.
  tokens_input      INTEGER DEFAULT 0,
  tokens_output     INTEGER DEFAULT 0,
  tokens_total      INTEGER DEFAULT 0,
  cost_usd          REAL DEFAULT 0,
  file_size_bytes   BIGINT DEFAULT 0,
  metadata          JSONB DEFAULT '{}',    -- extra context (file_name, project_id, etc.)
  ip_address        VARCHAR(45),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_service ON usage_events(service);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events(model_name);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at DESC);

-- ============================================================================
-- MIGRATION 008: Feature Flags (Granular service/module/action toggles)
-- Admin can enable/disable any feature per plan, org, or specific user
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key          VARCHAR(100) NOT NULL,         -- e.g. 'workflow_c', 'pump.compare', 'price_parser.upload'
  display_name      VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(50) NOT NULL DEFAULT 'service',  -- 'service', 'module', 'action'
  default_enabled   BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(flag_key)
);

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id           UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  scope_type        VARCHAR(20) NOT NULL CHECK (scope_type IN ('plan', 'org', 'user')),
  scope_value       VARCHAR(255) NOT NULL,  -- plan name, org UUID, or user ID
  enabled           BOOLEAN NOT NULL,
  set_by            INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(flag_id, scope_type, scope_value)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag ON feature_flag_overrides(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_scope ON feature_flag_overrides(scope_type, scope_value);

-- ============================================================================
-- MIGRATION 009: Registration IP Tracking & Phone Verification (Anti-fraud)
-- ============================================================================

CREATE TABLE IF NOT EXISTS registration_ips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address        VARCHAR(45) NOT NULL,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  fingerprint       VARCHAR(255),          -- browser fingerprint hash
  user_agent        TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_ips_ip ON registration_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_registration_ips_created ON registration_ips(created_at DESC);

CREATE TABLE IF NOT EXISTS phone_verification_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone             VARCHAR(30) NOT NULL,
  code_hash         VARCHAR(255) NOT NULL,  -- SHA256 of 6-digit code
  attempts          INTEGER DEFAULT 0,
  max_attempts      INTEGER DEFAULT 3,
  expires_at        TIMESTAMP NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_user ON phone_verification_tokens(user_id);

-- Extend users table with phone verification and quota fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_pipeline_runs_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';

-- ============================================================================
-- MIGRATION 010: Seed default feature flags
-- ============================================================================

INSERT INTO feature_flags (id, flag_key, display_name, description, category, default_enabled) VALUES
  (gen_random_uuid(), 'portal',              'Portal',                    'Hlavní portál — přehled projektů',                'service', true),
  (gen_random_uuid(), 'workflow_a',          'Workflow A (Import)',       'Upload a import dokumentů do CORE',               'service', true),
  (gen_random_uuid(), 'workflow_c',          'Workflow C (Audit)',        'AI audit rozpočtu — multi-role validace',          'service', true),
  (gen_random_uuid(), 'price_parser',        'Price Parser',             'Parsování ceníků betonáren z PDF',                'service', true),
  (gen_random_uuid(), 'pump',                'Pump Calculator',          'Kalkulátor čerpadel betonu',                      'service', true),
  (gen_random_uuid(), 'objednavka_betonu',   'Objednávka betonu',        'Vyhledávání betonáren + kalkulace',               'service', true),
  (gen_random_uuid(), 'monolit',             'Monolit Planner',          'Kalkulátor monolitických betonů',                 'service', true),
  (gen_random_uuid(), 'registry',            'Rozpočet Registry',        'Klasifikace položek rozpočtu',                    'service', true),
  (gen_random_uuid(), 'urs_matcher',         'URS Matcher',              'Párování položek na URS kódy',                    'service', true),
  (gen_random_uuid(), 'chat',                'Chat Assistant',           'AI chat asistent v projektech',                   'module',  true),
  (gen_random_uuid(), 'export_xlsx',         'Export XLSX',              'Export výsledků do Excel',                         'action',  true),
  (gen_random_uuid(), 'export_csv',          'Export CSV',               'Export výsledků do CSV',                           'action',  true),
  (gen_random_uuid(), 'kb_research',         'Knowledge Base',           'Přístup ke znalostní bázi (KROS, ČSN)',           'module',  true),
  (gen_random_uuid(), 'file_upload',         'Nahrávání souborů',        'Upload PDF/Excel/XML dokumentů',                  'action',  true),
  (gen_random_uuid(), 'google_drive',        'Google Drive',             'Připojení Google Drive',                          'module',  false)
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================================
-- MIGRATION 011: Credits System (Pay-as-you-go)
-- Users top up balance, operations deduct credits. No classic subscription.
-- Free tier = session-only (no DB storage), results only in browser.
-- ============================================================================

-- Operation pricing catalog: what each operation costs in credits
CREATE TABLE IF NOT EXISTS operation_prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key     VARCHAR(100) NOT NULL UNIQUE,  -- e.g. 'document_analyze', 'monolit_calculate'
  display_name      VARCHAR(255) NOT NULL,
  description       TEXT,
  credits_cost      INTEGER NOT NULL DEFAULT 1,     -- cost in credits
  is_ai             BOOLEAN DEFAULT false,          -- AI operations (for UI grouping)
  is_active         BOOLEAN DEFAULT true,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Credit transactions: every top-up and deduction
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,               -- positive = top-up, negative = deduction
  balance_after     INTEGER NOT NULL,               -- balance after this transaction
  operation_key     VARCHAR(100),                   -- NULL for top-ups, operation_key for deductions
  description       VARCHAR(500),                   -- human-readable description
  reference_id      VARCHAR(255),                   -- external ref (admin action; Lemon Squeezy order_id when MoR launches Q3 2026)
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Add credit_balance to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_operation ON credit_transactions(operation_key);
CREATE INDEX IF NOT EXISTS idx_operation_prices_key ON operation_prices(operation_key);

-- Seed default operation prices
INSERT INTO operation_prices (id, operation_key, display_name, description, credits_cost, is_ai, sort_order) VALUES
  (gen_random_uuid(), 'document_parse',       'Parsování dokumentu',          'Extrakce dat z PDF/Excel/XML (bez AI)',          2,  false, 1),
  (gen_random_uuid(), 'document_analyze',     'AI analýza dokumentu',         'Kompletní AI analýza s pasportem',              10, true,  2),
  (gen_random_uuid(), 'passport_generate',    'Generování pasportu',          'AI pasport s normami a identifikací',           15, true,  3),
  (gen_random_uuid(), 'nkb_check',            'Kontrola norem (NKB)',         'Kontrola souladu s ČSN/EN normami',              5, true,  4),
  (gen_random_uuid(), 'nkb_advisor',          'NKB poradce',                  'AI poradce pro normativní dotazy',               8, true,  5),
  (gen_random_uuid(), 'workflow_c_audit',     'Audit rozpočtu',               'Multi-role AI validace rozpočtu',                20, true,  6),
  (gen_random_uuid(), 'urs_match',            'URS párování',                 'AI párování položek na URS kódy',                8, true,  7),
  (gen_random_uuid(), 'registry_classify',    'Klasifikace položek',          'AI klasifikace do skupin prací',                 5, true,  8),
  (gen_random_uuid(), 'monolit_calculate',    'Kalkulace monolitu',           'Výpočet ceny betonových prací',                  1, false, 9),
  (gen_random_uuid(), 'pump_calculate',       'Kalkulace čerpadla',           'Výpočet nákladů na čerpadlo',                    1, false, 10),
  (gen_random_uuid(), 'export_xlsx',          'Export do Excel',              'Stažení výsledků jako XLSX',                     1, false, 11),
  (gen_random_uuid(), 'export_csv',           'Export do CSV',                'Stažení výsledků jako CSV',                      1, false, 12),
  (gen_random_uuid(), 'save_to_project',      'Uložení do projektu',          'Trvalé uložení výsledků do databáze',            2, false, 13),
  (gen_random_uuid(), 'chat_message',         'Chat zpráva',                  'AI odpověď v chatu projektu',                    3, true,  14),
  (gen_random_uuid(), 'price_parser',         'Parsování ceníku',             'Extrakce cen z PDF ceníku betonárny',            5, true,  15)
ON CONFLICT (operation_key) DO NOTHING;

-- Seed new feature flags for credits
INSERT INTO feature_flags (id, flag_key, display_name, description, category, default_enabled) VALUES
  (gen_random_uuid(), 'credits_system',       'Kreditní systém',              'Pay-as-you-go kreditní systém',                  'module',  true),
  (gen_random_uuid(), 'session_only_mode',    'Session-only režim',           'Bez kreditů = výsledky jen v prohlížeči',        'module',  true)
ON CONFLICT (flag_key) DO NOTHING;

-- Add banned status to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason VARCHAR(500);

-- Banned email domains (disposable email blacklist)
CREATE TABLE IF NOT EXISTS banned_email_domains (
  domain VARCHAR(255) PRIMARY KEY,
  added_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed common disposable email domains
INSERT INTO banned_email_domains (domain) VALUES
  ('tempmail.com'), ('temp-mail.org'), ('guerrillamail.com'), ('guerrillamail.de'),
  ('mailinator.com'), ('yopmail.com'), ('throwaway.email'), ('tempail.com'),
  ('trashmail.com'), ('trashmail.me'), ('10minutemail.com'), ('10minute.email'),
  ('minutemail.com'), ('dispostable.com'), ('maildrop.cc'), ('mailnesia.com'),
  ('sharklasers.com'), ('guerrillamailblock.com'), ('grr.la'), ('discard.email'),
  ('discardmail.com'), ('discardmail.de'), ('fakeinbox.com'), ('emailondeck.com'),
  ('tempr.email'), ('temp-mail.io'), ('mohmal.com'), ('getnada.com'),
  ('tmpmail.net'), ('tmpmail.org'), ('burnermail.io'), ('mailsac.com'),
  ('harakirimail.com'), ('crazymailing.com'), ('tmail.ws'), ('tempinbox.com'),
  ('binkmail.com'), ('safetymail.info'), ('filzmail.com'), ('mailcatch.com'),
  ('meltmail.com'), ('spamgourmet.com'), ('mytemp.email'), ('throwam.com'),
  ('mailnull.com'), ('spamfree24.org'), ('jetable.org'), ('trash-mail.com'),
  ('wegwerfmail.de'), ('wegwerfmail.net'), ('einrot.com'), ('sogetthis.com')
ON CONFLICT (domain) DO NOTHING;

