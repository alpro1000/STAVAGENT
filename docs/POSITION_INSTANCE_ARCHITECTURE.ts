/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STAVAGENT — Position Instance Architecture v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Two-level identity model for multi-kiosk integration:
 *
 *   Level 1: PositionInstance — concrete row on a concrete sheet (unique UUID)
 *   Level 2: PositionTemplate — reusable calculation pattern (catalog_code + unit + desc)
 *
 * Problem solved:
 *   Same catalog codes (ÚRS/OTSKP) repeat across sheets (SO 202, SO 203, etc.).
 *   A code like "231112" is NOT a unique ID — it appears N times in the project.
 *   position_instance_id (UUID) is the ONLY reliable key for linking kiosks.
 *
 * Data flow:
 *   Upload Excel → parse sheets → create PositionInstance per row
 *   Monolit reads instance → calculates → writes monolith_payload back
 *   DOV reads instance → calculates TOV → writes dov_payload back
 *   Registry displays aggregated results immediately
 *
 * Deep-links:
 *   ?project_id=X&position_instance_id=Y
 *
 * @version 1.0.0
 * @created 2026-02-26
 */

// =============================================================================
// LEVEL 1: POSITION INSTANCE (Экземпляр позиции)
// =============================================================================

/**
 * PositionInstance — one concrete row on one concrete sheet.
 *
 * This is the SINGLE SOURCE OF TRUTH for any work item in the project.
 * Kiosks read from it, calculate, and write results back.
 *
 * Unique key: position_instance_id (UUID)
 *
 * Stored in: portal_positions table (PostgreSQL)
 * Indexed by: project_id, object_id, catalog_code
 */
export interface PositionInstance {
  // ── Identity ─────────────────────────────────────────────────────────────
  /** UUID v4 — единственный идентификатор для связи между киосками */
  position_instance_id: string;

  /** Portal project UUID — groups all instances */
  project_id: string;

  /** Object (sheet) UUID — physical structure: bridge, wall, building */
  object_id: string;

  /** Human-readable sheet/object name: "SO 202", "SO 12-01", "Stěna 3" */
  sheet_name: string;

  /** Row index in original Excel (for audit trail) */
  row_index: number;

  // ── Core fields (from Excel import) ──────────────────────────────────────
  /** ÚRS/OTSKP catalog code: "231112", "273313" (NOT unique across sheets!) */
  catalog_code: string;

  /** Work description (Czech): "Železobeton základ. pasů prostý C 25/30" */
  description: string;

  /** Unit of measure: "m3", "m2", "kg", "t", "kus" */
  unit: string;

  /** Quantity from BOQ: 82.5, 1200.0 */
  qty: number;

  /** Unit price from original BOQ (may be null if not priced yet) */
  unit_price: number | null;

  /** Total price from BOQ: qty × unit_price */
  total_price: number | null;

  // ── Classification ───────────────────────────────────────────────────────
  /**
   * Work group (from Registry classifier):
   * ZEMNI_PRACE | BETON_MONOLIT | BETON_PREFAB | VYZTUŽ | BEDNENI |
   * KOTVENI | PILOTY | IZOLACE | KOMUNIKACE | DOPRAVA
   */
  skupina: string | null;

  /** Row role in BOQ hierarchy */
  row_role: 'main' | 'subordinate' | 'section' | 'unknown';

  // ── Template reference ───────────────────────────────────────────────────
  /**
   * If this instance was created/populated from a template.
   * null = manual input or first-time calculation.
   */
  template_id: string | null;

  /**
   * Confidence of template application:
   * - GREEN: exact match (same code + unit + normalized description)
   * - AMBER: partial match (same code + unit, different description)
   * - RED: code-only match (different unit or description)
   * - null: not from template
   */
  template_confidence: 'GREEN' | 'AMBER' | 'RED' | null;

  // ── Kiosk Payloads ──────────────────────────────────────────────────────
  /**
   * Monolit-Planner calculation result.
   * Written by Monolit when user calculates this position.
   * null = not yet calculated in Monolit.
   */
  monolith_payload: MonolithPayload | null;

  /**
   * DOV (Rozpis zdrojů / Resource Breakdown) result.
   * Written by DOV calculator (currently in Registry TOVModal).
   * null = not yet broken down.
   */
  dov_payload: DOVPayload | null;

