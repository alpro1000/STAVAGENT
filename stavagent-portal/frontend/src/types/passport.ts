/**
 * TypeScript types for Project Passport System
 *
 * Matches Python Pydantic schemas from:
 * concrete-agent/packages/core-backend/app/models/passport_schema.py
 *
 * Version: 1.0.0
 * Created: 2026-02-10
 */

// ===== LAYER 2: Deterministic Extraction =====

export interface ConcreteSpecification {
  concrete_class: string;              // "C30/37"
  exposure_classes: string[];          // ["XC4", "XD1", "XF3"]
  volume_m3: number | null;
  special_properties: string[];        // ["Bílá vana", "Pohledový beton"]
  confidence: number;                  // 1.0 (regex extraction)
  source_text: string;
}

export interface ReinforcementSpecification {
  steel_grade: string;                 // "B500B"
  tonnage_t: number | null;
  bar_diameters: string[];             // ["12mm", "16mm", "20mm"]
  confidence: number;                  // 1.0
  source_text: string;
}

export interface QuantityItem {
  description: string;
  volume_m3: number | null;
  area_m2: number | null;
  tonnage_t: number | null;
  confidence: number;                  // 1.0
  source_text: string;
}

export interface BuildingDimensions {
  floors_above_ground: number | null;
  floors_underground: number | null;
  height_m: number | null;
  length_m: number | null;
  width_m: number | null;
  built_up_area_m2: number | null;
  confidence: number;                  // 1.0
}

export interface SpecialRequirement {
  requirement_type: string;            // "Watertightness" | "Appearance" | "Durability" | "Other"
  description: string;
  standard: string | null;             // "ČSN EN 12390-8"
  confidence: number;                  // 1.0
  source_text: string;
}

// ===== LAYER 3: AI Enrichment =====

export interface RiskAssessment {
  risk_category: string;               // "Technical" | "Schedule" | "Cost" | "Safety" | "Environmental"
  severity: string;                    // "High" | "Medium" | "Low"
  description: string;
  mitigation: string;
  confidence: number;                  // 0.5-0.9 (AI enrichment)
}

export interface ProjectLocation {
  region: string | null;
  city: string | null;
  address: string | null;
  coordinates: string | null;          // "50.0755N, 14.4378E"
  confidence: number;                  // 0.5-0.9
}

export interface ProjectTimeline {
  start_date: string | null;
  end_date: string | null;
  duration_months: number | null;
  critical_milestones: string[];
  confidence: number;                  // 0.5-0.9
}

export interface ProjectStakeholder {
  role: string;                        // "Investor" | "Contractor" | "Designer" | "Supervisor" | "Other"
  name: string;
  confidence: number;                  // 0.5-0.9
}

// ===== Main Passport Schema =====

export interface ProjectPassport {
  passport_id: string;                 // UUID
  project_name: string;
  generated_at: string;                // ISO 8601 datetime

  // Layer 2: Deterministic facts (confidence = 1.0)
  concrete_specifications: ConcreteSpecification[];
  reinforcement: ReinforcementSpecification[];
  quantities: QuantityItem[];
  dimensions: BuildingDimensions | null;
  special_requirements: SpecialRequirement[];

  // Layer 3: AI enrichment (confidence = 0.5-0.9)
  risks: RiskAssessment[];
  location: ProjectLocation | null;
  timeline: ProjectTimeline | null;
  stakeholders: ProjectStakeholder[];

  // AI-generated summary (always useful for Technická zpráva docs)
  description: string | null;
  technical_highlights: string[];
  structure_type: string | null;
}

// ===== Adaptive Summary (v2 — universal document analysis) =====

export interface AdaptiveTopic {
  title: string;                       // Topic name
  icon: string;                        // Emoji icon
  content: string;                     // Detailed explanation
  key_facts: string[];                 // Extracted facts with numbers
  importance: 'high' | 'medium' | 'low';
}

export interface AdaptiveSummary {
  summary: string;                     // Executive summary (backward compat)
  document_type: string;               // Detected document type
  document_title: string;              // Document title/identifier
  topics: AdaptiveTopic[];             // Dynamic topics array
  warnings: string[];                  // Important warnings
  processing_time_ms: number;
  chars_processed: number;
  model_used: string;
  format: 'adaptive_v2';
}

