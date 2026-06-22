-- 012_orchestrator_tables.sql
-- Orchestrator stage-gating tables — sessions + append-only audit log.
--
-- Live-seal blocker fix (2026-06-10): these tables existed only as ORM models
-- (created ad hoc by the CI test fixture via metadata.create_all) — NO migration
-- ever created them, so production never had them. This migration codifies them.
--
-- DECISION (б-zero, live-seal blockers task §3.1): user_id / project_id are
-- PLAIN indexed UUIDs, NOT foreign keys. The shared production database is
-- owned by the Portal, whose `users.id` is INTEGER — a UUID FK to it is not
-- even expressible, and nothing in the orchestrator path ever reads the users
-- row (tenant isolation is enforced in app code by comparing the authenticated
-- principal's user_id to the session's user_id). Same convention the audit
-- table always documented: "plain UUIDs — NOT FKs". Consequently the
-- orchestrator performs NO writes to Portal-owned tables (users / projects);
-- the former auto-provisioning upserts are removed.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS,
-- matching the startup-migrations runner contract (single-writer advisory lock).

CREATE TABLE IF NOT EXISTS orchestrator_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Tenant isolation keys — plain UUIDs, no FK (see header).
    user_id         UUID NOT NULL,
    project_id      UUID NOT NULL,
    -- State-machine position + lifecycle status.
    workflow_state  VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT_ANALYSIS',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    -- TTL / expiry (default applied by the repository layer at creation).
    expires_at      TIMESTAMPTZ,
    -- JSONB accumulators for replay.
    partials          JSONB NOT NULL DEFAULT '{}',
    aggregates        JSONB NOT NULL DEFAULT '{}',
    drafts            JSONB NOT NULL DEFAULT '{}',
    decisions         JSONB NOT NULL DEFAULT '[]',
    conversation_log  JSONB NOT NULL DEFAULT '[]',
    tool_calls_log    JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_orchestrator_session_status
        CHECK (status IN ('active', 'committed', 'abandoned', 'undone')),
    CONSTRAINT check_orchestrator_session_workflow_state
        CHECK (workflow_state IN (
            'DOCUMENT_ANALYSIS','WORK_ATOMIZATION','DECOMPOSITION',
            'CATALOG_BINDING','PRICING','REVIEW','COMMIT_PENDING',
            'COMMITTED','EXPORTED'))
);

CREATE INDEX IF NOT EXISTS ix_orchestrator_sessions_user_id
    ON orchestrator_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_orchestrator_sessions_project_id
    ON orchestrator_sessions (project_id);
CREATE INDEX IF NOT EXISTS ix_orchestrator_sessions_workflow_state
    ON orchestrator_sessions (workflow_state);
CREATE INDEX IF NOT EXISTS ix_orchestrator_sessions_status
    ON orchestrator_sessions (status);
CREATE INDEX IF NOT EXISTS ix_orchestrator_sessions_expires_at
    ON orchestrator_sessions (expires_at);

CREATE TABLE IF NOT EXISTS orchestrator_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Tenant / session context (plain UUIDs — NOT FKs; audit outlives its refs).
    session_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    project_id      UUID,
    -- What happened.
    event_type      VARCHAR(30) NOT NULL,
    -- Tool fingerprint (tool_call / policy_violation events).
    tool_name           VARCHAR(120),
    tool_version        VARCHAR(40),
    inputs_hash         VARCHAR(64),
    outputs_hash        VARCHAR(64),
    policy_hash         VARCHAR(64),
    core_engine_version VARCHAR(40),
    -- State-transition fields (state_transition events).
    transition_from   VARCHAR(30),
    transition_to     VARCHAR(30),
    transition_source VARCHAR(200),
    -- Free-form structured context.
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_orchestrator_audit_log_session_id
    ON orchestrator_audit_log (session_id);
CREATE INDEX IF NOT EXISTS ix_orchestrator_audit_log_user_id
    ON orchestrator_audit_log (user_id);
CREATE INDEX IF NOT EXISTS ix_orchestrator_audit_log_project_id
    ON orchestrator_audit_log (project_id);
CREATE INDEX IF NOT EXISTS ix_orchestrator_audit_log_event_type
    ON orchestrator_audit_log (event_type);

-- Append-only guarantee (AC13): any UPDATE or DELETE raises.
CREATE OR REPLACE FUNCTION orchestrator_audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'orchestrator_audit_log is append-only: % not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orchestrator_audit_log_append_only ON orchestrator_audit_log;
CREATE TRIGGER trg_orchestrator_audit_log_append_only
    BEFORE UPDATE OR DELETE ON orchestrator_audit_log
    FOR EACH ROW EXECUTE FUNCTION orchestrator_audit_log_append_only();
