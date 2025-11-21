/**
 * Position and budget item types
 */

export interface Position {
  id?: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  metadata?: Record<string, unknown>;
}

export interface EnrichedPosition extends Position {
  kros_match?: string;
  rts_price?: number;
  confidence_score?: number;
  enrichment_status?: 'matched' | 'partial' | 'no_match';
  match_quality?: 'exact' | 'partial' | 'fuzzy';
  evidence?: string[];
}

export interface PositionMetrics {
  total_positions: number;
  total_quantity: number;
  total_price: number;
  average_unit_price: number;
  matched_positions: number;
  match_rate: number; // percentage 0-100
}

export interface PositionBatch {
  positions: Position[];
  source: 'excel' | 'pdf' | 'manual' | 'core' | 'templates';
  project_id?: string;
  created_at: string;
}