// ===== API Response =====

export interface PassportGenerationResponse {
  success?: boolean;
  passport: ProjectPassport & {
    // Additional fields returned in summary_only mode
    document_type?: string;
    topics?: AdaptiveTopic[];
    warnings?: string[];
  };
  metadata?: {
    file_name: string;
    processing_time_seconds: number;
    parser_used: string;               // "SmartParser" | "AdaptiveSummarizer"
    extraction_method: string;         // "Regex + AI" | "NotebookLM-inspired INDEX→EXPLAIN"
    ai_model_used: string | null;      // "gemini" | "claude-sonnet" | null
    requested_model?: string | null;
    llm_provider?: string | null;
    total_confidence: number;          // Average confidence across all fields
  };
  statistics?: {
    total_concrete_m3: number;
    total_reinforcement_t: number;
    unique_concrete_classes: number;
    unique_steel_grades: number;
    deterministic_fields: number;      // Count of fields with confidence = 1.0
    ai_enriched_fields: number;        // Count of fields with confidence < 1.0
  };
  // Adaptive summary mode fields
  analysis_mode?: 'adaptive_extraction' | 'summary_only';
  format?: 'adaptive_v2';
  adaptive_summary?: AdaptiveSummary;
  // Classification & type-specific extractions
  classification?: ClassificationInfo;
  technical?: TechnicalExtraction;
  bill_of_quantities?: BillOfQuantitiesExtraction;
  tender_conditions?: TenderConditionsExtraction;
  schedule?: ScheduleExtraction;

  // v3: Full extractions
  tender?: TenderExtraction;
  gtp?: GTPExtraction;
  bridge_params?: BridgeSOParams;

  // v3: Multi-document merge results
  merged_sos?: MergedSO[];
  contradictions?: ContradictionRecord[];
  file_groups?: SOFileGroup[];
}

// ===== Document Classification (3-tier) =====

export type DocCategory = 'TZ' | 'RO' | 'PD' | 'VY' | 'SM' | 'HA' | 'GE' | 'ZP' | 'TI' | 'OT';

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  TZ: 'Technická zpráva',
  RO: 'Rozpočet / Výkaz výměr',
  PD: 'Podmínky / Zadávací dokumentace',
  VY: 'Výkresy',
  SM: 'Smlouva',
  HA: 'Harmonogram',
  GE: 'Geologický průzkum',
  ZP: 'BOZP / Životní prostředí',
  TI: 'Titulní list / Obsah',
  OT: 'Ostatní',
};

export const DOC_CATEGORY_COLORS: Record<DocCategory, string> = {
  TZ: '#3B82F6',
  RO: '#10B981',
  PD: '#8B5CF6',
  VY: '#F59E0B',
  SM: '#6366F1',
  HA: '#EC4899',
  GE: '#78716C',
  ZP: '#EF4444',
  TI: '#94A3B8',
  OT: '#9CA3AF',
};

export interface ClassificationInfo {
  category: DocCategory;
  sub_type?: DocSubType;
  confidence: number;
  method: 'filename' | 'keywords' | 'ai';
  detected_keywords?: string[];
  so_code?: string;
  priority?: number;
}

// ===== v3: Document Sub-Types =====

export type DocSubType =
  | 'TZ-S' | 'TZ-D'
  | 'VY-SIT' | 'VY-POD' | 'VY-PRI' | 'VY-VYT' | 'VY-OPE' | 'VY-NK' | 'VY-PRE' | 'VY-ARM' | 'VY-VYB' | 'VY-GEN'
  | 'GE-GTP' | 'GE-IGP'
  | 'RO-SOD' | 'RO-REC'
  | 'PD-ZD' | 'PD-KP'
  | 'HA-GEN' | 'SM-SOD' | 'OT-GEN';

// ===== Type-Specific Extractions =====

export interface TechnicalExtraction {
  project_name?: string;
  structure_type?: string;
  structure_subtype?: string;
  total_length_m?: number;
  width_m?: number;
  height_m?: number;
  area_m2?: number;
  volume_m3?: number;
  span_count?: number;
  span_lengths_m?: number[];
  concrete_grade?: string;
  reinforcement_grade?: string;
  foundation_type?: string;
  fabrication_method?: string;
  load_class?: string;
  design_life_years?: number;
  applicable_standards?: string[];
  construction_duration_months?: number;
  special_conditions?: string[];
  source_pages?: Record<string, number>;
}