  /**
   * Manual overrides applied AFTER template application.
   * Partial object — only contains fields the user edited.
   * Takes priority over template values.
   */
  overrides: PositionOverrides | null;

  // ── Audit ────────────────────────────────────────────────────────────────
  created_at: string;   // ISO datetime
  updated_at: string;   // ISO datetime
  created_by: string;   // 'excel_import' | 'manual' | 'template_apply'
  updated_by: string;   // 'monolit' | 'dov' | 'manual' | 'template_apply'
}

// =============================================================================
// LEVEL 2: POSITION TEMPLATE (Шаблон позиции)
// =============================================================================

/**
 * PositionTemplate — reusable calculation pattern.
 *
 * When a user calculates a position in Monolit or fills DOV for "231112 m3",
 * they can "Save as template". Later, "Apply to matches" finds all other
 * instances with the same catalog_code + unit across all sheets and applies
 * the template with scaling.
 *
 * Natural key: catalog_code + unit + normalized_description
 * Stored in: position_templates table
 */
export interface PositionTemplate {
  /** UUID v4 */
  template_id: string;

  /** Portal project (templates are project-scoped) */
  project_id: string;

  // ── Template key (natural composite key) ─────────────────────────────────
  /** Catalog code: "231112" */
  catalog_code: string;

  /** Unit: "m3" */
  unit: string;

  /**
   * Normalized description for fuzzy matching.
   * Lowercase, diacritics removed, extra whitespace collapsed.
   * "zelezobeton zaklad. pasu prosty c 25/30"
   */
  normalized_description: string;

  /** Original (pretty) description for display */
  display_description: string;

  // ── Saved calculations ───────────────────────────────────────────────────
  /** Monolit calculation — normalized to qty=1 for scaling */
  monolith_template: MonolithPayload | null;

  /** DOV breakdown — normalized to qty=1 for scaling */
  dov_template: DOVPayload | null;

  // ── Scaling rules ────────────────────────────────────────────────────────
  /**
   * How to adjust qty when applying template to a different instance:
   * - 'linear': proportional scaling (result × target_qty / source_qty)
   * - 'fixed': same values regardless of qty (e.g. mobilization cost)
   * - 'manual': don't auto-scale, user must review
   */
  scaling_rule: 'linear' | 'fixed' | 'manual';

  /** Source qty this template was saved from (for linear scaling ratio) */
  source_qty: number;

  // ── Metadata ─────────────────────────────────────────────────────────────
  /** Which position instance was the source */
  source_instance_id: string;

  /** User who created the template */
  created_by: string;
  created_at: string;
  updated_at: string;

  /** How many times this template was applied */
  apply_count: number;
}

// =============================================================================
// MONOLITH PAYLOAD (Monolit-Planner calculation result)
// =============================================================================

/**
 * MonolithPayload — everything Monolit-Planner computes for a position.
 *
 * This is the complete calculation output written back to PositionInstance.
 * Mirrors Monolit's Position model fields + R0 calculator results.
 *
 * Written by: POST /positions/{instance_id}/monolith
 * Read by: GET /positions/{instance_id}/monolith
 */
export interface MonolithPayload {
  // ── Source tracking ──────────────────────────────────────────────────────
  /** Monolit's internal position ID (for deep-linking back) */
  monolit_position_id: string;

  /** Monolit bridge/project ID */
  monolit_project_id: string;

  /** Part name in Monolit: "ZÁKLADY", "MOSTOVKA", "OPĚRA OP4" */
  part_name: string;

  /** Deep-link URL to open this position in Monolit */
  monolit_url: string;

  // ── Classification ───────────────────────────────────────────────────────
  /**
   * Monolit subtype:
   * 'beton' | 'bednění' | 'výztuž' | 'jiné' |
   * 'oboustranné (opěry)' | 'oboustranné (křídla)' | 'oboustranné (závěrné zídky)'
   */
  subtype: string;

  /** OTSKP code (typically same as catalog_code) */
  otskp_code: string | null;

  /** User-editable item name in Monolit */
  item_name: string | null;

  // ── Work parameters ──────────────────────────────────────────────────────
  /** Crew size (workers) */
  crew_size: number;

