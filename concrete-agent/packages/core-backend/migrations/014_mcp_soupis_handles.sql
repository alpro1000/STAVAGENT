-- 014_mcp_soupis_handles.sql
-- Owner-scoped, TTL'd handles for a PRE-PARSED soupis (výkaz výměr / BOQ).
--
-- Why: build_bridge_passport needs a soupis, but a real soupis XML is ~6.6 MB;
-- base64-inlining it through an LLM-mediated MCP call is impossible (megabytes
-- would have to pass through the model context). Instead the caller uploads the
-- file to POST /api/v1/mcp/soupis/upload (multipart, OUT of the model context),
-- the server parses it ONCE server-side, stores the COMPACT parsed result here
-- under an unguessable handle, and build_bridge_passport reads it by soupis_ref.
-- The megabytes never persist beyond the upload temp file.
--
-- Isolation (docs/security/isolation_model.md, mirrored into the MCP auth
-- surface — the surface that owns mcp_api_keys, not the Portal JWT surface):
--   * owner_id is stamped from the VERIFIED bearer at INSERT, never from the
--     request body (the /api/positions lesson: never trust a caller-supplied id);
--   * resolution is `WHERE soupis_ref = %s AND owner_id = %s` — a ref owned by
--     someone else reads as "not found", never the blob and never a 403 that
--     confirms existence;
--   * this is the owner dimension passport_store / bridge_passport_store lack —
--     do NOT clone their global namespace for a caller-supplied ref.
--
-- TTL: a fresh soupis_ref per upload (no content dedup — Alexander's call);
-- expires_at + purge_expired() GC (lazy on read + a mandatory periodic sweep in
-- app/tasks/maintenance.py) evict the rest so parsed BOQs don't pile up silently.
--
-- Idempotent: CREATE TABLE / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS mcp_soupis_handles (
    soupis_ref       TEXT        PRIMARY KEY,   -- soupis-{hex32}, 128-bit unguessable
    owner_id         INTEGER     NOT NULL
                                 REFERENCES mcp_api_keys(id) ON DELETE CASCADE,
    parsed_budget    JSONB       NOT NULL,       -- compact parse_construction_budget output
    filename         TEXT,
    format_detected  TEXT,
    total_items      INTEGER     NOT NULL DEFAULT 0,
    size_bytes       INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ NOT NULL
);

-- Owner-scoped listing / cascade-friendly lookups (the resolve query is covered
-- by the PK on soupis_ref; this covers owner-side operations + FK checks).
CREATE INDEX IF NOT EXISTS ix_mcp_soupis_handles_owner
    ON mcp_soupis_handles (owner_id);

-- GC sweep of expired rows (purge_expired + the maintenance task).
CREATE INDEX IF NOT EXISTS ix_mcp_soupis_handles_expires
    ON mcp_soupis_handles (expires_at);
