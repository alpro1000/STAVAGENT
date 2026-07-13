-- 015_soupis_handle_parse_version.sql
-- STALE HANDLE fix (bug passport-soupis-join-whole-stavba, increment 2.5).
--
-- A soupis_ref stores the PARSED result (parsed_budget), not the raw XML — so a
-- handle created BEFORE a parser deploy silently serves data parsed by the OLD
-- parser for its whole 24 h TTL. Found live during the #1503 re-run: the same
-- soupis_ref returned the pre-fix numbers (deck 8561) while a fresh upload of the
-- SAME file returned the fixed ones (2697.941) — old data, old behaviour, no
-- signal to the user.
--
-- Fix: stamp the parser item-contract version (PARSE_VERSION in
-- app/mcp/tools/budget.py) on the handle at save; resolve compares it with the
-- current version and a mismatch surfaces as a typed `soupis_ref_stale`
-- ("re-upload required") — never a silent old result.
--
-- Existing rows get NULL → stale by definition (they predate versioning, i.e.
-- they were parsed by SOME old parser). Idempotent.

ALTER TABLE mcp_soupis_handles
    ADD COLUMN IF NOT EXISTS parse_version INTEGER;
