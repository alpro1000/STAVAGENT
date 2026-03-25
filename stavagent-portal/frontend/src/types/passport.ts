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
  dimensions?: Record<string, string | number>;
  spans?: string[];
  materials?: string[];
  standards?: string[];
  construction_method?: string;
  foundation_type?: string;
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
  severity: 'high' | 'medium' | 'low';
  note?: string;
}

// ===== v3: SO File Grouping & Merge =====

export interface SOFile {
  filename: string;
  file_type: string;
  pages: number;
  processed: boolean;
  priority: number;
}

export interface SOFileGroup {
  so_code: string;
  so_name: string;
  files: SOFile[];
  coverage?: Record<string, boolean>;
  missing_categories?: string[];
}

export interface MergedSO {
  so_code: string;
  so_name?: string;
  structure_type?: string;
  bridge_params?: BridgeSOParams;
  gtp?: GTPExtraction;
  tender?: TenderExtraction;
  contradictions?: ContradictionRecord[];
  sources?: Record<string, string>;
  file_count?: number;
  files?: string[];
  source_documents?: string[];
  coverage?: Record<string, boolean>;
}

// ===== AI Model Selection =====

export const AI_MODELS = {
  GEMINI: 'gemini',
  CLAUDE_SONNET: 'claude-sonnet',
  CLAUDE_HAIKU: 'claude-haiku',
  OPENAI_GPT4: 'openai',       // Backend expects 'openai', not 'openai-gpt4'
  OPENAI_MINI: 'openai-mini',
  PERPLEXITY: 'perplexity',
  VERTEX_AI_GEMINI: 'vertex-ai-gemini',
} as const;

export type AIModelType = typeof AI_MODELS[keyof typeof AI_MODELS];

export interface AIModelInfo {
  id: AIModelType;
  name: string;
  cost_per_passport: string;
  speed: string;
  quality: string;
  description: string;
  provider?: 'google' | 'anthropic' | 'openai' | 'perplexity';
}


export const AI_MODEL_OPTIONS: AIModelInfo[] = [
  {
    id: AI_MODELS.VERTEX_AI_GEMINI,
    name: 'Vertex AI Gemini (Google Credits)',
    cost_per_passport: 'Google credits',
    speed: 'Rychlý (2-4s)',
    quality: 'Vysoká',
    description: 'Gemini přes Vertex AI — firemní billing, žádné API klíče na Cloud Run',
    provider: 'google',
  },
  {
    id: AI_MODELS.GEMINI,
    name: 'Gemini 2.5 Flash',
    cost_per_passport: 'ZDARMA',
    speed: 'Velmi rychlý (1-2s)',
    quality: 'Vysoká',
    description: 'Přímé API (gemini-2.5-flash) — výchozí fallback, nejlepší poměr cena/výkon',
    provider: 'google',
  },
  {
    id: AI_MODELS.CLAUDE_HAIKU,
    name: 'Claude Haiku 4.5',
    cost_per_passport: '$0.0006',
    speed: 'Rychlý (2-3s)',
    quality: 'Velmi vysoká',
    description: 'Nejlevnější Claude model (claude-haiku-4-5-20251001)',
    provider: 'anthropic',
  },
  {
    id: AI_MODELS.CLAUDE_SONNET,
    name: 'Claude Sonnet 4.6',
    cost_per_passport: '$0.0075',
    speed: 'Střední (3-5s)',
    quality: 'Maximální',
    description: 'Nejlepší kvalita (claude-sonnet-4-6)',
    provider: 'anthropic',
  },
  {
    id: AI_MODELS.OPENAI_MINI,
    name: 'GPT-4.1 Mini',
    cost_per_passport: '$0.0004',
    speed: 'Rychlý (2-3s)',
    quality: 'Dobrá',
    description: 'Levný OpenAI model (gpt-4.1-mini)',
    provider: 'openai',
  },
  {
    id: AI_MODELS.PERPLEXITY,
    name: 'Perplexity Sonar',
    cost_per_passport: '$0.0025',
    speed: 'Střední (3-4s)',
    quality: 'Vysoká',
    description: 'Online vyhledávání + AI',
    provider: 'perplexity',
  },
];

