-- Migration 006: R0 Deterministic Core
-- Date: 2026-01-20
-- Purpose: Expand schema for proper construction planning with traceability
-- Architecture: Elements → Captures → Tasks → Schedule → Cost

-- ============================================
-- 1. R0 PROJECTS (Enhanced project metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS r0_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,

  -- Work regime
  shift_hours REAL NOT NULL DEFAULT 10.0,              -- Длительность смены (ч)
  time_utilization_k REAL NOT NULL DEFAULT 0.80,       -- Коэффициент использования времени
  days_per_month INTEGER NOT NULL DEFAULT 30,          -- Дней в месяце (30=непрерывная, 22=рабочие)

  -- Cost parameters
  oh_rate REAL NOT NULL DEFAULT 0.13,                  -- Накладные расходы (13%)
  profit_rate REAL NOT NULL DEFAULT 0.08,              -- Прибыль (8%)
  reserve_rate REAL NOT NULL DEFAULT 0.05,             -- Резерв (5%)

  -- Wage rates
  wage_rebar_czk_h REAL NOT NULL DEFAULT 398,          -- Ставка арматурщиков (CZK/ч)
  wage_formwork_czk_h REAL NOT NULL DEFAULT 398,       -- Ставка опалубщиков (CZK/ч)
  wage_concreting_czk_h REAL NOT NULL DEFAULT 398,     -- Ставка бетонщиков (CZK/ч)

  -- Machine rates
  pump_rate_czk_h REAL NOT NULL DEFAULT 1500,          -- Стоимость насоса (CZK/ч)
  formwork_rental_czk_day REAL NOT NULL DEFAULT 300,   -- Аренда комплекта опалубки (CZK/день)

  -- Resources available
  crew_rebar_count INTEGER NOT NULL DEFAULT 1,         -- Количество бригад арматурщиков
  crew_formwork_count INTEGER NOT NULL DEFAULT 1,      -- Количество бригад опалубщиков
  crew_concreting_count INTEGER NOT NULL DEFAULT 1,    -- Количество бригад бетонщиков
  formwork_kits_count INTEGER NOT NULL DEFAULT 1,      -- Количество комплектов опалубки
  pumps_count INTEGER NOT NULL DEFAULT 1,              -- Количество насосов

  -- Metadata
  status TEXT DEFAULT 'active',                        -- active / archived
  owner_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. ELEMENTS (Physical construction elements)
-- ============================================
CREATE TABLE IF NOT EXISTS elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES r0_projects(id) ON DELETE CASCADE,

  -- Classification
  type TEXT NOT NULL,                                  -- slab / wall / beam / footing / column
  name TEXT NOT NULL,                                  -- "Deska nad 1. NP"
  description TEXT,

  -- Geometry
  length_m REAL,                                       -- Длина (м)
  width_m REAL,                                        -- Ширина (м)
  height_m REAL,                                       -- Высота (м)
  thickness_m REAL,                                    -- Толщина (м)

  -- Quantities (calculated or entered)
  concrete_volume_m3 REAL NOT NULL,                    -- Объём бетона (м³)
  formwork_area_m2 REAL NOT NULL,                      -- Площадь опалубки (м²)
  rebar_mass_t REAL NOT NULL,                          -- Масса арматуры (т)

  -- Technological constraints
  max_continuous_pour_hours REAL DEFAULT 12.0,         -- Макс. окно непрерывности (ч)
  layer_thickness_m REAL,                              -- Толщина слоя при послойном (м)

  -- Traceability
  source_tag TEXT DEFAULT 'USER',                      -- USER / AI_PROPOSED / IMPORTED
  confidence REAL DEFAULT 1.0,                         -- Уверенность (0-1)
  assumptions_log TEXT,                                -- JSON с допущениями

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. NORMSETS (Library of norms)
-- ============================================
CREATE TABLE IF NOT EXISTS normsets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                                  -- "ÚRS 2024"
  description TEXT,
  source_tag TEXT NOT NULL,                            -- URS_2024_OFFICIAL / RTS_2023 / INTERNAL_MEASURED / AI_PROPOSED

  -- Rebar norms
  rebar_h_per_t REAL NOT NULL,                         -- Часов на 1 тонну арматуры

  -- Formwork norms
  formwork_assembly_h_per_m2 REAL NOT NULL,            -- Монтаж часов/м²
  formwork_disassembly_h_per_m2 REAL NOT NULL,         -- Демонтаж часов/м²

  -- Concreting norms
  pour_team_required INTEGER NOT NULL DEFAULT 6,       -- Размер бригады бетонщиков
  pour_setup_hours REAL NOT NULL DEFAULT 0.5,          -- Подготовка (ч)
  washout_hours REAL NOT NULL DEFAULT 0.5,             -- Промывка (ч)
  strip_wait_hours REAL NOT NULL DEFAULT 72.0,         -- Выдержка до распалубки (ч)
  move_clean_hours REAL NOT NULL DEFAULT 2.0,          -- Перестановка и очистка (ч)

  -- Metadata
  is_default BOOLEAN DEFAULT 0,                        -- Набор норм по умолчанию
  is_active BOOLEAN DEFAULT 1,                         -- Активен
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. CAPTURES (Takts/phases of construction)
-- ============================================
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,

  -- Sequence
  sequence_index INTEGER NOT NULL,                     -- Порядковый номер (1, 2, 3...)
  name TEXT,                                           -- "Takt 1"

  -- Quantities for this capture
  volume_m3 REAL NOT NULL,                             -- Объём бетона (м³)
  area_m2 REAL NOT NULL,                               -- Площадь опалубки (м²)
  mass_t REAL NOT NULL,                                -- Масса арматуры (т)

  -- Joint/connection
  joint_type TEXT DEFAULT 'none',                      -- none / construction_joint / expansion_joint

  -- Dependencies (JSON array of capture IDs)
  dependencies TEXT DEFAULT '[]',                      -- ["capt_00", "capt_01"]

  -- Traceability
  source_tag TEXT DEFAULT 'USER',
  confidence REAL DEFAULT 1.0,
  assumptions_log TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. TASKS (Operations - auto-generated)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  normset_id TEXT NOT NULL REFERENCES normsets(id),

  -- Task classification
  type TEXT NOT NULL,                                  -- rebar / formwork_in / pour / wait_strip / formwork_out / move_clean
  sequence INTEGER NOT NULL,                           -- Порядок в захватке (1,2,3...)
  description TEXT,                                    -- "Вязка арматуры, Takt 1"

  -- Calculated fields (DETERMINISTIC - from calculators!)
  duration_hours REAL NOT NULL,                        -- Длительность (ч)
  duration_days REAL NOT NULL,                         -- Длительность (дни)
  labor_hours REAL NOT NULL,                           -- Трудозатраты (ч)

  -- Costs
  cost_labor REAL NOT NULL,                            -- Стоимость труда (CZK)
  cost_machine REAL,                                   -- Стоимость механизмов (CZK)
  cost_rental REAL,                                    -- Аренда (CZK) - заполняется из Schedule!

  -- Resources required
  crew_size INTEGER NOT NULL,                          -- Размер бригады
  resources_required TEXT DEFAULT '{}',                -- JSON: {"kit_id": "k1", "pump_id": "p1"}

  -- Traceability (CRITICAL!)
  source_tag TEXT NOT NULL,                            -- URS_2024_OFFICIAL / RTS_2023 / USER
  norm_used TEXT,                                      -- "50 h/t"
  assumptions_log TEXT NOT NULL,                       -- "crew=4, k=0.8, wage=398 CZK/h"
  confidence REAL NOT NULL,                            -- 0.0-1.0

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. SCHEDULE (Result of scheduling engine)
-- ============================================
CREATE TABLE IF NOT EXISTS schedule (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,

  -- Timeline
  start_day REAL NOT NULL,                             -- День начала (от старта проекта)
  end_day REAL NOT NULL,                               -- День окончания

  -- Resources assigned
  resources_used TEXT NOT NULL DEFAULT '{}',           -- JSON: {"crew_id": "crew_A", "kit_id": "k1", "pump_id": "p1"}

  -- Critical path
  is_critical BOOLEAN DEFAULT 0,                       -- На критическом пути?
  slack_days REAL DEFAULT 0,                           -- Резерв времени (дни)

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. COST_BREAKDOWN (Detailed cost traceability)
-- ============================================
CREATE TABLE IF NOT EXISTS cost_breakdown (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Cost line item
  description TEXT NOT NULL,                           -- "Вязка арматуры, Deska nad 1. NP, Takt 1"
  quantity REAL NOT NULL,                              -- 2.05
  unit TEXT NOT NULL,                                  -- "t"
  unit_cost REAL NOT NULL,                             -- 19,900 CZK/т
  total_cost REAL NOT NULL,                            -- 40,795 CZK

  -- Category
  cost_type TEXT NOT NULL,                             -- labor / machine / material / rental

  -- Traceability
  source_tag TEXT NOT NULL,                            -- URS_2024_OFFICIAL
  norm_used TEXT,                                      -- "50 h/t"
  assumptions TEXT,                                    -- "crew=4, k=0.8, wage=398 CZK/h"
  confidence REAL NOT NULL,                            -- 0.95

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. BOTTLENECKS (Validation issues)
-- ============================================
CREATE TABLE IF NOT EXISTS bottlenecks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES r0_projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,

  -- Issue classification
  type TEXT NOT NULL,                                  -- POUR_EXCEEDS_SHIFT / FORMWORK_BOTTLENECK / etc.
  severity TEXT NOT NULL,                              -- ERROR / WARNING / INFO

  -- Details
  message TEXT NOT NULL,                               -- "Бетонирование захватки capt_01: 14.5ч > смены 10ч"
  suggestion TEXT,                                     -- "Разбить на 2 такта или увеличить Q_eff насоса"

  -- Status
  status TEXT DEFAULT 'open',                          -- open / acknowledged / resolved

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_elements_project ON elements(project_id);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);
CREATE INDEX IF NOT EXISTS idx_captures_element ON captures(element_id);
CREATE INDEX IF NOT EXISTS idx_captures_sequence ON captures(element_id, sequence_index);
CREATE INDEX IF NOT EXISTS idx_tasks_capture ON tasks(capture_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_schedule_timeline ON schedule(start_day, end_day);
CREATE INDEX IF NOT EXISTS idx_schedule_critical ON schedule(is_critical);
CREATE INDEX IF NOT EXISTS idx_cost_breakdown_task ON cost_breakdown(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_breakdown_type ON cost_breakdown(cost_type);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_project ON bottlenecks(project_id);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_severity ON bottlenecks(severity);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_status ON bottlenecks(status);

-- ============================================
-- SEED DATA: Default normsets
-- ============================================

-- ÚRS 2024 (Czech official norms)
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t, formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
  pour_team_required, pour_setup_hours, washout_hours, strip_wait_hours, move_clean_hours,
  is_default, is_active
) VALUES (
  'norm_urs_2024',
  'ÚRS 2024',
  'Ústřední rozpočtové standardy 2024 (Czech Republic)',
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
  rebar_h_per_t, formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
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
  rebar_h_per_t, formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
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

-- Internal measured (company-specific norms)
INSERT OR IGNORE INTO normsets (
  id, name, description, source_tag,
  rebar_h_per_t, formwork_assembly_h_per_m2, formwork_disassembly_h_per_m2,
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
-- TRIGGERS (auto-update timestamps)
-- ============================================

-- R0 Projects
CREATE TRIGGER IF NOT EXISTS update_r0_projects_timestamp
AFTER UPDATE ON r0_projects
BEGIN
  UPDATE r0_projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Elements
CREATE TRIGGER IF NOT EXISTS update_elements_timestamp
AFTER UPDATE ON elements
BEGIN
  UPDATE elements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Normsets
CREATE TRIGGER IF NOT EXISTS update_normsets_timestamp
AFTER UPDATE ON normsets
BEGIN
  UPDATE normsets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Captures
CREATE TRIGGER IF NOT EXISTS update_captures_timestamp
AFTER UPDATE ON captures
BEGIN
  UPDATE captures SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Tasks
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp
AFTER UPDATE ON tasks
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Schedule
CREATE TRIGGER IF NOT EXISTS update_schedule_timestamp
AFTER UPDATE ON schedule
BEGIN
  UPDATE schedule SET updated_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
END;

-- Bottlenecks
CREATE TRIGGER IF NOT EXISTS update_bottlenecks_timestamp
AFTER UPDATE ON bottlenecks
BEGIN
  UPDATE bottlenecks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- VIEWS (for easier querying)
-- ============================================

-- View: Full task details with traceability
CREATE VIEW IF NOT EXISTS v_tasks_full AS
SELECT
  t.id as task_id,
  t.type as task_type,
  t.sequence,
  t.description,
  t.duration_hours,
  t.duration_days,
  t.labor_hours,
  t.cost_labor,
  t.cost_machine,
  t.cost_rental,
  t.source_tag,
  t.assumptions_log,
  t.confidence,

  c.id as capture_id,
  c.sequence_index as capture_sequence,
  c.volume_m3,
  c.area_m2,
  c.mass_t,

  e.id as element_id,
  e.name as element_name,
  e.type as element_type,

  p.id as project_id,
  p.name as project_name,

  n.id as normset_id,
  n.name as normset_name,
  n.source_tag as norm_source
FROM tasks t
JOIN captures c ON t.capture_id = c.id
JOIN elements e ON c.element_id = e.id
JOIN r0_projects p ON e.project_id = p.id
JOIN normsets n ON t.normset_id = n.id;

-- View: Schedule with task details
CREATE VIEW IF NOT EXISTS v_schedule_full AS
SELECT
  s.task_id,
  s.start_day,
  s.end_day,
  s.end_day - s.start_day as duration_days,
  s.is_critical,
  s.slack_days,
  s.resources_used,

  t.type as task_type,
  t.description as task_description,
  t.labor_hours,
  t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0) as total_cost,

  c.sequence_index as capture_sequence,
  e.name as element_name,
  p.name as project_name
FROM schedule s
JOIN tasks t ON s.task_id = t.id
JOIN captures c ON t.capture_id = c.id
JOIN elements e ON c.element_id = e.id
JOIN r0_projects p ON e.project_id = p.id
ORDER BY s.start_day, c.sequence_index, t.sequence;

-- View: Cost summary by element
CREATE VIEW IF NOT EXISTS v_cost_by_element AS
SELECT
  e.id as element_id,
  e.name as element_name,
  e.type as element_type,
  p.id as project_id,
  p.name as project_name,

  SUM(t.labor_hours) as total_labor_hours,
  SUM(t.cost_labor) as total_cost_labor,
  SUM(COALESCE(t.cost_machine, 0)) as total_cost_machine,
  SUM(COALESCE(t.cost_rental, 0)) as total_cost_rental,
  SUM(t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0)) as total_cost,

  e.concrete_volume_m3,
  CASE
    WHEN e.concrete_volume_m3 > 0 THEN
      SUM(t.cost_labor + COALESCE(t.cost_machine, 0) + COALESCE(t.cost_rental, 0)) / e.concrete_volume_m3
    ELSE 0
  END as unit_cost_czk_per_m3
FROM elements e
JOIN r0_projects p ON e.project_id = p.id
LEFT JOIN captures c ON e.id = c.element_id
LEFT JOIN tasks t ON c.id = t.capture_id
GROUP BY e.id, e.name, e.type, p.id, p.name, e.concrete_volume_m3;

-- ============================================
-- COMMENTS
-- ============================================
-- SQLite doesn't support COMMENT ON TABLE/COLUMN, so we document here:

-- r0_projects: Enhanced project with all parameters for deterministic calculations
-- elements: Physical construction elements (slabs, walls, beams, etc.)
-- normsets: Library of labor/time norms from various sources (ÚRS, RTS, KROS, internal)
-- captures: Phased construction (takts) for large elements
-- tasks: Auto-generated operations (rebar, formwork_in, pour, wait, formwork_out, move_clean)
-- schedule: Result of scheduling engine (timeline + resource assignment)
-- cost_breakdown: Detailed cost traceability for every line item
-- bottlenecks: Validation issues found by rule-based analyzer

-- ============================================
-- END OF MIGRATION 006
-- ============================================
