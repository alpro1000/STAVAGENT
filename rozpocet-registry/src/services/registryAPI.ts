/**
 * Registry Backend API Service
 * Replaces localStorage with PostgreSQL backend
 */

const API_URL = import.meta.env.VITE_REGISTRY_API_URL || 'https://rozpocet-registry-backend.onrender.com';
const USER_ID = 1; // Default user for now (no auth)

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
    const res = await fetch(`${API_URL}/api/registry/projects?user_id=${USER_ID}`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    const data = await res.json();
    return data.projects || [];
  }

  async createProject(name: string, portalProjectId?: string): Promise<RegistryProject> {
    const res = await fetch(`${API_URL}/api/registry/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: name,
        portal_project_id: portalProjectId,
        user_id: USER_ID,
      }),
    });
    if (!res.ok) throw new Error('Failed to create project');
    const data = await res.json();
    return data.project;
  }

  async getProject(projectId: string): Promise<RegistryProject> {
    const res = await fetch(`${API_URL}/api/registry/projects/${projectId}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    const data = await res.json();
    return data.project;
  }

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/registry/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
  }

  // ============ SHEETS ============

  async getSheets(projectId: string): Promise<RegistrySheet[]> {
    const res = await fetch(`${API_URL}/api/registry/projects/${projectId}/sheets`);
    if (!res.ok) throw new Error('Failed to fetch sheets');
    const data = await res.json();
    return data.sheets || [];
  }

  async createSheet(projectId: string, name: string, order: number = 0): Promise<RegistrySheet> {
    const res = await fetch(`${API_URL}/api/registry/projects/${projectId}/sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_name: name,
        sheet_order: order,
      }),
    });
    if (!res.ok) throw new Error('Failed to create sheet');
    const data = await res.json();
    return data.sheet;
  }

  async deleteSheet(sheetId: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/registry/sheets/${sheetId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete sheet');
  }

  // ============ ITEMS ============

  async getItems(sheetId: string): Promise<RegistryItem[]> {
    const res = await fetch(`${API_URL}/api/registry/sheets/${sheetId}/items`);
    if (!res.ok) throw new Error('Failed to fetch items');
    const data = await res.json();
    return data.items || [];
  }

  async createItem(sheetId: string, item: Partial<RegistryItem>, tovData?: TOVData): Promise<RegistryItem> {
    const res = await fetch(`${API_URL}/api/registry/sheets/${sheetId}/items`, {
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
    const res = await fetch(`${API_URL}/api/registry/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update item');
    const data = await res.json();
    return data.item;
  }

  async deleteItem(itemId: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/registry/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete item');
  }

  async updateItemTOV(itemId: string, tovData: TOVData): Promise<void> {
    const res = await fetch(`${API_URL}/api/registry/items/${itemId}/tov`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tov_data: tovData }),
    });
    if (!res.ok) throw new Error('Failed to update TOV data');
  }

  // ============ BULK OPERATIONS ============

  async bulkCreateItems(sheetId: string, items: Array<Partial<RegistryItem> & { tov_data?: TOVData }>): Promise<void> {
    // Create items one by one (backend doesn't have bulk endpoint yet)
    for (const item of items) {
      await this.createItem(sheetId, item, item.tov_data);
    }
  }
}

export const registryAPI = new RegistryAPI();
