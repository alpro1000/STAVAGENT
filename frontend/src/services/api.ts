/**
 * API service - Axios wrapper for backend communication
 */

import axios from 'axios';
import { Position, HeaderKPI, Bridge, ProjectConfig, SnapshotListItem, Snapshot, OtskpCode, OtskpSearchResult } from '@monolit/shared';

// ============ MonolithProject Types ============
interface MonolithProject {
  project_id: string;
  object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
  project_name?: string;
  object_name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  // Type-specific fields
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  building_area_m2?: number;
  building_floors?: number;
  road_length_km?: number;
  road_width_m?: number;
  parts_count?: number;
  parts?: Part[];
  templates?: PartTemplate[];
}

interface Part {
  part_id: string;
  project_id: string;
  part_name: string;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
  positions_count?: number;
}

interface PartTemplate {
  template_id: string;
  object_type: string;
  part_name: string;
  display_order: number;
  is_default: boolean;
  description?: string;
  created_at: string;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

console.log('[API Service] Initializing with API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add JWT token to all requests
api.interceptors.request.use(request => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }

  console.log(`[API] ${request.method?.toUpperCase()} ${request.url}`, request.params);
  return request;
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds base delay

// Helper: delay with exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry logic for 429 errors + 401 redirect
api.interceptors.response.use(
  response => {
    console.log(`[API] Response ${response.status}:`, response.data);
    return response;
  },
  async error => {
    const config = error.config;
    const status = error.response?.status;

    console.error(`[API] Error:`, status, error.message);

    // Handle 401 Unauthorized - redirect to login
    if (status === 401) {
      console.warn('[API] 401 Unauthorized - redirecting to login');
      localStorage.removeItem('auth_token');

      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Retry on 429 (Too Many Requests) with exponential backoff
    if (status === 429 && config && !config.__retryCount) {
      config.__retryCount = 0;
    }

    if (status === 429 && config && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;
      const retryDelay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);

      console.warn(
        `[API] 429 Rate Limited. Retry ${config.__retryCount}/${MAX_RETRIES} after ${retryDelay}ms`
      );

      await delay(retryDelay);
      return api.request(config);
    }

    return Promise.reject(error);
  }
);

// Bridges
export const bridgesAPI = {
  getAll: async (): Promise<Bridge[]> => {
    const { data } = await api.get('/api/bridges');
    return data;
  },

  getOne: async (bridgeId: string): Promise<Bridge> => {
    const { data } = await api.get(`/api/bridges/${bridgeId}`);
    return data;
  },

  create: async (params: { bridge_id: string; project_name?: string; object_name?: string; span_length_m?: number; deck_width_m?: number; pd_weeks?: number }): Promise<void> => {
    await api.post('/api/bridges', params);
  },

  update: async (bridgeId: string, params: Partial<Bridge>): Promise<void> => {
    await api.put(`/api/bridges/${bridgeId}`, params);
  },

  updateStatus: async (bridgeId: string, status: 'active' | 'completed' | 'archived'): Promise<void> => {
    await api.patch(`/api/bridges/${bridgeId}/status`, { status });
  },

  complete: async (bridgeId: string, params?: { created_by?: string; description?: string }): Promise<{ success: boolean; final_snapshot_id: string; snapshots_deleted: number }> => {
    const { data } = await api.post(`/api/bridges/${bridgeId}/complete`, params || {});
    return data;
  },

  delete: async (bridgeId: string): Promise<void> => {
    await api.delete(`/api/bridges/${bridgeId}`);
  }
};

// MonolithProjects (Universal objects for all construction types)
export const monolithProjectsAPI = {
  getAll: async (type?: string, status?: string): Promise<MonolithProject[]> => {
    const params: any = {};
    if (type) params.type = type;
    if (status) params.status = status;

    const { data } = await api.get('/api/monolith-projects', { params });
    return data;
  },

  getOne: async (projectId: string): Promise<MonolithProject> => {
    const { data } = await api.get(`/api/monolith-projects/${projectId}`);
    return data;
  },

  create: async (params: {
    project_id: string;
    object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
    project_name?: string;
    object_name?: string;
    description?: string;
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    building_area_m2?: number;
    building_floors?: number;
    road_length_km?: number;
    road_width_m?: number;
  }): Promise<MonolithProject> => {
    const { data } = await api.post('/api/monolith-projects', params);
    return data;
  },

  update: async (projectId: string, params: Partial<MonolithProject>): Promise<MonolithProject> => {
    const { data } = await api.put(`/api/monolith-projects/${projectId}`, params);
    return data;
  },

  updateStatus: async (projectId: string, status: 'active' | 'completed' | 'archived'): Promise<void> => {
    await api.patch(`/api/monolith-projects/${projectId}/status`, { status });
  },

  delete: async (projectId: string): Promise<void> => {
    await api.delete(`/api/monolith-projects/${projectId}`);
  },

  searchByType: async (type: string): Promise<MonolithProject[]> => {
    const { data } = await api.get(`/api/monolith-projects/search/${type}`);
    return data;
  }
};

// Part Templates (no auth required)
export const partTemplatesAPI = {
  getAll: async (type?: string): Promise<PartTemplate[]> => {
    const params: any = {};
    if (type) params.type = type;

    const { data } = await api.get('/api/parts/templates', { params });
    return data;
  }
};

// Parts
export const partsAPI = {
  getForProject: async (projectId: string): Promise<Part[]> => {
    const { data } = await api.get(`/api/parts/list/${projectId}`);
    return data;
  },

  create: async (params: {
    project_id: string;
    part_name: string;
  }): Promise<Part> => {
    const { data } = await api.post('/api/parts', params);
    return data;
  },

  update: async (partId: string, params: { part_name?: string }): Promise<Part> => {
    const { data } = await api.put(`/api/parts/${partId}`, params);
    return data;
  },

  delete: async (partId: string): Promise<void> => {
    await api.delete(`/api/parts/${partId}`);
  }
};

// Positions
export const positionsAPI = {
  getForBridge: async (bridgeId: string, includeRFI = true) => {
    const { data } = await api.get('/api/positions', {
      params: { bridge_id: bridgeId, include_rfi: includeRFI }
    });
    return data as {
      positions: Position[];
      header_kpi: HeaderKPI;
      rfi_summary: { count: number; issues: any[] };
    };
  },

  create: async (bridgeId: string, positions: Position[]) => {
    const { data } = await api.post('/api/positions', {
      bridge_id: bridgeId,
      positions
    });
    return data;
  },

  update: async (bridgeId: string, updates: Partial<Position>[]) => {
    const { data } = await api.put('/api/positions', {
      bridge_id: bridgeId,
      updates
    });
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/api/positions/${id}`);
  }
};

// Upload
export const uploadAPI = {
  uploadXLSX: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
};

// Export
export const exportAPI = {
  exportXLSX: async (bridgeId: string): Promise<Blob> => {
    const { data } = await api.get('/api/export/xlsx', {
      params: { bridge_id: bridgeId },
      responseType: 'blob'
    });
    return data;
  },

  saveXLSX: async (bridgeId: string) => {
    const { data } = await api.post('/api/export/save', null, {
      params: { bridge_id: bridgeId }
    });
    return data;
  },

  getExportsList: async () => {
    const { data } = await api.get('/api/export/list');
    return data.exports;
  },

  downloadExport: async (filename: string): Promise<Blob> => {
    const { data } = await api.get(`/api/export/download/${filename}`, {
      responseType: 'blob'
    });
    return data;
  },

  deleteExport: async (filename: string) => {
    const { data } = await api.delete(`/api/export/${filename}`);
    return data;
  },

  exportCSV: async (bridgeId: string, delimiter = ';'): Promise<Blob> => {
    const { data } = await api.get('/api/export/csv', {
      params: { bridge_id: bridgeId, delimiter },
      responseType: 'blob'
    });
    return data;
  }
};

// Config
export const configAPI = {
  get: async (): Promise<ProjectConfig> => {
    const { data } = await api.get('/api/config');
    return data;
  },

  update: async (config: Partial<ProjectConfig>) => {
    const { data } = await api.post('/api/config', config);
    return data;
  }
};

// Mapping
export const mappingAPI = {
  getProfiles: async () => {
    const { data } = await api.get('/api/mapping');
    return data;
  },

  saveProfile: async (profile: any) => {
    const { data } = await api.post('/api/mapping', profile);
    return data;
  },

  applyMapping: async (rawRows: any[], columnMapping: any) => {
    const { data } = await api.post('/api/mapping/apply', {
      raw_rows: rawRows,
      column_mapping: columnMapping
    });
    return data;
  }
};

// Snapshots
export const snapshotsAPI = {
  create: async (params: {
    bridge_id: string;
    positions: Position[];
    header_kpi: HeaderKPI;
    description?: string;
    snapshot_name?: string;
    created_by?: string;
  }) => {
    const { data } = await api.post('/api/snapshots/create', params);
    return data;
  },

  list: async (bridgeId: string): Promise<SnapshotListItem[]> => {
    const { data } = await api.get(`/api/snapshots/${bridgeId}`);
    return data;
  },

  getDetail: async (snapshotId: string): Promise<Snapshot> => {
    const { data } = await api.get(`/api/snapshots/detail/${snapshotId}`);
    return data;
  },

  restore: async (snapshotId: string, comment?: string, created_by?: string) => {
    const { data } = await api.post(`/api/snapshots/${snapshotId}/restore`, {
      comment,
      created_by
    });
    return data;
  },

  unlock: async (snapshotId: string, reason: string, created_by?: string) => {
    const { data } = await api.post(`/api/snapshots/${snapshotId}/unlock`, {
      reason,
      created_by
    });
    return data;
  },

  delete: async (snapshotId: string) => {
    await api.delete(`/api/snapshots/${snapshotId}`);
  },

  getActive: async (bridgeId: string) => {
    const { data } = await api.get(`/api/snapshots/active/${bridgeId}`);
    return data;
  }
};

// OTSKP (pricing catalog)
export const otskpAPI = {
  search: async (query: string, limit = 20): Promise<OtskpSearchResult> => {
    const { data } = await api.get('/api/otskp/search', {
      params: { q: query, limit }
    });
    return data;
  },

  getByCode: async (code: string): Promise<OtskpCode> => {
    const { data } = await api.get(`/api/otskp/${code}`);
    return data;
  },

  getStats: async () => {
    const { data } = await api.get('/api/otskp/stats/summary');
    return data;
  }
};

// Helper exports for convenience
export const createBridge = bridgesAPI.create;
export const deleteBridge = bridgesAPI.delete;
export const createMonolithProject = monolithProjectsAPI.create;
export const deleteMonolithProject = monolithProjectsAPI.delete;

export default api;
