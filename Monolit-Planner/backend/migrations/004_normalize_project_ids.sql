-- Migration: Normalize project_id by removing all spaces
-- This ensures consistency between Excel imports and manual project creation
-- Example: "SO 13-20-01" → "SO13-20-01"

-- 1. Update monolith_projects table
UPDATE monolith_projects
SET project_id = REPLACE(project_id, ' ', '')
WHERE project_id LIKE '% %';

-- 2. Update bridges table (for FK compatibility)
UPDATE bridges
SET bridge_id = REPLACE(bridge_id, ' ', '')
WHERE bridge_id LIKE '% %';

-- 3. Update positions table (references bridge_id)
UPDATE positions
SET bridge_id = REPLACE(bridge_id, ' ', '')
WHERE bridge_id LIKE '% %';

-- 4. Update parts table (references project_id)
UPDATE parts
SET project_id = REPLACE(project_id, ' ', '')
WHERE project_id LIKE '% %';

-- 5. Update snapshots table (references bridge_id)
UPDATE snapshots
SET bridge_id = REPLACE(bridge_id, ' ', '')
WHERE bridge_id LIKE '% %';

-- Log migration completion
SELECT 'Migration 004: Normalized project IDs - removed all spaces' as status;
