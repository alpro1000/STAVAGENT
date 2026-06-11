-- 013_mcp_rate_limit_buckets.sql
-- Postgres-backed rate-limit buckets for the public DCR /register endpoint.
--
-- Replaces the Memorystore Redis Lua INCR+EXPIRE bucket (cost-audit task 3,
-- docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md §2.2): the limiter was
-- the ONLY hard Redis consumer in production; moving it here retires the
-- Redis instance + the VPC connector that existed solely to reach it.
--
-- Semantics mirror the Lua script exactly (fixed window, NOT sliding):
--   * window_start is set on the FIRST increment of a window and does not
--     move on subsequent hits — an attacker staying just under the limit
--     cannot keep the bucket alive forever;
--   * an expired window resets count to 1 and restarts window_start.
-- Both transitions happen inside a single INSERT ... ON CONFLICT ... DO
-- UPDATE ... RETURNING — one round-trip, atomic under concurrency (row lock
-- on the PK), so a concurrent burst can't double-count or skip the reset.
--
-- Volume: one row per source IP per window (limit is 10/hour/IP) — the
-- table stays tiny. Stale rows are harmless (next hit after expiry resets
-- them in place); no cleanup job needed.

CREATE TABLE IF NOT EXISTS mcp_rate_limit_buckets (
    bucket_key   TEXT        PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count        INTEGER     NOT NULL DEFAULT 1
);
