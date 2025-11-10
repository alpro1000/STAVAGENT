/**
 * usePositions hook - Fetch and manage positions for a bridge
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionsAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Position } from '@monolit/shared';

export function usePositions(bridgeId: string | null) {
  const { setPositions, setHeaderKPI, showOnlyRFI } = useAppContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['positions', bridgeId, showOnlyRFI],
    queryFn: async () => {
      if (!bridgeId) return null;

      return await positionsAPI.getForBridge(bridgeId, !showOnlyRFI);
    },
    enabled: !!bridgeId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - no refetch unless stale
    refetchOnMount: false, // CRITICAL: Never refetch on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    gcTime: 10 * 60 * 1000 // Keep in cache for 10 minutes before garbage collection
  });

  // FIX: Use useEffect to sync context with query data (prevents race condition)
  useEffect(() => {
    if (query.data) {
      setPositions(query.data.positions);
      setHeaderKPI(query.data.header_kpi);
    }
  }, [query.data, setPositions, setHeaderKPI]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Position>[]) => {
      if (!bridgeId) throw new Error('No bridge selected');
      console.log(`🔄 updateMutation: sending ${updates.length} updates to backend`);
      console.log(`   Updates: ${JSON.stringify(updates)}`);
      const result = await positionsAPI.update(bridgeId, updates);
      console.log(`✅ updateMutation: response received`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`✅ updateMutation.onSuccess: updating context with ${data.positions.length} positions`);
      console.log(`   Header KPI:`, data.header_kpi);
      setPositions(data.positions);
      setHeaderKPI(data.header_kpi);
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId, showOnlyRFI] });
      console.log(`✅ updateMutation.onSuccess: invalidated query cache`);
    },
    onError: (error) => {
      console.error(`❌ updateMutation.onError:`, error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await positionsAPI.delete(id);
    },
    onSuccess: () => {
      // Invalidate all positions queries for this bridge (both RFI filters)
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
