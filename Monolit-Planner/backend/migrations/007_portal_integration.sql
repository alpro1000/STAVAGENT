-- Migration 007: Add Portal integration to Monolit Planner
-- Date: 2026-01-20
-- Purpose: Connect Monolit Planner with stavagent-portal projects

-- ============================================
-- 1. ADD portal_project_id to bridges
-- ============================================

-- PostgreSQL version
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS portal_project_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bridges_portal_project ON bridges(portal_project_id);

-- SQLite version (for local development)
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so check first
-- ALTER TABLE bridges ADD COLUMN portal_project_id TEXT;
-- CREATE INDEX idx_bridges_portal_project ON bridges(portal_project_id);

-- ============================================
-- 2. ADD portal_project_id to monolith_projects
-- ============================================

ALTER TABLE monolith_projects ADD COLUMN IF NOT EXISTS portal_project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_monolith_projects_portal ON monolith_projects(portal_project_id);

-- ============================================
-- 3. CREATE normsets table (for AI suggestions)
-- ============================================

CREATE TABLE IF NOT EXISTS normsets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_tag TEXT NOT NULL,              -- URS_2024_OFFICIAL / RTS_2023 / KROS_2024 / INTERNAL_MEASURED

  -- Rebar norms
  rebar_h_per_t REAL NOT NULL,           -- Часов на 1 тонну арматуры

  -- Formwork norms
  formwork_assembly_h_per_m2 REAL NOT NULL,     -- Монтаж часов/м²
  formwork_disassembly_h_per_m2 REAL NOT NULL,  -- Демонтаж часов/м²

  -- Concreting norms
  pour_team_required INTEGER NOT NULL DEFAULT 6,       -- Размер бригады бетонщиков
  pour_setup_hours REAL NOT NULL DEFAULT 0.5,          -- Подготовка (ч)
  washout_hours REAL NOT NULL DEFAULT 0.5,             -- Промывка (ч)
  strip_wait_hours REAL NOT NULL DEFAULT 72.0,         -- Выдержка до распалубки (ч)
  move_clean_hours REAL NOT NULL DEFAULT 2.0,          -- Перестановка и очистка (ч)

  -- Metadata
  is_default BOOLEAN DEFAULT 0,          -- Набор норм по умолчанию
  is_active BOOLEAN DEFAULT 1,           -- Активен
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. CREATE position_suggestions table
-- ============================================

CREATE TABLE IF NOT EXISTS position_suggestions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,

  -- Suggestion metadata
  suggested_days REAL NOT NULL,          -- Рекомендуемое количество дней
  suggested_by TEXT NOT NULL,            -- "CALCULATOR_REBAR" / "CALCULATOR_FORMWORK" / "CALCULATOR_CONCRETING" / "AI_FOREMAN"
  normset_id TEXT REFERENCES normsets(id),  -- Какой набор норм использован
  norm_source TEXT,                      -- "URS_2024_OFFICIAL"
  assumptions_log TEXT,                  -- JSON с параметрами расчёта
  confidence REAL NOT NULL,              -- Уверенность (0-1)

  -- User decision
  status TEXT DEFAULT 'pending',         -- "pending" / "accepted" / "rejected" / "modified"
  user_decision_days REAL,               -- Что пользователь выбрал (если отличается)
  user_note TEXT,                        -- Комментарий пользователя

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_position_suggestions_position ON position_suggestions(position_id);
CREATE INDEX IF NOT EXISTS idx_position_suggestions_status ON position_suggestions(status);

-- ============================================
-- 5. SEED DATA: Default normsets
-- ============================================

-- ÚRS 2024 (Czech official norms) - DEFAULT
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t,
  formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
  pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours,
  is_default, is_active
) VALUES (
  'norm_urs_2024',
  'ÚRS 2024',
  'Ústřední rozpočtové standardy 2024 (Czech Republic) - Oficiální normy',
  'URS_2024_OFFICIAL',
  50.0,   -- rebar: 50 h/t
  0.8,    -- formwork assembly: 0.8 h/m²
  0.3,    -- formwork disassembly: 0.3 h/m²
  6,      -- pour team: 6 persons
  0.5,    -- setup: 0.5 h
  0.5,    -- washout: 0.5 h
  72.0,   -- strip wait: 72 h (3 days)
  2.0,    -- move/clean: 2 h
  1,      -- is_default
  1       -- is_active
);

-- RTS 2023 (Russian territorial norms)
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t,
  formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
  pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours,
  is_default, is_active
) VALUES (
  'norm_rts_2023',
  'RTS 2023',
  'Российские территориальные сметные нормативы 2023',
  'RTS_2023',
  48.0,   -- rebar: 48 h/t (slightly faster)
  0.75,   -- formwork assembly: 0.75 h/m²
  0.28,   -- formwork disassembly: 0.28 h/m²
  6,
  0.5,
  0.5,
  72.0,
  2.0,
  0,      -- not default
  1
);

-- KROS 2024 (Czech complex norms)
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t,
  formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
  pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours,
  is_default, is_active
) VALUES (
  'norm_kros_2024',
  'KROS 2024',
  'Komplexní rozpočtové orientační standardy 2024',
  'KROS_2024',
  52.0,   -- rebar: 52 h/t (more conservative)
  0.85,   -- formwork assembly: 0.85 h/m²
  0.32,   -- formwork disassembly: 0.32 h/m²
  6,
  0.5,
  0.5,
  72.0,
  2.0,
  0,
  1
);

-- Internal Measured (company-specific norms)
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t,
  formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
  pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours,
  is_default, is_active
) VALUES (
  'norm_internal_2025',
  'Internal Measured 2025',
  'Фактически замеренные нормы на проектах компании',
  'INTERNAL_MEASURED',
  47.0,   -- rebar: 47 h/t (measured on site)
  0.72,   -- formwork assembly: 0.72 h/m² (experienced crew)
  0.25,   -- formwork disassembly: 0.25 h/m² (faster with practice)
  6,
  0.4,    -- setup: 0.4 h (optimized)
  0.4,    -- washout: 0.4 h
  72.0,
  1.5,    -- move/clean: 1.5 h (efficient logistics)
  0,
  1
);

-- ============================================
-- 6. TRIGGERS (auto-update timestamps)
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_normsets_timestamp
AFTER UPDATE ON normsets
BEGIN
  UPDATE normsets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 7. COMMENTS & DOCUMENTATION
-- ============================================

-- This migration adds Portal integration to Monolit Planner:
--
-- 1. portal_project_id in bridges/monolith_projects
--    - Links Monolit projects to Portal projects
--    - Enables cross-kiosk data sharing
--
-- 2. normsets table
--    - Library of construction norms (ÚRS, RTS, KROS, internal)
--    - Used by AI suggestion calculators
--    - 4 seed datasets included
--
-- 3. position_suggestions table
--    - Stores AI suggestions for days/hours
--    - Tracks user acceptance/rejection
--    - Provides audit trail for decisions
--
-- Usage:
--   - When user clicks "Подсказать ✨" button
--   - Calculator uses normset to compute suggestion
--   - Suggestion stored in position_suggestions
--   - User accepts → copies to position.days
--   - User rejects → keeps manual value

-- ============================================
-- END OF MIGRATION 007
-- ============================================
