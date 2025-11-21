// API Response Types
export interface Project {
  id: string;
  name: string;
  workflow: 'A' | 'B';
  status: 'processing' | 'completed' | 'failed' | 'pending';
  createdAt: string;
  progress?: number;
  positionsCount?: number;
  issuesCount?: {
    red: number;
    amber: number;
    green: number;
  };
}

export interface Position {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  status?: 'green' | 'amber' | 'red';
}

// Multi-Role Assistant Types
export interface AssistantMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;

  // For assistant messages:
  rolesConsulted?: string[];
  confidence?: number;
  conflicts?: Conflict[];
  warnings?: string[];
  criticalIssues?: string[];
  artifacts?: Artifact[];

  // Interaction tracking
  interaction_id?: string;
  feedback?: MessageFeedback;
}

export interface Conflict {
  type: string;
  description: string;
  resolved: boolean;
  winner?: string;
  resolution?: string;
}

export interface MessageFeedback {
  rating: number; // 1-5
  helpful: boolean;
  correct?: boolean;
  comment?: string;
}

export interface Artifact {
  id?: string;
  type: 'calculation' | 'report' | 'table' | 'chart' | 'tech_card' | 'resource_sheet' | 'materials' | 'vykaz_vymer' | 'audit' | 'summary';
  title: string;
  content: any;
  editable?: boolean;
  exportFormats?: ('pdf' | 'excel' | 'docx' | 'copy')[];
}

export interface ProjectContext {
  projectId: string;
  projectName: string;
  workflow: 'A' | 'B';
  positions?: Position[];
  metadata?: Record<string, any>;
}

// Legacy support
export interface ChatMessage extends AssistantMessage {}

export interface ChatResponse {
  response: string;
  artifact?: Artifact;
}

export interface UploadProgress {
  percent: number;
}
