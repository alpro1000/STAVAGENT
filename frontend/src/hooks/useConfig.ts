/**
 * useConfig hook - Manage project configuration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { ProjectConfig } from '@monolit/shared';

export function useConfig() {
  const { setDaysPerMonth } = useAppContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      return await configAPI.get();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes - reduced API load
    refetchOnMount: false, // CRITICAL: Never refetch on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when reconnecting
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 30 * 60 * 1000 // Keep in cache for 30 minutes before garbage collection
  });

  // Update context AFTER query succeeds, not inside queryFn
  if (query.data) {
    setDaysPerMonth(query.data.days_per_month_mode);
  }

  const updateMutation = useMutation({
    mutationFn: async (config: Partial<ProjectConfig>) => {
      return await configAPI.update(config);
    },
    onSuccess: (data) => {
      if (data.config?.days_per_month_mode) {
        setDaysPerMonth(data.config.days_per_month_mode);
      }
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    }
  });

  return {
    ...query,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  };
}