  /** Hourly wage [CZK/h] */
  wage_czk_ph: number;

  /** Shift duration [h] */
  shift_hours: number;

  /** Calculated work days */
  days: number;

  /** Curing days (for beton subtype) */
  curing_days: number | null;

  // ── Calculated costs ─────────────────────────────────────────────────────
  /** Total labor hours */
  labor_hours: number;

  /** Total labor cost [CZK] */
  cost_czk: number;

  /** Unit cost in original unit (CZK/m2, CZK/kg, etc.) */
  unit_cost_native: number | null;

  /** Reference concrete volume [m3] (for CZK/m3 calculation) */
  concrete_m3: number | null;

  /** Unit cost per m3 of concrete [CZK/m3] */
  unit_cost_on_m3: number | null;

  /** KROS rounded unit price: Math.ceil(unit_cost_on_m3 / 50) * 50 */
  kros_unit_czk: number | null;

  /** KROS total: kros_unit_czk × qty */
  kros_total_czk: number | null;

  // ── Formwork-specific (only for bednění subtype) ─────────────────────────
  formwork?: {
    /** Assembly norm [h/m2] */
    norm_assembly_h_m2: number;
    /** Disassembly norm [h/m2] */
    norm_disassembly_h_m2: number;
    /** Assembly days */
    assembly_days: number;
    /** Disassembly days */
    disassembly_days: number;
    /** Curing/wait days */
    wait_days: number;
    /** Kit occupancy days per cycle */
    kit_occupancy_days: number;
    /** Selected strategy (A/B/C) */
    selected_strategy?: 'A' | 'B' | 'C';
    /** Number of formwork sets */
    sets_count?: number;
    /** Rental cost [CZK] */
    rental_cost?: number;
    /** Rental days */
    rental_days?: number;
  };

  // ── Rebar-specific (only for výztuž subtype) ────────────────────────────
  rebar?: {
    /** Mass [t] */
    mass_t: number;
    /** Norm hours per ton */
    norm_h_per_t: number;
    /** Total labor hours */
    labor_hours: number;
    /** Duration [days] */
    duration_days: number;
  };

  // ── Traceability ─────────────────────────────────────────────────────────
  /** Data source: "URS_2024_OFFICIAL", "RTS_2023", "USER", "AI_PROPOSED" */
  source_tag: string;

  /** Human-readable assumptions log */
  assumptions_log: string;

  /** Confidence 0.0-1.0 */
  confidence: number;

  /** ISO datetime when calculated */
  calculated_at: string;
}

// =============================================================================
// DOV PAYLOAD (Rozpis zdrojů / Resource Breakdown)
// =============================================================================

/**
 * DOVPayload — detailed resource breakdown for a position.
 *
 * DOV = "Doplnění Objemů a Výkonů" (Volume & Performance Supplement)
 * This is what the Registry TOV modal currently manages.
 *
 * Contains: labor, machinery, materials, formwork rental, pump rental.
 * Each section can be independently filled (partial DOV is valid).
 *
 * Written by: POST /positions/{instance_id}/dov
 * Read by: GET /positions/{instance_id}/dov
 */
export interface DOVPayload {
  // ── Labor (Pracovní síly) ────────────────────────────────────────────────
  labor: DOVLaborRow[];
  labor_summary: {
    total_norm_hours: number;
    total_workers: number;
    total_cost_czk: number;
  };

  // ── Machinery (Stroje a mechanizmy) ──────────────────────────────────────
  machinery: DOVMachineryRow[];
  machinery_summary: {
    total_machine_hours: number;
    total_units: number;
    total_cost_czk: number;
  };

  // ── Materials (Materiály) ────────────────────────────────────────────────
  materials: DOVMaterialRow[];
  materials_summary: {
    total_cost_czk: number;
    item_count: number;
  };

  // ── Formwork Rental (Nájem bednění) — only for BEDNENI ───────────────────
  formwork_rental: FormworkRentalEntry[] | null;
  formwork_rental_summary: {
    total_rental_czk: number;
    total_purchase_czk: number;
    grand_total_czk: number;
  } | null;

  // ── Pump Rental (Kalkulátor čerpadla) — only for BETON_MONOLIT ──────────
  pump_rental: PumpRentalEntry | null;
  pump_rental_summary: {
    total_czk: number;
  } | null;

