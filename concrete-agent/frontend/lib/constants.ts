// Project Status
export const PROJECT_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

// Workflow Types
export const WORKFLOW_TYPES = {
  A: 'A',
  B: 'B',
} as const;

export type WorkflowType = typeof WORKFLOW_TYPES[keyof typeof WORKFLOW_TYPES];

// Issue Status (Traffic Light)
export const ISSUE_STATUS = {
  GREEN: 'green',
  AMBER: 'amber',
  RED: 'red',
} as const;

export type IssueStatus = typeof ISSUE_STATUS[keyof typeof ISSUE_STATUS];

// Status Labels & Colors
export const STATUS_CONFIG = {
  [PROJECT_STATUS.PROCESSING]: {
    label: 'Processing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: '⏳',
  },
  [PROJECT_STATUS.COMPLETED]: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: '✅',
  },
  [PROJECT_STATUS.FAILED]: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: '❌',
  },
  [PROJECT_STATUS.PENDING]: {
    label: 'Pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: '⏸️',
  },
};

// Issue Status Colors
export const ISSUE_STATUS_CONFIG = {
  [ISSUE_STATUS.GREEN]: {
    label: 'OK',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: '🟢',
  },
  [ISSUE_STATUS.AMBER]: {
    label: 'Warning',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: '🟡',
  },
  [ISSUE_STATUS.RED]: {
    label: 'Error',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: '🔴',
  },
};

// Workflow Labels
export const WORKFLOW_CONFIG = {
  [WORKFLOW_TYPES.A]: {
    label: 'Workflow A',
    description: 'Import & Audit existing BOQ',
    icon: '📊',
  },
  [WORKFLOW_TYPES.B]: {
    label: 'Workflow B',
    description: 'Generate BOQ from drawings',
    icon: '📐',
  },
};

// Default Values
export const DEFAULT_ISSUES_COUNT = {
  red: 0,
  amber: 0,
  green: 0,
};

// API Endpoints (for reference)
export const API_ENDPOINTS = {
  PROJECTS: '/api/projects',
  UPLOAD: '/api/upload',
  CHAT_MESSAGE: '/api/chat/message',
  CHAT_ACTION: '/api/chat/action',
  WORKFLOW_A_POSITIONS: '/api/workflow/a/positions',
  WORKFLOW_B_POSITIONS: '/api/workflow/b/positions',
} as const;
