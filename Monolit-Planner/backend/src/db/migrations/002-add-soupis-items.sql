-- Migration 002: Add soupis_items table for generated bill of quantities
-- Used by Soupis Prací tab (OTSKP price engine → URS classifier)

CREATE TABLE IF NOT EXISTS soupis_items (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id        TEXT NOT NULL,
  item_id           TEXT NOT NULL,
  chapter           TEXT,
  code_otskp        TEXT,
  code_urs          TEXT,
  urs_name          TEXT,
  urs_confidence    REAL,
  description       TEXT NOT NULL,
  specification     TEXT,
  unit              TEXT NOT NULL,
  quantity          REAL,
  unit_price        REAL,
  total_price       REAL,
  quantity_status   TEXT DEFAULT 'OK',
  confidence        REAL DEFAULT 1.00,
  source_param      TEXT,
  is_composite      INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_soupis_project ON soupis_items(project_id);
CREATE INDEX IF NOT EXISTS idx_soupis_otskp ON soupis_items(code_otskp);
