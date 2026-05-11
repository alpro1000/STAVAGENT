/**
 * Service Connection types — Sprint 2
 */

export type ServiceType =
  | 'gemini' | 'openai' | 'anthropic' | 'aws_bedrock'
  | 'perplexity' | 'azure_openai'
  | 'gcs' | 'aws_s3' | 'azure_blob';

export type ConnectionStatus = 'active' | 'error' | 'untested' | 'disabled';

export interface ServiceConnection {
  id: string;
  user_id: number | null;
  org_id: string | null;
  service_type: ServiceType;
  display_name: string;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  primary: string;
  fallback: string;
  model_overrides: Record<string, string>;
  available_providers?: string[];
}

export type KioskToggles = Record<string, boolean>;

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  aws_bedrock: 'AWS Bedrock',
  perplexity: 'Perplexity',
  azure_openai: 'Azure OpenAI',
  gcs: 'Google Cloud Storage',
  aws_s3: 'AWS S3',
  azure_blob: 'Azure Blob Storage',
};

export const SERVICE_TYPE_CATEGORIES: Record<string, ServiceType[]> = {
  'AI Modely': ['gemini', 'openai', 'anthropic', 'aws_bedrock', 'perplexity', 'azure_openai'],
  'Úložiště': ['gcs', 'aws_s3', 'azure_blob'],
};

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  active: 'Aktivní',
  error: 'Chyba',
  untested: 'Netestováno',
  disabled: 'Vypnuto',
};

export const STATUS_COLORS: Record<ConnectionStatus, string> = {
  active: '#10b981',
  error: '#ef4444',
  untested: '#6b7280',
  disabled: '#9ca3af',
};

export const KIOSK_LABELS: Record<string, string> = {
  monolit: 'Kalkulátor betonáže',
  registry: 'Registr Rozpočtů',
  urs_matcher: 'Klasifikátor stavebních prací',
  pump: 'Pump Calculator',
  formwork: 'Formwork Calculator',
};
