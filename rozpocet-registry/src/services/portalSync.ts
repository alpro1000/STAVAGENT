/**
 * Portal Sync Service
 * 
 * Handles loading projects from Portal and syncing TOV data back.
 */

const PORTAL_API_URL = import.meta.env.VITE_PORTAL_API_URL || 'https://stavagent-portal-backend.onrender.com';

export interface PortalProject {
  id: string;
  name: string;
  sheets: Array<{
    name: string;
    items: any[];
  }>;
}

/**
 * Load project from Portal by ID
 */
export async function loadProjectFromPortal(portalProjectId: string): Promise<PortalProject> {
  const response = await fetch(
    `${PORTAL_API_URL}/api/integration/for-registry/${portalProjectId}`,
    {
      credentials: 'include'
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to load project');
  }

  return data.project;
}

/**
 * Sync TOV data back to Portal
 */
export async function syncTOVToPortal(
  portalProjectId: string,
  updates: Array<{ position_id: string; tovData: any }>
): Promise<void> {
  const response = await fetch(
    `${PORTAL_API_URL}/api/integration/sync-tov`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        portal_project_id: portalProjectId,
        updates
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to sync TOV: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to sync TOV');
  }
}

/**
 * Setup auto-sync for TOV changes (debounced)
 */
export function setupAutoSync(
  portalProjectId: string,
  getTOVUpdates: () => Array<{ position_id: string; tovData: any }>
) {
  let timeoutId: NodeJS.Timeout;

  const debouncedSync = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      try {
        const updates = getTOVUpdates();
        if (updates.length > 0) {
          await syncTOVToPortal(portalProjectId, updates);
          console.log(`[PortalSync] Synced ${updates.length} TOV updates`);
        }
      } catch (error) {
        console.error('[PortalSync] Auto-sync failed:', error);
      }
    }, 2000);
  };

  return debouncedSync;
}
