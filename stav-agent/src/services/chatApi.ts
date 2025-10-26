import axios, { isAxiosError } from 'axios';

const DEFAULT_API_URL = 'https://concrete-agent.onrender.com';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  DEFAULT_API_URL;

const chatClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export type ChatAction =
  | 'audit_positions'
  | 'materials_summary'
  | 'calculate_resources'
  | 'position_breakdown';

export interface ArtifactNavigationSection {
  id: string;
  label: string;
  icon?: string;
}

export interface ArtifactNavigation {
  title?: string;
  sections?: ArtifactNavigationSection[];
  active_section?: string;
}

export interface ArtifactAction {
  id: string;
  label: string;
  icon?: string;
  endpoint?: string;
}

export interface ArtifactWarning {
  level: 'INFO' | 'WARNING' | 'ERROR' | string;
  message: string;
}

export interface ArtifactMetadata {
  generated_at?: string;
  project_id?: string;
  project_name?: string;
  generated_by?: string;
  [key: string]: unknown;
}

export interface ArtifactUiHints {
  display_mode?: 'table' | 'card' | 'tree' | 'timeline' | string;
  expandable_sections?: boolean;
  sortable_columns?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  [key: string]: unknown;
}

export interface ChatArtifact {
  type: string;
  title?: string;
  data?: unknown;
  metadata?: ArtifactMetadata;
  navigation?: ArtifactNavigation;
  actions?: ArtifactAction[];
  status?: 'OK' | 'WARNING' | 'ERROR' | string;
  warnings?: ArtifactWarning[];
  ui_hints?: ArtifactUiHints;
}

export interface ChatResponse {
  response: string;
  artifact?: ChatArtifact;
  metadata?: Record<string, unknown>;
}

const toError = (error: unknown): Error => {
  if (isAxiosError(error)) {
    const details =
      (typeof error.response?.data === 'object' && error.response?.data && 'error' in error.response.data
        ? String((error.response.data as { error?: unknown }).error)
        : undefined) || error.message || 'Neznámá chyba';
    return new Error(details);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('Neznámá chyba');
};

const normalizeChat = (data: unknown): ChatResponse => {
  const payload = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const response =
    typeof payload.response === 'string'
      ? payload.response
      : typeof payload.message === 'string'
      ? payload.message
      : '';

  return {
    response,
    artifact: (payload.artifact as ChatArtifact | undefined) ?? undefined,
    metadata: (payload.metadata as Record<string, unknown> | undefined) ?? undefined,
  };
};

export const sendMessage = async (projectId: string, message: string): Promise<ChatResponse> => {
  try {
    const { data } = await chatClient.post('/api/chat/message', {
      project_id: projectId,
      message,
      include_history: true,
    });
    return normalizeChat(data);
  } catch (error) {
    throw toError(error);
  }
};

export interface TriggerActionParams {
  projectId: string;
  action: ChatAction;
  options?: Record<string, unknown>;
  positionId?: string;
  freeFormQuery?: string;
}

export const triggerAction = async ({
  projectId,
  action,
  options,
  positionId,
  freeFormQuery,
}: TriggerActionParams): Promise<ChatResponse> => {
  try {
    const { data } = await chatClient.post('/api/chat/action', {
      project_id: projectId,
      action,
      position_id: positionId,
      options,
      free_form_query: freeFormQuery,
    });
    return normalizeChat(data);
  } catch (error) {
    throw toError(error);
  }
};
