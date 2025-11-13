-- PostgreSQL Schema for Monolit Planner
-- Auto-generated from SQLite schema with PostgreSQL-specific types

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bridges table
CREATE TABLE IF NOT EXISTS bridges (
  bridge_id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255),
  object_name VARCHAR(255) NOT NULL DEFAULT '',
  element_count INTEGER DEFAULT 0,
  concrete_m3 REAL DEFAULT 0,
  sum_kros_czk REAL DEFAULT 0,
  span_length_m REAL,
  deck_width_m REAL,
  pd_weeks REAL,
  status VARCHAR(50) DEFAULT 'active',
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(255) PRIMARY KEY,
  bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  subtype VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  qty REAL NOT NULL,
  qty_m3_helper REAL,
  crew_size INTEGER NOT NULL DEFAULT 4,
  wage_czk_ph REAL NOT NULL DEFAULT 398,
  shift_hours REAL NOT NULL DEFAULT 10,
  days REAL NOT NULL DEFAULT 0,
  labor_hours REAL,
  cost_czk REAL,
  unit_cost_native REAL,
  concrete_m3 REAL,
  unit_cost_on_m3 REAL,
  kros_unit_czk REAL,
  kros_total_czk REAL,
  has_rfi INTEGER DEFAULT 0,
  rfi_message TEXT,
  item_name VARCHAR(255),
  otskp_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Snapshots table
CREATE TABLE IF NOT EXISTS snapshots (
  id VARCHAR(255) PRIMARY KEY,
  bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE,
  snapshot_name VARCHAR(255),
  snapshot_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  positions_snapshot TEXT NOT NULL,
  header_kpi_snapshot TEXT NOT NULL,
  description TEXT,
  is_locked INTEGER DEFAULT 1,
  is_final INTEGER DEFAULT 0,
  parent_snapshot_id VARCHAR(255) REFERENCES snapshots(id) ON DELETE SET NULL,
  sum_kros_at_lock REAL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mapping profiles table
CREATE TABLE IF NOT EXISTS mapping_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  column_mapping TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project config table
CREATE TABLE IF NOT EXISTS project_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feature_flags TEXT NOT NULL,
  defaults TEXT NOT NULL,
  days_per_month_mode INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTSKP codes table
CREATE TABLE IF NOT EXISTS otskp_codes (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price REAL NOT NULL,
  specification TEXT,
  search_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bridges_owner ON bridges(owner_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(status);
CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
CREATE INDEX IF NOT EXISTS idx_positions_otskp ON positions(otskp_code);
CREATE INDEX IF NOT EXISTS idx_snapshots_bridge ON snapshots(bridge_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_locked ON snapshots(is_locked);
CREATE INDEX IF NOT EXISTS idx_snapshots_final ON snapshots(is_final);
CREATE INDEX IF NOT EXISTS idx_otskp_code ON otskp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otskp_name ON otskp_codes(name);
CREATE INDEX IF NOT EXISTS idx_otskp_search_name ON otskp_codes(search_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