  // ── Grand total ──────────────────────────────────────────────────────────
  grand_total: {
    labor_czk: number;
    machinery_czk: number;
    materials_czk: number;
    rental_czk: number;       // formwork + pump
    total_czk: number;
    currency: 'CZK';
  };

  // ── Metadata ─────────────────────────────────────────────────────────────
  calculated_at: string;      // ISO datetime
  calculated_by: string;      // 'manual' | 'template' | 'auto'
  version: number;            // Increments on every save
}

// =============================================================================
// DOV SUB-TYPES
// =============================================================================

/** One labor row in DOV */
export interface DOVLaborRow {
  id: string;
  /** Profession: "Betonář", "Tesař/Bednář", "Železář/Armovač" */
  profession: string;
  /** Profession code from catalog (optional) */
  profession_code: string | null;
  /** Number of workers */
  count: number;
  /** Hours per unit of work */
  hours: number;
  /** Norm-hours: count × hours */
  norm_hours: number;
  /** Hourly rate [CZK/h] */
  hourly_rate: number;
  /** Total cost: norm_hours × hourly_rate */
  total_cost_czk: number;
  /** Link to Monolit calculation (if auto-generated) */
  linked_monolit_id: string | null;
}

/** One machinery row in DOV */
export interface DOVMachineryRow {
  id: string;
  /** Machine type: "Autojeřáb", "Vibrační deska", "Ponorný vibrátor" */
  machine_type: string;
  /** Machine code from catalog */
  machine_code: string | null;
  /** Count of units */
  count: number;
  /** Hours of operation */
  hours: number;
  /** Machine-hours: count × hours */
  machine_hours: number;
  /** Hourly rate [CZK/h] */
  hourly_rate: number;
  /** Total cost: machine_hours × hourly_rate */
  total_cost_czk: number;
  linked_monolit_id: string | null;
}

/** One material row in DOV */
export interface DOVMaterialRow {
  id: string;
  /** Material name: "Beton C30/37 XF3", "Výztuž B500B" */
  name: string;
  /** Material code from catalog */
  code: string | null;
  /** Quantity */
  quantity: number;
  /** Unit: "m³", "kg", "t", "ks" */
  unit: string;
  /** Unit price [CZK] */
  unit_price: number;
  /** Total: quantity × unit_price */
  total_cost_czk: number;
  /** Link to Monolit for concrete material cost */
  linked_monolit_id: string | null;
}

// =============================================================================
// FORMWORK RENTAL ENTRY (per construction element)
// =============================================================================

/**
 * One row in the formwork rental table.
 * Compatible with existing FormworkRentalRow in rozpocet-registry.
 *
 * Formulas (ČSN EN 13670):
 *   pocet_taktu    = ⌈celkem_m2 / sada_m2⌉ (auto) or manual
 *   takt_per_set   = pocet_taktu / pocet_sad
 *   doba_bedneni   = takt_per_set × dni_na_takt
 *   celkem_beton   = takt_per_set × dni_beton_takt
 *   celkova_doba   = doba_bedneni + celkem_beton + dni_demontaz
 *   mesicni_sada   = sada_m2 × mesicni_najem_jednotka
 *   konecny_najem  = mesicni_sada × MAX(1, celkova_doba/30) × pocet_sad + podil_koupe
 */
export interface FormworkRentalEntry {
  id: string;
  /** Construction name: "SO202 Základ OP" */
  construction_name: string;

  // ── Area & tacts ─────────────────────────────────────────────────────────
  celkem_m2: number;          // Total formwork area [m²]
  sada_m2: number;            // One set area [m²]
  pocet_taktu: number;        // Number of tacts
  auto_taktu: boolean;        // Auto-derive from area ratio
  pocet_sad: number;          // Number of sets (1 or 2 typically)

  // ── Time parameters ──────────────────────────────────────────────────────
  dni_na_takt: number;        // Assembly days per tact
  dni_beton_takt: number;     // Curing days per tact (ČSN EN 13670)
  dni_demontaz: number;       // Final stripping days (default 1)

