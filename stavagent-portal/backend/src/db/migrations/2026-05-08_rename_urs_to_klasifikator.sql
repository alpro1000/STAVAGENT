-- ============================================================================
-- Migration 2026-05-08: Rename URS / Monolit / Registry labels to canonical
-- ============================================================================
--
-- Companion to v3.2 landing repositioning Gates 1+2 (commits 2c56410, 5dd95c1,
-- and the Gate 2 commit that introduces this file). The seed values in
-- schema-postgres.sql were updated alongside this migration; the seed only
-- governs FRESH databases. Existing production rows still hold the old
-- labels (e.g. 'URS Matcher', 'Monolit Planner', 'Rozpočet Registry') so
-- this migration brings them in sync.
--
-- Tables touched:
--   - feature_flags        (drives Portal services listing UI)
--   - operation_prices     (drives credits/billing UI in cabinet)
--
-- Idempotency:
--   Every UPDATE includes the OLD value in the WHERE clause. Re-running
--   this migration after it has already been applied is a no-op (zero rows
--   match the WHERE). Safe to run via Cloud Run boot, manual psql, or
--   Cloud SQL Studio. Run order does not matter.
--
-- Apply:
--   Manually against the stavagent_portal database. Example:
--     psql "$PORTAL_DATABASE_URL" -f \
--       stavagent-portal/backend/src/db/migrations/2026-05-08_rename_urs_to_klasifikator.sql
--
--   Or via Cloud SQL Studio paste-and-run.
--
-- Rollback:
--   Reverse each UPDATE with the values swapped (original values are in the
--   block comment at the top of each statement below for easy reference).
--   No DDL changes; nothing to drop.
-- ============================================================================

-- feature_flags: 'urs_matcher' service row
-- BEFORE: 'URS Matcher' / 'Párování položek na URS kódy'
-- AFTER:  'Klasifikátor stavebních prací' / 'AI klasifikace pozic'
UPDATE feature_flags
SET display_name = 'Klasifikátor stavebních prací',
    description  = 'AI klasifikace pozic'
WHERE flag_key = 'urs_matcher'
  AND display_name = 'URS Matcher';

-- feature_flags: 'monolit' service row (Gate 1 canonical naming, deferred to
-- this migration per audit §13.1 since the seed-only edit doesn't reach
-- existing prod rows).
-- BEFORE: 'Monolit Planner' / 'Kalkulátor monolitických betonů'
-- AFTER:  'Kalkulátor betonáže' / 'Detail prvku + plán objektu — beton, bednění, takty, harmonogram'
UPDATE feature_flags
SET display_name = 'Kalkulátor betonáže',
    description  = 'Detail prvku + plán objektu — beton, bednění, takty, harmonogram'
WHERE flag_key = 'monolit'
  AND display_name = 'Monolit Planner';

-- feature_flags: 'registry' service row (Gate 1 canonical naming, deferred
-- to this migration for the same reason).
-- BEFORE: 'Rozpočet Registry' / 'Klasifikace položek rozpočtu'
-- AFTER:  'Registr' / 'Pracovní rozbor smety: skupiny + TOV + multi-supplier kalkulátory'
UPDATE feature_flags
SET display_name = 'Registr',
    description  = 'Pracovní rozbor smety: skupiny + TOV + multi-supplier kalkulátory'
WHERE flag_key = 'registry'
  AND display_name = 'Rozpočet Registry';

-- feature_flags: 'kb_research' KROS removal (Gate 2 legal scrub — KROS was
-- in the public description text).
-- BEFORE: 'Přístup ke znalostní bázi (KROS, ČSN)'
-- AFTER:  'Přístup ke znalostní bázi (OTSKP, ČSN)'
UPDATE feature_flags
SET description = 'Přístup ke znalostní bázi (OTSKP, ČSN)'
WHERE flag_key = 'kb_research'
  AND description = 'Přístup ke znalostní bázi (KROS, ČSN)';

-- operation_prices: 'urs_match' billing-row rename (visible in the cabinet
-- billing UI when the user expands per-operation credit costs).
-- BEFORE: 'URS párování' / 'AI párování položek na URS kódy'
-- AFTER:  'AI klasifikace pozic' / 'AI návrh kódů s pravděpodobností'
UPDATE operation_prices
SET display_name = 'AI klasifikace pozic',
    description  = 'AI návrh kódů s pravděpodobností'
WHERE operation_key = 'urs_match'
  AND display_name = 'URS párování';

-- Verification queries (run these after applying to confirm zero rows
-- still hold legacy values):
--
--   SELECT flag_key, display_name, description
--     FROM feature_flags
--     WHERE flag_key IN ('urs_matcher','monolit','registry','kb_research');
--
--   SELECT operation_key, display_name, description
--     FROM operation_prices
--     WHERE operation_key = 'urs_match';
--
-- Expected: all five rows now show the AFTER values listed in the comments
-- above. If any row still shows BEFORE values, re-run the migration (the
-- WHERE clause is keyed on the BEFORE value so a partial state is safe).
