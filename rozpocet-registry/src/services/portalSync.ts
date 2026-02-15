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

export interface SyncStatus {
  syncing: boolean;
  lastSync: Date | null;
  error: string | null;
}

let syncTimeout: NodeJS.Timeout | null = null;
let syncStatus: SyncStatus = {
  syncing: false,
  lastSync: null,
  error: null
};

const statusListeners: Array<(status: SyncStatus) => void> = [];

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback: (status: SyncStatus) => void) {
  statusListeners.push(callback);
  return () => {
    const index = statusListeners.indexOf(callback);
    if (index > -1) statusListeners.splice(index, 1);
  };
}

function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  statusListeners.forEach(cb => cb(syncStatus));
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
  updateSyncStatus({ syncing: true, error: null });

  try {
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

    updateSyncStatus({ syncing: false, lastSync: new Date(), error: null });
    console.log(`[PortalSync] Synced ${updates.length} positions`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateSyncStatus({ syncing: false, error: errorMsg });
    throw error;
  }
}

/**
 * Setup auto-sync for TOV changes (debounced 2s)
 */
export function setupAutoSync(
  portalProjectId: string,
  getTOVUpdates: () => Array<{ position_id: string; tovData: any }>
) {
  return () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    
    syncTimeout = setTimeout(async () => {
      try {
        const updates = getTOVUpdates();
        if (updates.length > 0) {
          await syncTOVToPortal(portalProjectId, updates);
        }
      } catch (error) {
        console.error('[PortalSync] Auto-sync failed:', error);
      }
    }, 2000);
  };
}

/**
 * Manual sync (immediate)
 */
export async function syncNow(
  portalProjectId: string,
  getTOVUpdates: () => Array<{ position_id: string; tovData: any }>
): Promise<void> {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  const updates = getTOVUpdates();
  if (updates.length === 0) {
    throw new Error('No changes to sync');
  }

  await syncTOVToPortal(portalProjectId, updates);
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}