  // ── Computed time ────────────────────────────────────────────────────────
  doba_bedneni: number;       // Assembly total: takt_per_set × dni_na_takt
  celkem_beton: number;       // Curing total: takt_per_set × dni_beton_takt
  celkova_doba: number;       // Grand total days

  // ── Formwork system ──────────────────────────────────────────────────────
  bednici_system: string;     // "Frami Xlife", "Framax Xlife", "Dokaflex"
  rozmery: string;            // "h = 0,9 m", "h = 1,5 m"

  // ── Pricing ──────────────────────────────────────────────────────────────
  mesicni_najem_jednotka: number;  // Monthly rent per m² [CZK/m²/month]
  mesicni_najem_sada: number;      // Monthly rent per set
  najem_naklady: number;           // Rental cost (excl. purchase)
  podil_koupe: number;             // One-time purchase (lost parts)
  konecny_najem: number;           // Grand total rental

  // ── KROS label ───────────────────────────────────────────────────────────
  kros_kod: string | null;
  kros_popis: string | null;  // Auto-generated: "Bednění - Základ OP (sada: 1× ...)"
}

// =============================================================================
// PUMP RENTAL ENTRY (concrete pump calculator)
// =============================================================================

/**
 * Concrete pump calculator state.
 * Compatible with existing PumpRentalData in rozpocet-registry.
 *
 * Cost = doprava + manipulace + příplatek_m³ + příslušenství + příplatky
 */
export interface PumpRentalEntry {
  // ── Pump type ────────────────────────────────────────────────────────────
  pump_type_id: string | null;
  pump_label: string | null;

  // ── Parameters ───────────────────────────────────────────────────────────
  manipulace_czk_h: number;
  priplatek_czk_m3: number;
  pristaveni_fixed_czk: number;
  czk_km: number;
  vykon_m3h: number;
  vzdalenost_km: number;
  stavba_h: number;           // Default 0.5
  myti_h: number;             // Default 0.5

  // ── Construction elements ────────────────────────────────────────────────
  items: Array<{
    id: string;
    nazev: string;
    objem_m3_takt: number;
    pocet_taktu: number;
    pocet_pristaveni: number;
    celkem_m3: number;
    hodiny_cerpani: number;
    hodiny_overhead: number;
    hodiny_celkem: number;
  }>;

  // ── Accessories & surcharges ─────────────────────────────────────────────
  accessories: Array<{
    id: string;
    nazev: string;
    mnozstvi: number;
    unit: string;
    czk_per_unit: number;
    celkem: number;
  }>;

  surcharges: Array<{
    id: string;
    nazev: string;
    czk_per_pristaveni: number;
    celkem: number;
  }>;

  // ── Totals ───────────────────────────────────────────────────────────────
  celkem_m3: number;
  celkem_pristaveni: number;
  celkem_hodiny: number;
  celkem_doprava: number;
  celkem_manipulace: number;
  celkem_priplatek_m3: number;
  celkem_prislusenstvi: number;
  celkem_priplatky: number;
  konecna_cena: number;

  kros_kod: string | null;
}

// =============================================================================
// POSITION OVERRIDES (Manual edits after template application)
// =============================================================================

/**
 * Overrides are partial — only fields the user manually changed.
 * When rendering, merge: template_defaults ← overrides.
 */
export interface PositionOverrides {
  /** Overridden Monolit fields */
  monolith?: Partial<MonolithPayload>;

  /** Overridden DOV fields */
  dov?: Partial<DOVPayload>;

  /** Reason for override (audit) */
  reason?: string;

  /** ISO datetime */
  overridden_at: string;

  /** Who overrode */
  overridden_by: string;
}

// =============================================================================
// TEMPLATE APPLICATION (matching & scaling)
// =============================================================================

/**
 * When applying a template, the system:
 * 1. Finds all PositionInstances with matching catalog_code + unit
 * 2. Calculates match confidence (GREEN/AMBER/RED)
 * 3. Scales values by qty ratio
 * 4. Writes results + sets template_id reference
 */
export interface TemplateMatch {
  /** Target position instance */
  position_instance_id: string;

  /** Matched template */
  template_id: string;

  /** Match confidence */
  confidence: 'GREEN' | 'AMBER' | 'RED';

