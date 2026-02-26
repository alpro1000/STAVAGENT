/**
 * Portal Auto-Sync Service
 *
 * Automatically syncs Registry projects to Portal PostgreSQL database.
 * When projects are created/imported/modified in Registry, data is pushed
 * to Portal via /api/integration/import-from-registry endpoint.
 *
 * This ensures Registry data is persisted server-side, not just in browser localStorage.
 */

import type { Project, TOVData } from '../types';

const PORTAL_API_URL = import.meta.env.VITE_PORTAL_API_URL || 'https://stav-agent.onrender.com';

// Debounce timers per project
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Track portal project IDs for registry projects
const portalProjectMap = new Map<string, string>();

/**
 * Check if a Registry project already has a portal link
 */
export async function checkPortalLink(registryProjectId: string): Promise<string | null> {
  // Check local cache first
  const cached = portalProjectMap.get(registryProjectId);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${PORTAL_API_URL}/api/integration/registry-status/${registryProjectId}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.linked && data.portal_project_id) {
        portalProjectMap.set(registryProjectId, data.portal_project_id);
        return data.portal_project_id;
      }
    }
  } catch {
    // Silent fail — Portal might be sleeping
  }
  return null;
}

/**
 * Sync a project to Portal DB (immediate)
 */
export async function syncProjectToPortal(
  project: Project,
  tovData: Record<string, TOVData>
): Promise<string | null> {
  try {
    // Check if already linked
    const existingPortalId = project.portalLink?.portalProjectId
      || portalProjectMap.get(project.id)
      || await checkPortalLink(project.id);

    const body = {
      registry_project_id: project.id,
      project_name: project.name,
      portal_project_id: existingPortalId || undefined,
      sheets: project.sheets.map(sheet => ({
        name: sheet.name,
        items: sheet.items.map(item => ({
          id: item.id,
          kod: item.kod,
          popis: item.popis,
          mnozstvi: item.mnozstvi,
          mj: item.mj,
          cenaJednotkova: item.cenaJednotkova,
          cenaCelkem: item.cenaCelkem,
        })),
      })),
      tovData: tovData || {},
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `${PORTAL_API_URL}/api/integration/import-from-registry`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.portal_project_id) {
        portalProjectMap.set(project.id, data.portal_project_id);
        console.log(`[PortalAutoSync] Synced project "${project.name}" → Portal ${data.portal_project_id} (${data.items_imported} items)`);
        return data.portal_project_id;
      }
    } else {
      const errorText = await response.text();
      console.warn(`[PortalAutoSync] Sync failed (${response.status}):`, errorText);
    }
  } catch (error) {
    // Silent fail — don't block UI if Portal is down
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[PortalAutoSync] Sync timeout — Portal may be sleeping');
    } else {
      console.warn('[PortalAutoSync] Sync error:', error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/**
 * Debounced sync — waits 3s after last change before syncing
 * This prevents flooding the API during rapid edits (classification, price edits, etc.)
 */
export function debouncedSyncToPortal(
  project: Project,
  tovData: Record<string, TOVData>
): void {
  const existing = syncTimers.get(project.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    syncTimers.delete(project.id);
    const portalId = await syncProjectToPortal(project, tovData);
    if (portalId && !project.portalLink) {
      // Auto-link if not already linked
      // This is handled by the store wrapper
    }
  }, 3000);

  syncTimers.set(project.id, timer);
}

/**
 * Cancel pending sync for a project (e.g., on delete)
 */
export function cancelSync(projectId: string): void {
  const timer = syncTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    syncTimers.delete(projectId);
  }
  portalProjectMap.delete(projectId);
}

/**
 * Get cached portal project ID
 */
export function getCachedPortalId(registryProjectId: string): string | null {
  return portalProjectMap.get(registryProjectId) || null;
}
