-- Migration 005: Migrate data from bridges table to monolith_projects
-- Date: 2026-01-20
-- Purpose: Transfer all existing projects from old 'bridges' table to new 'monolith_projects' table

-- STEP 1: Copy all data from bridges to monolith_projects
-- Match all columns that exist in both tables
INSERT INTO monolith_projects (
  project_id,
  project_name,
  object_name,
  element_count,
  concrete_m3,
  sum_kros_czk,
  span_length_m,
  deck_width_m,
  pd_weeks,
  status,
  owner_id,
  created_at,
  updated_at,
  object_type
)
SELECT
  bridge_id as project_id,
  project_name,
  object_name,
  element_count,
  concrete_m3,
  sum_kros_czk,
  span_length_m,
  deck_width_m,
  pd_weeks,
  status,
  COALESCE(owner_id, 1) as owner_id,  -- Default to owner_id = 1 if NULL
  created_at,
  updated_at,
  'custom' as object_type  -- VARIANT 1: all objects are 'custom' type
FROM bridges
WHERE bridge_id NOT IN (SELECT project_id FROM monolith_projects)  -- Avoid duplicates
ORDER BY created_at ASC;

-- STEP 2: Verify migration
-- This will be logged by the migration runner
-- Expected: All bridges should now exist in monolith_projects
