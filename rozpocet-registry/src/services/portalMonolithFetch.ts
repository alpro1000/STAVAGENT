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

export interface MonolithFetchResult {
  /** position_instance_id → MonolithPayload for every linked position. */
  payloads: Map<string, MonolithPayload>;
  /**
   * true when Portal has no such project for this user (HTTP 404) — a DEAD
   * link (project deleted / never existed / owned by someone else). This does
   * NOT recover by retrying, so pollers must stop hitting it instead of
   * spamming `/for-registry/:id` 404 every 30 s. A cold-start timeout or 503
   * is NOT a dead link, so those keep portalMissing=false.
   */
  portalMissing: boolean;
}

/**
 * Fetch monolith_payload data for all positions in a Portal project.
 */
export async function fetchMonolithData(
  portalProjectId: string
): Promise<MonolithFetchResult> {
  const payloads = new Map<string, MonolithPayload>();

  if (!portalProjectId) return { payloads, portalMissing: false };

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
      return { payloads, portalMissing: response.status === 404 };
    }

    const data = await response.json();

    // Extract monolith_payload from all positions
    for (const sheet of data.project?.sheets || []) {
      for (const item of sheet.items || []) {
        if (item.position_instance_id && item.monolith_payload) {
          const payload = typeof item.monolith_payload === 'string'
            ? JSON.parse(item.monolith_payload)
            : item.monolith_payload;
          payloads.set(item.position_instance_id, payload);
        }
      }
    }

    if (payloads.size > 0) {
      console.log(`[MonolithFetch] Fetched ${payloads.size} monolith payloads for project ${portalProjectId}`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[MonolithFetch] Timeout — Portal may be sleeping');
    } else {
      console.warn('[MonolithFetch] Error:', error instanceof Error ? error.message : error);
    }
  }

  return { payloads, portalMissing: false };
}
