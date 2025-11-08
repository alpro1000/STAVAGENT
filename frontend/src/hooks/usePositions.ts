/**
 * usePositions hook - Fetch and manage positions for a bridge
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionsAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Position } from '@monolit/shared';

export function usePositions(bridgeId: string | null) {
  const { setPositions, setHeaderKPI, showOnlyRFI } = useAppContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['positions', bridgeId],
    queryFn: async () => {
      if (!bridgeId) return null;

      return await positionsAPI.getForBridge(bridgeId, !showOnlyRFI);
    },
    enabled: !!bridgeId,
    refetchOnMount: true
  });

  // Update context AFTER query succeeds, not inside queryFn
  // This prevents setState race conditions
  if (query.data) {
    setPositions(query.data.positions);
    setHeaderKPI(query.data.header_kpi);
  }

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Position>[]) => {
      if (!bridgeId) throw new Error('No bridge selected');
      return await positionsAPI.update(bridgeId, updates);
    },
    onSuccess: (data) => {
      setPositions(data.positions);
      setHeaderKPI(data.header_kpi);
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await positionsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId] });
    }
  });

  return {
    ...query,
    updatePositions: updateMutation.mutate,
    deletePosition: deleteMutation.mutate,
    isUpdating: updateMutation.isPending
  };
}
