-- =====================================================================
-- 2026-05-19 — Owner_id=1 "sirot" cleanup — DRY RUN PLAYBOOK
-- =====================================================================
--
-- Context: pre-multi-tenant + kiosk hardcoded `owner_id = 1` produced
-- ~58 orphan portal_projects (audit §2.3) that no real user can see in
-- their /portal Projekty list. Backend fixes shipped in PRs above
-- ensure no NEW orphans are created. This migration cleans up the
-- existing ones.
--
-- STRICT WORKFLOW (per security-hotfix Q1 = D "review then decide"):
--   1. RUN Section A (READ-ONLY inspection). Pipe output to the user
--      (Александр) for review.
--   2. Pick a strategy per row based on the inspection:
--        - REASSIGN to a known user_id
--        - DELETE  (junk / test data)
--        - ARCHIVE (preserve, hide)
--   3. Uncomment ONLY the chosen action block in Section B, fill the
--      explicit project_id list, run inside a transaction.
--   4. Re-run Section A to confirm `owner_id=1` count is 0 (or only
--      legitimate system rows remain).
--
-- This file is intentionally NOT auto-applied by any migration runner.
-- It is a manual playbook. The DELETE / UPDATE statements are commented
-- out and require explicit edit-then-execute by the operator.
--
-- =====================================================================

-- ---------------------------------------------------------------------
-- Section A — READ-ONLY INSPECTION (always safe)
-- ---------------------------------------------------------------------

-- A1. Count of orphans across the three services:

SELECT 'portal_projects'    AS table_name, COUNT(*) AS sirot_count
  FROM portal_projects    WHERE owner_id = 1
UNION ALL
SELECT 'registry_projects' AS table_name, COUNT(*) AS sirot_count
  FROM registry_projects  WHERE owner_id = 1
UNION ALL
SELECT 'bridges'           AS table_name, COUNT(*) AS sirot_count
  FROM bridges            WHERE owner_id = 1
UNION ALL
SELECT 'monolith_projects' AS table_name, COUNT(*) AS sirot_count
  FROM monolith_projects  WHERE portal_user_id IS NULL
                             OR portal_user_id = 1;

-- A2. Portal orphan detail — pipe to user for review:

SELECT
  portal_project_id,
  project_name,
  project_type,
  stavba_name,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM portal_objects WHERE portal_project_id = pp.portal_project_id) AS objects_count,
  (SELECT COUNT(*) FROM portal_positions pop
   JOIN portal_objects po ON pop.object_id = po.object_id
   WHERE po.portal_project_id = pp.portal_project_id) AS positions_count,
  (SELECT array_agg(DISTINCT kiosk_type) FROM kiosk_links WHERE portal_project_id = pp.portal_project_id) AS linked_kiosks
FROM portal_projects pp
WHERE owner_id = 1
ORDER BY updated_at DESC;

-- A3. Registry orphan detail:

SELECT
  project_id,
  project_name,
  portal_project_id,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM registry_sheets WHERE project_id = rp.project_id) AS sheets_count,
  (SELECT COUNT(*) FROM registry_items i
   JOIN registry_sheets s ON i.sheet_id = s.sheet_id
   WHERE s.project_id = rp.project_id) AS items_count
FROM registry_projects rp
WHERE owner_id = 1
ORDER BY updated_at DESC;

-- A4. Bridge orphans:

SELECT bridge_id, project_name, object_name, status, created_at, updated_at
FROM bridges
WHERE owner_id = 1
ORDER BY updated_at DESC;

-- ---------------------------------------------------------------------
-- Section B — ACTION BLOCKS (all commented; uncomment ONE per row class)
-- ---------------------------------------------------------------------
--
-- Always wrap in BEGIN / ROLLBACK first; commit only after verifying
-- the row count is what you expected.
--
-- ---------------------------------------------------------------------

-- B1. REASSIGN portal_projects orphans to a known user_id.
--     Replace <NEW_OWNER_ID> + the project_id list.
--
-- BEGIN;
-- UPDATE portal_projects
--    SET owner_id = <NEW_OWNER_ID>,
--        updated_at = NOW()
--  WHERE owner_id = 1
--    AND portal_project_id IN (
--      'proj_aaaa-...',
--      'proj_bbbb-...'
--    );
-- -- Verify row count matches expectation:
-- SELECT COUNT(*) AS reassigned FROM portal_projects
--  WHERE owner_id = <NEW_OWNER_ID> AND portal_project_id IN (...);
-- COMMIT;  -- or ROLLBACK if wrong

-- B2. DELETE junk portal_projects (FK CASCADE removes objects + positions).
--     Confirm schema has ON DELETE CASCADE on portal_objects.portal_project_id
--     and portal_positions.object_id before running.
--
-- BEGIN;
-- DELETE FROM portal_projects
--  WHERE owner_id = 1
--    AND portal_project_id IN (
--      'proj_aaaa-...',
--      'proj_bbbb-...'
--    );
-- COMMIT;

-- B3. ARCHIVE portal_projects (move to a separate table, hide from /portal).
--     Requires creating the archive table once.
--
-- CREATE TABLE IF NOT EXISTS portal_projects_archived (
--   LIKE portal_projects INCLUDING ALL,
--   archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   archive_reason TEXT
-- );
--
-- BEGIN;
-- INSERT INTO portal_projects_archived
--   SELECT pp.*, NOW(), 'pre-multi-tenant orphan (audit 2026-05-19)'
--     FROM portal_projects pp
--    WHERE owner_id = 1
--      AND portal_project_id IN ('proj_aaaa-...', 'proj_bbbb-...');
-- DELETE FROM portal_projects
--  WHERE owner_id = 1
--    AND portal_project_id IN ('proj_aaaa-...', 'proj_bbbb-...');
-- COMMIT;

-- B4. Registry-side mirror (registry_projects.owner_id = 1).
--     Same 3 strategies; the FK cascade chain is registry_projects →
--     registry_sheets → registry_items → registry_tov, so DELETE on
--     registry_projects removes everything underneath if the schema's
--     ON DELETE CASCADE is set (verify in schema.sql).
--
-- BEGIN;
-- UPDATE registry_projects
--    SET owner_id = <NEW_OWNER_ID>,
--        updated_at = NOW()
--  WHERE owner_id = 1 AND project_id IN ('reg_aaa', 'reg_bbb');
-- COMMIT;

-- B5. Monolit bridges.
--
-- BEGIN;
-- UPDATE bridges
--    SET owner_id = <NEW_OWNER_ID>
--  WHERE owner_id = 1 AND bridge_id IN ('br_aaa', 'br_bbb');
-- COMMIT;

-- ---------------------------------------------------------------------
-- Section C — POST-CLEANUP VERIFICATION
-- ---------------------------------------------------------------------
-- After running the action blocks, re-run Section A1. Expected:
--   portal_projects    sirot_count = 0  (or only legitimate system rows)
--   registry_projects  sirot_count = 0
--   bridges            sirot_count = 0
--   monolith_projects  sirot_count = 0  (portal_user_id NOT NULL for all)
--
-- Once 0, the backend fixes in PRs above (no more INSERTs with
-- owner_id=1) guarantee the orphan count stays at 0.

-- ---------------------------------------------------------------------
-- Footnote — why no automated DELETE
-- ---------------------------------------------------------------------
-- The audit (§2.5) found ZERO E2E isolation tests to verify post-cleanup
-- safety. We refuse to automate destruction of data this PR can't prove
-- is junk. The mandatory workflow is: review SELECT output → decide
-- per-row → uncomment chosen block → run inside a transaction.
