/**
 * Registry Backend API Service
 * Replaces localStorage with PostgreSQL backend
 */

import { REGISTRY_API_URL } from '../utils/config.js';
import { portalAuthHeader } from './portalAuth';

const API_URL = REGISTRY_API_URL;
const FETCH_TIMEOUT = 30000; // 30s timeout — was 8 s but Cloud Run cold-starts on the
                             // registry backend regularly exceeded that, causing user-visible
                             // bugs (DELETEs that never reach the backend → projects re-appear
                             // on next loadFromBackend; bulkCreateItems on 605-item sheets
                             // aborting mid-flight). The backend itself caps requests well below
                             // 30 s, so this just adds slack for cold starts.

/** Check if the backend is reachable (cached for 60s) */
let _backendAvailable: boolean | null = null;
let _lastCheck = 0;

export async function isBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_backendAvailable !== null && now - _lastCheck < 60000) return _backendAvailable;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    // Support both old format (status=ok) and new format (database=connected)
    _backendAvailable = data.status === 'ok' || data.database === 'connected';
  } catch {
    _backendAvailable = false;
  }
  _lastCheck = now;
  return _backendAvailable;
}

/** Reset backend availability cache (e.g., after user action) */
export function resetBackendCache(): void {
  _backendAvailable = null;
  _lastCheck = 0;
}

/** Fetch with timeout + Portal JWT.
 *
 * The registry backend requires a Bearer token on every /api/registry
 * route (owner_id is derived from the JWT — isolation hotfix 2026-05).
 * Attaching it HERE, in the single shared fetch wrapper, guarantees no
 * call site can forget it — the exact bug that left the PostgreSQL sync
 * silently 401-ing while all project data lived only in IndexedDB. */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...portalAuthHeader() },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export interface RegistryProject {
  project_id: string;
  project_name: string;
  owner_id: number;
  portal_project_id?: string;
  created_at: string;
  updated_at: string;
  sheets_count?: number;
  items_count?: number;
}

export interface RegistrySheet {
  sheet_id: string;
  project_id: string;
  sheet_name: string;
  sheet_order: number;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

export interface RegistryItem {
  item_id: string;
  sheet_id: string;
  kod: string;
  popis: string;
  mnozstvi: number;
  mj: string;
  cena_jednotkova?: number;
  cena_celkem?: number;
  item_order: number;
  skupina?: string;
  /**
   * JSON-encoded classifier output (rowRole, parentItemId, sectionId,
   * popisDetail, _rawCells, originalTyp, classification confidence/source,
   * source_format/row_index, por, cenovaSoustava, varianta).
   * Backend column is `sync_metadata TEXT` and round-trips opaquely — only
   * the frontend codec interprets it. Optional both ways: legacy items
   * pre-classifier-rewrite carry `null` and continue to render as flat lists.
   * See services/classificationCodec.ts.
   */
  sync_metadata?: string | object | null;
  created_at: string;
  updated_at: string;
  tov_data?: any[];
}

export interface TOVData {
  labor?: any[];
  machinery?: any[];
  materials?: any[];
}

class RegistryAPI {
  // ============ PROJECTS ============
  
  async getProjects(): Promise<RegistryProject[]> {
    // owner comes from the verified JWT — the backend ignores user_id params
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    const data = await res.json();
    return data.projects || [];
  }

  async createProject(name: string, portalProjectId?: string, projectId?: string): Promise<RegistryProject> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        project_name: name,
        portal_project_id: portalProjectId,
      }),
    });
    if (!res.ok) throw new Error('Failed to create project');
    const data = await res.json();
    return data.project;
  }

  async getProject(projectId: string): Promise<RegistryProject> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects/${projectId}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    const data = await res.json();
    return data.project;
  }

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
  }

  // ============ SHEETS ============

  async getSheets(projectId: string): Promise<RegistrySheet[]> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects/${projectId}/sheets`);
    if (!res.ok) throw new Error('Failed to fetch sheets');
    const data = await res.json();
    return data.sheets || [];
  }

  async createSheet(projectId: string, name: string, order: number = 0, sheetId?: string): Promise<RegistrySheet> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/projects/${projectId}/sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: sheetId,
        sheet_name: name,
        sheet_order: order,
      }),
    });
    if (!res.ok) throw new Error('Failed to create sheet');
    const data = await res.json();
    return data.sheet;
  }

  async deleteSheet(sheetId: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/sheets/${sheetId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete sheet');
  }

  // ============ ITEMS ============

  async getItems(sheetId: string): Promise<RegistryItem[]> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/sheets/${sheetId}/items`);
    if (!res.ok) throw new Error('Failed to fetch items');
    const data = await res.json();
    return data.items || [];
  }

  async createItem(sheetId: string, item: Partial<RegistryItem>, tovData?: TOVData): Promise<RegistryItem> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/sheets/${sheetId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        tov_data: tovData,
      }),
    });
    if (!res.ok) throw new Error('Failed to create item');
    const data = await res.json();
    return data.item;
  }

  async updateItem(itemId: string, updates: Partial<RegistryItem>): Promise<RegistryItem> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update item');
    const data = await res.json();
    return data.item;
  }

  async deleteItem(itemId: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete item');
  }

  async updateItemTOV(itemId: string, tovData: TOVData): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/items/${itemId}/tov`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tov_data: tovData }),
    });
    if (!res.ok) throw new Error('Failed to update TOV data');
  }

  // ============ BULK OPERATIONS ============

  async bulkCreateItems(sheetId: string, items: Array<Partial<RegistryItem> & { tov_data?: TOVData }>): Promise<number> {
    const res = await fetchWithTimeout(`${API_URL}/api/registry/sheets/${sheetId}/items/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Failed to bulk create items');
    const data = await res.json();
    return data.created || 0;
  }
}

export const registryAPI = new RegistryAPI();
