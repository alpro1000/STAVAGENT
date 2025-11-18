/**
 * Audit and classification types
 */

export type AuditStatus = 'GREEN' | 'AMBER' | 'RED';
export type ExpertRole = 'SME' | 'ARCH' | 'ENG' | 'SUP';

export interface AuditResult {
  id?: string;
  position_id: string;
  project_id?: string;
  status: AuditStatus;
  confidence_score: number; // 0-100
  reasons: string[];
  expert_roles: Record<ExpertRole, ExpertOpinion>;
  needs_human_review: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExpertOpinion {
  role: ExpertRole;
  opinion: AuditStatus;
  confidence: number; // 0-100
  rationale: string;
}

export interface AuditClassification {
  total_positions: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  green_percentage: number;
  amber_percentage: number;
  red_percentage: number;
  needs_human_review_count: number;
  average_confidence: number;
}

export interface MultiRoleAuditRequest {
  position: unknown; // Position object
  roles: ExpertRole[];
  project_context?: Record<string, unknown>;
  user_preferences?: Record<string, unknown>;
}

export interface MultiRoleAuditResponse {
  position_id: string;
  result: AuditResult;
  consensus_status: AuditStatus;
  conflict_detected: boolean;
  execution_time_ms: number;
}