export interface BillOfQuantitiesExtraction {
  total_items?: number;
  total_price_czk?: number;
  categories?: string[];
  key_materials?: string[];
  volumes?: Record<string, number>;
}

export interface TenderConditionsExtraction {
  tender_name?: string;
  contracting_authority?: string;
  deadlines?: Record<string, string>;
  documents?: string[];
  criteria?: string[];
  budget?: string;
}

export interface ScheduleExtraction {
  duration?: string;
  dates?: Record<string, string>;
  phases?: string[];
  milestones?: string[];
  critical_path?: string[];
}

// ===== v3: Bridge SO Params (ČSN 73 6200) =====

export interface BridgeSOParams {
  // Odst. 4: Classification
  csn_4_1?: string;
  csn_4_2?: string;
  csn_4_3?: string;
  csn_4_6?: string;
  csn_4_12?: string;
  csn_4_14?: string;

  // Odst. 5: Dimensions
  light_span_m?: number;
  span_m?: number;
  span_config?: string;
  nk_length_m?: number;
  nk_area_m2?: number;
  bridge_length_m?: number;
  bridge_width_m?: number;
  free_width_m?: number;
  width_between_railings_m?: number;
  bridge_height_m?: number;
  structural_height_m?: number;
  construction_height?: string;
  clearance_under_m?: number;
  crossing_angle_deg?: number;
  skewness_deg?: number;
  load_class?: string;

  // NK
  nk_type?: string;
  beam_count?: number;
  beam_spacing_mm?: number;
  slab_thickness_mm?: number;
  hard_protection_mm?: number;
  transverse_slope_pct?: number;
  longitudinal_slope_pct?: number;

  // Foundation
  foundation_type?: string;
  pile_diameter_mm?: number;
  pile_length_m?: number;
  pile_change_note?: string;

  // Concrete
  concrete_nk?: string;
  concrete_substructure?: string;
  concrete_protection?: string;
  concrete_foundation?: string;
  cover_mm?: string;
  reinforcement?: string;

  // Deformace
  settlement_abutment_1_mm?: number;
  settlement_abutment_2_mm?: number;
  deflection_span_mm?: number;
  consolidation_95pct_days?: number;

  // PKO
  pko_aggressivity?: string;
  pko_lifetime?: string;
  stray_current_protection?: number;

  // GTP data
  gtp_boreholes?: string[];
  groundwater_level_m?: string;
  water_aggressivity?: string;
  geotechnical_category?: number;
  foundation_soils?: string[];

  // Related SOs
  related_sos?: string[];

  // Crossing
  obstacle_crossed?: string;
  road_on_bridge?: string;
  chainage_km?: number;
  crossing_point_jtsk?: string;

  // Source tracking
  sources?: Record<string, string>;
}

// ===== v3: GTP Extraction =====

export interface SoilLayer {
  depth_from_m: number;
  depth_to_m: number;
  soil_type_code: string;
  csn_class?: string;
  description?: string;
  consistency?: string;
}

export interface BoreholeData {
  borehole_id: string;
  coordinates_jtsk?: string;
  elevation_bpv?: number;
  depth_m: number;
  date?: string;
  layers?: SoilLayer[];
}

export interface SoilType {
  code: string;
  description?: string;
  depth_range?: string;
  edef_mpa?: number;
  phi_deg?: number;
  c_kpa?: number;
  rp_mpa?: number;
  permeability?: string;
}

export interface GTPExtraction {
  boreholes?: BoreholeData[];
  soil_types?: SoilType[];
  groundwater_levels?: Record<string, Record<string, number>>;
  water_aggressivity?: string;
  aggressivity_details?: Record<string, number | string>;
  stray_current_class?: number;
  geotechnical_category?: number;
  foundation_recommendation?: string;
  pile_depth_estimate?: string;
  special_measures?: string[];
  settlements?: Array<Record<string, any>>;
  source_pages?: Record<string, number>;
}

// ===== v3: Full Tender Extraction (PD) =====

