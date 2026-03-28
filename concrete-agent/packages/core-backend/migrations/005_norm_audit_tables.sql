-- Migration 005: NKB Audit tables for source tracking and gap analysis
-- Adds: nkb_audit_runs, nkb_found_documents
-- Extends: nkb_norms with zdroje[] array

-- Add zdroje (sources) array to existing nkb_norms
ALTER TABLE nkb_norms ADD COLUMN IF NOT EXISTS zdroje TEXT[] DEFAULT '{}';
ALTER TABLE nkb_norms ADD COLUMN IF NOT EXISTS url_ke_stazeni TEXT;
ALTER TABLE nkb_norms ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50) DEFAULT 'norma';
ALTER TABLE nkb_norms ADD COLUMN IF NOT EXISTS oblast VARCHAR(100);

-- Audit run log
CREATE TABLE IF NOT EXISTS nkb_audit_runs (
    audit_id VARCHAR(100) PRIMARY KEY,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    sources_checked TEXT[] DEFAULT '{}',
    total_found INTEGER DEFAULT 0,
    aktualni INTEGER DEFAULT 0,
    zastaraly INTEGER DEFAULT 0,
    chybi INTEGER DEFAULT 0,
    nedostupny INTEGER DEFAULT 0,
    error TEXT,
    result_json JSONB
);

-- Found documents from all sources (deduplicated by oznaceni)
CREATE TABLE IF NOT EXISTS nkb_found_documents (
    oznaceni VARCHAR(300) PRIMARY KEY,
    nazev TEXT NOT NULL DEFAULT '',
    doc_type VARCHAR(50) NOT NULL DEFAULT 'norma',
    datum_ucinnosti VARCHAR(50),
    oblast VARCHAR(100),
    url_ke_stazeni TEXT,
    zdroje TEXT[] NOT NULL DEFAULT '{}',
    priorita INTEGER NOT NULL DEFAULT 2,
    is_freely_available BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'chybí',
    norm_id_in_db VARCHAR(100),
    version_in_db VARCHAR(50),
    version_in_source VARCHAR(50),
    raw_metadata JSONB DEFAULT '{}',
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nkb_found_status ON nkb_found_documents(status);
CREATE INDEX IF NOT EXISTS idx_nkb_found_doc_type ON nkb_found_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_nkb_found_oblast ON nkb_found_documents(oblast);
CREATE INDEX IF NOT EXISTS idx_nkb_found_priorita ON nkb_found_documents(priorita);
CREATE INDEX IF NOT EXISTS idx_nkb_found_zdroje ON nkb_found_documents USING GIN(zdroje);
CREATE INDEX IF NOT EXISTS idx_nkb_norms_zdroje ON nkb_norms USING GIN(zdroje);
CREATE INDEX IF NOT EXISTS idx_nkb_audit_status ON nkb_audit_runs(status);
