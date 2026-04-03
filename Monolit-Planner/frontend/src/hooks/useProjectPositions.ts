/**
 * useProjectPositions — React Query hook for positions of a selected project.
 *
 * Data lives only in React Query. No duplicate context sync.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionsAPI } from '../services/api';
import { useUI } from '../context/UIContext';
import type { Position, HeaderKPI } from '@stavagent/monolit-shared';

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
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Position>[]) => {
      if (!selectedProjectId) throw new Error('No project selected');
      return positionsAPI.update(selectedProjectId, updates);
    },
    onSuccess: (data) => {
      // Update cache directly with fresh data from server
      qc.setQueryData(positionsKey(selectedProjectId, showOnlyRFI), data);
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
