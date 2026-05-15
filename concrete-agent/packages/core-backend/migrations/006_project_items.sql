-- Migration 006: Unified Item Layer — project_items + item_versions
-- Permanent position storage with namespace blocks and version history.

CREATE TABLE IF NOT EXISTS project_items (
    item_id VARCHAR(100) PRIMARY KEY,          -- Permanent UUID (e.g., "item_a1b2c3d4e5f6")
    project_id VARCHAR(255) NOT NULL,          -- Project reference

    -- Identity triple (for matching on reimport)
    code_system VARCHAR(20) NOT NULL DEFAULT 'unknown',  -- otskp, urs, rts, unknown
    kod VARCHAR(200) NOT NULL DEFAULT '',
    popis TEXT NOT NULL DEFAULT '',
    mj VARCHAR(50) NOT NULL DEFAULT '',

    -- Hierarchy
    so_id VARCHAR(100),
    so_name VARCHAR(500),
    oddil_code VARCHAR(100),
    oddil_name VARCHAR(500),

    -- Estimate data (namespace: estimate)
    estimate_data JSONB DEFAULT '{}',

    -- Monolit data (namespace: monolit)
    monolit_data JSONB,

    -- Classification data (namespace: classification)
    classification_data JSONB,

    -- Core metadata (namespace: core)
    version INTEGER NOT NULL DEFAULT 1,
    source_file VARCHAR(500),
    deleted_in_reimport BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Identity triple must be unique within a project + code_system.
-- For RTS, `oddil_code` is part of the identity because codes can repeat
-- across sections. Postgres rejects expressions (e.g. COALESCE) inside an
-- inline `UNIQUE(...)` table constraint, so we enforce uniqueness via a
-- unique expression index instead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_items_identity_triple
    ON project_items (project_id, code_system, kod, mj, COALESCE(oddil_code, ''));

-- Version history (changes to estimate data on reimport)
CREATE TABLE IF NOT EXISTS item_versions (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(100) NOT NULL REFERENCES project_items(item_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_fields TEXT[] NOT NULL DEFAULT '{}',
    old_values JSONB NOT NULL DEFAULT '{}',
    new_values JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_project ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_code_system ON project_items(code_system);
CREATE INDEX IF NOT EXISTS idx_items_kod ON project_items(kod);
CREATE INDEX IF NOT EXISTS idx_items_so ON project_items(so_id);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON project_items(deleted_in_reimport);
CREATE INDEX IF NOT EXISTS idx_items_estimate ON project_items USING GIN(estimate_data);
CREATE INDEX IF NOT EXISTS idx_items_classification ON project_items USING GIN(classification_data);
CREATE INDEX IF NOT EXISTS idx_items_monolit ON project_items USING GIN(monolit_data);
CREATE INDEX IF NOT EXISTS idx_item_versions_item ON item_versions(item_id);

-- Full-text search on popis (Czech)
CREATE INDEX IF NOT EXISTS idx_items_popis_fts ON project_items
    USING GIN(to_tsvector('simple', popis));
