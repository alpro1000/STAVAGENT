/**
 * useProjectPositions — React Query hook for positions of a selected project.
 *
 * Data lives only in React Query. No duplicate context sync.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { positionsAPI, API_URL } from '../services/api';
import { useUI } from '../context/UIContext';
import type { Position, HeaderKPI } from '@stavagent/monolit-shared';

/**
 * Fire-and-forget TOV sync to Registry for positions that have
 * position_instance_id (linked to Portal). Called after Aplikovat.
 */
function syncTOVToRegistry(positions: Position[]) {
  for (const pos of positions) {
    if (!pos.id || !pos.position_instance_id) continue;
    // Only sync beton positions that have calculated data
    if (!pos.kros_total_czk && !pos.labor_hours) continue;
    // Fire-and-forget — don't await, don't block UI
    axios.post(`${API_URL}/api/export-to-registry/position/${pos.id}/tov`)
      .catch(err => {
        console.warn(`[TOV sync] Failed for position ${pos.id}:`, err.message);
      });
  }
}

/**
 * Fields whose change has no effect on the TOV (work breakdown / labour
 * costs) downstream of Registry. Updates limited to these fields do NOT
 * need a TOV re-sync — most importantly, toggling `metadata.is_monolith_override`
 * should not spam Registry with N×404s for every linked beton position.
 */
const TOV_IRRELEVANT_FIELDS = new Set(['metadata', 'position_instance_id']);

function shouldSyncTOV(updates: Partial<Position>[]): boolean {
  for (const u of updates) {
    for (const key of Object.keys(u)) {
      if (key === 'id') continue;
      if (!TOV_IRRELEVANT_FIELDS.has(key)) return true;
    }
  }
  return false;
}

function positionsKey(projectId: string | null, onlyRFI: boolean) {
  return ['positions', projectId, onlyRFI] as const;
}

export function useProjectPositions() {
  const { selectedProjectId, showOnlyRFI } = useUI();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: positionsKey(selectedProjectId, showOnlyRFI),
    queryFn: () => {
      if (!selectedProjectId) return null;
      return positionsAPI.getForBridge(selectedProjectId, !showOnlyRFI);
    },
    enabled: !!selectedProjectId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: 'always', // Always refetch when component remounts (e.g. returning from /planner after Aplikovat)
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Position>[]) => {
      if (!selectedProjectId) throw new Error('No project selected');
      return positionsAPI.update(selectedProjectId, updates);
    },
    onSuccess: (data, variables) => {
      // Update cache directly with fresh data from server
      qc.setQueryData(positionsKey(selectedProjectId, showOnlyRFI), data);

      // Auto-sync TOV to Registry only when the update actually changes
      // something Registry cares about (qty, days, wages, …). Metadata-only
      // updates such as the "Není monolit" toggle would otherwise fire one
      // POST per linked position and 404-spam the console.
      if (!data?.positions || !variables?.length) return;
      if (!shouldSyncTOV(variables)) return;
      const updatedIds = new Set(variables.map(u => u.id).filter(Boolean));
      const changed = data.positions.filter((p: Position) => p.id && updatedIds.has(p.id));
      if (changed.length) syncTOVToRegistry(changed);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => positionsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
    },
  });

  const positions: Position[] = query.data?.positions ?? [];
  const headerKPI: HeaderKPI | null = query.data?.header_kpi ?? null;
  const rfiSummary = query.data?.rfi_summary ?? { count: 0, issues: [] };

  return {
    positions,
    headerKPI,
    rfiSummary,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    updatePositions: updateMutation.mutateAsync,
    deletePosition: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
