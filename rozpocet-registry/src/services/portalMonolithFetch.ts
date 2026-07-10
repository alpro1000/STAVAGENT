/**
 * Portal Monolith Fetch Service — the single GUARDED seam for reading
 * MonolithPayloads from Portal (`GET /api/integration/for-registry/:id`).
 *
 * ALL consumers call fetchMonolithData — registryStore.fetchAndMergeMonolithData
 * (TOV modal / project select) and monolithPolling.doPoll (comparison drawer) —
 * so the guards live HERE, one source of truth instead of per-caller copies
 * that disagree (post-#1475 review: the store's dead-Set went silent while the
 * poller kept hammering the same dead link, and vice versa).
 *
 * Guard semantics:
 * - IN-FLIGHT DEDUPE: concurrent callers share one request (double-click on a
 *   TOV button; poller restart racing a modal open).
 * - FRESH-TTL (3 s): calls completing within the window reuse the last
 *   successful result — kills the immediate double-fetch when a merge-triggered
 *   `projects` identity change restarts the poller milliseconds after a
 *   TOV-open fetch. Deliberately SHORT: a human recalculate-in-Monolit →
 *   reopen-TOV loop takes longer than 3 s, so freshness after «Aplikovat» is
 *   preserved (the 15 s per-caller cooldown this replaces served stale
 *   prefills to fast users).
 * - DEAD-LINK TTL (5 min): a 404 (project deleted on Portal — or owner
 *   mismatch, which the owner-scoped endpoint also reports as 404)
 *   short-circuits ALL callers for 5 minutes, then allows one probe again.
 *   Deliberately NOT permanent: a wrong-account 404 must not kill the link for
 *   the whole browser session (re-login recovers within minutes), while a
 *   genuinely deleted project costs at most one request per 5 minutes instead
 *   of one per poll tick / TOV click.
 * - Timeouts / 5xx / network errors stamp NOTHING — a cold-start failure must
 *   not open a blackout window; the next caller retries immediately.
 *
 * `clearMonolithFetchState(portalProjectId)` drops the marks instantly — call
 * it wherever a portalLink is (re)installed.
 */

import type { MonolithPayload } from '../types';

import { PORTAL_API_URL } from '../utils/config.js';
import { portalAuthHeader } from './portalAuth';

const FETCH_TIMEOUT = 10_000;
const FRESH_TTL_MS = 3_000;
const DEAD_LINK_TTL_MS = 5 * 60_000;

const inFlight = new Map<string, Promise<MonolithFetchResult>>();
const lastResult = new Map<string, { at: number; result: MonolithFetchResult }>();
const deadUntil = new Map<string, number>();

export interface MonolithFetchResult {
  /** position_instance_id → MonolithPayload for every linked position. */
  payloads: Map<string, MonolithPayload>;
  /**
   * true when Portal has no such project for this user (HTTP 404) — a DEAD
   * link (project deleted / never existed / owned by someone else). This does
   * NOT recover by retrying quickly, so all callers are short-circuited for
   * DEAD_LINK_TTL_MS instead of hitting `/for-registry/:id` on every poll
   * tick or TOV-open. A cold-start timeout or 503 is NOT a dead link, so
   * those keep portalMissing=false.
   */
  portalMissing: boolean;
}

/**
 * Forget everything cached for a portal link. Call when a portalLink is
 * (re)installed so the fresh link gets an immediate, unguarded chance.
 */
export function clearMonolithFetchState(portalProjectId: string): void {
  lastResult.delete(portalProjectId);
  deadUntil.delete(portalProjectId);
}

/**
 * Fetch monolith_payload data for all positions in a Portal project.
 * Guarded — see the module doc for the dedupe / TTL semantics.
 */
export function fetchMonolithData(
  portalProjectId: string
): Promise<MonolithFetchResult> {
  if (!portalProjectId) {
    return Promise.resolve({ payloads: new Map(), portalMissing: false });
  }

  const dead = deadUntil.get(portalProjectId);
  if (dead !== undefined) {
    if (Date.now() < dead) {
      return Promise.resolve({ payloads: new Map(), portalMissing: true });
    }
    deadUntil.delete(portalProjectId); // TTL expired — allow one probe
  }

  const fresh = lastResult.get(portalProjectId);
  if (fresh && Date.now() - fresh.at < FRESH_TTL_MS) {
    return Promise.resolve(fresh.result);
  }

  const pending = inFlight.get(portalProjectId);
  if (pending) return pending;

  const request = requestMonolithData(portalProjectId)
    .then(({ result, succeeded }) => {
      if (result.portalMissing) {
        deadUntil.set(portalProjectId, Date.now() + DEAD_LINK_TTL_MS);
      } else if (succeeded) {
        // Only a real HTTP 200 stamps the fresh window — a swallowed timeout /
        // 5xx returns an empty map that must NOT masquerade as fresh data.
        lastResult.set(portalProjectId, { at: Date.now(), result });
      }
      return result;
    })
    .finally(() => {
      inFlight.delete(portalProjectId);
    });

  inFlight.set(portalProjectId, request);
  return request;
}

/** The raw, unguarded HTTP request. */
async function requestMonolithData(
  portalProjectId: string
): Promise<{ result: MonolithFetchResult; succeeded: boolean }> {
  const payloads = new Map<string, MonolithPayload>();

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
      return {
        result: { payloads, portalMissing: response.status === 404 },
        succeeded: false,
      };
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

    return { result: { payloads, portalMissing: false }, succeeded: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[MonolithFetch] Timeout — Portal may be sleeping');
    } else {
      console.warn('[MonolithFetch] Error:', error instanceof Error ? error.message : error);
    }
    return { result: { payloads, portalMissing: false }, succeeded: false };
  }
}
