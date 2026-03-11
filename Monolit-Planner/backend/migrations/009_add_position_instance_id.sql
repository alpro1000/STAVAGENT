-- Migration 009: Add position_instance_id to positions table
-- Links Monolit positions to Portal PositionInstance (two-level identity model)
--
-- position_instance_id is a UUID assigned by Portal when importing positions.
-- Monolit stores it to enable write-back of MonolithPayload to Portal.
-- Nullable: positions created before integration have no instance ID.

-- PostgreSQL
ALTER TABLE positions ADD COLUMN IF NOT EXISTS position_instance_id VARCHAR(255) UNIQUE;

-- Index for lookup by position_instance_id
CREATE INDEX IF NOT EXISTS idx_positions_instance_id ON positions(position_instance_id);
