-- Migration: Add project hierarchy fields to monolith_projects
-- Date: November 20, 2025
-- Purpose: Support Stavba → Objects → Positions hierarchy with metadata preservation

-- Add new columns for project hierarchy
ALTER TABLE IF EXISTS monolith_projects
ADD COLUMN IF NOT EXISTS stavba VARCHAR(255),
ADD COLUMN IF NOT EXISTS objekt VARCHAR(255),
ADD COLUMN IF NOT EXISTS soupis VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_project_id VARCHAR(255);

-- Add column comments (PostgreSQL-style)
COMMENT ON COLUMN monolith_projects.stavba IS 'Project name from file header';
COMMENT ON COLUMN monolith_projects.objekt IS 'Object description from file header';
COMMENT ON COLUMN monolith_projects.soupis IS 'Budget/list name from file';
COMMENT ON COLUMN monolith_projects.parent_project_id IS 'Link to parent project for hierarchy';

-- Add foreign key constraint for parent_project_id if not exists
-- Note: This is checked with IF NOT EXISTS logic in application code
-- ALTER TABLE monolith_projects
-- ADD CONSTRAINT fk_monolith_projects_parent
-- FOREIGN KEY (parent_project_id)
-- REFERENCES monolith_projects(project_id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monolith_projects_stavba ON monolith_projects(stavba);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_parent ON monolith_projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_hierarchy ON monolith_projects(parent_project_id, object_type);

-- Index for querying all objects in a project
CREATE INDEX IF NOT EXISTS idx_monolith_projects_parent_type ON monolith_projects(parent_project_id, object_type) WHERE parent_project_id IS NOT NULL;

-- Create a view for project hierarchy
CREATE OR REPLACE VIEW v_project_hierarchy AS
SELECT
  mp.project_id,
  mp.object_type,
  mp.object_name,
  mp.stavba,
  mp.parent_project_id,
  parent_mp.stavba AS parent_stavba,
  parent_mp.object_name AS parent_object_name,
  mp.concrete_m3,
  mp.owner_id,
  mp.created_at
FROM monolith_projects mp
LEFT JOIN monolith_projects parent_mp ON mp.parent_project_id = parent_mp.project_id;

-- Create a view for project statistics
CREATE OR REPLACE VIEW v_project_statistics AS
SELECT
  mp.project_id,
  mp.stavba,
  COUNT(DISTINCT CASE WHEN child.object_type = 'bridge' THEN child.project_id END) AS bridge_count,
  COUNT(DISTINCT CASE WHEN child.object_type = 'tunnel' THEN child.project_id END) AS tunnel_count,
  COUNT(DISTINCT CASE WHEN child.object_type = 'building' THEN child.project_id END) AS building_count,
  COUNT(DISTINCT CASE WHEN child.object_type != 'project' THEN child.project_id END) AS total_objects,
  SUM(CASE WHEN child.object_type != 'project' THEN child.concrete_m3 ELSE 0 END) AS total_concrete_m3,
  mp.created_at,
  mp.owner_id
FROM monolith_projects mp
LEFT JOIN monolith_projects child ON mp.project_id = child.parent_project_id
WHERE mp.object_type = 'project'
GROUP BY mp.project_id, mp.stavba, mp.created_at, mp.owner_id;

-- Create a view for orphaned objects (objects without parent projects)
CREATE OR REPLACE VIEW v_orphaned_objects AS
SELECT
  mp.project_id,
  mp.object_type,
  mp.object_name,
  mp.stavba,
  mp.concrete_m3,
  mp.created_at
FROM monolith_projects mp
WHERE mp.parent_project_id IS NULL
  AND mp.object_type != 'project'
  AND mp.stavba IS NOT NULL;
