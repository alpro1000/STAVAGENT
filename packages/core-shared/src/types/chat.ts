/**
 * Chat and message types
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatAction =
  | 'audit_positions'
  | 'materials_summary'
  | 'calculate_resources'
  | 'position_breakdown';

export interface ChatMessage {
  id: string;
  project_id: string;
  role: ChatRole;
  content: string;
  artifacts?: ChatArtifact[];
  created_at: string;
  updated_at?: string;
}

export interface ChatResponse {
  success: boolean;
  message?: ChatMessage;
  artifacts?: ChatArtifact[];
  error?: string;
}

export interface ChatArtifact {
  id: string;
  type: 'audit_result' | 'materials' | 'resources' | 'breakdown';
  title: string;
  content: unknown;
  metadata?: Record<string, unknown>;
}
