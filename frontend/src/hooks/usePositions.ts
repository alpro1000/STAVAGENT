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

      const result = await positionsAPI.getForBridge(bridgeId, !showOnlyRFI);
      setPositions(result.positions);
      setHeaderKPI(result.header_kpi);

      return result;
    },
    enabled: !!bridgeId,
    refetchOnMount: true
  });

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
