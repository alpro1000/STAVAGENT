import axios from 'axios';

const DEFAULT_API_URL = 'https://concrete-agent.onrender.com';
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const normalizeChat = (data) => ({
  response: data?.response ?? data?.message ?? '',
  artifact: data?.artifact ?? null,
});

// Projects
export const getProjects = () =>
  apiClient.get('/api/projects').catch(() => ({ data: { projects: [] } }));

export const getProject = (projectId) =>
  apiClient.get(`/api/projects/${projectId}`);

export const createProject = (name) =>
  apiClient.post('/api/projects', { name });

// Upload
export const uploadFiles = (projectId, files, onProgress) => {
  console.log('📤 Uploading files for project:', projectId);
  console.log('📂 Files:', files.map(f => f.name));

  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  return apiClient.post(`/api/upload?project_id=${projectId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      const percent = Math.round((event.loaded * 100) / event.total);
      onProgress(percent);
    },
  }).then(response => {
    console.log('✅ Upload response:', response.data);
    return response;
  });
};

// Chat
export const sendChatMessage = async (projectId, message) => {
  const { data } = await apiClient.post('/api/chat/message', {
    project_id: projectId,
    message,
    include_history: true,
  });

  return normalizeChat(data);
};

// Actions (buttons)
export const triggerAction = async ({
  projectId,
  action,
  options = undefined,
  positionId = undefined,
  freeFormQuery = undefined,
}) => {
  const payload = {
    project_id: projectId,
    action,
  };

  if (options) {
    payload.options = options;
  }

  if (positionId) {
    payload.position_id = positionId;
  }

  if (freeFormQuery) {
    payload.free_form_query = freeFormQuery;
  }

  const { data } = await apiClient.post('/api/chat/action', payload);
  return normalizeChat(data);
};

// Results
export const getProjectResults = (projectId) =>
  apiClient.get(`/api/projects/${projectId}/results`);

export const getProjectStatus = (projectId) =>
  apiClient.get(`/api/projects/${projectId}/status`);

export const getProjectFiles = (projectId) =>
  apiClient.get(`/api/projects/${projectId}/files`);

// Workflow A artifacts (NEW body-based endpoints)
export const getWorkflowAParsedPositions = (projectId) => {
  console.log('📥 Fetching positions for project:', projectId);
  return apiClient.get(`/api/workflow/a/positions?project_id=${projectId}`);
};

export const generateWorkflowATechCard = (projectId, positionId) => {
  console.log('🛠️ Generating tech card:', { projectId, positionId });
  return apiClient.post(`/api/workflow/a/tech-card`, {
    project_id: projectId,
    position_id: positionId,
  });
};

export const generateWorkflowATov = (projectId, positionId) => {
  console.log('⚙️ Generating resource sheet:', { projectId, positionId });
  return apiClient.post(`/api/workflow/a/resource-sheet`, {
    project_id: projectId,
    position_id: positionId,
  });
};

export const generateWorkflowAMaterials = (projectId, positionId) => {
  console.log('🧱 Generating materials:', { projectId, positionId });
  return apiClient.post(`/api/workflow/a/materials`, {
    project_id: projectId,
    position_id: positionId,
  });
};

// Workflow B artifacts (NEW body-based endpoints)
export const getWorkflowBPositions = (projectId) => {
  console.log('📥 Fetching Workflow B positions for project:', projectId);
  return apiClient.get(`/api/workflow/b/positions?project_id=${projectId}`);
};

export const generateWorkflowBTechCard = (projectId, positionId) => {
  console.log('🛠️ Generating Workflow B tech card:', { projectId, positionId });
  return apiClient.post(`/api/workflow/b/tech-card`, {
    project_id: projectId,
    position_id: positionId,
  });
};

export const generateWorkflowBTov = (projectId, positionId) => {
  console.log('⚙️ Generating Workflow B resource sheet:', { projectId, positionId });
  return apiClient.post(`/api/workflow/b/resource-sheet`, {
    project_id: projectId,
    position_id: positionId,
  });
};

export default apiClient;
