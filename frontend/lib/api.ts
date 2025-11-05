import axios from 'axios';
import type { Project, Position, ChatResponse, UploadProgress } from './types';

const DEFAULT_API_URL = 'https://concrete-agent.onrender.com';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  DEFAULT_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const normalizeChat = (data: any): ChatResponse => ({
  response: data?.response ?? data?.message ?? '',
  artifact: data?.artifact ?? null,
});

// ========================================
// PROJECTS
// ========================================

export const getProjects = async (): Promise<{ projects: Project[] }> => {
  try {
    const { data } = await apiClient.get('/api/projects');
    return data;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return { projects: [] };
  }
};

export const getProject = async (projectId: string): Promise<Project> => {
  const { data } = await apiClient.get(`/api/projects/${projectId}`);
  return data;
};

export const createProject = async (name: string): Promise<Project> => {
  const { data } = await apiClient.post('/api/chat/projects', { name });
  return data;
};

export const uploadProject = async (
  projectName: string,
  workflow: 'A' | 'B',
  files: File[],
  onProgress?: (progress: number) => void
): Promise<any> => {
  console.log('📤 Uploading new project:', projectName);
  console.log('📂 Files:', files.map(f => f.name));
  console.log('⚙️ Workflow:', workflow);

  const formData = new FormData();
  formData.append('project_name', projectName);
  formData.append('workflow', workflow);

  files.forEach((file) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (['xlsx', 'xls'].includes(ext || '')) {
      formData.append('vykaz_vymer', file);
    } else if (['pdf', 'dwg', 'png', 'jpg', 'jpeg'].includes(ext || '')) {
      formData.append('vykresy', file);
    }
  });

  const { data } = await apiClient.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      const percent = Math.round((event.loaded * 100) / event.total);
      onProgress(percent);
    },
  });

  console.log('✅ Upload response:', data);
  return data;
};

// ========================================
// UPLOAD FILES TO EXISTING PROJECT
// ========================================

export const uploadFiles = async (
  projectId: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<any> => {
  console.log('📤 Uploading files for project:', projectId);
  console.log('📂 Files:', files.map(f => f.name));

  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const { data } = await apiClient.post(
    `/api/upload-to-project?project_id=${projectId}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      },
    }
  );

  console.log('✅ Upload response:', data);
  return data;
};

// ========================================
// CHAT
// ========================================

export const sendChatMessage = async (
  projectId: string,
  message: string
): Promise<ChatResponse> => {
  const { data } = await apiClient.post('/api/chat/message', {
    project_id: projectId,
    message,
    include_history: true,
  });

  return normalizeChat(data);
};

// ========================================
// ACTIONS (Quick Actions)
// ========================================

export const triggerAction = async ({
  projectId,
  action,
  options,
  positionId,
  freeFormQuery,
}: {
  projectId: string;
  action: string;
  options?: any;
  positionId?: string;
  freeFormQuery?: string;
}): Promise<ChatResponse> => {
  const payload: any = {
    project_id: projectId,
    action,
  };

  if (options) payload.options = options;
  if (positionId) payload.position_id = positionId;
  if (freeFormQuery) payload.free_form_query = freeFormQuery;

  const { data } = await apiClient.post('/api/chat/action', payload);
  return normalizeChat(data);
};

// ========================================
// PROJECT RESULTS & STATUS
// ========================================

export const getProjectResults = async (projectId: string): Promise<any> => {
  const { data } = await apiClient.get(`/api/projects/${projectId}/results`);
  return data;
};

export const getProjectStatus = async (projectId: string): Promise<any> => {
  const { data } = await apiClient.get(`/api/projects/${projectId}/status`);
  return data;
};

export const getProjectFiles = async (projectId: string): Promise<any> => {
  const { data } = await apiClient.get(`/api/projects/${projectId}/files`);
  return data;
};

// ========================================
// WORKFLOW A ARTIFACTS
// ========================================

export const getWorkflowAParsedPositions = async (
  projectId: string
): Promise<{ positions: Position[] }> => {
  console.log('📥 Fetching positions for project:', projectId);
  const { data } = await apiClient.get(
    `/api/workflow/a/positions?project_id=${projectId}`
  );
  return data;
};

export const generateWorkflowATechCard = async (
  projectId: string,
  positionId: string
): Promise<any> => {
  console.log('🛠️ Generating tech card:', { projectId, positionId });
  const { data } = await apiClient.post(`/api/workflow/a/tech-card`, {
    project_id: projectId,
    position_id: positionId,
  });
  return data;
};

export const generateWorkflowATov = async (
  projectId: string,
  positionId: string
): Promise<any> => {
  console.log('⚙️ Generating resource sheet:', { projectId, positionId });
  const { data } = await apiClient.post(`/api/workflow/a/resource-sheet`, {
    project_id: projectId,
    position_id: positionId,
  });
  return data;
};

export const generateWorkflowAMaterials = async (
  projectId: string,
  positionId: string
): Promise<any> => {
  console.log('🧱 Generating materials:', { projectId, positionId });
  const { data } = await apiClient.post(`/api/workflow/a/materials`, {
    project_id: projectId,
    position_id: positionId,
  });
  return data;
};

// ========================================
// WORKFLOW B ARTIFACTS
// ========================================

export const getWorkflowBPositions = async (
  projectId: string
): Promise<{ positions: Position[] }> => {
  console.log('📥 Fetching Workflow B positions for project:', projectId);
  const { data } = await apiClient.get(
    `/api/workflow/b/positions?project_id=${projectId}`
  );
  return data;
};

export const generateWorkflowBTechCard = async (
  projectId: string,
  positionId: string
): Promise<any> => {
  console.log('🛠️ Generating Workflow B tech card:', { projectId, positionId });
  const { data } = await apiClient.post(`/api/workflow/b/tech-card`, {
    project_id: projectId,
    position_id: positionId,
  });
  return data;
};

export const generateWorkflowBTov = async (
  projectId: string,
  positionId: string
): Promise<any> => {
  console.log('⚙️ Generating Workflow B resource sheet:', { projectId, positionId });
  const { data } = await apiClient.post(`/api/workflow/b/resource-sheet`, {
    project_id: projectId,
    position_id: positionId,
  });
  return data;
};

export default apiClient;
