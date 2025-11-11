/**
 * usePositions hook - Fetch and manage positions for a bridge
 *
 * IMPORTANT: Properly handles bridgeId through closure to avoid race conditions
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionsAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Position } from '@monolit/shared';

export function usePositions(bridgeId: string | null) {
  const { setPositions, setHeaderKPI, showOnlyRFI } = useAppContext();
  const queryClient = useQueryClient();

  // CRITICAL: Ensure bridgeId is available
  if (!bridgeId) {
    console.warn('[usePositions] No bridgeId provided');
  }

  const query = useQuery({
    queryKey: ['positions', bridgeId, showOnlyRFI],
    queryFn: async () => {
      if (!bridgeId) {
        console.warn('[usePositions] queryFn: bridgeId is null, returning null');
        return null;
      }

      console.log(`[usePositions] Fetching positions for bridge: "${bridgeId}"`);
      return await positionsAPI.getForBridge(bridgeId, !showOnlyRFI);
    },
    enabled: !!bridgeId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000
  });

  // Sync context with query data
  useEffect(() => {
    if (query.data) {
      console.log(`[usePositions] Syncing ${query.data.positions.length} positions to context`);
      setPositions(query.data.positions);
      setHeaderKPI(query.data.header_kpi);
    }
  }, [query.data, setPositions, setHeaderKPI]);

  // Update mutation - receives bridgeId as parameter to avoid closure issues
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Position>[]) => {
      // Use the bridgeId from closure (guaranteed fresh because hook is called with it)
      if (!bridgeId) {
        const error = 'Bridge ID is required for updates';
        console.error(`❌ [usePositions] updateMutation: ${error}`);
        throw new Error(error);
      }

      console.log(`🔄 [usePositions] Sending ${updates.length} updates to backend`);
      console.log(`   Bridge: "${bridgeId}"`);
      console.log(`   Updates:`, updates);

      const result = await positionsAPI.update(bridgeId, updates);

      console.log(`✅ [usePositions] Update response received:`, result);
      return result;
    },
    onSuccess: (data) => {
      if (!bridgeId) return;

      console.log(`✅ [usePositions] Update successful, syncing ${data.positions.length} positions`);

      // Update context immediately
      setPositions(data.positions);
      setHeaderKPI(data.header_kpi);

      // Invalidate cache to refetch if needed
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId, showOnlyRFI] });
      console.log(`🔄 [usePositions] Invalidated query cache for bridge: "${bridgeId}"`);
    },
    onError: (error: any) => {
      console.error(`❌ [usePositions] Update failed:`, error.message || error);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log(`🗑️ [usePositions] Deleting position: ${id}`);
      return await positionsAPI.delete(id);
    },
    onSuccess: () => {
      if (!bridgeId) return;

      console.log(`✅ [usePositions] Position deleted, invalidating cache`);
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId] });
    },
    onError: (error: any) => {
      console.error(`❌ [usePositions] Delete failed:`, error.message || error);
    }
  });

  return {
    ...query,
    updatePositions: updateMutation.mutate,
    deletePosition: deleteMutation.mutate,
    isUpdating: updateMutation.isPending
  };
}
