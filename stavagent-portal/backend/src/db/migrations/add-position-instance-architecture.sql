-- Migration: Position Instance Architecture v1.0
-- Date: 2026-02-27
-- Purpose: Implement two-level identity model (PositionInstance + PositionTemplate)
-- Spec: docs/POSITION_INSTANCE_ARCHITECTURE.ts
--
-- Changes:
--   Phase 1: Extend portal_positions with position_instance_id, payloads, classification
--   Phase 2: Create position_templates table
--   Phase 3: Create position_audit_log table

-- =============================================================================
-- PHASE 1: Extend portal_positions → PositionInstance
-- =============================================================================

-- position_instance_id — the ONLY reliable cross-kiosk linking key
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS position_instance_id UUID DEFAULT gen_random_uuid();

-- Ensure every existing row gets a UUID
UPDATE portal_positions
  SET position_instance_id = gen_random_uuid()
  WHERE position_instance_id IS NULL;

ALTER TABLE portal_positions
  ALTER COLUMN position_instance_id SET NOT NULL;

-- Sheet/row context (from Excel import)
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS sheet_name VARCHAR(255);

ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS row_index INTEGER DEFAULT 0;

-- Classification
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS skupina VARCHAR(50);

ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS row_role VARCHAR(20) DEFAULT 'unknown';

-- Template reference
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS template_id UUID;

ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS template_confidence VARCHAR(10);

-- Kiosk payloads (JSONB for structured data)
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS monolith_payload JSONB;

ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS dov_payload JSONB;

-- Manual overrides after template application
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS overrides JSONB;

-- Audit trail
ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'legacy';

ALTER TABLE portal_positions
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) DEFAULT 'legacy';

-- Indexes for position_instance_id (critical for cross-kiosk lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_positions_instance_id
  ON portal_positions(position_instance_id);

CREATE INDEX IF NOT EXISTS idx_portal_positions_skupina
  ON portal_positions(skupina);

CREATE INDEX IF NOT EXISTS idx_portal_positions_template
  ON portal_positions(template_id);

CREATE INDEX IF NOT EXISTS idx_portal_positions_row_role
  ON portal_positions(row_role);

-- =============================================================================
-- PHASE 2: Create position_templates table
-- =============================================================================

CREATE TABLE IF NOT EXISTS position_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,

  -- Template natural key (composite unique)
  catalog_code VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  normalized_description TEXT NOT NULL,
  display_description TEXT NOT NULL,

  -- Saved calculations (normalized to qty=1)
  monolith_template JSONB,
  dov_template JSONB,

  -- Scaling rules
  scaling_rule VARCHAR(20) NOT NULL DEFAULT 'linear',
  source_qty REAL NOT NULL,

  -- Metadata
  source_instance_id UUID NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  apply_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, catalog_code, unit, normalized_description)
);

CREATE INDEX IF NOT EXISTS idx_position_templates_project
  ON position_templates(project_id);

CREATE INDEX IF NOT EXISTS idx_position_templates_code
  ON position_templates(catalog_code);

CREATE INDEX IF NOT EXISTS idx_position_templates_code_unit
  ON position_templates(catalog_code, unit);

-- =============================================================================
-- PHASE 3: Create position_audit_log table
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_position_audit_log_project
  ON position_audit_log(project_id);

CREATE INDEX IF NOT EXISTS idx_position_audit_log_instance
  ON position_audit_log(position_instance_id);

CREATE INDEX IF NOT EXISTS idx_position_audit_log_event
  ON position_audit_log(event);

CREATE INDEX IF NOT EXISTS idx_position_audit_log_timestamp
  ON position_audit_log(timestamp DESC);
