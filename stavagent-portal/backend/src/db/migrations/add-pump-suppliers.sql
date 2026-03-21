-- Phase 9: Unified Pump Calculator — pump_suppliers, pump_models, pump_accessories_catalog
-- Consolidates 3 separate pump calculators into a single Portal-managed system
-- Supports builtin suppliers + user-created custom suppliers

-- ============================================================
-- 1. pump_suppliers — Supplier registry (builtin + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS pump_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  billing_model VARCHAR(20) NOT NULL CHECK (billing_model IN ('hourly', 'hourly_plus_m3', 'per_15min', 'custom')),
  is_builtin    BOOLEAN DEFAULT false,
  contact       JSONB DEFAULT '{}',
  surcharges    JSONB DEFAULT '{}',
  hose_per_m_per_day NUMERIC(10,2),
  metadata      JSONB DEFAULT '{}',
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. pump_models — Pump models per supplier
-- ============================================================
CREATE TABLE IF NOT EXISTS pump_models (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID NOT NULL REFERENCES pump_suppliers(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  reach_m             NUMERIC(5,1),
  boom_m              NUMERIC(5,1),
  arrival_fixed_czk   NUMERIC(10,2),
  arrival_per_km_czk  NUMERIC(10,2),
  operation_per_h_czk NUMERIC(10,2),
  operation_per_15min_czk NUMERIC(10,2),
  volume_per_m3_czk   NUMERIC(10,2),
  practical_m3_h      NUMERIC(5,1),
  theoretical_m3_h    NUMERIC(5,1),
  priplatek_czk_m3    NUMERIC(10,2) DEFAULT 0,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}',
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pump_models_supplier ON pump_models(supplier_id);

-- ============================================================
-- 3. pump_accessories_catalog — Shared + supplier-specific
-- ============================================================
CREATE TABLE IF NOT EXISTS pump_accessories_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID REFERENCES pump_suppliers(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  unit          VARCHAR(10) NOT NULL,
  czk_per_unit  NUMERIC(10,2) NOT NULL,
  is_common     BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pump_accessories_supplier ON pump_accessories_catalog(supplier_id);

-- ============================================================
-- 4. pump_calculations — Saved calculations linked to positions
-- ============================================================
CREATE TABLE IF NOT EXISTS pump_calculations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_instance_id  UUID,
  project_id            VARCHAR(255),
  supplier_id           UUID REFERENCES pump_suppliers(id),
  model_id              UUID REFERENCES pump_models(id),
  input_params          JSONB NOT NULL,
  result                JSONB NOT NULL,
  created_by            INTEGER REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pump_calc_position ON pump_calculations(position_instance_id);
CREATE INDEX IF NOT EXISTS idx_pump_calc_project ON pump_calculations(project_id);

-- ============================================================
-- 5. Seed builtin suppliers
-- ============================================================

-- Berger Beton Sadov (hourly_plus_m3)
INSERT INTO pump_suppliers (slug, name, billing_model, is_builtin, hose_per_m_per_day, surcharges, metadata)
VALUES (
  'berger_sadov',
  'Berger Beton Sadov',
  'hourly_plus_m3',
  true,
  140,
  '{"saturday_pct": 15, "sunday_pct": 20, "night_pct": 15, "fibreconcrete_per_m3": 50, "slow_down_elbow": 590, "primer_chemical": 500}',
  '{"price_list_date": "2026-01-01"}'
) ON CONFLICT (slug) DO NOTHING;

-- Frischbeton KV (per_15min)
INSERT INTO pump_suppliers (slug, name, billing_model, is_builtin, hose_per_m_per_day, surcharges, metadata)
VALUES (
  'frischbeton_kv',
  'Frischbeton KV',
  'per_15min',
  true,
  130,
  '{"night_per_h": 200, "sunday_per_h": 220, "fibreconcrete_per_m3": 50, "slow_down_elbow": 500, "primer_chemical": 500}',
  '{"price_list_date": "2026-01-01"}'
) ON CONFLICT (slug) DO NOTHING;

-- Beton Union Plzeň (hourly)
INSERT INTO pump_suppliers (slug, name, billing_model, is_builtin, hose_per_m_per_day, surcharges, metadata)
VALUES (
  'beton_union',
  'Beton Union Plzeň',
  'hourly',
  true,
  120,
  '{"saturday": 1500, "sunday": 2000, "night": 1200, "slow_down_elbow": 500}',
  '{"price_list_date": "2026-01-01", "cancellation_czk": 10000, "myti_mimo_stavbu_czk": 1000}'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 6. Seed pump models for Berger Beton Sadov
-- ============================================================
INSERT INTO pump_models (supplier_id, name, reach_m, arrival_per_km_czk, operation_per_h_czk, volume_per_m3_czk, practical_m3_h, sort_order)
SELECT s.id, 'PUMI', 24, 82, 2450, 65, 30, 1
FROM pump_suppliers s WHERE s.slug = 'berger_sadov'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_per_km_czk, operation_per_h_czk, volume_per_m3_czk, practical_m3_h, sort_order)
SELECT s.id, '32-36m', 36, 80, 2500, 65, 38, 2
FROM pump_suppliers s WHERE s.slug = 'berger_sadov'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_per_km_czk, operation_per_h_czk, volume_per_m3_czk, practical_m3_h, sort_order)
SELECT s.id, '38-42m', 42, 80, 3600, 65, 40, 3
FROM pump_suppliers s WHERE s.slug = 'berger_sadov'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Seed pump models for Frischbeton KV
-- ============================================================
INSERT INTO pump_models (supplier_id, name, reach_m, arrival_fixed_czk, operation_per_15min_czk, practical_m3_h, sort_order)
SELECT s.id, '24-26m PUMI', 26, 2200, 550, 30, 1
FROM pump_suppliers s WHERE s.slug = 'frischbeton_kv'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_fixed_czk, operation_per_15min_czk, practical_m3_h, sort_order)
SELECT s.id, '28m', 28, 2200, 550, 35, 2
FROM pump_suppliers s WHERE s.slug = 'frischbeton_kv'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_fixed_czk, operation_per_15min_czk, practical_m3_h, sort_order)
SELECT s.id, '32m', 32, 2400, 550, 38, 3
FROM pump_suppliers s WHERE s.slug = 'frischbeton_kv'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_fixed_czk, operation_per_15min_czk, practical_m3_h, sort_order)
SELECT s.id, '34-36m', 36, 2480, 630, 38, 4
FROM pump_suppliers s WHERE s.slug = 'frischbeton_kv'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, arrival_fixed_czk, operation_per_15min_czk, practical_m3_h, sort_order)
SELECT s.id, '38m', 38, 2720, 630, 40, 5
FROM pump_suppliers s WHERE s.slug = 'frischbeton_kv'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Seed pump models for Beton Union Plzeň (from knowledge base)
-- ============================================================
INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '28/24 m (PUMI)', 24, 28, 2000, 60, 2500, 0, 30, 90, 'Standardní čerpadlo — základy, sloupy, stěny do 24 m', 1
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '31/27 m', 27, 31, 2000, 60, 2650, 0, 40, 160, 'Vyšší výkon — velké základové desky', 2
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '34/30 m', 30, 34, 2000, 60, 2750, 10, 38, 150, 'Příplatek 10 Kč/m³', 3
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '36/32 m', 32, 36, 2000, 60, 2750, 15, 40, 160, 'Příplatek 15 Kč/m³', 4
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '38/34 m', 34, 38, 2000, 60, 2900, 20, 40, 160, 'Příplatek 20 Kč/m³', 5
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '42/38 m', 38, 42, 2000, 60, 2900, 40, 40, 160, 'Příplatek 40 Kč/m³', 6
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '46/42 m', 42, 46, 2000, 60, 3350, 50, 40, 163, 'Příplatek 50 Kč/m³', 7
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '52/48 m', 48, 52, 3500, 90, 3900, 60, 38, 160, 'Velké čerpadlo — vyšší přistavení a km sazba', 8
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, '56/52 m', 52, 56, 3500, 90, 4600, 60, 38, 160, 'Největší čerpadlo — pro výškové stavby', 9
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

INSERT INTO pump_models (supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk, operation_per_h_czk, priplatek_czk_m3, practical_m3_h, theoretical_m3_h, notes, sort_order)
SELECT s.id, 'Mix-pumpa PUMI 24/20 m', 20, 24, 2000, 90, 2500, 0, 25, 56, 'Autodomíchávač + čerpadlo — nevyžaduje domíchávač zvlášť', 10
FROM pump_suppliers s WHERE s.slug = 'beton_union'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Seed common accessories (supplier_id = NULL → universal)
-- ============================================================
INSERT INTO pump_accessories_catalog (supplier_id, name, unit, czk_per_unit, is_common, notes)
VALUES
  (NULL, 'Gumová hadice', 'm', 120, true, '1 m gumové hadice'),
  (NULL, 'Ocelové potrubí', 'm', 100, true, '1 m ocelového potrubí'),
  (NULL, 'Drátkobetonová směs', 'm³', 50, true, 'Příplatek za čerpání drátkobetonu'),
  (NULL, 'Nájezd přísadou', 'ks', 500, true, 'Per přistavení'),
  (NULL, 'Marný výjezd', 'ks', 2999, false, 'Čerpadlo dorazí a betonáž se nekoná')
ON CONFLICT DO NOTHING;
