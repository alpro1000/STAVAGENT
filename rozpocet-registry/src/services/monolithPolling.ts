/**
 * Monolit Auto-Polling Service
 *
 * Periodically fetches MonolithPayload from Portal for active project.
 * Detects changes and computes comparison/conflict data.
 */

import { fetchMonolithData } from './portalMonolithFetch';
import type { MonolithPayload, ParsedItem } from '../types';

const POLL_INTERVAL_MS = 30_000;  // 30 seconds
const POLL_INTERVAL_BACKGROUND_MS = 120_000;  // 2 minutes when tab hidden

export interface ComparisonItem {
  itemId: string;
  kod: string;
  popis: string;
  registryUnitPrice: number | null;
  registryTotal: number | null;
  monolithUnitCost: number | null;  // kros_unit_czk
  monolithTotal: number | null;     // kros_total_czk or cost_czk
  monolithDays: number;
  monolithCrew: number;
  variancePct: number | null;       // (registry - monolit) / monolit * 100
  severity: 'match' | 'info' | 'warning' | 'conflict';
  monolithPayload: MonolithPayload;
}

export interface PollState {
  active: boolean;
  projectId: string | null;
  portalProjectId: string | null;
  lastFetch: Date | null;
  itemsWithMonolit: number;
  comparisons: ComparisonItem[];
  conflictCount: number;
}

// Severity thresholds for variance:
// |variance| < 5% = match, < 15% = info, < 30% = warning, >= 30% = conflict

let pollInterval: ReturnType<typeof setInterval> | null = null;
let currentState: PollState = {
  active: false,
  projectId: null,
  portalProjectId: null,
  lastFetch: null,
  itemsWithMonolit: 0,
  comparisons: [],
  conflictCount: 0,
};
let onUpdateCallback: ((state: PollState) => void) | null = null;

// Stored references for visibility change handler
let storedPortalProjectId: string | null = null;
let storedItems: ParsedItem[] = [];

export function startPolling(
  projectId: string,
  portalProjectId: string,
  items: ParsedItem[],
  onUpdate: (state: PollState) => void,
): void {
  stopPolling();
  onUpdateCallback = onUpdate;
  storedPortalProjectId = portalProjectId;
  storedItems = items;
  currentState = {
    active: true,
    projectId,
    portalProjectId,
    lastFetch: null,
    itemsWithMonolit: 0,
    comparisons: [],
    conflictCount: 0,
  };

  // First fetch immediately
  doPoll(portalProjectId, items);

  // Then poll at interval
  const ms = document.hidden ? POLL_INTERVAL_BACKGROUND_MS : POLL_INTERVAL_MS;
  pollInterval = setInterval(() => doPoll(portalProjectId, items), ms);

  // Adjust when tab visibility changes
  document.addEventListener('visibilitychange', handleVisibility);
}

export function stopPolling(): void {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  currentState = { ...currentState, active: false };
  document.removeEventListener('visibilitychange', handleVisibility);
  onUpdateCallback = null;
  storedPortalProjectId = null;
  storedItems = [];
}

export function refreshNow(portalProjectId: string, items: ParsedItem[]): void {
  storedPortalProjectId = portalProjectId;
  storedItems = items;
  doPoll(portalProjectId, items);
}

export function getPollingState(): PollState {
  return currentState;
}

function handleVisibility(): void {
  if (currentState.active && storedPortalProjectId) {
    // Restart interval with appropriate timing based on tab visibility
    if (pollInterval) clearInterval(pollInterval);
    const ms = document.hidden ? POLL_INTERVAL_BACKGROUND_MS : POLL_INTERVAL_MS;
    pollInterval = setInterval(
      () => {
        if (storedPortalProjectId) {
          doPoll(storedPortalProjectId, storedItems);
        }
      },
      ms,
    );
  }
}

async function doPoll(portalProjectId: string, items: ParsedItem[]): Promise<void> {
  try {
    const monolithMap = await fetchMonolithData(portalProjectId);
    if (monolithMap.size === 0) return;

    const comparisons: ComparisonItem[] = [];

    for (const item of items) {
      if (!item.position_instance_id) continue;
      const mp = monolithMap.get(item.position_instance_id);
      if (!mp) continue;

      const monolithUnit = mp.kros_unit_czk ?? mp.unit_cost_on_m3 ?? null;
      const monolithTotal = mp.kros_total_czk ?? mp.cost_czk ?? null;
      const registryUnit = item.cenaJednotkova;
      const registryTotal = item.cenaCelkem;

      let variancePct: number | null = null;
      if (monolithTotal && registryTotal && monolithTotal > 0) {
        variancePct = ((registryTotal - monolithTotal) / monolithTotal) * 100;
      }

      let severity: ComparisonItem['severity'] = 'match';
      if (variancePct !== null) {
        const abs = Math.abs(variancePct);
        if (abs >= 30) severity = 'conflict';
        else if (abs >= 15) severity = 'warning';
        else if (abs >= 5) severity = 'info';
      }

      comparisons.push({
        itemId: item.id,
        kod: item.kod,
        popis: item.popis,
        registryUnitPrice: registryUnit,
        registryTotal: registryTotal,
        monolithUnitCost: monolithUnit,
        monolithTotal: monolithTotal,
        monolithDays: mp.days,
        monolithCrew: mp.crew_size,
        variancePct,
        severity,
        monolithPayload: mp,
      });
    }

    currentState = {
      ...currentState,
      lastFetch: new Date(),
      itemsWithMonolit: comparisons.length,
      comparisons,
      conflictCount: comparisons.filter(
        (c) => c.severity === 'conflict' || c.severity === 'warning',
      ).length,
    };

    onUpdateCallback?.(currentState);
  } catch {
    // Silent fail — polling is best-effort
  }
}