export interface PersonnelRequirement {
  role: string;
  role_code?: string;
  experience_years?: number;
  reference_description?: string;
  reference_min_value_czk?: number;
  authorization_required?: string;
  authorization_law?: string;
  proof_documents?: string[];
}

export interface ReferenceRequirement {
  reference_code?: string;
  description?: string;
  min_value_czk?: number;
  min_volume?: string;
  completed_period?: string;
  proof_type?: string;
  specific_conditions?: string[];
}

export interface EquipmentRequirement {
  description: string;
  min_capacity?: string;
  ownership?: string;
  conditions?: string[];
}

export interface EvaluationCriterion {
  name: string;
  weight_pct: number;
  direction: 'lower_better' | 'higher_better';
  min_value?: number;
  max_scored_value?: number;
  unit?: string;
  formula?: string;
  disqualification_threshold?: string;
}

export interface TenderAttachment {
  number: number;
  name: string;
  description?: string;
  is_form?: boolean;
  is_contract?: boolean;
  is_technical?: boolean;
}

export interface TenderExtraction {
  // Identification
  tender_name?: string;
  tender_number?: string;
  evidence_number?: string;
  procedure_type?: string;
  contracting_authority?: string;
  authority_address?: string;
  authority_ico?: string;
  authority_branch?: string;
  contact_person?: string;
  contact_phone?: string;
  data_box?: string;
  designer?: string;
  contract_type?: string;

  // Value
  estimated_value_czk?: number;
  estimated_value_note?: string;
  currency?: string;
  vat_note?: string;

  // Site inspection
  site_inspection_organized?: boolean;
  site_inspection_note?: string;

  // Qualification
  basic_eligibility?: string[];
  professional_eligibility?: string[];
  min_annual_turnover_czk?: number;
  turnover_period?: string;
  turnover_note?: string;
  required_personnel?: PersonnelRequirement[];
  required_references?: ReferenceRequirement[];
  required_equipment?: EquipmentRequirement[];

  // Substitution
  can_substitute_with_declaration?: boolean;
  jeoo_accepted?: boolean;

  // Pricing
  pricing_method?: string;
  price_includes?: string;

  // Evaluation
  evaluation_criteria?: EvaluationCriterion[];

  // Submission
  submission_method?: string;
  electronic_tool?: string;
  tender_profile_url?: string;
  submission_deadline?: string;
  max_file_size_mb?: number;
  qualification_size_mb?: number;
  other_docs_size_mb?: number;
  accepted_formats?: string[];
  paper_submission_allowed?: boolean;

  // Opening
  opening_method?: string;

  // Binding period
  binding_period_months?: number;

  // Jistota
  jistota_required?: boolean;
  jistota_amount_czk?: number;
  jistota_forms?: string[];
  jistota_bank_account?: string;
  jistota_variable_symbol?: string;
  jistota_must_be_original?: boolean;

  // Reservations
  variants_allowed?: boolean;
  one_bid_only?: boolean;

  // Subcontracting
  subcontracting_limit?: string;
  own_capacity_required?: string[];
  subcontractor_identification_deadline?: string;

  // Attachments
  attachments?: TenderAttachment[];

  // Calculated
  submission_deadline_parsed?: string;
  days_until_submission?: number;

  // Risk flags
  risk_flags?: string[];

  source_pages?: Record<string, number>;
}

// ===== v3: Contradiction Detection =====

export interface ContradictionRecord {
  so_code: string;
  field_name: string;
  value_1: string;
  source_1: string;
  value_2: string;
  source_2: string;
  resolution: string;
  severity: 'critical' | 'warning' | 'info';
  note?: string;
}

// ===== v3: SO File Grouping & Merge =====

export interface SOFile {
  filename: string;
  file_path?: string;
  file_type?: string;
  file_hash?: string;
  so_code?: string;
  pages?: number;
  processed?: boolean;
  priority?: number;
  classification?: ClassificationInfo;
}

export interface SOFileGroup {
  so_code: string;
  so_name: string;
  files: SOFile[];
  coverage?: Record<string, boolean>;
  missing_categories?: string[];
}

// ===== v3.1: SO Type-Specific Params =====

