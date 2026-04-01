-- Migration 013: Add metadata and position_number columns to positions
-- Date: 2026-04-01
-- Purpose: Fix 500 error on PUT /api/positions — columns referenced in
--          ALLOWED_UPDATE_FIELDS but missing from PostgreSQL schema.

ALTER TABLE positions ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS position_number INTEGER;
