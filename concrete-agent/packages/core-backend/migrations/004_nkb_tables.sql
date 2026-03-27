-- NKB (Normative Knowledge Base) PostgreSQL migration
-- Creates tables for norms registry and rules, replacing JSON file storage.
-- Backward compatible: norm_storage.py falls back to JSON if DB unavailable.

-- Layer 1: Norms Registry
CREATE TABLE IF NOT EXISTS nkb_norms (
    norm_id VARCHAR(100) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,          -- zakon, vyhlaska, csn, csn_en, tkp, vtp, ztp, predpis...
    designation VARCHAR(200) NOT NULL,      -- e.g. 'ČSN 73 6201'
    title TEXT NOT NULL,
    title_en TEXT,
    version VARCHAR(50) DEFAULT '1.0',
    valid_from DATE,
    valid_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    replaces TEXT[] DEFAULT '{}',           -- norm_ids this replaces
    replaced_by VARCHAR(100),
    -- Scope (denormalized for query performance)
    scope_construction_types TEXT[] DEFAULT '{}',  -- pozemní, dopravní, železniční, mostní
    scope_phases TEXT[] DEFAULT '{}',              -- DUR, DSP, PDPS, realizace
    scope_objects TEXT[] DEFAULT '{}',             -- beton, výztuž, most, vozovka...
    scope_regions TEXT[] DEFAULT '{ČR}',
    source_url TEXT,
    tags TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 50,            -- zákon=100, vyhláška=90, ČSN=70, TKP=60, VTP=50
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Layer 2: Rules
CREATE TABLE IF NOT EXISTS nkb_rules (
    rule_id VARCHAR(100) PRIMARY KEY,
    norm_id VARCHAR(100) NOT NULL REFERENCES nkb_norms(norm_id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,         -- tolerance, formula, deadline, procedure, requirement...
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    applies_to TEXT[] DEFAULT '{}',         -- výztuž, beton, most...
    phase VARCHAR(50),
    construction_type VARCHAR(50),
    -- Rule values
    parameter VARCHAR(200),
    value TEXT,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    unit VARCHAR(50),
    formula TEXT,
    -- Enforcement
    is_mandatory BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 50,
    penalty_reference TEXT,
    section_reference TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_nkb_norms_category ON nkb_norms(category);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_active ON nkb_norms(is_active);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_priority ON nkb_norms(priority DESC);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_construction ON nkb_norms USING GIN(scope_construction_types);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_objects ON nkb_norms USING GIN(scope_objects);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_tags ON nkb_norms USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_nkb_rules_norm ON nkb_rules(norm_id);
CREATE INDEX IF NOT EXISTS idx_nkb_rules_type ON nkb_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_nkb_rules_mandatory ON nkb_rules(is_mandatory);
CREATE INDEX IF NOT EXISTS idx_nkb_rules_applies ON nkb_rules USING GIN(applies_to);
CREATE INDEX IF NOT EXISTS idx_nkb_rules_tags ON nkb_rules USING GIN(tags);

-- Full-text search on norm titles and rule descriptions (Czech)
CREATE INDEX IF NOT EXISTS idx_nkb_norms_fts ON nkb_norms USING GIN(to_tsvector('simple', title || ' ' || designation));
CREATE INDEX IF NOT EXISTS idx_nkb_rules_fts ON nkb_rules USING GIN(to_tsvector('simple', title || ' ' || description));
