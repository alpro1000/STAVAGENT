/**
 * Portal-open dedupe: decide whether a project opened from Portal
 * («Otevřít» on a linked kiosk) already exists locally, so we re-select
 * it instead of re-importing a flattened copy from the Portal echo.
 *
 * Why this matters: Portal's `/api/integration/for-registry/` payload
 * carries only kod/popis/ceny/skupina/row_role — parentItemId,
 * popisDetail, sectionId and _rawCells never make the trip, so a
 * re-import permanently flattens the row hierarchy. The ONLY correct
 * outcome for an already-known project is "select existing".
 *
 * Match priority:
 *  1. `registryProjectId` — Portal sends the ORIGINAL Registry project id
 *     in the `?project_id=` URL param (kiosk_links.kiosk_project_id).
 *     Strongest signal; survives even when the local copy has no
 *     portalLink (e.g. it was restored from the registry backend where
 *     portal_project_id was still NULL).
 *  2. `portalLink.portalProjectId` — project was linked earlier.
 *  3. `portalEchoProjectId` — the id under which a PREVIOUS buggy
 *     re-import stored the duplicate (`portalProject.id` from the echo).
 */
import type { Project } from '../types';

export interface PortalImportKeys {
  /** `?project_id=` URL param — original Registry project id from kiosk_links. */
  registryProjectId?: string | null;
  /** `?portal_project=` URL param — portal_project_id. */
  portalProjectId: string;
  /** `project.id` from the /for-registry/ response body (equals portal_project_id today). */
  portalEchoProjectId?: string | null;
}

export function findExistingProjectForPortalImport(
  projects: Project[],
  keys: PortalImportKeys,
): Project | undefined {
  const { registryProjectId, portalProjectId, portalEchoProjectId } = keys;

  if (registryProjectId) {
    const byRegistryId = projects.find((p) => p.id === registryProjectId);
    if (byRegistryId) return byRegistryId;
  }

  const byPortalLink = projects.find(
    (p) => p.portalLink?.portalProjectId === portalProjectId,
  );
  if (byPortalLink) return byPortalLink;

  if (portalEchoProjectId) {
    const byEchoId = projects.find((p) => p.id === portalEchoProjectId);
    if (byEchoId) return byEchoId;
  }

  return undefined;
}

/** Allowed rowRole values on ParsedItem (see types/item.ts). */
const ROW_ROLES = new Set(['main', 'subordinate', 'section', 'unknown']);

/**
 * Normalise the row role coming from Portal's for-registry echo, which
 * uses snake_case `row_role` (and defaults to 'unknown'). Returns a valid
 * ParsedItem['rowRole'] or undefined so the UI proximity fallback applies.
 */
export function normalizePortalRowRole(
  value: unknown,
): 'main' | 'subordinate' | 'section' | 'unknown' | undefined {
  return typeof value === 'string' && ROW_ROLES.has(value)
    ? (value as 'main' | 'subordinate' | 'section' | 'unknown')
    : undefined;
}
