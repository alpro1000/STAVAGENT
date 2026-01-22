/**
 * useBridges hook - Fetch and manage bridges
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bridgesAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';

export function useBridges() {
  const { setBridges } = useAppContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bridges'],
    queryFn: async () => {
      return await bridgesAPI.getAll();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: true, // Fetch on mount if data is stale (ensures initial load)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    // refetchOnReconnect defaults to true - important for recovering from network issues
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 30 * 60 * 1000 // Keep in cache for 30 minutes before garbage collection
  });

  // Update context when query.data changes
  // Use useEffect to prevent infinite render loops
  // Server data is source of truth - always update from API response
  useEffect(() => {
    if (query.data) {
      setBridges(query.data);
    }
  }, [query.data, setBridges]);

  // Mutation: Create new bridge (with auto-refetch on success)
  const createMutation = useMutation({
    mutationFn: (params: any) => {
      return bridgesAPI.create(params);
    },
    onSuccess: () => {
      // Invalidate and refetch bridges list immediately after creation
      // This ensures the new bridge appears in the sidebar right away
      queryClient.invalidateQueries({ queryKey: ['bridges'] });
      queryClient.refetchQueries({ queryKey: ['bridges'] });
    }
  });

  // Mutation: Update bridge status
  const statusMutation = useMutation({
    mutationFn: ({ bridgeId, status }: { bridgeId: string; status: 'active' | 'completed' | 'archived' }) => {
      return bridgesAPI.updateStatus(bridgeId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridges'] });
    }
  });

  // Mutation: Delete bridge
  const deleteMutation = useMutation({
    mutationFn: (bridgeId: string) => {
      return bridgesAPI.delete(bridgeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridges'] });
    }
  });

  // Mutation: Complete bridge (with final snapshot)
  const completeMutation = useMutation({
    mutationFn: (params: { bridgeId: string; created_by?: string; description?: string }) => {
      return bridgesAPI.complete(params.bridgeId, { created_by: params.created_by, description: params.description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridges'] });
    }
  });

  // Mutation: Delete entire project (all bridges with same project_name)
  const deleteProjectMutation = useMutation({
    mutationFn: (projectName: string) => {
      return bridgesAPI.deleteByProjectName(projectName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridges'] });
    }
  });

  return {
    ...query,
    createBridge: async (params: any) => {
      return await createMutation.mutateAsync(params);
    },
    updateBridgeStatus: async (bridgeId: string, status: 'active' | 'completed' | 'archived') => {
      await statusMutation.mutateAsync({ bridgeId, status });
    },
    completeBridge: async (bridgeId: string, params?: { created_by?: string; description?: string }) => {
      return await completeMutation.mutateAsync({ bridgeId, ...params });
    },
    deleteBridge: async (bridgeId: string) => {
      await deleteMutation.mutateAsync(bridgeId);
    },
    deleteProject: async (projectName: string) => {
      return await deleteProjectMutation.mutateAsync(projectName);
    },
    isLoading: query.isLoading || createMutation.isPending || statusMutation.isPending || deleteMutation.isPending || completeMutation.isPending || deleteProjectMutation.isPending
  };
}
