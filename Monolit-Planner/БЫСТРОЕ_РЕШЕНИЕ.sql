-- ================================================================
-- БЫСТРОЕ РЕШЕНИЕ: Создать project_config и включить AI Suggestion
-- ================================================================
-- Этот скрипт безопасен - можно запускать многократно
-- ================================================================

-- Шаг 1: Создать таблицу project_config (если не существует)
CREATE TABLE IF NOT EXISTS project_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feature_flags TEXT NOT NULL,
  defaults TEXT NOT NULL,
  days_per_month_mode INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Шаг 2: Удалить старую запись (если есть)
DELETE FROM project_config WHERE id = 1;

-- Шаг 3: Вставить конфигурацию с включенным AI Suggestion
INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
VALUES (
  1,
  '{"FF_AI_DAYS_SUGGEST": true, "FF_PUMP_MODULE": false, "FF_ADVANCED_METRICS": false, "FF_DARK_MODE": false, "FF_SPEED_ANALYSIS": false}',
  '{"ROUNDING_STEP_KROS": 50, "RHO_T_PER_M3": 2.4, "LOCALE": "cs-CZ", "CURRENCY": "CZK", "DAYS_PER_MONTH_OPTIONS": [30, 22], "DAYS_PER_MONTH_DEFAULT": 30, "SNAPSHOT_RETENTION_DAYS": 30, "REQUIRE_SNAPSHOT_FOR_EXPORT": true, "AUTO_SNAPSHOT_ON_EXPORT": false}',
  30
);

-- Шаг 4: Проверка
SELECT
  id,
  feature_flags::json->>'FF_AI_DAYS_SUGGEST' AS ai_enabled,
  updated_at
FROM project_config
WHERE id = 1;

-- ================================================================
-- Если увидишь:
--   ai_enabled | true
-- Значит ВСЁ РАБОТАЕТ! ✅
-- ================================================================
