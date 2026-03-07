/**
 * API service - Axios wrapper for backend communication
 */

import axios from 'axios';
import { Position, HeaderKPI, Bridge, ProjectConfig, SnapshotListItem, Snapshot, OtskpCode, OtskpSearchResult } from '@stavagent/portal-shared';

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

export const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

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

// Bridges (now maps to MonolithProjects for universal object support)
export const bridgesAPI = {
  getAll: async (): Promise<Bridge[]> => {
    const { data } = await api.get('/api/monolith-projects');
    return data;
  },

  getOne: async (bridgeId: string): Promise<Bridge> => {
    const { data } = await api.get(`/api/monolith-projects/${bridgeId}`);
    return data;
  },

  create: async (params: { bridge_id: string; project_name?: string; object_name?: string; span_length_m?: number; deck_width_m?: number; pd_weeks?: number }): Promise<void> => {
    // Map bridge_id to project_id and bridge params to monolith params
    const monolithParams = {
      project_id: params.bridge_id,
      object_type: 'bridge',
      project_name: params.project_name || '',
      object_name: params.object_name || '',
      span_length_m: params.span_length_m,
      deck_width_m: params.deck_width_m,
      pd_weeks: params.pd_weeks
    };
    await api.post('/api/monolith-projects', monolithParams);
  },

  update: async (bridgeId: string, params: Partial<Bridge>): Promise<void> => {
    await api.put(`/api/monolith-projects/${bridgeId}`, params);
  },

  updateStatus: async (bridgeId: string, status: 'active' | 'completed' | 'archived'): Promise<void> => {
    // Use PUT to update status (no dedicated PATCH endpoint)
    await api.put(`/api/monolith-projects/${bridgeId}`, { status });
  },

  complete: async (bridgeId: string, params?: { created_by?: string; description?: string }): Promise<{ success: boolean; final_snapshot_id: string; snapshots_deleted: number }> => {
    // Complete is now handled through updateStatus + snapshot system
    // For now, just update status to completed
    await api.put(`/api/monolith-projects/${bridgeId}`, { status: 'completed', ...params });
    return { success: true, final_snapshot_id: '', snapshots_deleted: 0 };
  },

  delete: async (bridgeId: string): Promise<void> => {
    await api.delete(`/api/monolith-projects/${bridgeId}`);
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

// Auth API (email verification, login, etc.)
export const authAPI = {
  verify: async (token: string): Promise<any> => {
    const { data } = await api.post('/api/auth/verify', { token });
    return data;
  },
  getMe: async (): Promise<any> => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<any> => {
    const { data } = await api.post('/api/auth/change-password', { currentPassword, newPassword });
    return data;
  },
  forgotPassword: async (email: string): Promise<any> => {
    const { data } = await api.post('/api/auth/forgot-password', { email });
    return data;
  },
  resetPassword: async (token: string, newPassword: string): Promise<any> => {
    const { data } = await api.post('/api/auth/reset-password', { token, newPassword });
    return data;
  },
  createAdminIfFirst: async (email: string, password: string, name: string): Promise<any> => {
    const { data } = await api.post('/api/auth/create-admin-if-first', { email, password, name });
    return data;
  }
};

// Admin API
export const adminAPI = {
  getUsers: async (): Promise<any> => {
    const { data } = await api.get('/api/admin/users');
    return data;
  },
  getUser: async (userId: number): Promise<any> => {
    const { data } = await api.get(`/api/admin/users/${userId}`);
    return data;
  },
  updateUser: async (userId: number, updates: any): Promise<any> => {
    const { data } = await api.put(`/api/admin/users/${userId}`, updates);
    return data;
  },
  deleteUser: async (userId: number): Promise<any> => {
    const { data } = await api.delete(`/api/admin/users/${userId}`);
    return data;
  },
  getAuditLogs: async (filters?: any): Promise<any> => {
    const { data } = await api.get('/api/admin/audit-logs', { params: filters });
    return data;
  },
  getAuditStats: async (): Promise<any> => {
    const { data } = await api.get('/api/admin/audit-logs/stats');
    return data;
  },
  getStats: async (): Promise<any> => {
    const { data } = await api.get('/api/admin/stats');
    return data;
  }
};

// ============ Workflow C Types ============
export interface WorkflowCPosition {
  code?: string;
  description: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
}

export interface WorkflowCRequest {
  project_id: string;
  project_name: string;
  positions: WorkflowCPosition[];
  generate_summary?: boolean;
  use_parallel?: boolean;
  language?: 'cs' | 'en' | 'sk';
}

export interface WorkflowCResult {
  success: boolean;
  project_id: string;
  project_name: string;
  positions_count: number;
  audit_classification: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';
  audit_confidence: number;
  critical_issues: string[];
  warnings: string[];
  summary?: {
    executive_summary?: string;
    key_findings?: string[];
    recommendations?: string[];
  };
  total_duration_seconds: number;
  stage_durations: Record<string, number>;
  multi_role_speedup?: number;
}

export interface WorkflowCProgress {
  project_id: string;
  current_stage: string;
  progress_percentage: number;
  stages_completed: string[];
  duration_seconds: number;
  error?: string;
}

// Workflow C API (concrete-agent CORE)
const CORE_API_URL = (import.meta as any).env?.VITE_CORE_API_URL || 'https://concrete-agent.onrender.com';

export const workflowCAPI = {
  /**
   * Execute Workflow C with pre-parsed positions
   */
  execute: async (request: WorkflowCRequest): Promise<WorkflowCResult> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: request.project_id,
        project_name: request.project_name,
        positions: request.positions,
        generate_summary: request.generate_summary ?? true,
        use_parallel: request.use_parallel ?? true,
        language: request.language ?? 'cs',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Workflow C failed: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Upload file and execute Workflow C
   */
  uploadAndExecute: async (
    file: File,
    projectId: string,
    projectName: string,
    options?: {
      generate_summary?: boolean;
      use_parallel?: boolean;
      language?: 'cs' | 'en' | 'sk';
    }
  ): Promise<WorkflowCResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('project_name', projectName);
    formData.append('generate_summary', String(options?.generate_summary ?? true));
    formData.append('use_parallel', String(options?.use_parallel ?? true));
    formData.append('language', options?.language ?? 'cs');

    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Workflow C upload failed: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Execute Workflow C asynchronously (returns immediately)
   */
  executeAsync: async (request: WorkflowCRequest): Promise<{ project_id: string; status: string; status_url: string; result_url: string }> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/execute-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: request.project_id,
        project_name: request.project_name,
        positions: request.positions,
        generate_summary: request.generate_summary ?? true,
        use_parallel: request.use_parallel ?? true,
        language: request.language ?? 'cs',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Workflow C async failed: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get workflow progress
   */
  getProgress: async (projectId: string): Promise<WorkflowCProgress> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/${projectId}/status`);

    if (!response.ok) {
      throw new Error(`Failed to get progress: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get workflow result
   */
  getResult: async (projectId: string): Promise<WorkflowCResult> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/${projectId}/result`);

    if (!response.ok) {
      if (response.status === 202) {
        throw new Error('Workflow still in progress');
      }
      throw new Error(`Failed to get result: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Health check
   */
  health: async (): Promise<{ status: string; version: string }> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/workflow/c/health`);
    return response.json();
  },
};

// ============ Price Parser API (concrete-agent CORE) ============

export interface PriceListSource {
  company: string | null;
  provozovna: string | null;
  valid_from: string | null;
  valid_to: string | null;
  currency: string;
  vat_rate: number;
}

export interface BetonItem {
  name: string;
  exposure_class: string | null;
  price_per_m3: number | null;
  price_per_m3_vat: number | null;
  notes: string | null;
}

export interface DopravaZona {
  km_from: number;
  km_to: number;
  price_per_m3: number;
}

export interface Doprava {
  min_objem_m3: number | null;
  volny_cas_min: number | null;
  cekani_per_15min: number | null;
  zony: DopravaZona[];
  pristaveni_ks: number | null;
}

export interface CerpadloItem {
  type: string;
  pristaveni: number | null;
  hodinova_sazba: number | null;
  cena_per_m3: number | null;
  km_sazba: number | null;
}

export interface PriplatekCasovy {
  nazev: string;
  typ: string;
  hodnota: number;
}

export interface PriplatekZimni {
  teplota_from: number;
  teplota_to: number;
  price_per_m3: number;
}

export interface PriplatekTechnologicky {
  nazev: string;
  typ: string;
  hodnota: number;
}

export interface Priplatky {
  casove: PriplatekCasovy[];
  zimni: PriplatekZimni[];
  technologicke: PriplatekTechnologicky[];
}

export interface LaboratorItem {
  nazev: string;
  jednotka: string | null;
  cena: number | null;
}

export interface PriceListResult {
  source: PriceListSource;
  betony: BetonItem[];
  malty_potere: Array<{ name: string; type: string | null; price_per_m3: number | null; price_per_m3_vat: number | null }>;
  doprava: Doprava;
  cerpadla: CerpadloItem[];
  priplatky: Priplatky;
  laborator: LaboratorItem[];
  ostatni: string | null;
}

export const priceParserAPI = {
  /**
   * Parse a single PDF price list
   */
  parse: async (file: File): Promise<PriceListResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${CORE_API_URL}/api/v1/price-parser/parse`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Price parser failed: ${response.status}`);
    }

    return response.json();
  },
};

// ============ Betonárny Discovery Types ============

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface PlantContact {
  phone: string | null;
  email: string | null;
  website: string | null;
  price_list_url: string | null;
}

export interface ConcretePlant {
  id: string;
  name: string;
  company: string | null;
  address: string | null;
  location: GeoPoint;
  distance_km: number | null;
  source: 'osm' | 'betonserver' | 'manual';
  tags: Record<string, string>;
  contact: PlantContact;
  has_price_list: boolean;
  price_range_note: string | null;
}

export interface PlantSearchResult {
  plants: ConcretePlant[];
  total: number;
  sources_used: string[];
}

export interface ScrapeResult {
  plants_found: number;
  plants_new: number;
  plants_updated: number;
  errors: string[];
}

export const betonarnyAPI = {
  /**
   * Search for concrete plants near a GPS location
   */
  search: async (lat: number, lon: number, radius_km = 50, include_quarries = false): Promise<PlantSearchResult> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/betonarny/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, radius_km, include_quarries }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Search failed' }));
      throw new Error(error.detail || `Search failed: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Admin: scrape BetonServer.cz for new plant listings
   */
  scrape: async (region?: string, max_pages = 5): Promise<ScrapeResult> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/betonarny/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, max_pages }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Scrape failed' }));
      throw new Error(error.detail || `Scrape failed: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Get cached plants from previous scraping
   */
  getCache: async (): Promise<{ plants: ConcretePlant[]; total: number }> => {
    const response = await fetch(`${CORE_API_URL}/api/v1/betonarny/cache`);
    if (!response.ok) throw new Error('Failed to load cache');
    return response.json();
  },
};

// Helper exports for convenience
export const createBridge = bridgesAPI.create;
export const deleteBridge = bridgesAPI.delete;
export const createMonolithProject = monolithProjectsAPI.create;
export const deleteMonolithProject = monolithProjectsAPI.delete;

export default api;
