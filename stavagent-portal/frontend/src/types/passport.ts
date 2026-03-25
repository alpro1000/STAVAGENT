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

