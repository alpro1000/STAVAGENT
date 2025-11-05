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

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifact?: Artifact;
  rolesConsulted?: string[];
  confidence?: number;
}

export interface Artifact {
  type: 'tech_card' | 'resource_sheet' | 'materials' | 'vykaz_vymer' | 'audit' | 'summary';
  title: string;
  content: any;
}

export interface ChatResponse {
  response: string;
  artifact?: Artifact;
}

export interface UploadProgress {
  percent: number;
}
