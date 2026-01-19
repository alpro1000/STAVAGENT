-- ========================================
-- CLEAR PRODUCTION DATABASE
-- WARNING: This will DELETE ALL data!
-- ========================================

-- Show current state BEFORE deletion
SELECT 'BEFORE DELETION:' as status;
SELECT COUNT(*) as projects FROM monolith_projects;
SELECT COUNT(*) as bridges FROM bridges;
SELECT COUNT(*) as positions FROM positions;
SELECT COUNT(*) as parts FROM parts;
SELECT COUNT(*) as snapshots FROM snapshots;

-- Show all project IDs that will be deleted
SELECT 'Projects to be deleted:' as status;
SELECT project_id, project_name, object_name FROM monolith_projects;

-- Pause before deletion (you must manually execute next part)
SELECT '========================================' as status;
SELECT 'Ready to delete. Execute DELETE commands below:' as status;
SELECT '========================================' as status;

-- DELETE ALL DATA (execute this part separately after reviewing above)
BEGIN;

DELETE FROM positions;
DELETE FROM parts;
DELETE FROM snapshots;
DELETE FROM bridges;
DELETE FROM monolith_projects;

COMMIT;

-- Show final state AFTER deletion
SELECT 'AFTER DELETION:' as status;
SELECT COUNT(*) as projects FROM monolith_projects;
SELECT COUNT(*) as bridges FROM bridges;
SELECT COUNT(*) as positions FROM positions;