  /**
   * Match details:
   * GREEN: catalog_code + unit + normalized_description all match
   * AMBER: catalog_code + unit match, description similar (>70% Levenshtein)
   * RED:   catalog_code matches only (different unit or description)
   */
  match_details: {
    code_match: boolean;
    unit_match: boolean;
    description_similarity: number;  // 0.0-1.0
  };

  /** Scaling info */
  scaling: {
    rule: 'linear' | 'fixed' | 'manual';
    source_qty: number;
    target_qty: number;
    ratio: number;  // target_qty / source_qty
  };

  /** Whether user approved this application */
  approved: boolean;
}

// =============================================================================
// API CONTRACTS
// =============================================================================

// ── Projects ───────────────────────────────────────────────────────────────

/** POST /projects */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  project_type?: 'bridge' | 'building' | 'road' | 'parking' | 'custom';
}

/** POST /projects/{id}/files */
export interface UploadFileRequest {
  file: File;
  file_type: 'xlsx' | 'xls' | 'pdf';
}

/** POST /files/{version_id}/parse */
export interface ParseFileResponse {
  project_id: string;
  objects_created: number;      // sheets → objects
  instances_created: number;    // rows → position instances
  objects: Array<{
    object_id: string;
    sheet_name: string;
    instance_count: number;
  }>;
}

// ── Position Instances ─────────────────────────────────────────────────────

/** GET /projects/{id}/positions */
export interface ListPositionsResponse {
  project_id: string;
  total: number;
  objects: Array<{
    object_id: string;
    sheet_name: string;
    positions: PositionInstance[];
  }>;
}

/** GET /positions/{instance_id}/monolith */
export type GetMonolithResponse = MonolithPayload | null;

/** POST /positions/{instance_id}/monolith */
export interface WriteMonolithRequest {
  payload: MonolithPayload;
}

/** GET /positions/{instance_id}/dov */
export type GetDOVResponse = DOVPayload | null;

/** POST /positions/{instance_id}/dov */
export interface WriteDOVRequest {
  payload: DOVPayload;
}

// ── Templates ──────────────────────────────────────────────────────────────

/** POST /templates (save current instance as template) */
export interface SaveTemplateRequest {
  source_instance_id: string;
  scaling_rule: 'linear' | 'fixed' | 'manual';
}

/** GET /templates?project_id=X&catalog_code=Y */
export interface ListTemplatesResponse {
  templates: PositionTemplate[];
}

/** POST /templates/{id}/apply */
export interface ApplyTemplateRequest {
  template_id: string;
  /** Target instances to apply to (if empty, auto-find matches) */
  target_instance_ids?: string[];
  /** Only apply to matches above this confidence */
  min_confidence?: 'GREEN' | 'AMBER' | 'RED';
  /** Require manual approval for each match */
  require_approval?: boolean;
}

export interface ApplyTemplateResponse {
  template_id: string;
  matches: TemplateMatch[];
  applied: number;
  skipped: number;
  pending_approval: number;
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: 'template_saved' | 'template_applied' | 'monolith_written' | 'dov_written' | 'override_applied';
  actor: string;             // 'user:123' | 'kiosk:monolit' | 'system:template'
  project_id: string;
  position_instance_id?: string;
  template_id?: string;
  details: Record<string, unknown>;
}

// =============================================================================
// MIGRATION PATH: Current → New Architecture
// =============================================================================