export interface RoadSOParams {
  road_designation?: string;
  road_class?: number;
  road_category?: string;
  road_type?: string;
  road_length_m?: number;
  chainage_start?: string;
  chainage_end?: string;
  alignment_type?: string;
  curve_radius_m?: number;
  cross_slope_pct?: number;
  cross_slope_type?: string;
  lane_width_m?: number;
  lane_count?: number;
  shoulder_paved_m?: number;
  shoulder_unpaved_m?: number;
  pavement_catalog?: string;
  traffic_load_class?: string;
  design_damage_level?: string;
  surface_type?: string;
  pavement_layers?: string[];
  active_zone_thickness_m?: number;
  min_cbr_pct?: number;
  earthwork_type?: string;
  has_sanation?: boolean;
  sanation_type?: string;
  has_guardrails?: boolean;
  guardrail_type?: string;
  drainage_method?: string;
  intersections?: Array<Record<string, string>>;
  volume_cut_m3?: number;
  volume_fill_m3?: number;
  related_sos?: string[];
  future_owner?: string;
  sources?: Record<string, string>;
}

export interface ConstructionPhase {
  phase_number: number;
  name?: string;
  duration_weeks?: number;
  description?: string;
  sos_in_phase?: string[];
  traffic_restrictions?: string[];
  key_activities?: string[];
}

export interface RoadClosure {
  road: string;
  closure_type: string;
  reason: string;
  phase: number;
  duration_description?: string;
}

export interface DetourRoute {
  for_road: string;
  route_description: string;
  roads_used?: string[];
}

