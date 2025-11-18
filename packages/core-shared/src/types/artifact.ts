/**
 * Artifact and visualization types
 */

export type ArtifactType = 'audit_result' | 'materials' | 'resources' | 'breakdown' | 'schedule';
export type WarningLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface ArtifactAction {
  id: string;
  label: string;
  icon?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface ArtifactNavigationSection {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

export interface ArtifactNavigation {
  title?: string;
  sections?: ArtifactNavigationSection[];
  active_section?: string;
}

export interface ArtifactWarning {
  level: WarningLevel;
  message: string;
  code?: string;
  details?: unknown;
}

export interface ArtifactUiHints {
  layout?: 'grid' | 'list' | 'table' | 'tree';
  columns?: string[];
  sortable?: boolean;
  filterable?: boolean;
  expandable?: boolean;
}

export interface ArtifactMetadata {
  generated_at?: string;
  project_id?: string;
  project_name?: string;
  generated_by?: string;
  version?: string;
  custom_data?: Record<string, unknown>;
}

export interface ChatArtifactDisplay {
  id: string;
  type: ArtifactType;
  title: string;
  summary?: string;
  content: unknown;
  navigation?: ArtifactNavigation;
  actions?: ArtifactAction[];
  warnings?: ArtifactWarning[];
  metadata?: ArtifactMetadata;
  uiHints?: ArtifactUiHints;
}