/**
 * MIGRATION STRATEGY (backward compatible):
 *
 * Phase 1 — Add position_instance_id to existing tables:
 *   ALTER TABLE portal_positions ADD COLUMN position_instance_id UUID DEFAULT gen_random_uuid();
 *   ALTER TABLE portal_positions ADD COLUMN template_id UUID REFERENCES position_templates(template_id);
 *   ALTER TABLE portal_positions ADD COLUMN template_confidence VARCHAR(10);
 *   ALTER TABLE portal_positions ADD COLUMN overrides JSONB;
 *   -- Existing tov_labor/tov_machinery/tov_materials → migrate to dov_payload JSONB
 *   ALTER TABLE portal_positions ADD COLUMN monolith_payload JSONB;
 *   ALTER TABLE portal_positions ADD COLUMN dov_payload JSONB;
 *
 * Phase 2 — Create templates table:
 *   CREATE TABLE position_templates (
 *     template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     project_id VARCHAR(255) NOT NULL REFERENCES portal_projects(portal_project_id),
 *     catalog_code VARCHAR(50) NOT NULL,
 *     unit VARCHAR(20) NOT NULL,
 *     normalized_description TEXT NOT NULL,
 *     display_description TEXT NOT NULL,
 *     monolith_template JSONB,
 *     dov_template JSONB,
 *     scaling_rule VARCHAR(20) NOT NULL DEFAULT 'linear',
 *     source_qty REAL NOT NULL,
 *     source_instance_id UUID NOT NULL,
 *     created_by VARCHAR(100) NOT NULL,
 *     apply_count INTEGER DEFAULT 0,
 *     created_at TIMESTAMP DEFAULT NOW(),
 *     updated_at TIMESTAMP DEFAULT NOW(),
 *     UNIQUE(project_id, catalog_code, unit, normalized_description)
 *   );
 *
 * Phase 3 — Create audit_log table:
 *   CREATE TABLE audit_log (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     timestamp TIMESTAMP DEFAULT NOW(),
 *     event VARCHAR(50) NOT NULL,
 *     actor VARCHAR(100) NOT NULL,
 *     project_id VARCHAR(255) NOT NULL,
 *     position_instance_id UUID,
 *     template_id UUID,
 *     details JSONB
 *   );
 *
 * Phase 4 — Update API endpoints:
 *   GET  /positions/{instance_id}/monolith  (reads monolith_payload)
 *   POST /positions/{instance_id}/monolith  (writes monolith_payload)
 *   GET  /positions/{instance_id}/dov       (reads dov_payload)
 *   POST /positions/{instance_id}/dov       (writes dov_payload)
 *   POST /templates                         (save as template)
 *   POST /templates/{id}/apply              (apply to matches)
 *
 * Phase 5 — Deep-link format update:
 *   Old: ?project_id=X&part=Y
 *   New: ?project_id=X&position_instance_id=Y
 *   (Keep backward compat: if only part=Y, resolve to first matching instance)
 *
 * BACKWARD COMPAT:
 *   - Existing portal_positions rows get auto-generated position_instance_id
 *   - Existing tov_labor/tov_machinery/tov_materials still work (read fallback)
 *   - Existing deep-links (?project=X&part=Y) still resolve via lookup
 *   - Registry browser-only storage migrates on next import (add instance IDs)
 */

// =============================================================================
// COMPATIBILITY MAP: Existing ↔ New
// =============================================================================

/**
 * Field mapping from existing models to PositionInstance:
 *
 * ┌───────────────────────────┬──────────────────────────────────────────┐
 * │ Existing Field            │ PositionInstance Field                    │
 * ├───────────────────────────┼──────────────────────────────────────────┤
 * │ portal_positions.position_id │ position_instance_id                  │
 * │ portal_positions.object_id   │ object_id                             │
 * │ portal_positions.kod         │ catalog_code                          │
 * │ portal_positions.popis       │ description                           │
 * │ portal_positions.mj          │ unit                                  │
 * │ portal_positions.mnozstvi    │ qty                                   │
 * │ portal_positions.cena_jednotkova │ unit_price                        │
 * │ portal_positions.cena_celkem │ total_price                           │
 * │ portal_positions.tov_labor   │ dov_payload.labor                     │
 * │ portal_positions.tov_machinery │ dov_payload.machinery               │
 * │ portal_positions.tov_materials │ dov_payload.materials               │
 * │ portal_positions.monolit_position_id │ monolith_payload.monolit_position_id │
 * │ portal_positions.registry_item_id │ (kept for backward compat)       │
 * │ ParsedItem.id (Registry)    │ position_instance_id (via mapping)     │
 * │ ParsedItem.kod               │ catalog_code                          │
 * │ ParsedItem.skupina           │ skupina                               │
 * │ TOVData (Registry)           │ dov_payload                           │
 * │ TOVData.monolitMetadata      │ monolith_payload (extracted)           │
 * │ Position.id (Monolit)        │ monolith_payload.monolit_position_id  │
 * │ Position.bridge_id           │ monolith_payload.monolit_project_id   │
 * └───────────────────────────┴──────────────────────────────────────────┘
 */