export interface TrafficDIOParams {
  total_duration_weeks?: number;
  phases?: ConstructionPhase[];
  closures?: RoadClosure[];
  detours?: DetourRoute[];
  bus_impact?: string;
  rail_impact?: string;
  phase_so_mapping?: Record<string, string[]>;
  provisional_roads?: Array<Record<string, unknown>>;
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface WaterSOParams {
  water_type?: string;
  pipe_material?: string;
  pipe_dn?: number;
  pipe_pn?: number;
  pipe_standard?: string;
  pipe_quality?: string;
  pipe_length_m?: number;
  outer_protection?: string;
  inner_lining?: string;
  joint_type?: string;
  casing_material?: string;
  casing_dn?: number;
  casing_length_m?: number;
  casing_protection?: string;
  trench_walls?: string;
  trench_shoring?: string;
  bedding_material?: string;
  bedding_depth_mm?: number;
  detection_wire?: string;
  warning_foil?: string;
  connection_type?: string;
  pressure_test?: string;
  disinfection?: boolean;
  crossing_km?: string[];
  owner?: string;
  drain_type?: string;
  retention_volume_m3?: number;
  oil_separator?: boolean;
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface PlantSpecies {
  code: string;
  latin_name: string;
  czech_name: string;
  total_count: number;
  size_category: string;
}

export interface VegetationSOParams {
  climate_region?: string;
  total_trees?: number;
  total_shrubs?: number;
  tree_species?: PlantSpecies[];
  shrub_species?: PlantSpecies[];
  lawn_care_count?: number;
  lawn_mowing_frequency?: string;
  watering_count?: number;
  mulch_material?: string;
  mulch_thickness_cm?: number;
  tree_care_years?: number;
  tree_stakes?: string;
  standards?: string[];
  greened_sos?: string[];
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface ElectroSOParams {
  electro_type?: string;
  voltage_level?: string;
  cable_type?: string;
  telecom_operator?: string;
  energy_operator?: string;
  chainage_km?: string;
  realized_by?: string;
  is_separate_contract?: boolean;
  dis_type?: string;
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface PipelineSOParams {
  pipeline_type?: string;
  pressure_class?: string;
  pipe_dn?: number;
  pipe_material?: string;
  pipe_length_m?: number;
  chainage_km?: string;
  operator?: string;
  realized_by?: string;
  is_separate_contract?: boolean;
  coordination_note?: string;
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface SignageSOParams {
  horizontal_type?: string;
  horizontal_standard?: string;
  sign_standards?: string[];
  roads_signed?: string[];
  related_sos?: string[];
  sources?: Record<string, string>;
}

export interface MergedSO {
  so_code: string;
  so_name?: string;
  so_category?: string;
  so_category_label?: string;
  structure_type?: string;
  bridge_params?: BridgeSOParams;
  gtp?: GTPExtraction;
  technical?: TechnicalExtraction;
  tender?: TenderExtraction;
  // v3.1: Universal SO type params
  road_params?: RoadSOParams;
  traffic_params?: TrafficDIOParams;
  water_params?: WaterSOParams;
  vegetation_params?: VegetationSOParams;
  electro_params?: ElectroSOParams;
  pipeline_params?: PipelineSOParams;
  signage_params?: SignageSOParams;
  // v4.1: D.1.4 profession params (pozemní TZB)
  silnoproud_params?: SilnoproudParams;
  slaboproud_params?: SlaboproudParams;
  vzt_params?: VZTParams;
  zti_params?: ZTIParams;
  ut_params?: UTParams;
  mar_params?: MaRParams;
  // v4.3: Railway params
  zel_svrsek_params?: ZelSvrsekParams;
  zel_spodek_params?: ZelSpodekParams;
  igp_params?: IGPParams;
  // v3.1.1: Enhanced classification
  construction_type?: string;
  section_ids?: Array<{ type: string; id: string }>;
  is_non_construction?: boolean;
  generic_summary?: GenericSummary;
  contradictions?: ContradictionRecord[];
  sources?: Record<string, string>;
  file_count?: number;
  files?: string[];
  source_documents?: string[];
  coverage?: Record<string, boolean>;
}

// v3.1.1: Non-construction document summary
export interface GenericSummary {
  document_type: string;  // "legal", "invoice", "correspondence", "other"
  title?: string;
  summary?: string;
  key_entities?: string[];
  dates_found?: string[];
  amounts_found?: string[];
  language?: string;
  page_count?: number;
  confidence?: number;
}

// ============================================================================
// D.1.4 Profession Params (Building Systems / TZB)
// ============================================================================

/** Silnoproud — high-voltage electrical installations */
export interface SilnoproudParams {
  section_id?: string;
  pd_level?: string;
  building_name?: string;
  building_type?: string;
  voltage_3phase?: string;
  voltage_1phase?: string;
  current_system?: string;
  max_concurrent_power_kw?: number;
  total_installed_kw?: number;
  total_concurrent_kw?: number;
  concurrency_factor?: number;
  annual_consumption_mwh?: number;
  supply_source?: string;
  supply_cable?: string;
  lighting_control?: string;
  emergency_lighting?: boolean;
  emergency_duration_min?: number;
  outlet_cable?: string;
  outlet_ip_rating?: string;
  surge_protection_type?: string;
  revision_standard?: string;
  protection_methods?: string[];
  cable_types_main?: string[];
  installation_methods?: string[];
  switchboards?: Record<string, unknown>[];
  power_balance?: Record<string, unknown>[];
  tzb_connections?: Record<string, unknown>[];
  sources?: Record<string, string>;
}

/** Slaboproud — low-voltage systems (SCS, PZTS, CCTV, EPS, etc.) */
export interface SlaboproudParams {
  section_id?: string;
  pd_level?: string;
  subsystems?: string[];
  scs?: Record<string, unknown>;
  pzts?: Record<string, unknown>;
  skv?: Record<string, unknown>;
  cctv?: Record<string, unknown>;
  eps?: Record<string, unknown>;
  avt?: Record<string, unknown>;
  intercom?: Record<string, unknown>;
  sources?: Record<string, string>;
}

/** VZT — ventilation and air conditioning */
export interface VZTParams {
  section_id?: string;
  pd_level?: string;
  building_name?: string;
  building_type?: string;
  ventilation_strategy?: string;
  total_supply_m3h?: number;
  total_exhaust_m3h?: number;
  ahu_count?: number;
  split_cooling_count?: number;
  exhaust_fan_count?: number;
  fire_damper_count?: number;
  total_heating_kw?: number;
  total_cooling_kw?: number;
  duct_material?: string;
  duct_insulation?: string;
  control_system?: string;
  bms_integration?: boolean;
  noise_limit_db?: number;
  design_outdoor_temp_winter?: number;
  design_outdoor_temp_summer?: number;
  design_indoor_temp?: number;
  regulations_used?: string[];
  devices?: Record<string, unknown>[];
  sources?: Record<string, string>;
}

/** ZTI — plumbing (water supply + sewerage + rainwater) */
export interface ZTIParams {
  section_id?: string;
  pd_level?: string;
  building_name?: string;
  building_type?: string;
  floors_above?: number;
  floors_below?: number;
  occupants?: number;
  design_flow_qww_ls?: number;
  main_branch_dn?: number;
  water_demand_m3_year?: number;
  fire_hydrants?: boolean;
  fire_hydrant_dn?: number;
  sewage?: Record<string, unknown>;
  rainwater?: Record<string, unknown>;
  cold_water?: Record<string, unknown>;
  hot_water?: Record<string, unknown>;
  fixtures?: Record<string, unknown>[];
  connections?: Record<string, unknown>[];
  sources?: Record<string, string>;
}

/** UT — central heating */
export interface UTParams {
  section_id?: string;
  pd_level?: string;
  building_name?: string;
  building_type?: string;
  heat_loss_total_kw?: number;
  design_outdoor_temp_c?: number;
  design_indoor_temp_c?: number;
  u_mean_wm2k?: number;
  specific_heat_demand_kwh_m2?: number;
  energy_class?: string;
  dhw_source?: string;
  dhw_storage_volume_l?: number;
  heat_source?: Record<string, unknown>;
  secondary_heat_source?: Record<string, unknown>;
  heating_system?: Record<string, unknown>;
  chimney?: Record<string, unknown>;
  garage_heating?: Record<string, unknown>;
  sources?: Record<string, string>;
}

/** MaR — measurement and regulation (BMS/automation) */
export interface MaRParams {
  section_id?: string;
  pd_level?: string;
  control_system_brand?: string;
  control_system_type?: string;
  plc_type?: string;
  io_points_count?: number;
  bus_protocol?: string;
  bms_integration?: boolean;
  visualization?: string;
  remote_access?: boolean;
  controlled_professions?: string[];
  controlled_equipment?: string[];
  temperature_sensors_count?: number;
  humidity_sensors_count?: number;
  pressure_sensors_count?: number;
  other_sensors?: string[];
  sources?: Record<string, string>;
}

// ============================================================================
// Railway Params (železniční stavby)
// ============================================================================

/** Železniční svršek — railway superstructure */
export interface ZelSvrsekParams {
  section_id?: string;
  so_id?: string;
  pd_level?: string;
  project_name?: string;
  track_section?: string;
  track_category?: string;
  max_speed_kmh?: number;
  axle_load_t?: number;
  load_class?: string;
  track_position?: string;
  traction_system?: string;
  safety_device?: string;
  track_count?: number;
  start_km?: number;
  end_km?: number;
  total_length_m?: number;
  reconstruction_length_m?: number;
  walkway_width_m?: number;
  walkway_renewal?: boolean;
  gpk?: Record<string, unknown>;
  track_frame?: Record<string, unknown>;
  continuous_welded?: Record<string, unknown>;
  sources?: Record<string, string>;
}

/** Železniční spodek — railway substructure */
export interface ZelSpodekParams {
  section_id?: string;
  so_id?: string;
  pd_level?: string;
  e_min_zp_mpa?: number;
  e_min_pl_mpa?: number;
  kpp_zones?: Record<string, unknown>[];
  subgrade?: Record<string, unknown>;
  formation_level?: Record<string, unknown>;
  drainage?: Record<string, unknown>;
  slope_stability?: Record<string, unknown>;
  sources?: Record<string, string>;
}

/** IGP — engineering-geological survey */
export interface IGPParams {
  project_name?: string;
  contractor?: string;
  client?: string;
  report_date?: string;
  location_municipality?: string;
  elevation_range_m?: string;
  track_vmax_kmh?: number;
  track_load_class?: string;
  required_e_min_zp_mpa?: number;
  required_e_min_pl_pp_mpa?: number;
  conclusion_summary?: string;
  probes?: Record<string, unknown>[];
  load_tests?: Record<string, unknown>[];
  geology?: Record<string, unknown>;
  hydrogeology?: Record<string, unknown>;
  lab_results?: Record<string, unknown>[];
  sources?: Record<string, string>;
}

// AI model type — backend auto-selects (Vertex AI on Cloud Run, Gemini fallback)
export type AIModelType = string;

