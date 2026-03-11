-- Migration 008: Enable AI Days Suggestion Feature Flag
-- Date: 2026-01-21
-- Purpose: Turn on FF_AI_DAYS_SUGGEST to show the ✨ Sparkles button in UI

-- ============================================
-- Enable FF_AI_DAYS_SUGGEST feature flag
-- ============================================

-- Check if config exists and update it
DO $$
BEGIN
  -- Check if project_config table exists and has row
  IF EXISTS (SELECT 1 FROM project_config WHERE id = 1) THEN
    -- Update existing config
    UPDATE project_config
    SET
      feature_flags = jsonb_set(
        COALESCE(feature_flags::jsonb, '{}'::jsonb),
        '{FF_AI_DAYS_SUGGEST}',
        'true'::jsonb,
        true
      )::text,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1;

    RAISE NOTICE '✅ Updated existing config - FF_AI_DAYS_SUGGEST enabled';
  ELSE
    -- Insert default config with AI suggestion enabled
    INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
    VALUES (
      1,
      '{"FF_AI_DAYS_SUGGEST": true, "FF_PUMP_MODULE": false, "FF_ADVANCED_METRICS": false, "FF_DARK_MODE": false, "FF_SPEED_ANALYSIS": false}',
      '{"ROUNDING_STEP_KROS": 50, "RHO_T_PER_M3": 2.4, "LOCALE": "cs-CZ", "CURRENCY": "CZK", "DAYS_PER_MONTH_OPTIONS": [30, 22], "DAYS_PER_MONTH_DEFAULT": 30}',
      30
    );

    RAISE NOTICE '✅ Created new config - FF_AI_DAYS_SUGGEST enabled';
  END IF;
END $$;

-- Verify the change
SELECT
  id,
  feature_flags::jsonb->>'FF_AI_DAYS_SUGGEST' AS ai_suggestion_enabled,
  updated_at
FROM project_config
WHERE id = 1;
