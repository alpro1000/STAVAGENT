-- Migration 011: Add Relink Algorithm Support
-- Purpose: Add columns for file version tracking and relink status

-- 1. Add previous_version_id to file_versions table
ALTER TABLE registry_file_versions 
  ADD COLUMN IF NOT EXISTS previous_version_id INTEGER REFERENCES registry_file_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS relink_status VARCHAR(20) DEFAULT 'pending' CHECK (relink_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped'));

-- 2. Add indexes for relink queries
CREATE INDEX IF NOT EXISTS idx_file_versions_previous ON registry_file_versions(previous_version_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_relink_status ON registry_file_versions(relink_status);

-- 3. Update relink_reports table structure
ALTER TABLE registry_relink_reports
  ADD COLUMN IF NOT EXISTS summary JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- 4. Add status column to position_instances for relink tracking
ALTER TABLE registry_position_instances
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'needs_review', 'orphaned'));

CREATE INDEX IF NOT EXISTS idx_positions_status ON registry_position_instances(status);

-- 5. Add description_normalized for fuzzy matching
ALTER TABLE registry_position_instances
  ADD COLUMN IF NOT EXISTS description_normalized TEXT;

-- Create function to normalize descriptions (lowercase, remove diacritics, trim)
CREATE OR REPLACE FUNCTION normalize_description(text) RETURNS TEXT AS $$
  SELECT lower(trim(regexp_replace($1, '[^a-zA-Z0-9\s]', '', 'g')))
$$ LANGUAGE SQL IMMUTABLE;

-- Create index for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_positions_description_normalized ON registry_position_instances(description_normalized);

-- 6. Add match metadata to relink_reports
COMMENT ON COLUMN registry_relink_reports.summary IS 'Summary stats: total_old, total_new, matched_exact, matched_fallback, matched_fuzzy, orphaned, new_positions';
COMMENT ON COLUMN registry_relink_reports.details IS 'Detailed match data: matches array, orphaned array, new_positions array';

-- Migration metadata
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('011', NOW())
ON CONFLICT (version) DO NOTHING;
