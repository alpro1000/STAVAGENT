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

  // Note: bridgeId may be null initially, before user selects a bridge
  // This is normal and not an error condition

  const query = useQuery({
    queryKey: ['positions', bridgeId, showOnlyRFI],
    queryFn: async () => {
      if (!bridgeId) {
        return null;
      }

      return await positionsAPI.getForBridge(bridgeId, !showOnlyRFI);
    },
    enabled: !!bridgeId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes - reduced API load
    refetchOnMount: false, // Don't refetch when component remounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    // refetchOnReconnect defaults to true - important for recovering from network issues
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 30 * 60 * 1000 // Keep in cache for 30 minutes before garbage collection
  });

  // Sync context with query data
  useEffect(() => {
    if (query.data) {
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
        throw new Error(error);
      }

      const result = await positionsAPI.update(bridgeId, updates);
      return result;
    },
    onSuccess: (data) => {
      if (!bridgeId) return;

      // Update context immediately
      setPositions(data.positions);
      setHeaderKPI(data.header_kpi);

      // Invalidate cache to refetch if needed
      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId, showOnlyRFI] });
    },
    onError: (_error: any) => {
      // Error handling - intentionally unused for now
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await positionsAPI.delete(id);
    },
    onSuccess: () => {
      if (!bridgeId) return;

      queryClient.invalidateQueries({ queryKey: ['positions', bridgeId] });
    },
    onError: (_error: any) => {
      // Error handling - intentionally unused for now
    }
  });

  return {
    ...query,
    updatePositions: updateMutation.mutate,
    deletePosition: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending
  };
}
