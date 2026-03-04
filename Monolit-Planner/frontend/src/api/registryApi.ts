/**
 * Registry API Client
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface PositionInstance {
  position_instance_id: string;
  file_version_id: string;
  kiosk_type: 'monolit' | 'registry_tov' | 'urs_matcher';
  work_category: string;
  catalog_code: string;
  description: string;
  qty: number;
  unit: string;
  monolith_payload?: Record<string, unknown>;
  tov_payload?: Record<string, unknown>;
  urs_payload?: Record<string, unknown>;
  object_name?: string;
  project_name?: string;
}

export async function getProjectPositions(projectId: string): Promise<PositionInstance[]> {
  const response = await fetch(`${API_BASE}/api/registry/projects/${projectId}/positions`);
  if (!response.ok) throw new Error('Failed to fetch positions');
  const data = await response.json();
  return data.positions || [];
}

export async function getPositionById(positionId: string): Promise<PositionInstance> {
  const response = await fetch(`${API_BASE}/api/registry/positions/${positionId}`);
  if (!response.ok) throw new Error('Failed to fetch position');
  return (await response.json()).position;
}
