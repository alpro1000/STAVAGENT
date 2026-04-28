/**
 * Portal Monolith Fetch Service
 *
 * Fetches Monolit calculation data (MonolithPayload) from Portal
 * for positions in a linked project.
 *
 * Used on:
 * 1. Project selection change (if linked to Portal)
 * 2. Manual "refresh" of Monolit data
 *
 * Flow: Registry → Portal GET /api/integration/for-registry/:id → monolith_payload
 */

import type { MonolithPayload } from '../types';

import { PORTAL_API_URL } from '../utils/config.js';
import { portalAuthHeader } from './portalAuth';
const FETCH_TIMEOUT = 10_000;

/**
 * Fetch monolith_payload data for all positions in a Portal project.
 * Returns a Map: position_instance_id → MonolithPayload
 */
export async function fetchMonolithData(
  portalProjectId: string
): Promise<Map<string, MonolithPayload>> {
  const result = new Map<string, MonolithPayload>();

  if (!portalProjectId) return result;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    // Auth wiring (PR-1 of cross-subdomain auth fix series). Without
    // it, Monolit data fetch silently 401s and the comparison drawer
    // shows "Portal vrátil chybu" with no Monolit prices to compare.
    const response = await fetch(
      `${PORTAL_API_URL}/api/integration/for-registry/${portalProjectId}`,
      {
        signal: controller.signal,
        credentials: 'include',
        headers: { ...portalAuthHeader() },
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[MonolithFetch] Portal returned ${response.status}`);
      return result;
    }

    const data = await response.json();

    // Extract monolith_payload from all positions
    for (const sheet of data.project?.sheets || []) {
      for (const item of sheet.items || []) {
        if (item.position_instance_id && item.monolith_payload) {
          const payload = typeof item.monolith_payload === 'string'
            ? JSON.parse(item.monolith_payload)
            : item.monolith_payload;
          result.set(item.position_instance_id, payload);
        }
      }
    }

    if (result.size > 0) {
      console.log(`[MonolithFetch] Fetched ${result.size} monolith payloads for project ${portalProjectId}`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[MonolithFetch] Timeout — Portal may be sleeping');
    } else {
      console.warn('[MonolithFetch] Error:', error instanceof Error ? error.message : error);
    }
  }

  return result;
}
